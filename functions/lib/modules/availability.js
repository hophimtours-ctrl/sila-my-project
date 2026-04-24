"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAvailability = exports.upsertAvailability = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_js_1 = require("../lib/firebase.js");
const rbac_js_1 = require("../lib/rbac.js");
const upsertAvailabilitySchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1),
    hotelId: zod_1.z.string().min(1),
    date: zod_1.z.string().min(8),
    available: zod_1.z.boolean(),
    inventory: zod_1.z.number().int().min(0),
    price: zod_1.z.number().nonnegative(),
    updatedFrom: zod_1.z.enum(["manual", "api"]).default("manual"),
});
exports.upsertAvailability = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "hotel_manager", "api_manager"]);
    const input = upsertAvailabilitySchema.parse(request.data);
    const docId = `${input.roomId}_${input.date}`;
    await firebase_js_1.db.collection("roomAvailability").doc(docId).set({
        ...input,
        updatedAt: new Date().toISOString(),
    });
    return { success: true, id: docId };
});
exports.checkAvailability = (0, https_1.onCall)(async (request) => {
    const input = zod_1.z
        .object({
        roomId: zod_1.z.string().min(1),
        checkIn: zod_1.z.string().min(1),
        checkOut: zod_1.z.string().min(1),
    })
        .parse(request.data);
    const snapshot = await firebase_js_1.db
        .collection("roomAvailability")
        .where("roomId", "==", input.roomId)
        .where("date", ">=", input.checkIn)
        .where("date", "<", input.checkOut)
        .get();
    const days = snapshot.docs.map((doc) => doc.data());
    const isAvailable = days.every((day) => day.available === true && Number(day.inventory ?? 0) > 0);
    return { isAvailable, days };
});
