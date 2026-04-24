import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
type HotelSearchDoc = {
  name?: string;
  location?: string;
  ratingAvg?: number;
  source?: "manual" | "api" | "hybrid";
  currency?: string;
  images?: string[];
};

const schema = z.object({
  destination: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guests: z.number().int().min(1),
});

export const searchHotels = onCall(async (request) => {
  const input = schema.parse(request.data);
  const hotelsSnapshot = await db.collection("hotels").where("status", "==", "active").limit(100).get();

  const matchedHotels = hotelsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as HotelSearchDoc) }))
    .filter((hotel) =>
      String(hotel.location ?? "")
        .toLowerCase()
        .includes(input.destination.toLowerCase()),
    );

  const items = await Promise.all(
    matchedHotels.map(async (hotel) => {
      const roomsSnapshot = await db
        .collection("rooms")
        .where("hotelId", "==", hotel.id)
        .where("isActive", "==", true)
        .limit(10)
        .get();

      const prices = roomsSnapshot.docs.map((room) => Number(room.data().basePrice ?? 0)).filter((price) => price > 0);
      const cheapestPrice = prices.length > 0 ? Math.min(...prices) : null;

      return {
        id: hotel.id,
        name: String(hotel.name ?? ""),
        location: String(hotel.location ?? ""),
        ratingAvg: hotel.ratingAvg ? Number(hotel.ratingAvg) : null,
        source: (hotel.source as "manual" | "api" | "hybrid" | undefined) ?? "manual",
        cheapestPrice,
        currency: String(hotel.currency ?? "USD"),
        imageUrl: Array.isArray(hotel.images) && hotel.images.length > 0 ? String(hotel.images[0]) : null,
      };
    }),
  );

  return { items };
});
