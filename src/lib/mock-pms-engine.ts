type MockProvider = "siteminder" | "opera" | "optima";

type MockAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  countryCode: string;
};

type MockGeoPoint = {
  latitude: number;
  longitude: number;
};

type MockRoomType = {
  roomTypeId: string;
  name: string;
  description: string;
  pricePerNight: number;
  currency: "ILS";
  availableUnits: number;
  maxGuests: number;
  cancellationPolicy: string;
  images: string[];
  amenities: string[];
  providerRefs: {
    siteminderRoomTypeId: string;
    operaRoomTypeCode: string;
    optimaRoomCode: string;
  };
};

type MockHotel = {
  hotelId: string;
  name: string;
  shortDescription: string;
  description: string;
  address: MockAddress;
  starRating: number;
  amenities: string[];
  images: string[];
  location: MockGeoPoint;
  roomTypes: MockRoomType[];
  providerRefs: {
    siteminderPropertyId: string;
    operaHotelCode: string;
    optimaHotelCode: string;
  };
};

type AvailabilityNight = {
  date: string;
  nightlyPrice: number;
  currency: "ILS";
  availableUnits: number;
};

type RoomAvailability = {
  hotelId: string;
  roomTypeId: string;
  roomName: string;
  maxGuests: number;
  isAvailable: boolean;
  minimumAvailableUnits: number;
  requestedUnits: number;
  totalPrice: number;
  currency: "ILS";
  nights: AvailabilityNight[];
};

type AvailabilityHotelResult = {
  hotelId: string;
  hotelName: string;
  isAvailable: boolean;
  rooms: RoomAvailability[];
};

type CreateReservationInput = {
  provider: MockProvider;
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  units: number;
  guests: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
};

type StoredReservation = {
  reservationId: string;
  provider: MockProvider;
  providerReservationId: string;
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  units: number;
  guests: number;
  totalPrice: number;
  currency: "ILS";
  status: "CONFIRMED" | "CANCELLED";
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  customer: CreateReservationInput["customer"];
};

type CancelReservationInput = {
  provider: MockProvider;
  reservationId: string;
  reason?: string;
};

type InventoryWebhookUpdate = {
  hotelId: string;
  roomTypeId: string;
  startDate: string;
  endDate: string;
  availableUnits?: number;
  pricePerNight?: number;
  stopSell?: boolean;
};

type InventoryOverride = {
  availableUnits?: number;
  pricePerNight?: number;
  stopSell?: boolean;
  updatedAt: string;
};

export type MockPmsRoomType = MockRoomType;
export type MockPmsHotel = MockHotel;

const HOTEL_AMENITIES = [
  "Free Wi-Fi",
  "Pool",
  "Spa",
  "Fitness Center",
  "Business Lounge",
  "Airport Shuttle",
  "Kids Club",
  "Rooftop Bar",
  "Beach Access",
  "Underground Parking",
  "24/7 Front Desk",
  "Conference Rooms",
  "EV Charging",
  "Shabbat Elevator",
  "Pet Friendly",
  "Sauna",
  "Breakfast Buffet",
  "Valet Service",
] as const;

const ROOM_AMENITIES = [
  "Air Conditioning",
  "Smart TV",
  "Nespresso Machine",
  "Rain Shower",
  "Mini Bar",
  "Work Desk",
  "Blackout Curtains",
  "In-room Safe",
  "Balcony",
  "Ocean View",
  "High-speed Wi-Fi",
  "Bathrobe",
] as const;

