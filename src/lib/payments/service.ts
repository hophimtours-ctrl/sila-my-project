import { randomUUID } from "node:crypto";
import type {
  Booking,
  CurrencyCode,
  PaymentOperationType,
  Prisma,
  RoomPaymentPolicy,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveGatewayByCurrency } from "@/lib/payments/router";
import type { BookingPaymentInitInput, PaymentOperationResult } from "@/lib/payments/types";

type ExecuteBookingPaymentOperationInput = {
  bookingId: string;
  operationType: PaymentOperationType;
  amount: number;
  gatewayReference?: string | null;
  paymentToken?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

function normalizeAmount(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function mapOperationToBookingAmounts(params: {
  operationType: PaymentOperationType;
  amount: number;
  existingAuthorizedAmount: number;
  existingCapturedAmount: number;
  existingRefundedAmount: number;
}) {
  const normalizedAmount = normalizeAmount(params.amount);
  if (params.operationType === "AUTHORIZE") {
    return {
      authorizedAmount: normalizedAmount,
      capturedAmount: normalizeAmount(params.existingCapturedAmount),
      refundedAmount: normalizeAmount(params.existingRefundedAmount),
    };
  }

  if (params.operationType === "CHARGE" || params.operationType === "CAPTURE") {
    const nextCapturedAmount = normalizeAmount(params.existingCapturedAmount + normalizedAmount);
    return {
      authorizedAmount: Math.max(normalizeAmount(params.existingAuthorizedAmount), nextCapturedAmount),
      capturedAmount: nextCapturedAmount,
      refundedAmount: normalizeAmount(params.existingRefundedAmount),
    };
  }

  if (params.operationType === "REFUND") {
    return {
      authorizedAmount: normalizeAmount(params.existingAuthorizedAmount),
      capturedAmount: normalizeAmount(params.existingCapturedAmount),
      refundedAmount: normalizeAmount(params.existingRefundedAmount + normalizedAmount),
    };
  }

  return {
    authorizedAmount: normalizeAmount(params.existingAuthorizedAmount),
    capturedAmount: normalizeAmount(params.existingCapturedAmount),
    refundedAmount: normalizeAmount(params.existingRefundedAmount),
  };
}

function buildPaymentMetadata(
  previousMetadata: Prisma.JsonValue | null,
  result: PaymentOperationResult,
  operationType: PaymentOperationType,
  additionalMetadata?: Record<string, unknown>,
) {
  const baseMetadata =
    previousMetadata && typeof previousMetadata === "object" && !Array.isArray(previousMetadata)
      ? (previousMetadata as Record<string, unknown>)
      : {};

  return {
    ...baseMetadata,
    lastGatewayMessage: result.message ?? null,
    lastGatewayReference: result.gatewayReference ?? null,
    lastProviderReference: result.providerReference ?? null,
    lastOperationType: operationType,
    ...(additionalMetadata ?? {}),
  };
}

function parseCurrencyCode(value: string): CurrencyCode {
  if (value === "USD" || value === "EUR" || value === "GBP" || value === "ILS") {
    return value;
  }
  return "ILS";
}

function parsePaymentPolicy(value: string): RoomPaymentPolicy {
  return value === "PREAUTH" ? "PREAUTH" : "CHARGE";
}

async function createPaymentOperationLog(params: {
  bookingId: string;
  operationType: PaymentOperationType;
  amount: number;
  currencyCode: CurrencyCode;
  result: PaymentOperationResult;
  idempotencyKey?: string;
  requestPayload?: Record<string, unknown>;
}) {
  await prisma.bookingPaymentOperation.create({
    data: {
      bookingId: params.bookingId,
      operationType: params.operationType,
      operationStatus: params.result.operationStatus,
      gateway: params.result.gateway,
      currencyCode: params.currencyCode,
      amount: normalizeAmount(params.amount),
      providerReference: params.result.providerReference ?? null,
      gatewayReference: params.result.gatewayReference ?? null,
      idempotencyKey: params.idempotencyKey ?? null,
      requestPayload: params.requestPayload
        ? (params.requestPayload as Prisma.InputJsonValue)
        : undefined,
      responsePayload:
        params.result.rawResponse && typeof params.result.rawResponse === "object"
          ? (params.result.rawResponse as Prisma.InputJsonValue)
          : undefined,
      failureReason: params.result.success ? null : params.result.message ?? "Payment operation failed",
    },
  });
}

function extractOperationAmount(params: {
  bookingTotalPrice: number;
  explicitAmount?: number;
  defaultToCaptured?: boolean;
  fallbackToAuthorized?: boolean;
}) {
  if (typeof params.explicitAmount === "number" && Number.isFinite(params.explicitAmount) && params.explicitAmount > 0) {
    return normalizeAmount(params.explicitAmount);
  }
  if (params.defaultToCaptured) {
    return normalizeAmount(params.bookingTotalPrice);
  }
  if (params.fallbackToAuthorized) {
    return normalizeAmount(params.bookingTotalPrice);
  }
  return normalizeAmount(params.bookingTotalPrice);
}

type BookingPaymentRecord = Pick<
  Booking,
  | "id"
  | "totalPrice"
  | "currencyCode"
  | "paymentPolicy"
  | "paymentStatus"
  | "paymentReference"
  | "authorizedAmount"
  | "capturedAmount"
  | "refundedAmount"
  | "paymentMetadata"
>;

async function getBookingPaymentRecord(bookingId: string): Promise<BookingPaymentRecord | null> {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      totalPrice: true,
      currencyCode: true,
      paymentPolicy: true,
      paymentStatus: true,
      paymentReference: true,
      authorizedAmount: true,
      capturedAmount: true,
      refundedAmount: true,
      paymentMetadata: true,
    },
  });
}

