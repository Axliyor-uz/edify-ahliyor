/**
 * Where a signed-in user with a users/{uid} profile lands (docs/AUTH.md).
 * Shared by password login, Google sign-in, complete-profile and the signup
 * wizards so the four places can't drift apart again.
 *
 * director/accountant is only a redirect HINT — the /office layout re-checks
 * center_staff/{uid} and bounces anyone who painted this value onto their own
 * (client-writable) user doc (docs/OFFICE.md).
 */
export function roleHome(role: unknown): string {
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "manager") return "/manager/dashboard";
  if (role === "director" || role === "accountant") return "/office";
  return "/dashboard";
}
