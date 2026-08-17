import type { AppUser, Permission, StaffProfile } from "@/types";

/**
 * UI-level permission gate. This ONLY controls what renders — it is not the
 * security boundary. The real enforcement lives in firestore.rules, which
 * independently re-checks role/permission on every read and write. Treat any
 * check in this file as "hide the button," never as "the operation is safe."
 */
export function hasPermission(
  staffProfile: StaffProfile | null,
  appUser: AppUser | null,
  permission: Permission
): boolean {
  if (appUser?.role === "admin") return true; // owner/admin bypasses granular checks
  if (appUser?.role !== "staff" || !staffProfile) return false;
  if (staffProfile.status !== "active") return false;
  return staffProfile.permissions.includes(permission);
}

export function isAdmin(appUser: AppUser | null): boolean {
  return appUser?.role === "admin";
}

export function isStaffOrAdmin(appUser: AppUser | null): boolean {
  return appUser?.role === "admin" || appUser?.role === "staff";
}