async function executeOperationAndPersist(
  booking: BookingPaymentRecord,
  input: ExecuteBookingPaymentOperationInput,
) {
  const currencyCode = parseCurrencyCode(booking.currencyCode);
  const gateway = resolveGatewayByCurrency(currencyCode);
  const amount = normalizeAmount(input.amount);
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const result =
    input.operationType === "CHARGE"
      ? await gateway.charge({
          bookingId: booking.id,
          amount,
          currencyCode,
          paymentToken: input.paymentToken ?? null,
          gatewayReference: input.gatewayReference ?? booking.paymentReference ?? null,
          idempotencyKey,
          metadata: input.metadata,
        })
      : input.operationType === "AUTHORIZE"
        ? await gateway.authorize({
            bookingId: booking.id,
            amount,
            currencyCode,
            paymentToken: input.paymentToken ?? null,
            gatewayReference: input.gatewayReference ?? booking.paymentReference ?? null,
            idempotencyKey,
            metadata: input.metadata,
          })
        : input.operationType === "CAPTURE"
          ? await gateway.capture({
              bookingId: booking.id,
              amount,
              currencyCode,
              gatewayReference: input.gatewayReference ?? booking.paymentReference ?? null,
              idempotencyKey,
              metadata: input.metadata,
            })
          : input.operationType === "VOID"
            ? await gateway.void({
                bookingId: booking.id,
                amount,
                currencyCode,
                gatewayReference: input.gatewayReference ?? booking.paymentReference ?? null,
                idempotencyKey,
                metadata: input.metadata,
              })
            : await gateway.refund({
                bookingId: booking.id,
                amount,
                currencyCode,
                gatewayReference: input.gatewayReference ?? booking.paymentReference ?? null,
                idempotencyKey,
                metadata: input.metadata,
              });

  await createPaymentOperationLog({
    bookingId: booking.id,
    operationType: input.operationType,
    amount,
    currencyCode,
    result,
    idempotencyKey,
    requestPayload: {
      gatewayReference: input.gatewayReference ?? booking.paymentReference ?? null,
      hasPaymentToken: Boolean(input.paymentToken),
      metadata: input.metadata ?? {},
    },
  });

  const amountState = mapOperationToBookingAmounts({
    operationType: input.operationType,
    amount,
    existingAuthorizedAmount: booking.authorizedAmount,
    existingCapturedAmount: booking.capturedAmount,
    existingRefundedAmount: booking.refundedAmount,
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paymentGateway: result.gateway,
      paymentStatus: result.paymentStatus,
      paymentReference: result.gatewayReference ?? booking.paymentReference ?? null,
      paymentErrorMessage: result.success ? null : result.message ?? "Payment operation failed",
      authorizedAmount: amountState.authorizedAmount,
      capturedAmount: amountState.capturedAmount,
      refundedAmount: amountState.refundedAmount,
      paymentMetadata: buildPaymentMetadata(
        booking.paymentMetadata as Prisma.JsonValue | null,
        result,
        input.operationType,
        input.metadata,
      ),
    },
  });

  return result;
}

