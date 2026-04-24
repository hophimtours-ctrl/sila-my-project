import { onCall } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { z } from "zod";
import { requireAuth, requireRole } from "../lib/rbac.js";

export const createResetPasswordLink = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin"]);
  const input = z.object({ email: z.string().email() }).parse(request.data);

  const link = await getAuth().generatePasswordResetLink(input.email);
  return { link };
});
