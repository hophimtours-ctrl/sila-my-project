import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/rbac.js";

const providerSchema = z.object({
  providerId: z.string().optional(),
  name: z.string().min(2),
  endpoint: z.string().url(),
  enabled: z.boolean().default(true),
  syncIntervalMinutes: z.number().int().min(1).default(60),
});

export const upsertApiProvider = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "api_manager"]);
  const input = providerSchema.parse(request.data);

  const payload = {
    name: input.name,
    endpoint: input.endpoint,
    enabled: input.enabled,
    syncIntervalMinutes: input.syncIntervalMinutes,
    lastSyncAt: null,
    lastStatus: input.enabled ? "active" : "disabled",
    lastError: null,
    updatedAt: new Date().toISOString(),
  };

  if (input.providerId) {
    await db.collection("apiProviders").doc(input.providerId).set(payload, { merge: true });
    return { providerId: input.providerId };
  }

  const doc = await db.collection("apiProviders").add({ ...payload, createdAt: new Date().toISOString() });
  return { providerId: doc.id };
});

export const testApiProviderConnection = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "api_manager"]);
  const input = z.object({ providerId: z.string().min(1) }).parse(request.data);

  const providerSnapshot = await db.collection("apiProviders").doc(input.providerId).get();
  if (!providerSnapshot.exists) {
    throw new Error("Provider not found");
  }

  const provider = providerSnapshot.data() ?? {};
  let status: "active" | "error" = "active";
  let message = "Connection successful";

  try {
    const response = await fetch(String(provider.endpoint), { method: "GET" });
    if (!response.ok) {
      status = "error";
      message = `Provider responded with status ${response.status}`;
    }
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Unknown provider connection error";
  }

  await db.collection("apiLogs").add({
    providerId: input.providerId,
    level: status === "active" ? "info" : "error",
    action: "test-connection",
    message,
    createdAt: new Date().toISOString(),
  });

  await providerSnapshot.ref.set(
    {
      lastStatus: status,
      lastError: status === "error" ? message : null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { success: status === "active", message };
});

export const syncApiProvider = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "api_manager"]);
  const input = z.object({ providerId: z.string().min(1) }).parse(request.data);

  await db.collection("apiLogs").add({
    providerId: input.providerId,
    level: "info",
    action: "sync-provider",
    message: "Sync triggered",
    createdAt: new Date().toISOString(),
  });

  await db.collection("apiProviders").doc(input.providerId).set(
    {
      lastSyncAt: new Date().toISOString(),
      lastStatus: "active",
      lastError: null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { success: true, importedHotels: 0, importedRooms: 0 };
});
