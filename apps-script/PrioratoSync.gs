/**
 * Priorato — sync tra postazioni.
 *
 * 1. Imposta SYNC_PASSWORD qui sotto (stessa password anche nelle app).
 * 2. Distribuisci → Nuova distribuzione → App web
 *    - Esegui come: Me
 *    - Chi ha accesso: Chiunque
 * 3. Copia l’URL e incollalo in Impostazioni su ogni dispositivo.
 */

const SYNC_PASSWORD = "CAMBIA-QUESTA-PASSWORD";
const FOLDER_NAME = "Priorato Accoglienza";
const FILE_NAME = "priorato-dati.json";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || "{}");
    if (!body.password || body.password !== SYNC_PASSWORD) {
      return json_({ ok: false, error: "password" });
    }
    if (body.action === "pull") {
      return json_({ ok: true, payload: readPayload_() });
    }
    if (body.action === "push") {
      const incoming = body.payload;
      if (!incoming || !Array.isArray(incoming.stays)) {
        return json_({ ok: false, error: "payload" });
      }
      const current = readPayload_();
      const base = Number(body.baseRevision) || 0;
      const currentRev = current ? Number(current.serverRevision) || 0 : 0;
      if (!body.force && current && currentRev > 0 && currentRev !== base) {
        return json_({ ok: false, conflict: true, payload: current });
      }
      incoming.serverRevision = currentRev + 1;
      incoming.version = 1;
      writePayload_(incoming);
      return json_({ ok: true, payload: incoming });
    }
    return json_({ ok: false, error: "action" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

function getFile_() {
  const folder = getFolder_();
  const files = folder.getFilesByName(FILE_NAME);
  if (files.hasNext()) return files.next();
  return folder.createFile(FILE_NAME, "{}", MimeType.PLAIN_TEXT);
}

function readPayload_() {
  const raw = getFile_().getBlob().getDataAsString() || "{}";
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.stays)) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function writePayload_(payload) {
  getFile_().setContent(JSON.stringify(payload));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