const CITY_DATA = [
  {
    city: "Tel Aviv",
    country: "Israel",
    countryCode: "IL",
    state: "Tel Aviv District",
    latitude: 32.0853,
    longitude: 34.7818,
    streets: ["HaYarkon St", "Rothschild Blvd", "Dizengoff St", "Allenby St"],
  },
  {
    city: "Jerusalem",
    country: "Israel",
    countryCode: "IL",
    state: "Jerusalem District",
    latitude: 31.7683,
    longitude: 35.2137,
    streets: ["King David St", "Jaffa St", "Hillel St", "Agripas St"],
  },
  {
    city: "Haifa",
    country: "Israel",
    countryCode: "IL",
    state: "Haifa District",
    latitude: 32.794,
    longitude: 34.9896,
    streets: ["Ben Gurion Ave", "HaNassi Blvd", "Yefe Nof St", "Allenby Haifa"],
  },
  {
    city: "Eilat",
    country: "Israel",
    countryCode: "IL",
    state: "South District",
    latitude: 29.5577,
    longitude: 34.9519,
    streets: ["North Beach Promenade", "Kamen St", "Antibes St", "Coral Beach Rd"],
  },
  {
    city: "Tiberias",
    country: "Israel",
    countryCode: "IL",
    state: "North District",
    latitude: 32.7959,
    longitude: 35.5309,
    streets: ["HaGalil St", "Yigal Alon Promenade", "Ahdut Yisrael St", "Gdud Barak St"],
  },
  {
    city: "Dead Sea",
    country: "Israel",
    countryCode: "IL",
    state: "South District",
    latitude: 31.2,
    longitude: 35.36,
    streets: ["Ein Bokek Blvd", "Spa Road", "Salt Lake Ave", "Oasis Lane"],
  },
  {
    city: "Netanya",
    country: "Israel",
    countryCode: "IL",
    state: "Central District",
    latitude: 32.3215,
    longitude: 34.8532,
    streets: ["Herzl St", "Nitza Blvd", "Gad Machnes St", "David HaMelech St"],
  },
  {
    city: "Athens",
    country: "Greece",
    countryCode: "GR",
    state: "Attica",
    latitude: 37.9838,
    longitude: 23.7275,
    streets: ["Syntagma Sq", "Adrianou St", "Mitropoleos St", "Pireos Ave"],
  },
  {
    city: "Rome",
    country: "Italy",
    countryCode: "IT",
    state: "Lazio",
    latitude: 41.9028,
    longitude: 12.4964,
    streets: ["Via Veneto", "Via del Corso", "Via Cavour", "Piazza Barberini"],
  },
  {
    city: "Barcelona",
    country: "Spain",
    countryCode: "ES",
    state: "Catalonia",
    latitude: 41.3851,
    longitude: 2.1734,
    streets: ["La Rambla", "Passeig de Gracia", "Carrer de Mallorca", "Avinguda Diagonal"],
  },
] as const;

const HOTEL_PREFIXES = [
  "Royal",
  "Urban",
  "Sea Breeze",
  "Grand",
  "Olive Tree",
  "Skyline",
  "Azure",
  "Heritage",
  "Crown",
  "Golden Bay",
] as const;

const HOTEL_SUFFIXES = [
  "Hotel",
  "Suites",
  "Resort",
  "Boutique",
  "Collection",
  "Plaza",
  "Residence",
  "Palace",
  "Retreat",
  "Heights",
] as const;

const ROOM_TEMPLATES = [
  {
    name: "Classic Room",
    description: "Comfortable room with city view and modern amenities.",
    maxGuests: 2,
    baseMultiplier: 1,
  },
  {
    name: "Deluxe Room",
    description: "Spacious room with upgraded interiors and seating area.",
    maxGuests: 3,
    baseMultiplier: 1.2,
  },
  {
    name: "Executive Room",
    description: "Premium room with lounge access and enhanced services.",
    maxGuests: 3,
    baseMultiplier: 1.35,
  },
  {
    name: "Family Suite",
    description: "Two-zone suite designed for families and longer stays.",
    maxGuests: 5,
    baseMultiplier: 1.65,
  },
  {
    name: "Junior Suite",
    description: "Elegant suite with dedicated living space and balcony.",
    maxGuests: 4,
    baseMultiplier: 1.55,
  },
  {
    name: "Presidential Suite",
    description: "Top-tier suite with panoramic views and private lounge.",
    maxGuests: 6,
    baseMultiplier: 2.4,
  },
] as const;

const reservationStore = new Map<string, StoredReservation>();
const inventoryOverrideStore = new Map<string, InventoryOverride>();

function normalizeProvider(value: string | null | undefined): MockProvider {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "opera" || raw === "opera-cloud" || raw === "operacloud") {
    return "opera";
  }
  if (raw === "optima") {
    return "optima";
  }
  return "siteminder";
}

