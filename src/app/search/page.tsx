import Link from "next/link";
import { cookies } from "next/headers";
import { differenceInCalendarDays } from "date-fns";
import { formatCurrency } from "@/lib/format";
import {
  getInventoryDisplayLabel,
  getRemainingInventory,
  isLowInventory,
  isRoomBookable,
} from "@/lib/inventory-availability";
import { DateRangePicker } from "@/components/date-range-picker";
import { GuestsSelector } from "@/components/guests-selector";
import { LANGUAGE_COOKIE_KEY, parseAppLanguage } from "@/lib/i18n";
import { fetchMockHotels } from "@/lib/mock-hotels-api";
import type { MockHotel } from "@/lib/mock-hotels";

type SearchPageParams = {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  facility?: string | string[];
  star?: string | string[];
  priceBand?: string | string[];
  view?: string;
};

type SearchResultHotel = {
  id: string;
  name: string;
  location: string;
  description: string;
  images: string[];
  minPrice: number;
  averageRating: number;
  stars: number;
  userScore: string;
  reviewCount: number;
  guestRatingText: string;
  distanceFromCenterKm: number;
  distanceToBeachKm: number;
  distanceToNightlifeKm: number;
  isPopularChoice: boolean;
  hasFreeCancellation: boolean;
  ratingLabel: string;
  remainingRooms: number;
  hasLowAvailability: boolean;
};

type TopDeal = {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  description: string;
  tag: string;
  ratingLabel: string;
  basePrice: number;
  dealPrice: number;
};
type WeekendUrgencyDeal = {
  id: string;
  name: string;
  location: string;
  imageUrl: string;
  description: string;
  ratingLabel: string;
  remainingRooms: number;
  basePrice: number;
  dealPrice: number;
  urgencyLabel: string;
};
type GroupedBookingCount = {
  roomTypeId: string;
  _count: { _all: number };
};
type BlockedHotel = { hotelId: string };

const POPULAR_DESTINATIONS = {
  he: [
    { city: "אילת", country: "ישראל" },
    { city: "חיפה", country: "ישראל" },
    { city: "טבריה", country: "ישראל" },
    { city: "תל אביב", country: "ישראל" },
    { city: "ירושלים", country: "ישראל" },
    { city: "נתניה", country: "ישראל" },
    { city: "אשדוד", country: "ישראל" },
    { city: "ים המלח", country: "ישראל" },
  ],
  en: [
    { city: "Eilat", country: "Israel" },
    { city: "Haifa", country: "Israel" },
    { city: "Tiberias", country: "Israel" },
    { city: "Tel Aviv", country: "Israel" },
    { city: "Jerusalem", country: "Israel" },
    { city: "Netanya", country: "Israel" },
    { city: "Ashdod", country: "Israel" },
    { city: "Dead Sea", country: "Israel" },
  ],
} as const;
const FACILITY_FILTER_OPTIONS = [
  { value: "wifi", he: "Wi-Fi חינם", en: "Free Wi-Fi" },
  { value: "parking", he: "חניה", en: "Parking" },
  { value: "pool", he: "בריכה", en: "Pool" },
  { value: "spa", he: "ספא", en: "Spa" },
  { value: "gym", he: "חדר כושר", en: "Gym" },
  { value: "breakfast", he: "ארוחת בוקר", en: "Breakfast included" },
  { value: "restaurant", he: "מסעדה", en: "Restaurant" },
  { value: "free-cancellation", he: "ביטול חינם", en: "Free cancellation" },
] as const;
const STAR_FILTER_OPTIONS = [
  { value: 5, he: "5 כוכבים ומעלה", en: "5 stars and up" },
  { value: 4, he: "4 כוכבים ומעלה", en: "4 stars and up" },
  { value: 3, he: "3 כוכבים ומעלה", en: "3 stars and up" },
] as const;
const PRICE_BAND_FILTER_OPTIONS = [
  { value: "budget", he: "עד ₪500", en: "Up to ₪500" },
  { value: "mid", he: "₪500 - ₪900", en: "₪500 - ₪900" },
  { value: "premium", he: "₪900 ומעלה", en: "₪900 and up" },
] as const;
const HOTEL_CHAINS = {
  he: ["פתאל", "ישרוטל", "דן", "לאונרדו", "הרברט סמואל", "בראון"],
  en: ["Fattal", "Isrotel", "Dan Hotels", "Leonardo", "Herbert Samuel", "Brown Hotels"],
} as const;

function parseImages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toArrayParam(value?: string | string[]) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function matchesPriceBand(minPrice: number, priceBand: string) {
  if (priceBand === "budget") {
    return minPrice <= 500;
  }
  if (priceBand === "mid") {
    return minPrice > 500 && minPrice <= 900;
  }
  if (priceBand === "premium") {
    return minPrice > 900;
  }

  return false;
}

function shortenDescription(text: unknown, maxLength = 150) {
  const normalized = asText(text).trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}
