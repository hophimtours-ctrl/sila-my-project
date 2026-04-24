import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth } from "../lib/rbac.js";
import { calculateNights, normalizeDateRange } from "../lib/utils.js";

const createBookingSchema = z.object({
  hotelId: z.string().min(1),
  roomId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guests: z.number().int().min(1),
});

export const createBooking = onCall(async (request) => {
  const uid = requireAuth(request);
  const input = createBookingSchema.parse(request.data);
  const { start, end } = normalizeDateRange(input.checkIn, input.checkOut);

  const roomSnapshot = await db.collection("rooms").doc(input.roomId).get();
  if (!roomSnapshot.exists) {
    throw new Error("Room not found");
  }

  const room = roomSnapshot.data() ?? {};
  const basePrice = Number(room.basePrice ?? 0);
  const nights = calculateNights(start, end);
  const totalPrice = basePrice * nights;

  const bookingDoc = await db.collection("bookings").add({
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

export const cancelBooking = onCall(async (request) => {
  const uid = requireAuth(request);
  const input = z.object({ bookingId: z.string().min(1) }).parse(request.data);
  const bookingRef = db.collection("bookings").doc(input.bookingId);
  const bookingSnapshot = await bookingRef.get();

  if (!bookingSnapshot.exists) {
    throw new Error("Booking not found");
  }

  const booking = bookingSnapshot.data() ?? {};
  if (booking.userId !== uid) {
    throw new Error("Booking does not belong to current user");
  }

  await bookingRef.set(
    {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { success: true };
});

export const listMyBookings = onCall(async (request) => {
  const uid = requireAuth(request);
  const snapshot = await db.collection("bookings").where("userId", "==", uid).limit(100).get();
  return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});
