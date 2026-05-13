import type { BookingPaymentStatus, PaymentGateway, PaymentOperationType } from "@prisma/client";
import type { PaymentGatewayAdapter, PaymentOperationInput, PaymentOperationResult } from "@/lib/payments/types";

function normalizeAmount(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function toStripeMinorAmount(amount: number) {
  return Math.round(normalizeAmount(amount) * 100);
}

function mapOperationToPaymentStatus(operationType: PaymentOperationType): BookingPaymentStatus {
  if (operationType === "AUTHORIZE") {
    return "AUTHORIZED";
  }
  if (operationType === "CAPTURE" || operationType === "CHARGE") {
    return "CAPTURED";
  }
  if (operationType === "VOID") {
    return "VOIDED";
  }
  return "REFUNDED";
}

function buildFailureResult(
  operationType: PaymentOperationType,
  input: PaymentOperationInput,
  message: string,
): PaymentOperationResult {
  return {
    success: false,
    gateway: "STRIPE",
    operationType,
    operationStatus: "FAILED",
    paymentStatus: "FAILED",
    amount: normalizeAmount(input.amount),
    currencyCode: input.currencyCode,
    gatewayReference: input.gatewayReference ?? null,
    providerReference: null,
    message,
  };
}

function toStripeErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const errorMessage = (payload as { error?: { message?: string } }).error?.message;
  if (typeof errorMessage === "string" && errorMessage.trim()) {
    return errorMessage;
  }
  return fallback;
}

export class StripeGatewayAdapter implements PaymentGatewayAdapter {
  readonly gateway: PaymentGateway = "STRIPE";

  async charge(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!input.paymentToken) {
      return buildFailureResult("CHARGE", input, "Missing hosted payment token");
    }

    const payload = new URLSearchParams({
      amount: String(toStripeMinorAmount(input.amount)),
      currency: input.currencyCode.toLowerCase(),
      payment_method: input.paymentToken,
      confirm: "true",
      capture_method: "automatic",
    });

    if (input.customerEmail) {
      payload.set("receipt_email", input.customerEmail);
    }
    if (input.description) {
      payload.set("description", input.description);
    }
    if (input.idempotencyKey) {
      payload.set("metadata[idempotencyKey]", input.idempotencyKey);
    }
    payload.set("metadata[bookingId]", input.bookingId);

    return this.callStripe({
      operationType: "CHARGE",
      input,
      path: "/v1/payment_intents",
      body: payload,
    });
  }

  async authorize(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!input.paymentToken) {
      return buildFailureResult("AUTHORIZE", input, "Missing hosted payment token");
    }

    const payload = new URLSearchParams({
      amount: String(toStripeMinorAmount(input.amount)),
      currency: input.currencyCode.toLowerCase(),
      payment_method: input.paymentToken,
      confirm: "true",
      capture_method: "manual",
    });

    if (input.customerEmail) {
      payload.set("receipt_email", input.customerEmail);
    }
    if (input.description) {
      payload.set("description", input.description);
    }
    payload.set("metadata[bookingId]", input.bookingId);

    return this.callStripe({
      operationType: "AUTHORIZE",
      input,
      path: "/v1/payment_intents",
      body: payload,
    });
  }

  async capture(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!input.gatewayReference) {
      return buildFailureResult("CAPTURE", input, "Missing payment reference for capture");
    }

    const payload = new URLSearchParams({
      amount_to_capture: String(toStripeMinorAmount(input.amount)),
    });

    return this.callStripe({
      operationType: "CAPTURE",
      input,
      path: `/v1/payment_intents/${encodeURIComponent(input.gatewayReference)}/capture`,
      body: payload,
    });
  }

  async void(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!input.gatewayReference) {
      return buildFailureResult("VOID", input, "Missing payment reference for void");
    }

    const payload = new URLSearchParams();

    return this.callStripe({
      operationType: "VOID",
      input,
      path: `/v1/payment_intents/${encodeURIComponent(input.gatewayReference)}/cancel`,
      body: payload,
    });
  }

  async refund(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    if (!input.gatewayReference) {
      return buildFailureResult("REFUND", input, "Missing payment reference for refund");
    }

    const payload = new URLSearchParams({
      payment_intent: input.gatewayReference,
      amount: String(toStripeMinorAmount(input.amount)),
    });

    return this.callStripe({
      operationType: "REFUND",
      input,
      path: "/v1/refunds",
      body: payload,
    });
  }

  private async callStripe(params: {
    operationType: PaymentOperationType;
    input: PaymentOperationInput;
    path: string;
    body: URLSearchParams;
  }): Promise<PaymentOperationResult> {
    const secretKey = String(process.env.STRIPE_SECRET_KEY ?? "").trim();
    if (!secretKey) {
      return buildFailureResult(params.operationType, params.input, "Stripe secret key is missing");
    }

    try {
      const response = await fetch(`https://api.stripe.com${params.path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: params.body.toString(),
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        id?: string;
        status?: string;
        latest_charge?: string;
      };

      if (!response.ok) {
        return buildFailureResult(
          params.operationType,
          params.input,
          toStripeErrorMessage(payload, "Stripe request failed"),
        );
      }

      return {
        success: true,
        gateway: "STRIPE",
        operationType: params.operationType,
        operationStatus: "SUCCEEDED",
        paymentStatus: mapOperationToPaymentStatus(params.operationType),
        amount: normalizeAmount(params.input.amount),
        currencyCode: params.input.currencyCode,
        gatewayReference: payload.id ?? params.input.gatewayReference ?? null,
        providerReference: payload.latest_charge ?? null,
        message: payload.status ?? null,
        rawResponse: payload,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe request failed";
      return buildFailureResult(params.operationType, params.input, message);
    }
  }
}