function getStarRating(averageRating: number) {
  if (averageRating >= 4.7) {
    return 5;
  }
  if (averageRating >= 4.1) {
    return 4;
  }
  if (averageRating >= 3.2) {
    return 3;
  }
  return 2;
}
function getGuestRatingText(averageRating: number, isHebrew: boolean) {
  if (averageRating >= 4.8) {
    return isHebrew ? "יוצא מן הכלל" : "Exceptional";
  }
  if (averageRating >= 4.5) {
    return isHebrew ? "מאוד מאוד טוב" : "Very very good";
  }
  if (averageRating >= 4.2) {
    return isHebrew ? "טוב מאוד" : "Very good";
  }
  if (averageRating > 0) {
    return isHebrew ? "טוב" : "Good";
  }
  return isHebrew ? "חדש" : "New";
}
function estimateDistanceFromCenterKm(hotelId: string) {
  const hash = hotelId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const value = 0.4 + (hash % 115) / 10;
  return Math.round(value * 10) / 10;
}
function estimateDistanceToBeachKm(hotelId: string) {
  const hash = hotelId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const value = 0.2 + (hash % 62) / 10;
  return Math.round(value * 10) / 10;
}
function estimateDistanceToNightlifeKm(hotelId: string) {
  const hash = hotelId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const value = 0.3 + (hash % 88) / 10;
  return Math.round(value * 10) / 10;
}
function getUpcomingWeekendRange(baseDate = new Date()) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const daysUntilFriday = (5 - start.getDay() + 7) % 7;
  start.setDate(start.getDate() + daysUntilFriday);

  const end = new Date(start);
  end.setDate(end.getDate() + 2);

  return { checkIn: start, checkOut: end };
}
function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function mapMockHotelToRawHotel(hotel: MockHotel) {
  const syntheticReviewCount = Math.max(1, Math.min(8, Math.round(hotel.reviewCount / 140)));
  return {
    id: hotel.id,
    name: hotel.name,
    location: hotel.location,
    description: hotel.description,
    facilities: hotel.facilities,
    images: hotel.images,
    roomTypes: hotel.rooms.map((room) => ({
      id: room.id,
      pricePerNight: room.pricePerNight,
      inventory: room.availableRooms,
      availableInventory: room.availableRooms,
      isAvailable: room.availableRooms > 0,
    })),
    reviews: Array.from({ length: syntheticReviewCount }, () => ({ rating: hotel.rating })),
  };
}

