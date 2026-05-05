import { NextResponse } from "next/server";
import { getMockHotelById } from "@/lib/mock-pms-engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const payload = getMockHotelById(id, url.searchParams.get("provider"));
    if (!payload) {
      return NextResponse.json({ success: false, error: "Hotel not found" }, { status: 404 });
    }

    return NextResponse.json({
      endpoint: `/hotel/${id}`,
      ...payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch hotel details";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
