import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

export type UserRole =
  | "admin"
  | "hotel_manager"
  | "api_manager"
  | "editor"
  | "viewer"
  | "customer";

export function requireAuth(request: CallableRequest<unknown>) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  return request.auth.uid;
}

export function requireRole(request: CallableRequest<unknown>, roles: UserRole[]) {
  const role = (request.auth?.token?.role as UserRole | undefined) ?? "customer";
  if (!roles.includes(role)) {
    throw new HttpsError("permission-denied", "Insufficient permissions");
  }

  return role;
}
