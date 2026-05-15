import {
  getMockPmsHotelById,
  listMockPmsHotels,
  resolveProvider,
  type MockPmsHotel,
} from "@/lib/mock-pms-engine";
import type { MockHotel } from "@/lib/mock-hotels";
function toMockHotelId(hotelId: string) {
  return `mock-hotel-${hotelId.toLowerCase()}`;
}
function toPmsHotelId(mockHotelId: string) {
  const normalized = mockHotelId.trim().toLowerCase();
  if (!normalized.startsWith("mock-hotel-")) {
    return null;
  }
  const suffix = normalized.slice("mock-hotel-".length).toUpperCase();
  if (!/^HTL-\d{4}$/.test(suffix)) {
    return null;
  }
  return suffix;
}
function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}
function mapPmsHotelToMockHotel(hotel: MockPmsHotel): MockHotel {
  const id = toMockHotelId(hotel.hotelId);
  const basePrice = Math.min(...hotel.roomTypes.map((room) => room.pricePerNight));
  const dealPrice = Math.max(100, Math.round(basePrice * 0.9));
  const facilities = hotel.amenities;
  const distanceHash = hashText(hotel.hotelId);
  const reviewCount = 90 + (distanceHash % 1600);
  const rating = Number((Math.min(4.9, hotel.starRating + 0.2 + (distanceHash % 6) / 10)).toFixed(1));
  const userScore = Number((Math.min(9.6, rating * 2)).toFixed(1));
  const hasFreeCancellation = hotel.roomTypes.some((room) =>
    room.cancellationPolicy.toLowerCase().includes("free cancellation"),
  );

  return {
    id,
    externalId: hotel.hotelId,
    slug: toSlug(hotel.name),
    name: hotel.name,
    location: `${hotel.address.city}, ${hotel.address.country}`,
    city: hotel.address.city,
    country: hotel.address.country,
    description: hotel.shortDescription || hotel.description,
    facilities,
    images: hotel.images,
    rating,
    stars: hotel.starRating,
    reviewCount,
    userScore,
    distanceFromCenterKm: Number((0.2 + (distanceHash % 72) / 10).toFixed(1)),
    hasFreeCancellation,
    isPopularChoice: hotel.starRating >= 4 || reviewCount > 700,
    basePrice,
    dealPrice,
    currency: "ILS",
    rooms: hotel.roomTypes.map((room) => ({
      id: `${id}-${room.roomTypeId.toLowerCase()}`,
      name: room.name,
      bedType: room.maxGuests >= 4 ? "2 Queen beds" : room.maxGuests === 3 ? "King bed + Sofa" : "Queen bed",
      maxGuests: room.maxGuests,
      pricePerNight: room.pricePerNight,
      currency: "ILS",
      availableRooms: room.availableUnits,
      cancellationPolicy: room.cancellationPolicy,
      breakfastIncluded: room.amenities.some((amenity) => amenity.toLowerCase().includes("coffee")),
      amenities: room.amenities,
      photos: room.images,
    })),
  };
}

export async function fetchMockHotels(options?: {
  city?: string;
  facility?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  provider?: string;
}) {
  const hotels = listMockPmsHotels({ city: options?.city }).map((hotel) => mapPmsHotelToMockHotel(hotel));
  const normalizedFacility = options?.facility?.trim().toLowerCase() ?? "";
  const minPrice =
    typeof options?.minPrice === "number" && Number.isFinite(options.minPrice) ? options.minPrice : null;
  const maxPrice =
    typeof options?.maxPrice === "number" && Number.isFinite(options.maxPrice) ? options.maxPrice : null;
  const limit =
    typeof options?.limit === "number" && Number.isFinite(options.limit) && options.limit > 0
      ? Math.floor(options.limit)
      : 50;
  const provider = resolveProvider(options?.provider);

  const filtered = hotels.filter((hotel) => {
    if (normalizedFacility) {
      const hasFacility = hotel.facilities.some((facility) =>
        facility.toLowerCase().includes(normalizedFacility),
      );
      if (!hasFacility) {
        return false;
      }
    }
    if (typeof minPrice === "number" && hotel.dealPrice < minPrice) {
      return false;
    }
    if (typeof maxPrice === "number" && hotel.dealPrice > maxPrice) {
      return false;
    }
    return true;
  });

  if (provider === "opera") {
    return filtered.sort((a, b) => b.stars - a.stars).slice(0, limit);
  }
  if (provider === "optima") {
    return filtered.sort((a, b) => a.dealPrice - b.dealPrice).slice(0, limit);
  }
  return filtered.slice(0, limit);
}

export async function fetchMockHotelById(id: string) {
  const pmsHotelId = toPmsHotelId(id);
  if (pmsHotelId) {
    const pmsHotel = getMockPmsHotelById(pmsHotelId);
    if (!pmsHotel) {
      return null;
    }
    return mapPmsHotelToMockHotel(pmsHotel);
  }

  const hotels = listMockPmsHotels().map((hotel) => mapPmsHotelToMockHotel(hotel));
  return hotels.find((hotel) => hotel.id === id) ?? null;
}

