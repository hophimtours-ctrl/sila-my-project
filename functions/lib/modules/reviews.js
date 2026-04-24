"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderateReview = exports.createReview = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_js_1 = require("../lib/firebase.js");
const rbac_js_1 = require("../lib/rbac.js");
exports.createReview = (0, https_1.onCall)(async (request) => {
    const uid = (0, rbac_js_1.requireAuth)(request);
    const input = zod_1.z
        .object({
        hotelId: zod_1.z.string().min(1),
        bookingId: zod_1.z.string().min(1),
        rating: zod_1.z.number().min(1).max(5),
        text: zod_1.z.string().min(2),
        images: zod_1.z.array(zod_1.z.string()).default([]),
    })
        .parse(request.data);
    const reviewDoc = await firebase_js_1.db.collection("reviews").add({
        ...input,
        userId: uid,
        verified: true,
        status: "pending",
        createdAt: new Date().toISOString(),
        moderatedBy: null,
        moderatedAt: null,
    });
    return { reviewId: reviewDoc.id };
});
exports.moderateReview = (0, https_1.onCall)(async (request) => {
    const adminUid = (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin", "editor"]);
    const input = zod_1.z
        .object({
        reviewId: zod_1.z.string().min(1),
        status: zod_1.z.enum(["approved", "rejected"]),
    })
        .parse(request.data);
    await firebase_js_1.db.collection("reviews").doc(input.reviewId).set({
        status: input.status,
        moderatedBy: adminUid,
        moderatedAt: new Date().toISOString(),
    }, { merge: true });
    return { success: true };
});
