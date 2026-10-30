// Remembers how this browser last signed in, so the login page can mark that
// option "last used". Only the method is stored — never the email/username
// (school computers are shared). Storage can be blocked, hence the try/catch.

export type LoginMethod = "password" | "google";

const KEY = "edify:lastLogin";

export function rememberLoginMethod(method: LoginMethod) {
  try {
    localStorage.setItem(KEY, method);
  } catch {}
}

export function lastLoginMethod(): LoginMethod | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "password" || v === "google" ? v : null;
  } catch {
    return null;
  }
}
