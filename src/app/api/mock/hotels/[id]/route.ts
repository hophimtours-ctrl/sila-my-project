import { NextResponse } from "next/server";
import { MOCK_HOTELS } from "@/lib/mock-hotels";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const hotel = MOCK_HOTELS.find((item) => item.id === id);
  if (!hotel) {
    return NextResponse.json({ success: false, error: "Hotel not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    item: hotel,
  });
}

