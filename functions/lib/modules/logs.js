"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listApiLogs = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_js_1 = require("../lib/firebase.js");
const rbac_js_1 = require("../lib/rbac.js");
exports.listApiLogs = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "api_manager", "viewer"]);
    const input = zod_1.z
        .object({
        providerId: zod_1.z.string().optional(),
        limit: zod_1.z.number().int().min(1).max(200).default(50),
    })
        .parse(request.data ?? {});
    let query = firebase_js_1.db.collection("apiLogs").orderBy("createdAt", "desc").limit(input.limit);
    if (input.providerId) {
        query = query.where("providerId", "==", input.providerId);
    }
    const snapshot = await query.get();
    return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});
