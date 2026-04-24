import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/rbac.js";

const upsertAvailabilitySchema = z.object({
  roomId: z.string().min(1),
  hotelId: z.string().min(1),
  date: z.string().min(8),
  available: z.boolean(),
  inventory: z.number().int().min(0),
  price: z.number().nonnegative(),
  updatedFrom: z.enum(["manual", "api"]).default("manual"),
});

export const upsertAvailability = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "hotel_manager", "api_manager"]);
  const input = upsertAvailabilitySchema.parse(request.data);

  const docId = `${input.roomId}_${input.date}`;
  await db.collection("roomAvailability").doc(docId).set({
    ...input,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, id: docId };
});

export const checkAvailability = onCall(async (request) => {
  const input = z
    .object({
      roomId: z.string().min(1),
      checkIn: z.string().min(1),
      checkOut: z.string().min(1),
    })
    .parse(request.data);

  const snapshot = await db
    .collection("roomAvailability")
    .where("roomId", "==", input.roomId)
    .where("date", ">=", input.checkIn)
    .where("date", "<", input.checkOut)
    .get();

  const days = snapshot.docs.map((doc) => doc.data());
  const isAvailable = days.every((day) => day.available === true && Number(day.inventory ?? 0) > 0);
  return { isAvailable, days };
});
