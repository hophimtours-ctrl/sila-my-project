import { NextResponse } from "next/server";
import { applyInventoryWebhook } from "@/lib/mock-pms-engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      provider?: string;
      eventId?: string;
      updates?: Array<{
        hotelId: string;
        roomTypeId: string;
        startDate: string;
        endDate: string;
        availableUnits?: number;
        pricePerNight?: number;
        stopSell?: boolean;
      }>;
    };

    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "updates[] is required and must contain at least one update item" },
        { status: 400 },
      );
    }

    const payload = applyInventoryWebhook({
      provider: body.provider,
      eventId: body.eventId,
      updates: body.updates,
    });

    return NextResponse.json({
      endpoint: "/webhook/inventory-update",
      ...payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process inventory webhook";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
