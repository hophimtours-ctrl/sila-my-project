import { NextResponse } from "next/server";
import { createReservation, resolveProvider } from "@/lib/mock-pms-engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      provider?: string;
      hotelId?: string;
      roomTypeId?: string;
      checkIn?: string;
      checkOut?: string;
      units?: number;
      guests?: number;
      customer?: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
      };
    };

    if (!body.hotelId || !body.roomTypeId || !body.checkIn || !body.checkOut || !body.customer) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: hotelId, roomTypeId, checkIn, checkOut, customer(firstName,lastName,email,phone)",
        },
        { status: 400 },
      );
    }

    const payload = createReservation({
      provider: resolveProvider(body.provider),
      hotelId: body.hotelId,
      roomTypeId: body.roomTypeId,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      units: typeof body.units === "number" ? body.units : 1,
      guests: typeof body.guests === "number" ? body.guests : 2,
      customer: {
        firstName: body.customer.firstName ?? "",
        lastName: body.customer.lastName ?? "",
        email: body.customer.email ?? "",
        phone: body.customer.phone ?? "",
      },
    });

    if ("error" in payload) {
      return NextResponse.json(
        {
          success: false,
          error: payload.error,
          details: "details" in payload ? payload.details : undefined,
        },
        { status: payload.status },
      );
    }

    return NextResponse.json({
      endpoint: "/reservation",
      ...payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create reservation";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