export default async function SearchPage({
  searchParams,
  showTopDeals = false,
}: {
  searchParams: Promise<SearchPageParams>;
  showTopDeals?: boolean;
}) {
  const cookieStore = await cookies();
  const language = parseAppLanguage(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value);
  const isHebrew = language === "he";
  const destinations = POPULAR_DESTINATIONS[language];
  const params = await searchParams;
  const requestedCheckInDate = parseDate(params.checkIn);
  const requestedCheckOutDate = parseDate(params.checkOut);
  const hasRequestedDateRange = Boolean(
    requestedCheckInDate &&
      requestedCheckOutDate &&
      requestedCheckOutDate.getTime() > requestedCheckInDate.getTime(),
  );
  const requestedNights =
    hasRequestedDateRange && requestedCheckInDate && requestedCheckOutDate
      ? Math.max(0, differenceInCalendarDays(requestedCheckOutDate, requestedCheckInDate))
      : 0;
  const requestedNightsLabel =
    requestedNights > 0
      ? isHebrew
        ? requestedNights === 1
          ? "לילה אחד"
          : `${requestedNights} לילות`
        : requestedNights === 1
          ? "1 night"
          : `${requestedNights} nights`
      : null;
  const cityQuery = params.city?.trim().toLowerCase() ?? "";
  const selectedFacilities = new Set(toArrayParam(params.facility).map((value) => value.toLowerCase()));
  const selectedStars = toArrayParam(params.star)
    .map((value) => Number(value))
    .filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 5);
  const selectedPriceBands = new Set(toArrayParam(params.priceBand));
  let dataLoadError = false;
  let hotelsRaw: Array<{
    id: string;
    name: string;
    location: string;
    description: string;
    facilities: unknown;
    images: unknown;
    roomTypes: Array<{
      id: string;
      pricePerNight: number;
      inventory: number;
      availableInventory: number;
      isAvailable: boolean;
    }>;
    reviews: Array<{ rating: number }>;
  }> = [];

  try {
    const mockHotels = await fetchMockHotels({ limit: 50 });
    hotelsRaw = mockHotels.map((hotel) => mapMockHotelToRawHotel(hotel));
  } catch (error) {
    dataLoadError = true;
    console.error("Failed to load search hotels", error);
  }

  const topDealTags = isHebrew
    ? ["דיל של הרגע האחרון", "יעד מבוקש", "מבצע לסופ\"ש", "הנחה לזמן מוגבל"]
    : ["Last-minute deal", "Popular destination", "Weekend sale", "Limited-time discount"];

  const topDeals: TopDeal[] = showTopDeals
    ? hotelsRaw
        .slice(0, 8)
        .map((hotel, index) => {
          const images = parseImages(hotel.images);
          const basePrice = hotel.roomTypes.length
            ? Math.min(...hotel.roomTypes.map((roomType) => Number(roomType.pricePerNight) || 0))
            : 0;
          const reviewsCount = hotel.reviews.length;
          const averageRating = reviewsCount
            ? hotel.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewsCount
            : 0;
          const discountRate = [20, 15, 18, 22][index % 4];
          const dealPrice =
            basePrice > 0 ? Math.max(1, Math.round(basePrice * (1 - discountRate / 100))) : 0;

          return {
            id: hotel.id,
            name: asText(hotel.name),
            location: asText(hotel.location),
            imageUrl: images[0] ?? "",
            description: shortenDescription(hotel.description, 110),
            tag: topDealTags[index % topDealTags.length],
            ratingLabel: reviewsCount > 0 ? averageRating.toFixed(1) : isHebrew ? "חדש" : "New",
            basePrice,
            dealPrice,
          };
        })
        .filter((deal) => deal.basePrice > 0)
    : [];
  const overlappingBookings: GroupedBookingCount[] = [];
  const blockedDates: BlockedHotel[] = [];
  const weekendRange = getUpcomingWeekendRange();
  const weekendCheckInParam = formatDateParam(weekendRange.checkIn);
  const weekendCheckOutParam = formatDateParam(weekendRange.checkOut);
  const weekendLabel = new Intl.DateTimeFormat(isHebrew ? "he-IL" : "en-US", {
    day: "2-digit",
    month: "2-digit",
  });
  const weekendOverlappingBookings: GroupedBookingCount[] = [];
  const weekendBlockedDates: BlockedHotel[] = [];
  const overlappingByRoomType = new Map(
    overlappingBookings.map((item) => [item.roomTypeId, item._count._all]),
  );
  const blockedHotelIds = new Set(blockedDates.map((blockedDate) => blockedDate.hotelId));
  const weekendOverlappingByRoomType = new Map(
    weekendOverlappingBookings.map((item) => [item.roomTypeId, item._count._all]),
  );
  const weekendBlockedHotelIds = new Set(weekendBlockedDates.map((blockedDate) => blockedDate.hotelId));
  const sharedHotelQuery = new URLSearchParams();
  if (params.checkIn) {
    sharedHotelQuery.set("checkIn", params.checkIn);
  }
  if (params.checkOut) {
    sharedHotelQuery.set("checkOut", params.checkOut);
  }
  if (params.guests) {
    sharedHotelQuery.set("guests", params.guests);
  }
  toArrayParam(params.facility).forEach((facility) => {
    sharedHotelQuery.append("facility", facility);
  });
  toArrayParam(params.star).forEach((star) => {
    sharedHotelQuery.append("star", star);
  });
  toArrayParam(params.priceBand).forEach((priceBand) => {
    sharedHotelQuery.append("priceBand", priceBand);
  });
  const hotelLinkSuffix = sharedHotelQuery.toString();
  const weekendDealQuery = new URLSearchParams({
    checkIn: weekendCheckInParam,
    checkOut: weekendCheckOutParam,
    guests: params.guests ?? "2",
  }).toString();
  const currentSearchQuery = new URLSearchParams();
  if (params.city) {
    currentSearchQuery.set("city", params.city);
  }
  if (params.checkIn) {
    currentSearchQuery.set("checkIn", params.checkIn);
  }
  if (params.checkOut) {
    currentSearchQuery.set("checkOut", params.checkOut);
  }
  if (params.guests) {
    currentSearchQuery.set("guests", params.guests);
  }
  toArrayParam(params.facility).forEach((facility) => currentSearchQuery.append("facility", facility));
  toArrayParam(params.star).forEach((star) => currentSearchQuery.append("star", star));
  toArrayParam(params.priceBand).forEach((priceBand) => currentSearchQuery.append("priceBand", priceBand));
  const isMapView = params.view === "map";
  const mapViewQuery = new URLSearchParams(currentSearchQuery);
  mapViewQuery.set("view", "map");
  const listViewQuery = new URLSearchParams(currentSearchQuery);
  listViewQuery.delete("view");
  const hasFreeCancellationFilter = selectedFacilities.has("free-cancellation");
  const freeCancellationQuery = new URLSearchParams(currentSearchQuery);
  if (!hasFreeCancellationFilter) {
    freeCancellationQuery.append("facility", "free-cancellation");
  } else {
    const facilitiesWithoutFree = toArrayParam(params.facility).filter(
      (facility) => facility.toLowerCase() !== "free-cancellation",
    );
    freeCancellationQuery.delete("facility");
    facilitiesWithoutFree.forEach((facility) => freeCancellationQuery.append("facility", facility));
  }
  const mapQuery = params.city?.trim() || hotelsRaw[0]?.location || (isHebrew ? "מלונות בישראל" : "Hotels in Israel");
  const mapEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
  const selectedSummaryBadges = [
    ...toArrayParam(params.priceBand)
      .map((band) => PRICE_BAND_FILTER_OPTIONS.find((option) => option.value === band))
      .filter((value): value is (typeof PRICE_BAND_FILTER_OPTIONS)[number] => Boolean(value))
      .map((option) => (isHebrew ? option.he : option.en)),
    ...toArrayParam(params.star).map((star) =>
      isHebrew ? `${star}★ ומעלה` : `${star}★ and up`,
    ),
    ...toArrayParam(params.facility)
      .map((facility) =>
        FACILITY_FILTER_OPTIONS.find((option) => option.value === facility.toLowerCase()),
      )
      .filter((value): value is (typeof FACILITY_FILTER_OPTIONS)[number] => Boolean(value))
      .map((option) => (isHebrew ? option.he : option.en)),
  ];

  const hotels: SearchResultHotel[] = hotelsRaw.reduce<SearchResultHotel[]>((acc, hotel) => {
    const hotelName = asText(hotel.name);
    const hotelLocation = asText(hotel.location);
    const cityMatch =
      cityQuery.length === 0 ||
      hotelLocation.toLowerCase().includes(cityQuery) ||
      hotelName.toLowerCase().includes(cityQuery);

    if (!cityMatch) {
      return acc;
    }
    const hotelBlockedForRequestedDates = hasRequestedDateRange && blockedHotelIds.has(hotel.id);
    const roomAvailability = hotel.roomTypes.map((roomType) => {
      const overlappingCount = hasRequestedDateRange
        ? Number(overlappingByRoomType.get(roomType.id) ?? 0)
        : 0;
      const remaining = getRemainingInventory({
        inventory: Number(roomType.inventory),
        availableInventory: Number(roomType.availableInventory),
        overlappingBookings: overlappingCount,
      });
      const isAvailable = isRoomBookable({
        roomIsAvailable: roomType.isAvailable,
        remainingInventory: remaining,
        hotelBlockedByDates: hotelBlockedForRequestedDates,
      });

      return {
        roomType,
        remaining,
        isAvailable,
      };
    });
    const availableRooms = roomAvailability.filter((room) => room.isAvailable);
    if (availableRooms.length === 0) {
      return acc;
    }
    const remainingRooms = availableRooms.reduce((sum, room) => sum + room.remaining, 0);
    const minPrice = availableRooms.length
      ? Math.min(...availableRooms.map((room) => Number(room.roomType.pricePerNight) || 0))
      : 0;

    const reviewsCount = hotel.reviews.length;
    const averageRating = reviewsCount
      ? hotel.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewsCount
      : 0;
    const stars = getStarRating(averageRating);
    const userScore = reviewsCount > 0 ? averageRating.toFixed(1) : isHebrew ? "חדש" : "New";
    const guestRatingText = getGuestRatingText(averageRating, isHebrew);
    const distanceFromCenterKm = estimateDistanceFromCenterKm(hotel.id);
    const distanceToBeachKm = estimateDistanceToBeachKm(hotel.id);
    const distanceToNightlifeKm = estimateDistanceToNightlifeKm(hotel.id);
    const normalizedFacilities = Array.isArray(hotel.facilities)
      ? hotel.facilities.map((facility) => asText(facility).trim().toLowerCase()).filter(Boolean)
      : [];
    const hasFreeCancellation = normalizedFacilities.some(
      (facility) => facility.includes("free-cancellation") || facility.includes("ביטול"),
    );
    const facilitiesMatch =
      selectedFacilities.size === 0 ||
      Array.from(selectedFacilities).every((facility) => normalizedFacilities.includes(facility));
    if (!facilitiesMatch) {
      return acc;
    }
    const starsMatch = selectedStars.length === 0 || selectedStars.some((star) => averageRating >= star);
    if (!starsMatch) {
      return acc;
    }
    const priceBandMatch =
      selectedPriceBands.size === 0 ||
      Array.from(selectedPriceBands).some((priceBand) => matchesPriceBand(minPrice, priceBand));
    if (!priceBandMatch) {
      return acc;
    }

    acc.push({
      id: hotel.id,
      name: hotelName,
      location: hotelLocation,
      description: shortenDescription(hotel.description),
      images: parseImages(hotel.images),
      minPrice,
      averageRating,
      stars,
      userScore,
      reviewCount: reviewsCount,
      guestRatingText,
      distanceFromCenterKm,
      distanceToBeachKm,
      distanceToNightlifeKm,
      isPopularChoice: averageRating >= 4.4 || remainingRooms <= 5,
      hasFreeCancellation,
      ratingLabel: reviewsCount > 0 ? averageRating.toFixed(1) : isHebrew ? "חדש" : "New",
      remainingRooms,
      hasLowAvailability: isLowInventory(remainingRooms),
    });

    return acc;
  }, []);
  const weekendUrgencyDeals: WeekendUrgencyDeal[] = showTopDeals
    ? hotelsRaw
        .reduce<WeekendUrgencyDeal[]>((acc, hotel) => {
          if (weekendBlockedHotelIds.has(hotel.id)) {
            return acc;
          }
          const weekendAvailability = hotel.roomTypes.map((roomType) => {
            const overlappingCount = Number(weekendOverlappingByRoomType.get(roomType.id) ?? 0);
            const remaining = getRemainingInventory({
              inventory: Number(roomType.inventory),
              availableInventory: Number(roomType.availableInventory),
              overlappingBookings: overlappingCount,
            });
            const isAvailable = isRoomBookable({
              roomIsAvailable: roomType.isAvailable,
              remainingInventory: remaining,
              hotelBlockedByDates: false,
            });
            return { roomType, remaining, isAvailable };
          });
          const availableWeekendRooms = weekendAvailability.filter((room) => room.isAvailable);
          if (availableWeekendRooms.length === 0) {
            return acc;
          }
          const remainingRooms = availableWeekendRooms.reduce((sum, room) => sum + room.remaining, 0);
          if (remainingRooms > 12) {
            return acc;
          }
          const basePrice = Math.min(
            ...availableWeekendRooms.map((room) => Number(room.roomType.pricePerNight) || 0),
          );
          if (!Number.isFinite(basePrice) || basePrice <= 0) {
            return acc;
          }
          const discountRate = remainingRooms <= 3 ? 24 : remainingRooms <= 6 ? 18 : 12;
          const dealPrice = Math.max(1, Math.round(basePrice * (1 - discountRate / 100)));

          acc.push({
            id: hotel.id,
            name: asText(hotel.name),
            location: asText(hotel.location),
            imageUrl: parseImages(hotel.images)[0] ?? "",
            description: shortenDescription(hotel.description, 95),
            ratingLabel:
              hotel.reviews.length > 0
                ? (
                    hotel.reviews.reduce((sum, review) => sum + review.rating, 0) /
                    hotel.reviews.length
                  ).toFixed(1)
                : isHebrew
                  ? "חדש"
                  : "New",
            remainingRooms,
            basePrice,
            dealPrice,
            urgencyLabel: isHebrew
              ? remainingRooms <= 3
                ? `כמעט סולד אאוט • נשארו רק ${remainingRooms} חדרים לסופ״ש`
                : `זמינות לסופ״ש: ${remainingRooms} חדרים אחרונים`
              : remainingRooms <= 3
                ? `Almost sold out • only ${remainingRooms} rooms left for this weekend`
                : `Weekend availability: ${remainingRooms} rooms left`,
          });

          return acc;
        }, [])
        .sort((a, b) => a.remainingRooms - b.remainingRooms || a.dealPrice - b.dealPrice)
        .slice(0, 6)
    : [];
  const renderFavoriteControl = (_hotelId?: string) => {
    void _hotelId;

    return (
      <span
        aria-label={isHebrew ? "מועדפים במצב דמו" : "Favorites unavailable in mock mode"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-400 shadow-sm"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
          <path
            d="M12.001 20.727 4.93 13.656a4.5 4.5 0 1 1 6.364-6.364l.707.707.707-.707a4.5 4.5 0 1 1 6.364 6.364z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  };

  const resultsTitle = params.city?.trim()
    ? isHebrew
      ? `מקומות אירוח ב${params.city.trim()}`
      : `Places to stay in ${params.city.trim()}`
    : isHebrew
      ? "מקומות אירוח מומלצים"
      : "Recommended places to stay";
  const summaryText = isHebrew
    ? hotels.length === 1
      ? "נמצא מקום אירוח אחד"
      : `נמצאו ${hotels.length} מקומות אירוח`
    : hotels.length === 1
      ? "1 place to stay found"
      : `${hotels.length} places to stay found`;
  const hasActiveSearch = Boolean(params.city?.trim() || hasRequestedDateRange || params.guests?.trim());
  const showAdvancedFilters = hasActiveSearch && hotels.length > 0;
  const footerCities = Array.from(
    new Set([
      ...destinations.map((destination) => destination.city.trim()).filter(Boolean),
      ...hotelsRaw
        .map((hotel) => asText(hotel.location).split(",")[0]?.trim() ?? "")
        .filter(Boolean),
    ]),
  );
  const footerCompanyName = "BookMeNow";

  return (
    <div className="min-h-screen space-y-8 pb-12">
      <section className="relative left-1/2 right-1/2 -mt-6 -mx-[50vw] w-screen overflow-visible bg-[var(--color-primary)] px-6 py-10 text-white shadow-xl sm:px-10 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            {isHebrew ? "מצאו את החופשה הבאה שלכם" : "Find your next vacation"}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-blue-100 sm:text-lg">
            {isHebrew
              ? "חפשו מלונות, דירות ומקומות אירוח מיוחדים בארץ ובעולם."
              : "Search hotels, apartments, and unique stays in Israel and worldwide."}
          </p>

          <form
            action="/search"
            className="relative z-20 mt-8 rounded-2xl border-4 border-[#7cc7ff] bg-gradient-to-b from-[#eaf7ff] to-white p-2 shadow-2xl"
          >
            {toArrayParam(params.facility).map((facility) => (
              <input key={`hero-facility-${facility}`} type="hidden" name="facility" value={facility} />
            ))}
            {toArrayParam(params.star).map((star) => (
              <input key={`hero-star-${star}`} type="hidden" name="star" value={star} />
            ))}
            {toArrayParam(params.priceBand).map((priceBand) => (
              <input key={`hero-priceBand-${priceBand}`} type="hidden" name="priceBand" value={priceBand} />
            ))}
            <div className="grid gap-2 lg:grid-cols-[1.5fr_1.4fr_1.1fr_auto]">

              <label className="rounded-xl border border-slate-200 px-3 py-2">
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  {isHebrew ? "יעד" : "Destination"}
                </span>
                <input
                  name="city"
                  list="popular-destinations"
                  defaultValue={params.city}
                  placeholder={isHebrew ? "לאן?" : "Where are you going?"}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none"
                />
                <datalist id="popular-destinations">
                  {destinations.map((destination) => (
                    <option
                      key={`${destination.city}-${destination.country}`}
                      value={destination.city}
                      label={`${destination.city}, ${destination.country}`}
                    />
                  ))}
                </datalist>
              </label>

              <DateRangePicker
                key={`${params.checkIn ?? ""}_${params.checkOut ?? ""}`}
                checkIn={params.checkIn}
                checkOut={params.checkOut}
                language={language}
              />

              <GuestsSelector guests={params.guests} language={language} />

              <button
                type="submit"
                className="rounded-xl bg-[var(--color-primary-light)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                {isHebrew ? "חיפוש" : "Search"}
              </button>
            </div>
          </form>

        </div>
      </section>

      {showTopDeals && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                {isHebrew ? "מלונות מומלצים" : "Recommended stays"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isHebrew
                  ? "בחירות מובילות עם תמונות גדולות, מיקום מרכזי ומחיר משתלם."
                  : "Top picks with large imagery, prime locations, and compelling prices."}
              </p>
            </div>
          </div>

          {topDeals.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center text-slate-600 shadow-sm">
              {isHebrew
                ? "המבצעים מתעדכנים כרגע. חזרו בעוד רגע להצעות חדשות."
                : "Deals are being updated right now. Check back soon for new offers."}
            </div>
          )}
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {topDeals.map((deal) => (
              <article
                key={deal.id}
                className="min-w-[300px] max-w-[340px] snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="relative h-52 w-full bg-slate-200 bg-cover bg-center"
                  style={deal.imageUrl ? { backgroundImage: `url(${deal.imageUrl})` } : undefined}
                >
                  <span className="absolute left-3 top-3 rounded-full bg-[var(--color-cta)] px-2.5 py-1 text-xs font-semibold text-slate-900">
                    {deal.tag}
                  </span>
                  <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                    {isHebrew ? "בחירה מומלצת" : "Popular choice"}
                  </span>
                  <div className="absolute right-3 top-3">{renderFavoriteControl(deal.id)}</div>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                      <span>{deal.name}</span>
                      <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {deal.ratingLabel}
                      </span>
                    </h3>
                    <p className="text-sm text-slate-500">{deal.location}</p>
                  </div>

                  <p className="text-sm leading-6 text-slate-600">{deal.description}</p>

                  <div className="flex items-end justify-between gap-2 pt-1">
                    <div>
                      <p className="text-xs text-slate-500">
                        {isHebrew ? "מחיר מבצע החל מ־" : "Deal price from"}
                      </p>
                      <p className="text-lg font-bold text-[var(--color-primary-light)]">
                        {formatCurrency(deal.dealPrice)}
                      </p>
                      <p className="text-xs text-slate-400 line-through">
                        {formatCurrency(deal.basePrice)}
                      </p>
                    </div>

                    <Link
                      href={`/hotels/${deal.id}${hotelLinkSuffix ? `?${hotelLinkSuffix}` : ""}`}
                      className="rounded-xl bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-105"
                    >
                      {isHebrew ? "הזמן עכשיו" : "Book now"}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {showTopDeals && (
        <section className="space-y-4 rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-amber-50 to-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                {isHebrew ? "דילים לסופ״ש הקרוב" : "This weekend sell-out deals"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {isHebrew
                  ? `הזדמנויות למחירים חמים בתאריכים ${weekendLabel.format(weekendRange.checkIn)} - ${weekendLabel.format(weekendRange.checkOut)}`
                  : `Hot prices for ${weekendLabel.format(weekendRange.checkIn)} - ${weekendLabel.format(weekendRange.checkOut)}`}
              </p>
            </div>
            <Link
              href={`/search?checkIn=${weekendCheckInParam}&checkOut=${weekendCheckOutParam}`}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              {isHebrew ? "לכל דילי הסופ״ש" : "See all weekend deals"}
            </Link>
          </div>

          {weekendUrgencyDeals.length === 0 && (
            <div className="rounded-2xl bg-white p-6 text-sm text-slate-600">
              {isHebrew
                ? "כרגע אין דילים דחופים לסופ״ש הקרוב. בדקו שוב בעוד רגע."
                : "No urgent weekend deals right now. Check back shortly."}
            </div>
          )}

          {weekendUrgencyDeals.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {weekendUrgencyDeals.map((deal) => {
                const discountPercent = Math.max(
                  0,
                  Math.round(((deal.basePrice - deal.dealPrice) / Math.max(1, deal.basePrice)) * 100),
                );

                return (
                  <article
                    key={`weekend-${deal.id}`}
                    className="overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-sm"
                  >
                    <div
                      className="relative h-36 w-full bg-slate-200 bg-cover bg-center"
                      style={deal.imageUrl ? { backgroundImage: `url(${deal.imageUrl})` } : undefined}
                    >
                      <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white">
                        {isHebrew ? `-${discountPercent}%` : `${discountPercent}% off`}
                      </span>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                            <span>{deal.name}</span>
                            <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              {deal.ratingLabel}
                            </span>
                          </h3>
                          <p className="text-sm text-slate-500">{deal.location}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderFavoriteControl(deal.id)}
                          <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700">
                            {isHebrew ? "סופ״ש חם" : "Weekend hot"}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-rose-700">{deal.urgencyLabel}</p>
                      <p className="text-sm text-slate-600">{deal.description}</p>

                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-500">
                            {isHebrew ? "מחיר לסופ״ש החל מ־" : "Weekend deal from"}
                          </p>
                          <p className="text-lg font-bold text-[var(--color-primary-light)]">
                            {formatCurrency(deal.dealPrice)}
                          </p>
                          <p className="text-xs text-slate-400 line-through">
                            {formatCurrency(deal.basePrice)}
                          </p>
                        </div>
                        <Link
                          href={`/hotels/${deal.id}?${weekendDealQuery}`}
                          className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:brightness-105"
                        >
                          {isHebrew ? "לתפוס דיל" : "Grab deal"}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        {dataLoadError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {isHebrew
              ? "הייתה תקלה זמנית בטעינת המלונות. רעננו את העמוד ונסו שוב."
              : "There was a temporary issue loading hotels. Refresh and try again."}
          </div>
        )}
        <div className={showAdvancedFilters ? "grid gap-6 lg:grid-cols-[280px_1fr]" : "space-y-4"}>
          {showAdvancedFilters && (
            <aside className="self-start rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
              <h3 className="text-lg font-semibold text-slate-900">
                {isHebrew ? "סינון מתקדם" : "Advanced filters"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {isHebrew ? "בחרו אפשרויות סינון עם תיבות סימון." : "Select filters using checkboxes."}
              </p>
              <form action="/search" className="mt-4 space-y-4">
                {params.city && <input type="hidden" name="city" value={params.city} />}
                {params.checkIn && <input type="hidden" name="checkIn" value={params.checkIn} />}
                {params.checkOut && <input type="hidden" name="checkOut" value={params.checkOut} />}
                {params.guests && <input type="hidden" name="guests" value={params.guests} />}

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-slate-700">
                    {isHebrew ? "מתקנים" : "Facilities"}
                  </legend>
                  {FACILITY_FILTER_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="facility"
                        value={option.value}
                        defaultChecked={selectedFacilities.has(option.value)}
                      />
                      <span>{isHebrew ? option.he : option.en}</span>
                    </label>
                  ))}
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-slate-700">
                    {isHebrew ? "דירוג כוכבים" : "Star rating"}
                  </legend>
                  {STAR_FILTER_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="star"
                        value={option.value}
                        defaultChecked={selectedStars.includes(option.value)}
                      />
                      <span>{isHebrew ? option.he : option.en}</span>
                    </label>
                  ))}
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold text-slate-700">
                    {isHebrew ? "טווח מחיר ללילה" : "Price per night"}
                  </legend>
                  {PRICE_BAND_FILTER_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="priceBand"
                        value={option.value}
                        defaultChecked={selectedPriceBands.has(option.value)}
                      />
                      <span>{isHebrew ? option.he : option.en}</span>
                    </label>
                  ))}
                </fieldset>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white"
                >
                  {isHebrew ? "עדכן סינון" : "Apply filters"}
                </button>
              </form>
            </aside>
          )}

          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{resultsTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{summaryText}</p>
              </div>
              <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Link
                  href={`/search?${listViewQuery.toString()}`}
                  className={`px-3 py-2 text-xs font-semibold transition ${
                    !isMapView
                      ? "bg-[var(--color-primary-light)] text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {isHebrew ? "רשימה" : "List"}
                </Link>
                <Link
                  href={`/search?${mapViewQuery.toString()}`}
                  className={`border-s border-slate-200 px-3 py-2 text-xs font-semibold transition ${
                    isMapView
                      ? "bg-[var(--color-primary-light)] text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {isHebrew ? "מפה" : "Map"}
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/search?${freeCancellationQuery.toString()}`}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  hasFreeCancellationFilter
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isHebrew ? "ביטול חינם" : "Free cancellation"}
              </Link>
              {selectedSummaryBadges.slice(0, 5).map((badge) => (
                <span
                  key={`active-filter-${badge}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {badge}
                </span>
              ))}
            </div>
            {isMapView && (
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
                <iframe
                  title={isHebrew ? "מפת מלונות" : "Hotels map"}
                  src={mapEmbedSrc}
                  className="h-72 w-full rounded-xl border border-slate-200"
                  loading="lazy"
                />
                <div className="flex flex-wrap gap-2">
                  {hotels.slice(0, 6).map((hotel) => (
                    <a
                      key={`map-hotel-${hotel.id}`}
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name} ${hotel.location}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      {hotel.name}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {hotels.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center text-slate-600 shadow-sm">
                {isHebrew
                  ? "לא נמצאו מקומות אירוח שמתאימים לחיפוש. נסו יעד אחר."
                  : "No stays matched your search. Try a different destination."}
              </div>
            )}

            <div className="space-y-5">
              {hotels.map((hotel) => {
                const imageUrl = hotel.images[0] ?? "";
                const hotelDetailsHref = `/hotels/${hotel.id}${hotelLinkSuffix ? `?${hotelLinkSuffix}` : ""}`;

                return (
                  <article
                    key={hotel.id}
                    className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:flex"
                  >
                    <div className="h-48 w-full bg-slate-200 md:h-auto md:w-72 md:flex-shrink-0">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={hotel.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
                          {isHebrew ? "תמונה תתווסף בקרוב" : "Image coming soon"}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 p-5 md:flex md:flex-1 md:flex-col md:space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="inline-flex items-center gap-2 text-lg font-semibold">
                            <Link
                              href={hotelDetailsHref}
                              className="text-[var(--color-primary-light)] transition hover:text-blue-400 hover:underline"
                            >
                              {hotel.name}
                            </Link>
                            <Link
                              href={hotelDetailsHref}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-bold text-blue-600 transition hover:bg-blue-100"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
                                <path
                                  d="M12 2 14.9 8.1 22 9.2l-5.2 5.1 1.2 7L12 18l-6 3.3 1.2-7L2 9.2l7.1-1.1z"
                                  fill="currentColor"
                                />
                              </svg>
                              <span>{hotel.userScore}</span>
                            </Link>
                            <span className="text-xs font-medium text-slate-500">
                              {isHebrew
                                ? `${hotel.guestRatingText} · ${hotel.reviewCount} חוות דעת`
                                : `${hotel.guestRatingText} · ${hotel.reviewCount} reviews`}
                            </span>
                          </h3>
                          <div className="mt-1 flex items-center gap-1 text-amber-500">
                            {Array.from({ length: hotel.stars }).map((_, index) => (
                              <svg key={`star-${hotel.id}-${index}`} viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
                                <path d="m12 3 2.6 5.3 5.9.8-4.3 4.2 1 5.9L12 16.8 6.8 19.2l1-5.9L3.5 9.1l5.9-.8z" />
                              </svg>
                            ))}
                          </div>
                          <p className="text-sm text-slate-500">{hotel.location}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
                                <path
                                  d="M12 21s7-5.9 7-11a7 7 0 1 0-14 0c0 5.1 7 11 7 11Z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                              </svg>
                              <span>
                                {isHebrew
                                  ? `${hotel.distanceFromCenterKm} ק״מ מהמרכז`
                                  : `${hotel.distanceFromCenterKm} km from center`}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
                                <path
                                  d="M3 16c1.1 1 2.2 1.5 3.5 1.5S9 17 10.3 16c1.1 1 2.2 1.5 3.5 1.5s2.5-.5 3.7-1.5c1.1 1 2.2 1.5 3.5 1.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span>
                                {isHebrew
                                  ? `${hotel.distanceToBeachKm} ק״מ מהים`
                                  : `${hotel.distanceToBeachKm} km from the beach`}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
                                <path
                                  d="M6 4v8m0 0a3 3 0 0 0 3-3V4M6 12a3 3 0 0 1-3-3V4M13 4h2v8m0 8V4m4 16V10a3 3 0 0 0-3-3"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span>
                                {isHebrew
                                  ? `${hotel.distanceToNightlifeKm} ק״מ מאזורי בילוי`
                                  : `${hotel.distanceToNightlifeKm} km from nightlife`}
                              </span>
                            </span>
                          </div>
                          {hotel.isPopularChoice && (
                            <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              {isHebrew ? "בחירה פופולרית" : "Popular choice"}
                            </span>
                          )}
                          {hotel.hasFreeCancellation && (
                            <span className="mt-1 ms-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              {isHebrew ? "ביטול חינם" : "Free cancellation"}
                            </span>
                          )}
                          {requestedNightsLabel && (
                            <p className="mt-1 text-xs font-medium text-[var(--color-primary-light)]">
                              {isHebrew ? `מבוקש: ${requestedNightsLabel}` : `Requested: ${requestedNightsLabel}`}
                            </p>
                          )}
                          {hotel.hasLowAvailability && (
                            <p className="mt-1 text-xs font-semibold text-rose-600">
                              {getInventoryDisplayLabel({
                                state: "lowStock",
                                remainingInventory: hotel.remainingRooms,
                                locale: isHebrew ? "he" : "en",
                              })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {renderFavoriteControl(hotel.id)}
                        </div>
                      </div>

                      <p className="text-sm leading-6 text-slate-600">{hotel.description}</p>

                      <div className="flex items-end justify-between gap-3 pt-2 md:mt-auto">
                        <div>
                          <p className="text-xs text-slate-500">{isHebrew ? "החל מ־" : "From"}</p>
                          <p className="text-xl font-bold text-[var(--color-primary-light)]">
                            {formatCurrency(hotel.minPrice)}
                          </p>
                          <p className="text-xs text-slate-500">{isHebrew ? "ללילה" : "per night"}</p>
                        </div>

                        <Link
                          href={hotelDetailsHref}
                          className="rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
                        >
                          {isHebrew ? "צפייה במלון" : "View hotel"}
                        </Link>
                      </div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name} ${hotel.location}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-[var(--color-primary-light)]"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
                          <path
                            d="M12 21s7-5.9 7-11a7 7 0 1 0-14 0c0 5.1 7 11 7 11Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                        <span>{isHebrew ? "הצג במפה" : "Show on map"}</span>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 pt-6">
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {isHebrew ? "ערים פופולריות להזמנה" : "Popular cities for stays"}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {footerCities.map((city) => (
                <span
                  key={`footer-city-${city}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {isHebrew ? "רשתות מובילות" : "Leading hotel chains"}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {HOTEL_CHAINS[language].map((chain) => (
                <span
                  key={`footer-chain-${chain}`}
                  className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800"
                >
                  {chain}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 text-slate-500">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M14.8 9.4a3.2 3.2 0 1 0 0 5.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span>
              {isHebrew
                ? `כל הזכויות שמורות לחברת ${footerCompanyName}`
                : `All rights reserved to ${footerCompanyName}`}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
