import { NextResponse } from "next/server";
import { getAvailability } from "@/lib/mock-pms-engine";

function parseNumber(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: string | null) {
  if (!value) {
    return false;
  }
  return value.trim().toLowerCase() === "true";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const checkIn = url.searchParams.get("checkIn") ?? "";
    const checkOut = url.searchParams.get("checkOut") ?? "";
    if (!checkIn || !checkOut) {
      return NextResponse.json(
        {
          success: false,
          error: "checkIn and checkOut are required query params (yyyy-mm-dd)",
        },
        { status: 400 },
      );
    }

    const payload = getAvailability({
      provider: url.searchParams.get("provider"),
      hotelId: url.searchParams.get("hotelId"),
      checkIn,
      checkOut,
      guests: parseNumber(url.searchParams.get("guests")),
      units: parseNumber(url.searchParams.get("units")),
      includeSoldOut: parseBoolean(url.searchParams.get("includeSoldOut")),
    });

    if ("error" in payload) {
      return NextResponse.json({ success: false, error: payload.error }, { status: 400 });
    }

    return NextResponse.json({
      endpoint: "/availability",
      checkIn,
      checkOut,
      ...payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch availability";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