export async function initializeBookingPayment(input: BookingPaymentInitInput) {
  const booking = await getBookingPaymentRecord(input.bookingId);
  if (!booking) {
    return { success: false as const, message: "Booking not found" };
  }

  const normalizedPolicy = parsePaymentPolicy(input.paymentPolicy);
  const result = await executeOperationAndPersist(booking, {
    bookingId: input.bookingId,
    operationType: normalizedPolicy === "PREAUTH" ? "AUTHORIZE" : "CHARGE",
    amount: normalizeAmount(input.amount),
    paymentToken: input.paymentToken,
    metadata: {
      customerEmail: input.customerEmail ?? null,
      customerName: input.customerName ?? null,
      description: input.description ?? null,
      ...(input.metadata ?? {}),
    },
  });

  return {
    success: result.success,
    result,
  };
}

export async function captureBookingPayment(params: {
  bookingId: string;
  amount?: number;
  idempotencyKey?: string;
}) {
  const booking = await getBookingPaymentRecord(params.bookingId);
  if (!booking) {
    return { success: false as const, message: "Booking not found" };
  }

  const amount = extractOperationAmount({
    bookingTotalPrice: booking.totalPrice,
    explicitAmount: params.amount,
    fallbackToAuthorized: true,
  });

  const result = await executeOperationAndPersist(booking, {
    bookingId: booking.id,
    operationType: "CAPTURE",
    amount,
    gatewayReference: booking.paymentReference,
    idempotencyKey: params.idempotencyKey,
  });

  return { success: result.success, result };
}

export async function voidBookingPayment(params: { bookingId: string; idempotencyKey?: string }) {
  const booking = await getBookingPaymentRecord(params.bookingId);
  if (!booking) {
    return { success: false as const, message: "Booking not found" };
  }

  const amount = normalizeAmount(booking.authorizedAmount || booking.totalPrice);
  const result = await executeOperationAndPersist(booking, {
    bookingId: booking.id,
    operationType: "VOID",
    amount,
    gatewayReference: booking.paymentReference,
    idempotencyKey: params.idempotencyKey,
  });

  return { success: result.success, result };
}

export async function refundBookingPayment(params: {
  bookingId: string;
  amount?: number;
  idempotencyKey?: string;
}) {
  const booking = await getBookingPaymentRecord(params.bookingId);
  if (!booking) {
    return { success: false as const, message: "Booking not found" };
  }

  const maxRefundable = Math.max(0, normalizeAmount(booking.capturedAmount - booking.refundedAmount));
  const requestedAmount = normalizeAmount(params.amount ?? maxRefundable);
  const amount = Math.min(maxRefundable, requestedAmount);

  if (amount <= 0) {
    return { success: false as const, message: "No refundable amount available" };
  }

  const result = await executeOperationAndPersist(booking, {
    bookingId: booking.id,
    operationType: "REFUND",
    amount,
    gatewayReference: booking.paymentReference,
    idempotencyKey: params.idempotencyKey,
  });

  return { success: result.success, result };
}
