import {
  BookingPaymentStatus,
  BookingStatus,
  CurrencyCode,
  PaymentGateway,
  PaymentOperationStatus,
  PaymentOperationType,
  Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const webhookPayloadSchema = z.object({
  bookingId: z.string().min(1).optional(),
  gatewayReference: z.string().min(1).optional(),
  paymentStatus: z.enum(["PENDING", "AUTHORIZED", "CAPTURED", "VOIDED", "REFUNDED", "FAILED"]),
  operationType: z.enum(["CHARGE", "AUTHORIZE", "CAPTURE", "VOID", "REFUND"]).optional(),
  operationStatus: z.enum(["SUCCEEDED", "FAILED"]).optional(),
  gateway: z.enum(["ISRAEL", "STRIPE"]).optional(),
  amount: z.number().nonnegative().optional(),
  currencyCode: z.enum(["ILS", "USD", "EUR", "GBP"]).optional(),
  providerReference: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  payload: z.unknown().optional(),
});

function normalizeAmount(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function mapPaymentStatusToOperationType(status: BookingPaymentStatus): PaymentOperationType {
  if (status === BookingPaymentStatus.AUTHORIZED) {
    return "AUTHORIZE";
  }
  if (status === BookingPaymentStatus.CAPTURED) {
    return "CHARGE";
  }
  if (status === BookingPaymentStatus.VOIDED) {
    return "VOID";
  }
  if (status === BookingPaymentStatus.REFUNDED) {
    return "REFUND";
  }
  return "CHARGE";
}

function mapPaymentStatusToOperationStatus(status: BookingPaymentStatus): PaymentOperationStatus {
  return status === BookingPaymentStatus.FAILED ? "FAILED" : "SUCCEEDED";
}

function resolveGateway(params: {
  inputGateway?: PaymentGateway;
  existingGateway?: PaymentGateway | null;
  currencyCode: CurrencyCode;
}): PaymentGateway {
  if (params.inputGateway) {
    return params.inputGateway;
  }
  if (params.existingGateway) {
    return params.existingGateway;
  }
  return params.currencyCode === CurrencyCode.ILS ? PaymentGateway.ISRAEL : PaymentGateway.STRIPE;
}

function mergeWebhookMetadata(
  previousMetadata: Prisma.JsonValue | null,
  params: {
    paymentStatus: BookingPaymentStatus;
    gatewayReference: string | null;
    providerReference: string | null;
    message: string | null;
    payload: unknown;
  },
) {
  const baseMetadata =
    previousMetadata && typeof previousMetadata === "object" && !Array.isArray(previousMetadata)
      ? (previousMetadata as Record<string, unknown>)
      : {};

  return {
    ...baseMetadata,
    lastWebhookAt: new Date().toISOString(),
    lastWebhookPaymentStatus: params.paymentStatus,
    lastWebhookGatewayReference: params.gatewayReference,
    lastWebhookProviderReference: params.providerReference,
    lastWebhookMessage: params.message,
    lastWebhookPayload: params.payload ?? null,
  };
}

export async function POST(request: Request) {
  const expectedSecret = String(process.env.UNIFIED_PAYMENTS_WEBHOOK_SECRET ?? "").trim();
  if (!expectedSecret) {
    return NextResponse.json(
      { success: false, error: "UNIFIED_PAYMENTS_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  const receivedSecret = request.headers.get("x-bookmenow-webhook-secret")?.trim() ?? "";
  if (receivedSecret !== expectedSecret) {
    return NextResponse.json({ success: false, error: "Unauthorized webhook request" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = webhookPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid webhook payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!parsed.data.bookingId && !parsed.data.gatewayReference) {
    return NextResponse.json(
      { success: false, error: "bookingId or gatewayReference is required" },
      { status: 400 },
    );
  }

  const booking = await prisma.booking.findFirst({
    where: parsed.data.bookingId
      ? { id: parsed.data.bookingId }
      : {
          paymentReference: parsed.data.gatewayReference ?? undefined,
        },
    select: {
      id: true,
      status: true,
      paymentGateway: true,
      paymentStatus: true,
      paymentReference: true,
      paymentMetadata: true,
      currencyCode: true,
      totalPrice: true,
      authorizedAmount: true,
      capturedAmount: true,
      refundedAmount: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
  }

  const paymentStatus = parsed.data.paymentStatus;
  const operationType = parsed.data.operationType ?? mapPaymentStatusToOperationType(paymentStatus);
  const operationStatus = parsed.data.operationStatus ?? mapPaymentStatusToOperationStatus(paymentStatus);
  const amount = normalizeAmount(parsed.data.amount ?? booking.totalPrice);
  const currencyCode = parsed.data.currencyCode ?? booking.currencyCode;
  const gateway = resolveGateway({
    inputGateway: parsed.data.gateway,
    existingGateway: booking.paymentGateway,
    currencyCode,
  });
  const gatewayReference = parsed.data.gatewayReference ?? booking.paymentReference ?? null;
  const providerReference = parsed.data.providerReference ?? null;
  const message = parsed.data.message ?? null;

  let authorizedAmount = booking.authorizedAmount;
  let capturedAmount = booking.capturedAmount;
  let refundedAmount = booking.refundedAmount;

  if (paymentStatus === BookingPaymentStatus.AUTHORIZED) {
    authorizedAmount = Math.max(authorizedAmount, amount);
  } else if (paymentStatus === BookingPaymentStatus.CAPTURED) {
    capturedAmount = Math.max(capturedAmount, amount);
    authorizedAmount = Math.max(authorizedAmount, capturedAmount);
  } else if (paymentStatus === BookingPaymentStatus.REFUNDED) {
    refundedAmount = Math.min(capturedAmount, normalizeAmount(refundedAmount + amount));
  }

  const nextBookingStatus =
    booking.status === BookingStatus.PENDING_PAYMENT
      ? paymentStatus === BookingPaymentStatus.AUTHORIZED || paymentStatus === BookingPaymentStatus.CAPTURED
        ? BookingStatus.CONFIRMED
        : paymentStatus === BookingPaymentStatus.FAILED || paymentStatus === BookingPaymentStatus.VOIDED
          ? BookingStatus.CANCELED
          : booking.status
      : booking.status;

  const mergedMetadata = mergeWebhookMetadata(booking.paymentMetadata, {
    paymentStatus,
    gatewayReference,
    providerReference,
    message,
    payload: parsed.data.payload,
  });

  await prisma.$transaction([
    prisma.bookingPaymentOperation.create({
      data: {
        bookingId: booking.id,
        operationType,
        operationStatus,
        gateway,
        currencyCode,
        amount,
        providerReference,
        gatewayReference,
        idempotencyKey: parsed.data.idempotencyKey ?? null,
        responsePayload:
          parsed.data.payload && typeof parsed.data.payload === "object"
            ? (parsed.data.payload as Prisma.InputJsonValue)
            : undefined,
        failureReason: operationStatus === PaymentOperationStatus.FAILED ? message ?? "Webhook failure" : null,
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: nextBookingStatus,
        paymentGateway: gateway,
        paymentStatus,
        paymentReference: gatewayReference,
        paymentErrorMessage: paymentStatus === BookingPaymentStatus.FAILED ? message ?? "Payment failed" : null,
        authorizedAmount: normalizeAmount(authorizedAmount),
        capturedAmount: normalizeAmount(capturedAmount),
        refundedAmount: normalizeAmount(refundedAmount),
        paymentMetadata: mergedMetadata as Prisma.InputJsonValue,
      },
    }),
  ]);

  const refreshedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentGateway: true,
      paymentReference: true,
      authorizedAmount: true,
      capturedAmount: true,
      refundedAmount: true,
      paymentErrorMessage: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    booking: refreshedBooking
      ? {
          ...refreshedBooking,
          updatedAt: refreshedBooking.updatedAt.toISOString(),
        }
      : null,
  });
}
