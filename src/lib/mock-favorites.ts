export const MOCK_FAVORITES_COOKIE_KEY = "bookmenow_mock_favorites";

export function isMockHotelId(hotelId: string) {
  return hotelId.startsWith("mock-hotel-");
}

export function parseMockFavoriteHotelIds(rawValue?: string) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is string => typeof value === "string")
      .filter((value) => value.length > 0)
      .slice(0, 200);
  } catch {
    return [];
  }
}

export function serializeMockFavoriteHotelIds(hotelIds: string[]) {
  return JSON.stringify(Array.from(new Set(hotelIds)));
}
