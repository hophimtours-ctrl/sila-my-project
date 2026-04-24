"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = exports.upsertUserRole = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_js_1 = require("../lib/firebase.js");
const rbac_js_1 = require("../lib/rbac.js");
const upsertUserRoleSchema = zod_1.z.object({
    uid: zod_1.z.string().min(1),
    role: zod_1.z.enum(["admin", "hotel_manager", "api_manager", "editor", "viewer", "customer"]),
    status: zod_1.z.enum(["active", "disabled"]).default("active"),
    permissions: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.upsertUserRole = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin"]);
    const input = upsertUserRoleSchema.parse(request.data);
    await firebase_js_1.db
        .collection("users")
        .doc(input.uid)
        .set({
        role: input.role,
        status: input.status,
        permissions: input.permissions,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { success: true };
});
exports.listUsers = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "viewer"]);
    const snapshot = await firebase_js_1.db.collection("users").limit(200).get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { users };
});
