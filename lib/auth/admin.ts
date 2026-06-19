/**
 * Admin gate for the internal dashboard. DENY-BY-DEFAULT: if neither env var is
 * set, no one is an admin (so shipping /admin to prod before configuring it is
 * safe). Set ADMIN_USER_IDS (comma-separated Clerk user IDs) and/or ADMIN_EMAILS
 * in the environment to grant access.
 */
export function isAdminUser(userId?: string | null, email?: string | null): boolean {
  const ids = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const emails = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (userId && ids.includes(userId)) return true;
  if (email && emails.includes(email.toLowerCase())) return true;
  return false;
}
