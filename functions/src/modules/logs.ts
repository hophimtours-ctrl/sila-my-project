import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/rbac.js";

export const listApiLogs = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "api_manager", "viewer"]);

  const input = z
    .object({
      providerId: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    })
    .parse(request.data ?? {});

  let query = db.collection("apiLogs").orderBy("createdAt", "desc").limit(input.limit);
  if (input.providerId) {
    query = query.where("providerId", "==", input.providerId);
  }

  const snapshot = await query.get();
  return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});
