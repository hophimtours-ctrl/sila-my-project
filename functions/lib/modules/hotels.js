"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listHotels = exports.deleteHotel = exports.upsertHotel = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_js_1 = require("../lib/firebase.js");
const rbac_js_1 = require("../lib/rbac.js");
const hotelSchema = zod_1.z.object({
    hotelId: zod_1.z.string().optional(),
    name: zod_1.z.string().min(2),
    location: zod_1.z.string().min(2),
    description: zod_1.z.string().min(2),
    amenities: zod_1.z.array(zod_1.z.string()).default([]),
    source: zod_1.z.enum(["manual", "api", "hybrid"]).default("manual"),
    apiProviderId: zod_1.z.string().nullable().optional(),
    status: zod_1.z.enum(["active", "draft", "archived"]).default("draft"),
});
exports.upsertHotel = (0, https_1.onCall)(async (request) => {
    const uid = (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "hotel_manager", "editor"]);
    const input = hotelSchema.parse(request.data);
    const payload = {
        name: input.name,
        location: input.location,
        description: input.description,
        amenities: input.amenities,
        source: input.source,
        apiProviderId: input.apiProviderId ?? null,
        status: input.status,
        updatedAt: new Date().toISOString(),
        createdBy: uid,
    };
    if (input.hotelId) {
        await firebase_js_1.db.collection("hotels").doc(input.hotelId).set(payload, { merge: true });
        return { hotelId: input.hotelId };
    }
    const doc = await firebase_js_1.db.collection("hotels").add({ ...payload, createdAt: new Date().toISOString() });
    return { hotelId: doc.id };
});
exports.deleteHotel = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "hotel_manager"]);
    const input = zod_1.z.object({ hotelId: zod_1.z.string().min(1) }).parse(request.data);
    await firebase_js_1.db.collection("hotels").doc(input.hotelId).delete();
    return { success: true };
});
exports.listHotels = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "hotel_manager", "api_manager", "editor", "viewer"]);
    const snapshot = await firebase_js_1.db.collection("hotels").limit(200).get();
    return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});
