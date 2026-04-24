"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMyBookings = exports.cancelBooking = exports.createBooking = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_js_1 = require("../lib/firebase.js");
const rbac_js_1 = require("../lib/rbac.js");
const utils_js_1 = require("../lib/utils.js");
const createBookingSchema = zod_1.z.object({
    hotelId: zod_1.z.string().min(1),
    roomId: zod_1.z.string().min(1),
    checkIn: zod_1.z.string().min(1),
    checkOut: zod_1.z.string().min(1),
    guests: zod_1.z.number().int().min(1),
});
exports.createBooking = (0, https_1.onCall)(async (request) => {
    const uid = (0, rbac_js_1.requireAuth)(request);
    const input = createBookingSchema.parse(request.data);
    const { start, end } = (0, utils_js_1.normalizeDateRange)(input.checkIn, input.checkOut);
    const roomSnapshot = await firebase_js_1.db.collection("rooms").doc(input.roomId).get();
    if (!roomSnapshot.exists) {
        throw new Error("Room not found");
    }
    const room = roomSnapshot.data() ?? {};
    const basePrice = Number(room.basePrice ?? 0);
    const nights = (0, utils_js_1.calculateNights)(start, end);
    const totalPrice = basePrice * nights;
    const bookingDoc = await firebase_js_1.db.collection("bookings").add({
        userId: uid,
        hotelId: input.hotelId,
        roomId: input.roomId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
        status: "pending",
        totalPrice,
        paymentStatus: "pending",
        paymentId: null,
        createdAt: new Date().toISOString(),
        cancelledAt: null,
        currency: String(room.currency ?? "USD"),
    });
    return {
        bookingId: bookingDoc.id,
        status: "pending",
        totalPrice,
        currency: String(room.currency ?? "USD"),
    };
});
exports.cancelBooking = (0, https_1.onCall)(async (request) => {
    const uid = (0, rbac_js_1.requireAuth)(request);
    const input = zod_1.z.object({ bookingId: zod_1.z.string().min(1) }).parse(request.data);
    const bookingRef = firebase_js_1.db.collection("bookings").doc(input.bookingId);
    const bookingSnapshot = await bookingRef.get();
    if (!bookingSnapshot.exists) {
        throw new Error("Booking not found");
    }
    const booking = bookingSnapshot.data() ?? {};
    if (booking.userId !== uid) {
        throw new Error("Booking does not belong to current user");
    }
    await bookingRef.set({
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
    }, { merge: true });
    return { success: true };
});
exports.listMyBookings = (0, https_1.onCall)(async (request) => {
    const uid = (0, rbac_js_1.requireAuth)(request);
    const snapshot = await firebase_js_1.db.collection("bookings").where("userId", "==", uid).limit(100).get();
    return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});
