import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/rbac.js";

const hotelSchema = z.object({
  hotelId: z.string().optional(),
  name: z.string().min(2),
  location: z.string().min(2),
  description: z.string().min(2),
  amenities: z.array(z.string()).default([]),
  source: z.enum(["manual", "api", "hybrid"]).default("manual"),
  apiProviderId: z.string().nullable().optional(),
  status: z.enum(["active", "draft", "archived"]).default("draft"),
});

export const upsertHotel = onCall(async (request) => {
  const uid = requireAuth(request);
  requireRole(request, ["admin", "hotel_manager", "editor"]);
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
    await db.collection("hotels").doc(input.hotelId).set(payload, { merge: true });
    return { hotelId: input.hotelId };
  }

  const doc = await db.collection("hotels").add({ ...payload, createdAt: new Date().toISOString() });
  return { hotelId: doc.id };
});

export const deleteHotel = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "hotel_manager"]);
  const input = z.object({ hotelId: z.string().min(1) }).parse(request.data);

  await db.collection("hotels").doc(input.hotelId).delete();
  return { success: true };
});

export const listHotels = onCall(async (request) => {
  requireAuth(request);
  requireRole(request, ["admin", "hotel_manager", "api_manager", "editor", "viewer"]);

  const snapshot = await db.collection("hotels").limit(200).get();
  return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});