function hashToInt(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function roundMoney(value: number) {
  return Math.round(value);
}

function clamp(min: number, max: number, value: number) {
  return Math.max(min, Math.min(max, value));
}

function imageUrl(tags: string, seed: string, width: number, height: number) {
  return `https://source.unsplash.com/${width}x${height}/?${encodeURIComponent(tags)},${encodeURIComponent(seed)}`;
}

function toIsoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(base: Date, days: number) {
  const clone = new Date(base);
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
}

function enumerateDates(checkIn: Date, checkOut: Date) {
  const dates: Date[] = [];
  for (let date = new Date(checkIn); date < checkOut; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function overlap(dateIso: string, checkInIso: string, checkOutIso: string) {
  return dateIso >= checkInIso && dateIso < checkOutIso;
}

function weekendFactor(date: Date) {
  const day = date.getUTCDay();
  return day === 4 || day === 5 ? 1.16 : 1;
}

function seasonalFactor(date: Date) {
  const month = date.getUTCMonth() + 1;
  if ([6, 7, 8, 9].includes(month)) {
    return 1.22;
  }
  if ([12, 1, 4].includes(month)) {
    return 1.12;
  }
  return 1;
}

function providerRateFactor(provider: MockProvider) {
  if (provider === "opera") {
    return 1.03;
  }
  if (provider === "optima") {
    return 0.98;
  }
  return 1;
}

function makeInventoryOverrideKey(hotelId: string, roomTypeId: string, dateIso: string) {
  return `${hotelId}::${roomTypeId}::${dateIso}`;
}

function getReservedUnitsForDate(roomTypeId: string, dateIso: string) {
  let total = 0;
  reservationStore.forEach((reservation) => {
    if (reservation.status !== "CONFIRMED") {
      return;
    }
    if (reservation.roomTypeId !== roomTypeId) {
      return;
    }
    if (overlap(dateIso, reservation.checkIn, reservation.checkOut)) {
      total += reservation.units;
    }
  });
  return total;
}

function buildMockHotels(count: number): MockHotel[] {
  return Array.from({ length: count }, (_, index) => {
    const sequence = index + 1;
    const city = CITY_DATA[index % CITY_DATA.length];
    const prefix = HOTEL_PREFIXES[index % HOTEL_PREFIXES.length];
    const suffix = HOTEL_SUFFIXES[(index * 3) % HOTEL_SUFFIXES.length];
    const street = city.streets[index % city.streets.length];
    const streetNumber = 8 + (index % 140);
    const postalCode = String(10_000 + (hashToInt(`${city.city}-${sequence}`) % 80_000));
    const hotelId = `HTL-${String(sequence).padStart(4, "0")}`;
    const hotelName = `${prefix} ${city.city} ${suffix}`;
    const starRating = (3 + (index % 3)) as 3 | 4 | 5;
    const roomTypeCount = 3 + (index % 4);
    const hotelImageCount = 5 + (index % 6);
    const amenityOffset = index % HOTEL_AMENITIES.length;
    const rotatedAmenities = [
      ...HOTEL_AMENITIES.slice(amenityOffset),
      ...HOTEL_AMENITIES.slice(0, amenityOffset),
    ];
    const hotelAmenities = Array.from(new Set(rotatedAmenities.slice(0, 10)));
    const baseRoomPrice = 370 + (index % 11) * 65 + Math.floor(index / 8) * 24;

    const roomTypes = Array.from({ length: roomTypeCount }, (_, roomIndex) => {
      const template = ROOM_TEMPLATES[roomIndex % ROOM_TEMPLATES.length];
      const roomTypeId = `${hotelId}-RT-${String(roomIndex + 1).padStart(2, "0")}`;
      const roomAmenityOffset = (index * 2 + roomIndex * 3) % ROOM_AMENITIES.length;
      const rotatedRoomAmenities = [
        ...ROOM_AMENITIES.slice(roomAmenityOffset),
        ...ROOM_AMENITIES.slice(0, roomAmenityOffset),
      ];
      const roomAmenities = Array.from(new Set(rotatedRoomAmenities.slice(0, 7)));
      const roomImageCount = 3 + ((index + roomIndex) % 4);
      const availableUnits = clamp(2, 16, 4 + ((index * 5 + roomIndex * 7) % 13));
      const pricePerNight = roundMoney(baseRoomPrice * template.baseMultiplier + roomIndex * 35);

      return {
        roomTypeId,
        name: template.name,
        description: template.description,
        pricePerNight,
        currency: "ILS",
        availableUnits,
        maxGuests: template.maxGuests,
        cancellationPolicy:
          roomIndex % 2 === 0
            ? "Free cancellation up to 72 hours before arrival"
            : "Partially refundable up to 7 days before arrival",
        images: Array.from({ length: roomImageCount }, (_unused, imageIndex) =>
          imageUrl(
            "hotel room interior",
            `${hotelId}-room-${roomIndex + 1}-${imageIndex + 1}`,
            1200,
            800,
          ),
        ),
        amenities: roomAmenities,
        providerRefs: {
          siteminderRoomTypeId: `SMRT-${hotelId}-${roomIndex + 1}`,
          operaRoomTypeCode: `OPR-${sequence}-${roomIndex + 1}`,
          optimaRoomCode: `OPT-RT-${sequence}-${roomIndex + 1}`,
        },
      } satisfies MockRoomType;
    });

    return {
      hotelId,
      name: hotelName,
      shortDescription: `${hotelName} offers premium hospitality in ${city.city} with strong business and leisure facilities.`,
      description: `${hotelName} is a high-fidelity mock hotel entity designed for booking-engine development. The property includes realistic PMS identifiers, room categories, amenities, media, geolocation and inventory behavior inspired by SiteMinder, Opera Cloud and Optima integration patterns.`,
      address: {
        line1: `${streetNumber} ${street}`,
        line2: "Hospitality District",
        city: city.city,
        state: city.state,
        postalCode,
        country: city.country,
        countryCode: city.countryCode,
      },
      starRating,
      amenities: hotelAmenities,
      images: Array.from({ length: hotelImageCount }, (_unused, imageIndex) =>
        imageUrl("luxury hotel", `${hotelId}-hotel-${imageIndex + 1}`, 1600, 1000),
      ),
      location: {
        latitude: Number((city.latitude + ((index % 5) - 2) * 0.0074).toFixed(6)),
        longitude: Number((city.longitude + ((index % 7) - 3) * 0.0081).toFixed(6)),
      },
      roomTypes,
      providerRefs: {
        siteminderPropertyId: `SMPROP-${String(sequence).padStart(5, "0")}`,
        operaHotelCode: `OPR-H${String(sequence).padStart(4, "0")}`,
        optimaHotelCode: `OPT-H${String(sequence).padStart(4, "0")}`,
      },
    } satisfies MockHotel;
  });
}

const MOCK_HOTELS: MockHotel[] = buildMockHotels(50);

function buildRoomAvailability(params: {
  provider: MockProvider;
  hotel: MockHotel;
  room: MockRoomType;
  checkIn: Date;
  checkOut: Date;
  requestedUnits: number;
  guestsPerRoom: number;
}) {
  const nights = enumerateDates(params.checkIn, params.checkOut);
  const nightly = nights.map((nightDate) => {
    const dateIso = toIsoDateOnly(nightDate);
    const reservedUnits = getReservedUnitsForDate(params.room.roomTypeId, dateIso);
    const baseAvailable = Math.max(0, params.room.availableUnits - reservedUnits);
    const overrideKey = makeInventoryOverrideKey(params.hotel.hotelId, params.room.roomTypeId, dateIso);
    const override = inventoryOverrideStore.get(overrideKey);
    let availableUnits = override?.availableUnits ?? baseAvailable;
    if (override?.stopSell) {
      availableUnits = 0;
    }
    const dynamicPrice = roundMoney(
      params.room.pricePerNight *
        weekendFactor(nightDate) *
        seasonalFactor(nightDate) *
        providerRateFactor(params.provider),
    );
    const nightlyPrice = override?.pricePerNight ?? dynamicPrice;

    return {
      date: dateIso,
      nightlyPrice,
      currency: "ILS",
      availableUnits,
    } satisfies AvailabilityNight;
  });

  const minimumAvailableUnits = nightly.reduce(
    (min, item) => Math.min(min, item.availableUnits),
    Number.POSITIVE_INFINITY,
  );
  const totalPricePerUnit = nightly.reduce((sum, item) => sum + item.nightlyPrice, 0);
  const totalPrice = totalPricePerUnit * params.requestedUnits;
  const fitsGuests = params.room.maxGuests >= params.guestsPerRoom;
  const isAvailable = fitsGuests && minimumAvailableUnits >= params.requestedUnits;

  return {
    hotelId: params.hotel.hotelId,
    roomTypeId: params.room.roomTypeId,
    roomName: params.room.name,
    maxGuests: params.room.maxGuests,
    isAvailable,
    minimumAvailableUnits: Number.isFinite(minimumAvailableUnits) ? minimumAvailableUnits : 0,
    requestedUnits: params.requestedUnits,
    totalPrice,
    currency: "ILS",
    nights: nightly,
  } satisfies RoomAvailability;
}

function providerHotelListPayload(provider: MockProvider, hotels: MockHotel[]) {
  if (provider === "opera") {
    return {
      status: "SUCCESS",
      provider: "opera-cloud",
      generatedAt: new Date().toISOString(),
      count: hotels.length,
      hotels: hotels.map((hotel) => ({
        hotelCode: hotel.providerRefs.operaHotelCode,
        hotelId: hotel.hotelId,
        name: hotel.name,
        shortDescription: hotel.shortDescription,
        address: hotel.address,
        starRating: hotel.starRating,
        amenities: hotel.amenities.map((name, index) => ({ code: `AM-${index + 1}`, name })),
        media: hotel.images.map((url, index) => ({ id: `${hotel.hotelId}-IMG-${index + 1}`, url })),
        geoLocation: hotel.location,
        roomTypes: hotel.roomTypes.map((room) => ({
          roomTypeCode: room.providerRefs.operaRoomTypeCode,
          roomTypeId: room.roomTypeId,
          name: room.name,
          description: room.description,
          maxGuests: room.maxGuests,
          baseRate: room.pricePerNight,
          availableUnits: room.availableUnits,
          cancellationPolicy: room.cancellationPolicy,
          media: room.images,
          amenities: room.amenities,
        })),
      })),
    };
  }

  if (provider === "optima") {
    return {
      ok: true,
      provider: "optima",
      generatedAt: new Date().toISOString(),
      data: {
        totalHotels: hotels.length,
        hotels: hotels.map((hotel) => ({
          code: hotel.providerRefs.optimaHotelCode,
          hotelId: hotel.hotelId,
          title: hotel.name,
          shortText: hotel.shortDescription,
          address: hotel.address,
          stars: hotel.starRating,
          amenities: hotel.amenities,
          gallery: hotel.images,
          coordinates: hotel.location,
          roomTypes: hotel.roomTypes.map((room) => ({
            code: room.providerRefs.optimaRoomCode,
            roomTypeId: room.roomTypeId,
            title: room.name,
            description: room.description,
            nightlyRate: room.pricePerNight,
            currency: room.currency,
            availability: room.availableUnits,
            maxOccupancy: room.maxGuests,
            cancellationPolicy: room.cancellationPolicy,
            gallery: room.images,
            amenities: room.amenities,
          })),
        })),
      },
    };
  }

  return {
    success: true,
    provider: "siteminder",
    generatedAt: new Date().toISOString(),
    total: hotels.length,
    properties: hotels.map((hotel) => ({
      propertyId: hotel.providerRefs.siteminderPropertyId,
      hotelId: hotel.hotelId,
      name: hotel.name,
      shortDescription: hotel.shortDescription,
      address: hotel.address,
      starRating: hotel.starRating,
      amenities: hotel.amenities,
      images: hotel.images,
      location: hotel.location,
      roomTypes: hotel.roomTypes.map((room) => ({
        roomTypeId: room.providerRefs.siteminderRoomTypeId,
        internalRoomTypeId: room.roomTypeId,
        name: room.name,
        description: room.description,
        ratePerNight: room.pricePerNight,
        currency: room.currency,
        availableUnits: room.availableUnits,
        maxGuests: room.maxGuests,
        cancellationPolicy: room.cancellationPolicy,
        images: room.images,
        amenities: room.amenities,
      })),
    })),
  };
}

function providerHotelDetailsPayload(provider: MockProvider, hotel: MockHotel) {
  return providerHotelListPayload(provider, [hotel]);
}

function providerAvailabilityPayload(provider: MockProvider, availability: AvailabilityHotelResult[]) {
  if (provider === "opera") {
    return {
      status: "SUCCESS",
      provider: "opera-cloud",
      generatedAt: new Date().toISOString(),
      hotels: availability.map((hotel) => ({
        hotelId: hotel.hotelId,
        isAvailable: hotel.isAvailable,
        roomAvailabilities: hotel.rooms.map((room) => ({
          roomTypeId: room.roomTypeId,
          roomName: room.roomName,
          available: room.isAvailable,
          minimumAvailableUnits: room.minimumAvailableUnits,
          requestedUnits: room.requestedUnits,
          totalRate: room.totalPrice,
          currency: room.currency,
          nightlyRates: room.nights.map((night) => ({
            businessDate: night.date,
            amount: night.nightlyPrice,
            availableUnits: night.availableUnits,
          })),
        })),
      })),
    };
  }

  if (provider === "optima") {
    return {
      ok: true,
      provider: "optima",
      generatedAt: new Date().toISOString(),
      data: availability.map((hotel) => ({
        hotelId: hotel.hotelId,
        available: hotel.isAvailable,
        rooms: hotel.rooms.map((room) => ({
          roomTypeId: room.roomTypeId,
          roomName: room.roomName,
          available: room.isAvailable,
          unitsLeft: room.minimumAvailableUnits,
          unitsRequested: room.requestedUnits,
          totalPrice: room.totalPrice,
          currency: room.currency,
          nights: room.nights,
        })),
      })),
    };
  }

  return {
    success: true,
    provider: "siteminder",
    generatedAt: new Date().toISOString(),
    availability: availability.map((hotel) => ({
      propertyId:
        MOCK_HOTELS.find((item) => item.hotelId === hotel.hotelId)?.providerRefs.siteminderPropertyId ??
        hotel.hotelId,
      hotelId: hotel.hotelId,
      isAvailable: hotel.isAvailable,
      roomTypes: hotel.rooms.map((room) => ({
        roomTypeId:
          MOCK_HOTELS.find((item) => item.hotelId === hotel.hotelId)?.roomTypes.find(
            (candidate) => candidate.roomTypeId === room.roomTypeId,
          )?.providerRefs.siteminderRoomTypeId ?? room.roomTypeId,
        internalRoomTypeId: room.roomTypeId,
        roomName: room.roomName,
        available: room.isAvailable,
        minimumAvailableUnits: room.minimumAvailableUnits,
        requestedUnits: room.requestedUnits,
        totalPrice: room.totalPrice,
        currency: room.currency,
        nightlyRates: room.nights,
      })),
    })),
  };
}

function providerReservationPayload(provider: MockProvider, reservation: StoredReservation) {
  if (provider === "opera") {
    return {
      status: "SUCCESS",
      provider: "opera-cloud",
      reservation: {
        reservationId: reservation.reservationId,
        confirmationNumber: reservation.providerReservationId,
        status: reservation.status,
        hotelId: reservation.hotelId,
        roomTypeId: reservation.roomTypeId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        units: reservation.units,
        guests: reservation.guests,
        totalAmount: reservation.totalPrice,
        currency: reservation.currency,
        createdAt: reservation.createdAt,
      },
    };
  }

  if (provider === "optima") {
    return {
      ok: true,
      provider: "optima",
      data: {
        reservationId: reservation.reservationId,
        externalReference: reservation.providerReservationId,
        status: reservation.status,
        hotelId: reservation.hotelId,
        roomTypeId: reservation.roomTypeId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        units: reservation.units,
        guests: reservation.guests,
        totalPrice: reservation.totalPrice,
        currency: reservation.currency,
        createdAt: reservation.createdAt,
      },
    };
  }

  return {
    success: true,
    provider: "siteminder",
    reservation: {
      reservationId: reservation.reservationId,
      supplierReservationId: reservation.providerReservationId,
      status: reservation.status,
      hotelId: reservation.hotelId,
      roomTypeId: reservation.roomTypeId,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      units: reservation.units,
      guests: reservation.guests,
      totalPrice: reservation.totalPrice,
      currency: reservation.currency,
      createdAt: reservation.createdAt,
    },
  };
}

function providerCancellationPayload(provider: MockProvider, reservation: StoredReservation) {
  if (provider === "opera") {
    return {
      status: "SUCCESS",
      provider: "opera-cloud",
      cancellation: {
        reservationId: reservation.reservationId,
        confirmationNumber: reservation.providerReservationId,
        status: reservation.status,
        cancelledAt: reservation.cancelledAt,
        reason: reservation.cancellationReason,
      },
    };
  }

  if (provider === "optima") {
    return {
      ok: true,
      provider: "optima",
      data: {
        reservationId: reservation.reservationId,
        externalReference: reservation.providerReservationId,
        status: reservation.status,
        cancelledAt: reservation.cancelledAt,
        reason: reservation.cancellationReason,
      },
    };
  }

  return {
    success: true,
    provider: "siteminder",
    cancellation: {
      reservationId: reservation.reservationId,
      supplierReservationId: reservation.providerReservationId,
      status: reservation.status,
      cancelledAt: reservation.cancelledAt,
      reason: reservation.cancellationReason,
    },
  };
}

function providerInventoryWebhookPayload(provider: MockProvider, appliedCount: number) {
  if (provider === "opera") {
    return {
      status: "SUCCESS",
      provider: "opera-cloud",
      appliedUpdates: appliedCount,
      processedAt: new Date().toISOString(),
    };
  }

  if (provider === "optima") {
    return {
      ok: true,
      provider: "optima",
      data: {
        appliedUpdates: appliedCount,
        processedAt: new Date().toISOString(),
      },
    };
  }

  return {
    success: true,
    provider: "siteminder",
    appliedUpdates: appliedCount,
    processedAt: new Date().toISOString(),
  };
}

export function listMockHotels(params?: {
  provider?: string | null;
  city?: string | null;
  stars?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}) {
  const provider = normalizeProvider(params?.provider);
  const cityQuery = (params?.city ?? "").trim().toLowerCase();
  const stars = params?.stars ?? null;
  const minPrice = typeof params?.minPrice === "number" && Number.isFinite(params.minPrice)
    ? params.minPrice
    : null;
  const maxPrice = typeof params?.maxPrice === "number" && Number.isFinite(params.maxPrice)
    ? params.maxPrice
    : null;

  const filtered = MOCK_HOTELS.filter((hotel) => {
    if (
      cityQuery &&
      !hotel.address.city.toLowerCase().includes(cityQuery) &&
      !hotel.name.toLowerCase().includes(cityQuery) &&
      !hotel.address.country.toLowerCase().includes(cityQuery)
    ) {
      return false;
    }
    if (typeof stars === "number" && stars > 0 && hotel.starRating !== stars) {
      return false;
    }
    const cheapestRoom = Math.min(...hotel.roomTypes.map((room) => room.pricePerNight));
    if (typeof minPrice === "number" && cheapestRoom < minPrice) {
      return false;
    }
    if (typeof maxPrice === "number" && cheapestRoom > maxPrice) {
      return false;
    }
    return true;
  });

  return providerHotelListPayload(provider, filtered);
}

export function getMockHotelById(hotelId: string, providerRaw?: string | null) {
  const provider = normalizeProvider(providerRaw);
  const hotel = MOCK_HOTELS.find((item) => item.hotelId === hotelId);
  if (!hotel) {
    return null;
  }
  return providerHotelDetailsPayload(provider, hotel);
}

export function getAvailability(params: {
  provider?: string | null;
  hotelId?: string | null;
  checkIn: string;
  checkOut: string;
  guests?: number | null;
  units?: number | null;
  includeSoldOut?: boolean;
}) {
  const provider = normalizeProvider(params.provider);
  const checkIn = parseIsoDateOnly(params.checkIn);
  const checkOut = parseIsoDateOnly(params.checkOut);
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return {
      error: "Invalid date range. Use ISO format yyyy-mm-dd and checkOut > checkIn.",
    } as const;
  }

  const requestedUnits = clamp(
    1,
    6,
    typeof params.units === "number" && Number.isFinite(params.units) ? Math.floor(params.units) : 1,
  );
  const guests = clamp(
    1,
    16,
    typeof params.guests === "number" && Number.isFinite(params.guests) ? Math.floor(params.guests) : 2,
  );
  const guestsPerRoom = Math.ceil(guests / requestedUnits);

  const targetHotels = params.hotelId
    ? MOCK_HOTELS.filter((hotel) => hotel.hotelId === params.hotelId)
    : MOCK_HOTELS;

  const availability: AvailabilityHotelResult[] = targetHotels.map((hotel) => {
    const rooms = hotel.roomTypes.map((room) =>
      buildRoomAvailability({
        provider,
        hotel,
        room,
        checkIn,
        checkOut,
        requestedUnits,
        guestsPerRoom,
      }),
    );
    const filteredRooms = params.includeSoldOut ? rooms : rooms.filter((room) => room.isAvailable);

    return {
      hotelId: hotel.hotelId,
      hotelName: hotel.name,
      isAvailable: filteredRooms.some((room) => room.isAvailable),
      rooms: filteredRooms,
    };
  });

  return providerAvailabilityPayload(provider, availability);
}

export function createReservation(input: CreateReservationInput) {
  const provider = normalizeProvider(input.provider);
  const checkIn = parseIsoDateOnly(input.checkIn);
  const checkOut = parseIsoDateOnly(input.checkOut);
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return {
      error: "Invalid date range. Use ISO format yyyy-mm-dd and checkOut > checkIn.",
      status: 400,
    } as const;
  }

  const hotel = MOCK_HOTELS.find((item) => item.hotelId === input.hotelId);
  if (!hotel) {
    return { error: "Hotel not found", status: 404 } as const;
  }
  const room = hotel.roomTypes.find((item) => item.roomTypeId === input.roomTypeId);
  if (!room) {
    return { error: "Room type not found", status: 404 } as const;
  }

  const requestedUnits = clamp(1, 6, Math.floor(input.units || 1));
  const guests = clamp(1, 16, Math.floor(input.guests || 1));
  const guestsPerRoom = Math.ceil(guests / requestedUnits);

  const availability = buildRoomAvailability({
    provider,
    hotel,
    room,
    checkIn,
    checkOut,
    requestedUnits,
    guestsPerRoom,
  });

  if (!availability.isAvailable) {
    return {
      error: "Requested room is not available for the selected dates and occupancy.",
      status: 409,
      details: availability,
    } as const;
  }

  const reservationId = `RSV-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const providerReservationId =
    provider === "opera"
      ? `OPR-${reservationId}`
      : provider === "optima"
        ? `OPT-${reservationId}`
        : `SM-${reservationId}`;

  const reservation: StoredReservation = {
    reservationId,
    provider,
    providerReservationId,
    hotelId: hotel.hotelId,
    roomTypeId: room.roomTypeId,
    checkIn: toIsoDateOnly(checkIn),
    checkOut: toIsoDateOnly(checkOut),
    units: requestedUnits,
    guests,
    totalPrice: availability.totalPrice,
    currency: "ILS",
    status: "CONFIRMED",
    createdAt: new Date().toISOString(),
    cancelledAt: null,
    cancellationReason: null,
    customer: input.customer,
  };

  reservationStore.set(reservation.reservationId, reservation);
  return providerReservationPayload(provider, reservation);
}

export function cancelReservation(input: CancelReservationInput) {
  const provider = normalizeProvider(input.provider);
  const reservation = reservationStore.get(input.reservationId);
  if (!reservation) {
    return { error: "Reservation not found", status: 404 } as const;
  }
  if (reservation.status === "CANCELLED") {
    return { error: "Reservation already cancelled", status: 409 } as const;
  }

  reservation.status = "CANCELLED";
  reservation.cancelledAt = new Date().toISOString();
  reservation.cancellationReason = input.reason?.trim() || "Cancelled by API request";
  reservationStore.set(reservation.reservationId, reservation);

  return providerCancellationPayload(provider, reservation);
}

export function applyInventoryWebhook(params: {
  provider?: string | null;
  eventId?: string | null;
  updates: InventoryWebhookUpdate[];
}) {
  const provider = normalizeProvider(params.provider);
  let appliedCount = 0;

  for (const update of params.updates) {
    const hotel = MOCK_HOTELS.find((item) => item.hotelId === update.hotelId);
    if (!hotel) {
      continue;
    }
    const room = hotel.roomTypes.find((item) => item.roomTypeId === update.roomTypeId);
    if (!room) {
      continue;
    }
    const startDate = parseIsoDateOnly(update.startDate);
    const endDate = parseIsoDateOnly(update.endDate);
    if (!startDate || !endDate || endDate < startDate) {
      continue;
    }

    for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
      const dateIso = toIsoDateOnly(date);
      const key = makeInventoryOverrideKey(hotel.hotelId, room.roomTypeId, dateIso);
      inventoryOverrideStore.set(key, {
        availableUnits:
          typeof update.availableUnits === "number" && Number.isFinite(update.availableUnits)
            ? clamp(0, 40, Math.floor(update.availableUnits))
            : undefined,
        pricePerNight:
          typeof update.pricePerNight === "number" && Number.isFinite(update.pricePerNight)
            ? roundMoney(Math.max(80, update.pricePerNight))
            : undefined,
        stopSell: Boolean(update.stopSell),
        updatedAt: new Date().toISOString(),
      });
      appliedCount += 1;
    }
  }

  return {
    ...providerInventoryWebhookPayload(provider, appliedCount),
    eventId: params.eventId ?? `evt-${Date.now()}`,
  };
}

export function listMockPmsHotels(params?: {
  city?: string | null;
  hotelId?: string | null;
}) {
  const cityQuery = (params?.city ?? "").trim().toLowerCase();
  const hotelIdQuery = (params?.hotelId ?? "").trim().toUpperCase();

  return MOCK_HOTELS.filter((hotel) => {
    if (hotelIdQuery && hotel.hotelId !== hotelIdQuery) {
      return false;
    }
    if (
      cityQuery &&
      !hotel.address.city.toLowerCase().includes(cityQuery) &&
      !hotel.name.toLowerCase().includes(cityQuery) &&
      !hotel.address.country.toLowerCase().includes(cityQuery)
    ) {
      return false;
    }
    return true;
  });
}

export function getMockPmsHotelById(hotelId: string) {
  const normalized = hotelId.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  return MOCK_HOTELS.find((hotel) => hotel.hotelId === normalized) ?? null;
}

export function resolveProvider(value: string | null | undefined) {
  return normalizeProvider(value);
}

export function getDatasetStats() {
  return {
    hotels: MOCK_HOTELS.length,
    rooms: MOCK_HOTELS.reduce((sum, hotel) => sum + hotel.roomTypes.length, 0),
    activeReservations: Array.from(reservationStore.values()).filter(
      (reservation) => reservation.status === "CONFIRMED",
    ).length,
  };
}
