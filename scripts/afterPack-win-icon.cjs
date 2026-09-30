const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exe = path.join(context.appOutDir, exeName);
  const ico = path.join(context.packager.projectDir, "build", "icon.ico");
  const rcedit = path.join(
    context.packager.projectDir,
    "node_modules",
    "rcedit",
    "bin",
    "rcedit-x64.exe",
  );

  if (!fs.existsSync(exe) || !fs.existsSync(ico) || !fs.existsSync(rcedit)) {
    return;
  }

  execFileSync(rcedit, [exe, "--set-icon", ico]);
  fs.copyFileSync(ico, path.join(context.appOutDir, "icon.ico"));
};
