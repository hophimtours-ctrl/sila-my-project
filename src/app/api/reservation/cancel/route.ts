import { NextResponse } from "next/server";
import { cancelReservation, resolveProvider } from "@/lib/mock-pms-engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      provider?: string;
      reservationId?: string;
      reason?: string;
    };

    if (!body.reservationId) {
      return NextResponse.json(
        { success: false, error: "reservationId is required" },
        { status: 400 },
      );
    }

    const payload = cancelReservation({
      provider: resolveProvider(body.provider),
      reservationId: body.reservationId,
      reason: body.reason,
    });

    if ("error" in payload) {
      return NextResponse.json({ success: false, error: payload.error }, { status: payload.status });
    }

    return NextResponse.json({
      endpoint: "/reservation/cancel",
      ...payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel reservation";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
