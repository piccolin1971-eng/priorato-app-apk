const UNLOCK_KEY = "priorato-unlocked";

export function isSessionUnlocked(): boolean {
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function setSessionUnlocked(unlocked: boolean): void {
  if (unlocked) sessionStorage.setItem(UNLOCK_KEY, "1");
  else sessionStorage.removeItem(UNLOCK_KEY);
}

export function checkAppPassword(input: string, stored: string): boolean {
  return input === stored;
}
