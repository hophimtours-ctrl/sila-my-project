import type { NormalizedHotel, NormalizedRoom } from "@/lib/hotel-api";
import type { UnifiedHotel, UnifiedRoomSummary } from "@/lib/unified/contracts";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function splitLocation(location: string) {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { city: null, country: null };
  }
  if (parts.length === 1) {
    return { city: parts[0], country: null };
  }

  return {
    city: parts[0],
    country: parts[parts.length - 1],
  };
}

function mapRapidRoomsToUnified(params: {
  hotelExternalId: string;
  rooms: NormalizedRoom[];
  requestedGuests?: number;
  includeUnavailable?: boolean;
}) {
  const requestedGuests =
    typeof params.requestedGuests === "number" &&
    Number.isFinite(params.requestedGuests) &&
    params.requestedGuests > 0
      ? Math.floor(params.requestedGuests)
      : null;
  const includeUnavailable = Boolean(params.includeUnavailable);

  return params.rooms
    .filter((room) => (requestedGuests ? room.maxGuests >= requestedGuests : true))
    .filter((room) =>
      includeUnavailable ? true : room.isAvailable && room.availableInventory > 0,
    )
    .map<UnifiedRoomSummary>((room) => ({
      id: `${params.hotelExternalId}:${room.externalRoomId}`,
      externalRoomId: room.externalRoomId,
      name: room.name,
      maxGuests: room.maxGuests,
      baseRate: room.pricePerNight,
      currency: "USD",
      inventory: room.inventory,
      availableInventory: room.availableInventory,
      isAvailable: room.isAvailable && room.availableInventory > 0,
      cancellationPolicy: room.cancellationPolicy,
    }));
}

export function mapRapidHotelsToUnified(params: {
  hotels: NormalizedHotel[];
  providerId: string;
  providerCode?: string;
  requestedGuests?: number;
  includeUnavailable?: boolean;
  city?: string;
  country?: string;
  facility?: string;
}) {
  const cityQuery = params.city ? normalizeText(params.city) : "";
  const countryQuery = params.country ? normalizeText(params.country) : "";
  const facilityQuery = params.facility ? normalizeText(params.facility) : "";
  const providerCode = params.providerCode?.trim().toLowerCase() || "rapid";

  return params.hotels.reduce<UnifiedHotel[]>((items, hotel) => {
    const mappedRooms = mapRapidRoomsToUnified({
      hotelExternalId: hotel.externalHotelId,
      rooms: hotel.rooms,
      requestedGuests: params.requestedGuests,
      includeUnavailable: params.includeUnavailable,
    });
    if (mappedRooms.length === 0) {
      return items;
    }

    const location = splitLocation(hotel.location);
    const facilities = hotel.facilities;
    const normalizedHotelName = normalizeText(hotel.name);
    const normalizedLocation = normalizeText(hotel.location);
    const normalizedCity = normalizeText(location.city ?? "");
    const normalizedCountry = normalizeText(location.country ?? "");

    if (
      cityQuery &&
      !normalizedCity.includes(cityQuery) &&
      !normalizedLocation.includes(cityQuery) &&
      !normalizedHotelName.includes(cityQuery)
    ) {
      return items;
    }
    if (
      countryQuery &&
      !normalizedCountry.includes(countryQuery) &&
      !normalizedLocation.includes(countryQuery)
    ) {
      return items;
    }
    if (
      facilityQuery &&
      !facilities.some((facility) => {
        const normalizedFacility = normalizeText(facility);
        return (
          normalizedFacility === facilityQuery || normalizedFacility.includes(facilityQuery)
        );
      })
    ) {
      return items;
    }

    items.push({
      id: `rapid:${params.providerId}:${hotel.externalHotelId}`,
      name: hotel.name,
      location: hotel.location,
      city: location.city,
      country: location.country,
      description: hotel.description,
      facilities,
      images: hotel.images,
      rating: hotel.rating,
      averageReviewScore: null,
      source: "pms",
      integration: {
        providerId: params.providerId,
        providerCode,
        externalHotelId: hotel.externalHotelId,
      },
      rooms: mappedRooms,
    });

    return items;
  }, []);
}
