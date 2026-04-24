"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRoomsByHotel = exports.deleteRoom = exports.upsertRoom = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_js_1 = require("../lib/firebase.js");
const rbac_js_1 = require("../lib/rbac.js");
const roomSchema = zod_1.z.object({
    roomId: zod_1.z.string().optional(),
    hotelId: zod_1.z.string().min(1),
    roomType: zod_1.z.string().min(1),
    capacity: zod_1.z.number().int().min(1),
    basePrice: zod_1.z.number().positive(),
    currency: zod_1.z.string().default("USD"),
    source: zod_1.z.enum(["manual", "api", "hybrid"]).default("manual"),
    apiRoomId: zod_1.z.string().nullable().optional(),
    isActive: zod_1.z.boolean().default(true),
});
exports.upsertRoom = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "hotel_manager"]);
    const input = roomSchema.parse(request.data);
    const payload = {
        hotelId: input.hotelId,
        roomType: input.roomType,
        capacity: input.capacity,
        basePrice: input.basePrice,
        currency: input.currency,
        source: input.source,
        apiRoomId: input.apiRoomId ?? null,
        isActive: input.isActive,
        updatedAt: new Date().toISOString(),
    };
    if (input.roomId) {
        await firebase_js_1.db.collection("rooms").doc(input.roomId).set(payload, { merge: true });
        return { roomId: input.roomId };
    }
    const doc = await firebase_js_1.db.collection("rooms").add({ ...payload, createdAt: new Date().toISOString() });
    return { roomId: doc.id };
});
exports.deleteRoom = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "hotel_manager"]);
    const input = zod_1.z.object({ roomId: zod_1.z.string().min(1) }).parse(request.data);
    await firebase_js_1.db.collection("rooms").doc(input.roomId).delete();
    return { success: true };
});
exports.listRoomsByHotel = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "hotel_manager", "viewer", "api_manager", "editor"]);
    const input = zod_1.z.object({ hotelId: zod_1.z.string().min(1) }).parse(request.data);
    const snapshot = await firebase_js_1.db.collection("rooms").where("hotelId", "==", input.hotelId).limit(200).get();
    return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});
