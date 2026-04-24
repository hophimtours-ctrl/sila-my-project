import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth, requireRole, type UserRole } from "../lib/rbac.js";

const upsertUserRoleSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(["admin", "hotel_manager", "api_manager", "editor", "viewer", "customer"]),
  status: z.enum(["active", "disabled"]).default("active"),
  permissions: z.array(z.string()).default([]),
});

export const upsertUserRole = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin"]);

  const input = upsertUserRoleSchema.parse(request.data);
  await db
    .collection("users")
    .doc(input.uid)
    .set(
      {
        role: input.role,
        status: input.status,
        permissions: input.permissions,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  return { success: true };
});

export const listUsers = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "viewer"]);

  const snapshot = await db.collection("users").limit(200).get();
  const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() as { role?: UserRole } }));
  return { users };
});
