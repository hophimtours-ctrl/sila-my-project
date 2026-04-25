export type MockRoom = {
  id: string;
  name: string;
  bedType: string;
  maxGuests: number;
  pricePerNight: number;
  currency: "ILS";
  availableRooms: number;
  cancellationPolicy: string;
  breakfastIncluded: boolean;
  amenities: string[];
  photos: string[];
};

export type MockHotel = {
  id: string;
  externalId: string;
  slug: string;
  name: string;
  location: string;
  city: string;
  country: string;
  description: string;
  facilities: string[];
  images: string[];
  rating: number;
  stars: number;
  reviewCount: number;
  userScore: number;
  distanceFromCenterKm: number;
  hasFreeCancellation: boolean;
  isPopularChoice: boolean;
  basePrice: number;
  dealPrice: number;
  currency: "ILS";
  rooms: MockRoom[];
};

const FACILITY_POOL = [
  "Free Wi-Fi",
  "Parking",
  "Pool",
  "Spa",
  "Gym",
  "Restaurant",
  "Bar",
  "Room service",
  "24/7 reception",
  "Airport shuttle",
  "Breakfast included",
  "Beach access",
  "Pet friendly",
  "Family rooms",
  "Non-smoking rooms",
  "Accessible rooms",
  "Air conditioning",
  "Free cancellation",
];

const CITY_POOL = [
  { city: "תל אביב", country: "ישראל", cityEn: "Tel Aviv", district: "מרכז העיר", lat: 32.0853, lng: 34.7818 },
  { city: "ירושלים", country: "ישראל", cityEn: "Jerusalem", district: "שער יפו", lat: 31.7683, lng: 35.2137 },
  { city: "חיפה", country: "ישראל", cityEn: "Haifa", district: "המושבה הגרמנית", lat: 32.794, lng: 34.9896 },
  { city: "אילת", country: "ישראל", cityEn: "Eilat", district: "טיילת הים האדום", lat: 29.5577, lng: 34.9519 },
  { city: "נתניה", country: "ישראל", cityEn: "Netanya", district: "קו החוף", lat: 32.3215, lng: 34.8532 },
  { city: "טבריה", country: "ישראל", cityEn: "Tiberias", district: "טיילת הכנרת", lat: 32.7959, lng: 35.5309 },
  { city: "ים המלח", country: "ישראל", cityEn: "Dead Sea", district: "עין בוקק", lat: 31.2, lng: 35.36 },
  { city: "אשדוד", country: "ישראל", cityEn: "Ashdod", district: "מרינה", lat: 31.8014, lng: 34.6435 },
  { city: "באר שבע", country: "ישראל", cityEn: "Beer Sheva", district: "העיר העתיקה", lat: 31.2518, lng: 34.7915 },
  { city: "נצרת", country: "ישראל", cityEn: "Nazareth", district: "העיר העתיקה", lat: 32.702, lng: 35.2973 },
] as const;

const HOTEL_PREFIXES = [
  "Royal",
  "Sunset",
  "Urban",
  "Blue",
  "Grand",
  "Golden",
  "Olive",
  "Carmel",
  "Desert",
  "Harbor",
];

const HOTEL_SUFFIXES = [
  "Suites",
  "Resort",
  "Boutique",
  "Collection",
  "Palace",
  "Heights",
  "Bay Hotel",
  "Gardens",
  "Plaza",
  "Residence",
];

const ROOM_TEMPLATES = [
  { name: "Standard Room", bedType: "Queen bed", maxGuests: 2 },
  { name: "Deluxe Room", bedType: "King bed", maxGuests: 3 },
  { name: "Family Suite", bedType: "2 Queen beds", maxGuests: 4 },
] as const;

function makeSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeImageSet(prefix: string, seedBase: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const seed = seedBase * 10 + index + 1;
    return `https://picsum.photos/seed/${prefix}-${seed}/1200/800`;
  });
}

function pickFacilities(index: number) {
  const offset = index % FACILITY_POOL.length;
  const rotated = [...FACILITY_POOL.slice(offset), ...FACILITY_POOL.slice(0, offset)];
  const unique = new Set(rotated.slice(0, 10));
  unique.add("Free Wi-Fi");
  unique.add("Free cancellation");
  return Array.from(unique);
}

function createMockHotels(count = 50): MockHotel[] {
  return Array.from({ length: count }, (_, index) => {
    const seq = index + 1;
    const cityInfo = CITY_POOL[index % CITY_POOL.length];
    const prefix = HOTEL_PREFIXES[index % HOTEL_PREFIXES.length];
    const suffix = HOTEL_SUFFIXES[(index * 3) % HOTEL_SUFFIXES.length];
    const name = `${prefix} ${cityInfo.cityEn} ${suffix}`;
    const id = `mock-hotel-${String(seq).padStart(3, "0")}`;
    const stars = (3 + (index % 3)) as 3 | 4 | 5;
    const rating = Number((3.9 + ((index * 7) % 11) / 10).toFixed(1));
    const userScore = Number((7.6 + ((index * 13) % 22) / 10).toFixed(1));
    const reviewCount = 95 + ((index * 29) % 1400);
    const distanceFromCenterKm = Number((0.2 + ((index * 17) % 74) / 10).toFixed(1));
    const basePrice = 290 + (index % 10) * 65 + Math.floor(index / 10) * 45;
    const discountPercent = [0, 8, 12, 15, 18][index % 5];
    const dealPrice = Math.max(160, Math.round(basePrice * (1 - discountPercent / 100)));
    const facilities = pickFacilities(index);
    const roomBasePrice = Math.max(180, dealPrice - 45);
    const rooms: MockRoom[] = ROOM_TEMPLATES.map((template, roomIndex) => ({
      id: `${id}-room-${roomIndex + 1}`,
      name: template.name,
      bedType: template.bedType,
      maxGuests: template.maxGuests,
      pricePerNight: roomBasePrice + roomIndex * 110,
      currency: "ILS",
      availableRooms: Math.max(1, 2 + ((index + roomIndex * 3) % 9)),
      cancellationPolicy:
        roomIndex === 0
          ? "Free cancellation up to 48 hours before check-in"
          : "Partially refundable up to 5 days before check-in",
      breakfastIncluded: roomIndex !== 0,
      amenities: facilities.slice(0, 6),
      photos: makeImageSet(`room-${id}`, roomIndex + 1, 3),
    }));

    return {
      id,
      externalId: `external-${id}`,
      slug: makeSlug(name),
      name,
      location: `${cityInfo.district}, ${cityInfo.city}, ${cityInfo.country}`,
      city: cityInfo.city,
      country: cityInfo.country,
      description: `${name} הוא מלון דמה איכותי עם גישה נוחה למוקדי עניין, שירות ידידותי וחוויית אירוח מלאה. הנתונים מיועדים לפיתוח והחלפה עתידית בספק אמיתי.`,
      facilities,
      images: makeImageSet(`hotel-${id}`, seq, 6),
      rating,
      stars,
      reviewCount,
      userScore,
      distanceFromCenterKm,
      hasFreeCancellation: true,
      isPopularChoice: userScore >= 8.8 || distanceFromCenterKm <= 1.8,
      basePrice,
      dealPrice,
      currency: "ILS",
      rooms,
    };
  });
}

export const MOCK_HOTELS: MockHotel[] = createMockHotels(50);

