"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchHotels = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_js_1 = require("../lib/firebase.js");
const schema = zod_1.z.object({
    destination: zod_1.z.string().min(1),
    checkIn: zod_1.z.string().min(1),
    checkOut: zod_1.z.string().min(1),
    guests: zod_1.z.number().int().min(1),
});
exports.searchHotels = (0, https_1.onCall)(async (request) => {
    const input = schema.parse(request.data);
    const hotelsSnapshot = await firebase_js_1.db.collection("hotels").where("status", "==", "active").limit(100).get();
    const matchedHotels = hotelsSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((hotel) => String(hotel.location ?? "")
        .toLowerCase()
        .includes(input.destination.toLowerCase()));
    const items = await Promise.all(matchedHotels.map(async (hotel) => {
        const roomsSnapshot = await firebase_js_1.db
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
            source: hotel.source ?? "manual",
            cheapestPrice,
            currency: String(hotel.currency ?? "USD"),
            imageUrl: Array.isArray(hotel.images) && hotel.images.length > 0 ? String(hotel.images[0]) : null,
        };
    }));
    return { items };
});
