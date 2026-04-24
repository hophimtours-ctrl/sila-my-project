"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncApiProvider = exports.testApiProviderConnection = exports.upsertApiProvider = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_js_1 = require("../lib/firebase.js");
const rbac_js_1 = require("../lib/rbac.js");
const providerSchema = zod_1.z.object({
    providerId: zod_1.z.string().optional(),
    name: zod_1.z.string().min(2),
    endpoint: zod_1.z.string().url(),
    enabled: zod_1.z.boolean().default(true),
    syncIntervalMinutes: zod_1.z.number().int().min(1).default(60),
});
exports.upsertApiProvider = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "api_manager"]);
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
        await firebase_js_1.db.collection("apiProviders").doc(input.providerId).set(payload, { merge: true });
        return { providerId: input.providerId };
    }
    const doc = await firebase_js_1.db.collection("apiProviders").add({ ...payload, createdAt: new Date().toISOString() });
    return { providerId: doc.id };
});
exports.testApiProviderConnection = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "api_manager"]);
    const input = zod_1.z.object({ providerId: zod_1.z.string().min(1) }).parse(request.data);
    const providerSnapshot = await firebase_js_1.db.collection("apiProviders").doc(input.providerId).get();
    if (!providerSnapshot.exists) {
        throw new Error("Provider not found");
    }
    const provider = providerSnapshot.data() ?? {};
    let status = "active";
    let message = "Connection successful";
    try {
        const response = await fetch(String(provider.endpoint), { method: "GET" });
        if (!response.ok) {
            status = "error";
            message = `Provider responded with status ${response.status}`;
        }
    }
    catch (error) {
        status = "error";
        message = error instanceof Error ? error.message : "Unknown provider connection error";
    }
    await firebase_js_1.db.collection("apiLogs").add({
        providerId: input.providerId,
        level: status === "active" ? "info" : "error",
        action: "test-connection",
        message,
        createdAt: new Date().toISOString(),
    });
    await providerSnapshot.ref.set({
        lastStatus: status,
        lastError: status === "error" ? message : null,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { success: status === "active", message };
});
exports.syncApiProvider = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "api_manager"]);
    const input = zod_1.z.object({ providerId: zod_1.z.string().min(1) }).parse(request.data);
    await firebase_js_1.db.collection("apiLogs").add({
        providerId: input.providerId,
        level: "info",
        action: "sync-provider",
        message: "Sync triggered",
        createdAt: new Date().toISOString(),
    });
    await firebase_js_1.db.collection("apiProviders").doc(input.providerId).set({
        lastSyncAt: new Date().toISOString(),
        lastStatus: "active",
        lastError: null,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { success: true, importedHotels: 0, importedRooms: 0 };
});
