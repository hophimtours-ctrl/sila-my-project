import { NextResponse } from "next/server";
import { MOCK_HOTELS } from "@/lib/mock-hotels";

function toPositiveInt(value: string | null, fallback: number, max: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(parsed));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city")?.trim().toLowerCase() ?? "";
  const facility = url.searchParams.get("facility")?.trim().toLowerCase() ?? "";
  const minPrice = Number(url.searchParams.get("minPrice") ?? Number.NaN);
  const maxPrice = Number(url.searchParams.get("maxPrice") ?? Number.NaN);
  const limit = toPositiveInt(url.searchParams.get("limit"), 50, 50);
  const offset = toPositiveInt(url.searchParams.get("offset"), 0, 49);

  const filteredHotels = MOCK_HOTELS.filter((hotel) => {
    if (
      city &&
      !hotel.city.toLowerCase().includes(city) &&
      !hotel.location.toLowerCase().includes(city) &&
      !hotel.name.toLowerCase().includes(city)
    ) {
      return false;
    }

    if (
      facility &&
      !hotel.facilities.some((item) => item.toLowerCase().includes(facility))
    ) {
      return false;
    }

    if (Number.isFinite(minPrice) && hotel.dealPrice < minPrice) {
      return false;
    }

    if (Number.isFinite(maxPrice) && hotel.dealPrice > maxPrice) {
      return false;
    }

    return true;
  });

  const items = filteredHotels.slice(offset, offset + limit);

  return NextResponse.json({
    success: true,
    source: "mock-hotels",
    generatedAt: new Date().toISOString(),
    total: filteredHotels.length,
    count: items.length,
    limit,
    offset,
    items,
  });
}

