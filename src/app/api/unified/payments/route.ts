import { BookingStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  captureBookingPayment,
  initializeBookingPayment,
  refundBookingPayment,
  voidBookingPayment,
} from "@/lib/payments/service";

const paymentOperationSchema = z.object({
  operation: z.enum(["initialize", "capture", "void", "refund"]),
  bookingId: z.string().min(1),
  paymentToken: z.string().min(1).optional(),
  paymentSessionId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  idempotencyKey: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function canManageBooking(params: { role: Role; actorUserId: string; bookingUserId: string }) {
  if (params.role === Role.ADMIN || params.role === Role.OWNER) {
    return true;
  }
  return params.actorUserId === params.bookingUserId;
}

function mapBookingForResponse(booking: {
  id: string;
  status: string;
  paymentPolicy: string;
  paymentGateway: string | null;
  paymentStatus: string;
  currencyCode: string;
  paymentReference: string | null;
  authorizedAmount: number;
  capturedAmount: number;
  refundedAmount: number;
  paymentErrorMessage: string | null;
  updatedAt: Date;
  paymentOperations: Array<{
    id: string;
    operationType: string;
    operationStatus: string;
    gateway: string;
    amount: number;
    currencyCode: string;
    gatewayReference: string | null;
    providerReference: string | null;
    failureReason: string | null;
    createdAt: Date;
  }>;
}) {
  return {
    id: booking.id,
    status: booking.status,
    payment: {
      policy: booking.paymentPolicy,
      gateway: booking.paymentGateway,
      status: booking.paymentStatus,
      currencyCode: booking.currencyCode,
      reference: booking.paymentReference,
      authorizedAmount: booking.authorizedAmount,
      capturedAmount: booking.capturedAmount,
      refundedAmount: booking.refundedAmount,
      errorMessage: booking.paymentErrorMessage,
      updatedAt: booking.updatedAt.toISOString(),
    },
    operations: booking.paymentOperations.map((operation) => ({
      id: operation.id,
      operationType: operation.operationType,
      operationStatus: operation.operationStatus,
      gateway: operation.gateway,
      amount: operation.amount,
      currencyCode: operation.currencyCode,
      gatewayReference: operation.gatewayReference,
      providerReference: operation.providerReference,
      failureReason: operation.failureReason,
      createdAt: operation.createdAt.toISOString(),
    })),
  };
}

async function loadBookingWithPayments(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      status: true,
      totalPrice: true,
      paymentPolicy: true,
      currencyCode: true,
      paymentGateway: true,
      paymentStatus: true,
      paymentReference: true,
      authorizedAmount: true,
      capturedAmount: true,
      refundedAmount: true,
      paymentErrorMessage: true,
      updatedAt: true,
      paymentOperations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          operationType: true,
          operationStatus: true,
          gateway: true,
          amount: true,
          currencyCode: true,
          gatewayReference: true,
          providerReference: true,
          failureReason: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId")?.trim() ?? "";
  if (!bookingId) {
    return NextResponse.json({ success: false, error: "bookingId is required" }, { status: 400 });
  }

  const booking = await loadBookingWithPayments(bookingId);
  if (!booking) {
    return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
  }

  if (!canManageBooking({ role: user.role, actorUserId: user.id, bookingUserId: booking.userId })) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    booking: mapBookingForResponse(booking),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = paymentOperationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const booking = await loadBookingWithPayments(parsed.data.bookingId);
  if (!booking) {
    return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
  }

  if (!canManageBooking({ role: user.role, actorUserId: user.id, bookingUserId: booking.userId })) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (booking.status === BookingStatus.CANCELED && parsed.data.operation === "initialize") {
    return NextResponse.json(
      { success: false, error: "Cannot initialize payment for canceled booking" },
      { status: 409 },
    );
  }

  let operationResponse:
    | Awaited<ReturnType<typeof initializeBookingPayment>>
    | Awaited<ReturnType<typeof captureBookingPayment>>
    | Awaited<ReturnType<typeof voidBookingPayment>>
    | Awaited<ReturnType<typeof refundBookingPayment>>;

  if (parsed.data.operation === "initialize") {
    if (!parsed.data.paymentToken) {
      return NextResponse.json(
        { success: false, error: "paymentToken is required for initialize operation" },
        { status: 400 },
      );
    }

    operationResponse = await initializeBookingPayment({
      bookingId: booking.id,
      amount: booking.totalPrice,
      currencyCode: booking.currencyCode,
      paymentPolicy: booking.paymentPolicy,
      paymentToken: parsed.data.paymentToken,
      metadata: {
        source: "unified-payments-api",
        paymentSessionId: parsed.data.paymentSessionId ?? null,
        ...(parsed.data.metadata ?? {}),
      },
    });
  } else if (parsed.data.operation === "capture") {
    operationResponse = await captureBookingPayment({
      bookingId: booking.id,
      amount: parsed.data.amount,
      idempotencyKey: parsed.data.idempotencyKey,
    });
  } else if (parsed.data.operation === "void") {
    operationResponse = await voidBookingPayment({
      bookingId: booking.id,
      idempotencyKey: parsed.data.idempotencyKey,
    });
  } else {
    operationResponse = await refundBookingPayment({
      bookingId: booking.id,
      amount: parsed.data.amount,
      idempotencyKey: parsed.data.idempotencyKey,
    });
  }

  const refreshedBooking = await loadBookingWithPayments(booking.id);
  if (!refreshedBooking) {
    return NextResponse.json({ success: false, error: "Booking not found after operation" }, { status: 404 });
  }

  const operationResult =
    "result" in operationResponse && operationResponse.result ? operationResponse.result : null;
  const operationMessage =
    "message" in operationResponse && typeof operationResponse.message === "string"
      ? operationResponse.message
      : null;
  const hasSucceeded = Boolean(operationResponse.success);

  return NextResponse.json(
    {
      success: hasSucceeded,
      operation: operationResult,
      message: operationMessage,
      booking: mapBookingForResponse(refreshedBooking),
    },
    { status: hasSucceeded ? 200 : 422 },
  );
}
