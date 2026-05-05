import { NextResponse } from "next/server";
import { getDatasetStats, listMockHotels } from "@/lib/mock-pms-engine";

function parseNumber(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = listMockHotels({
      provider: url.searchParams.get("provider"),
      city: url.searchParams.get("city"),
      stars: parseNumber(url.searchParams.get("stars")),
      minPrice: parseNumber(url.searchParams.get("minPrice")),
      maxPrice: parseNumber(url.searchParams.get("maxPrice")),
    });

    return NextResponse.json({
      endpoint: "/hotels",
      ...payload,
      dataset: getDatasetStats(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch hotels";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
