import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/rbac.js";

const roomSchema = z.object({
  roomId: z.string().optional(),
  hotelId: z.string().min(1),
  roomType: z.string().min(1),
  capacity: z.number().int().min(1),
  basePrice: z.number().positive(),
  currency: z.string().default("USD"),
  source: z.enum(["manual", "api", "hybrid"]).default("manual"),
  apiRoomId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const upsertRoom = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "hotel_manager"]);
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
    await db.collection("rooms").doc(input.roomId).set(payload, { merge: true });
    return { roomId: input.roomId };
  }

  const doc = await db.collection("rooms").add({ ...payload, createdAt: new Date().toISOString() });
  return { roomId: doc.id };
});

export const deleteRoom = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "hotel_manager"]);
  const input = z.object({ roomId: z.string().min(1) }).parse(request.data);
  await db.collection("rooms").doc(input.roomId).delete();
  return { success: true };
});

export const listRoomsByHotel = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "hotel_manager", "viewer", "api_manager", "editor"]);
  const input = z.object({ hotelId: z.string().min(1) }).parse(request.data);

  const snapshot = await db.collection("rooms").where("hotelId", "==", input.hotelId).limit(200).get();
  return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});
