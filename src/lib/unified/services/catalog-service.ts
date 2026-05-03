import { HotelDataSourceMode, HotelStatus } from "@prisma/client";
import type {
  UnifiedHotel,
  UnifiedHotelSearchQuery,
  UnifiedHotelsSearchResult,
  UnifiedHotelSource,
  UnifiedRoomSummary,
} from "@/lib/unified/contracts";
import { prisma } from "@/lib/db";

function toPositiveInt(value: number | undefined, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(value));
}

function normalizeText(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function mapHotelSource(mode: HotelDataSourceMode): UnifiedHotelSource {
  if (mode === HotelDataSourceMode.MANUAL) {
    return "manual";
  }
  if (mode === HotelDataSourceMode.HYBRID) {
    return "hybrid";
  }
  return "pms";
}

function toProviderCode(providerName: string | null) {
  if (!providerName) {
    return null;
  }
  return providerName.trim().toLowerCase().replace(/\s+/g, "_");
}

function mapRoomsToUnified(params: {
  rooms: Array<{
    id: string;
    externalRoomId: string | null;
    name: string;
    maxGuests: number;
    pricePerNight: number;
    inventory: number;
    availableInventory: number;
    isAvailable: boolean;
    cancellationPolicy: string;
  }>;
  requestedGuests: number | null;
  includeUnavailable: boolean;
}) {
  const filteredByGuests = params.rooms.filter((room) =>
    params.requestedGuests ? room.maxGuests >= params.requestedGuests : true,
  );
  const filteredRooms = params.includeUnavailable
    ? filteredByGuests
    : filteredByGuests.filter((room) => room.isAvailable && room.availableInventory > 0);

  return filteredRooms.map<UnifiedRoomSummary>((room) => ({
    id: room.id,
    externalRoomId: room.externalRoomId,
    name: room.name,
    maxGuests: room.maxGuests,
    baseRate: room.pricePerNight,
    currency: "ILS",
    inventory: room.inventory,
    availableInventory: room.availableInventory,
    isAvailable: room.isAvailable && room.availableInventory > 0,
    cancellationPolicy: room.cancellationPolicy,
  }));
}

async function search(query: UnifiedHotelSearchQuery = {}): Promise<UnifiedHotelsSearchResult> {
  const limit = toPositiveInt(query.limit, 20, 100);
  const offset = toPositiveInt(query.offset, 0, 10_000);
  const includeUnavailable = Boolean(query.includeUnavailable);
  const requestedGuests =
    typeof query.guests === "number" && Number.isFinite(query.guests) && query.guests > 0
      ? Math.floor(query.guests)
      : null;
  const cityQuery = normalizeText(query.city);
  const countryQuery = normalizeText(query.country);
  const facilityQuery = normalizeText(query.facility);

  const hotels = await prisma.hotel.findMany({
    where: { status: HotelStatus.APPROVED },
    include: {
      provider: { select: { id: true, name: true } },
      roomTypes: {
        select: {
          id: true,
          externalRoomId: true,
          name: true,
          maxGuests: true,
          pricePerNight: true,
          inventory: true,
          availableInventory: true,
          isAvailable: true,
          cancellationPolicy: true,
        },
      },
      reviews: { select: { rating: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const mapped = hotels.reduce<UnifiedHotel[]>((items, hotel) => {
    const facilities = toStringArray(hotel.facilities);
    const images = toStringArray(hotel.images);
    const unifiedRooms = mapRoomsToUnified({
      rooms: hotel.roomTypes,
      requestedGuests,
      includeUnavailable,
    });
    if (unifiedRooms.length === 0) {
      return items;
    }

    const normalizedName = normalizeText(hotel.name);
    const normalizedLocation = normalizeText(hotel.location);
    const normalizedCity = normalizeText(hotel.city ?? undefined);
    const normalizedCountry = normalizeText(hotel.country ?? undefined);
    const normalizedFacilities = facilities.map((facility) => normalizeText(facility));

    if (
      cityQuery &&
      !normalizedCity.includes(cityQuery) &&
      !normalizedLocation.includes(cityQuery) &&
      !normalizedName.includes(cityQuery)
    ) {
      return items;
    }
    if (countryQuery && !normalizedCountry.includes(countryQuery) && !normalizedLocation.includes(countryQuery)) {
      return items;
    }
    if (
      facilityQuery &&
      !normalizedFacilities.some((facility) => facility === facilityQuery || facility.includes(facilityQuery))
    ) {
      return items;
    }

    const averageReviewScore =
      hotel.reviews.length > 0
        ? hotel.reviews.reduce((sum, review) => sum + review.rating, 0) / hotel.reviews.length
        : null;

    items.push({
      id: hotel.id,
      name: hotel.name,
      location: hotel.location,
      city: hotel.city,
      country: hotel.country,
      description: hotel.description,
      facilities,
      images,
      rating: hotel.rating,
      averageReviewScore,
      source: mapHotelSource(hotel.dataSourceMode),
      integration: {
        providerId: hotel.providerId,
        providerCode: toProviderCode(hotel.provider?.name ?? null),
        externalHotelId: hotel.externalHotelId,
      },
      rooms: unifiedRooms,
    });

    return items;
  }, []);

  const pagedItems = mapped.slice(offset, offset + limit);
  return {
    success: true,
    source: "unified-catalog-v1",
    generatedAt: new Date().toISOString(),
    total: mapped.length,
    count: pagedItems.length,
    limit,
    offset,
    items: pagedItems,
  };
}

export const unifiedCatalogService = {
  search,
};
