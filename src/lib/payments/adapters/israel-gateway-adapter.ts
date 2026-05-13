import { randomUUID } from "node:crypto";
import type { BookingPaymentStatus, PaymentGateway, PaymentOperationType } from "@prisma/client";
import type { PaymentGatewayAdapter, PaymentOperationInput, PaymentOperationResult } from "@/lib/payments/types";

type IsraelGatewayOperationMode = "mock" | "http";

function normalizeAmount(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function toBookingPaymentStatus(operationType: PaymentOperationType): BookingPaymentStatus {
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
    gateway: "ISRAEL",
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

export class IsraelGatewayAdapter implements PaymentGatewayAdapter {
  readonly gateway: PaymentGateway = "ISRAEL";

  private getMode(): IsraelGatewayOperationMode {
    const configuredMode = String(process.env.OTA_ISRAEL_GATEWAY_MODE ?? "mock").trim().toLowerCase();
    return configuredMode === "http" ? "http" : "mock";
  }

  async charge(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    return this.executeOperation("CHARGE", input);
  }

  async authorize(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    return this.executeOperation("AUTHORIZE", input);
  }

  async capture(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    return this.executeOperation("CAPTURE", input);
  }

  async void(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    return this.executeOperation("VOID", input);
  }

  async refund(input: PaymentOperationInput): Promise<PaymentOperationResult> {
    return this.executeOperation("REFUND", input);
  }

  private async executeOperation(
    operationType: PaymentOperationType,
    input: PaymentOperationInput,
  ): Promise<PaymentOperationResult> {
    if (this.getMode() === "mock") {
      return this.executeMockOperation(operationType, input);
    }

    return this.executeHttpOperation(operationType, input);
  }

  private executeMockOperation(
    operationType: PaymentOperationType,
    input: PaymentOperationInput,
  ): PaymentOperationResult {
    if ((operationType === "CHARGE" || operationType === "AUTHORIZE") && !input.paymentToken) {
      return buildFailureResult(operationType, input, "Missing hosted payment token for Israeli gateway");
    }

    if ((operationType === "CAPTURE" || operationType === "VOID" || operationType === "REFUND") && !input.gatewayReference) {
      return buildFailureResult(operationType, input, "Missing gateway reference for follow-up operation");
    }

    return {
      success: true,
      gateway: "ISRAEL",
      operationType,
      operationStatus: "SUCCEEDED",
      paymentStatus: toBookingPaymentStatus(operationType),
      amount: normalizeAmount(input.amount),
      currencyCode: input.currencyCode,
      gatewayReference: input.gatewayReference ?? `ilgw_${randomUUID()}`,
      providerReference: `isr_${randomUUID()}`,
      message: "Processed by Israeli gateway mock adapter",
      rawResponse: {
        mode: "mock",
        operationType,
      },
    };
  }

  private async executeHttpOperation(
    operationType: PaymentOperationType,
    input: PaymentOperationInput,
  ): Promise<PaymentOperationResult> {
    const endpoint = String(process.env.OTA_ISRAEL_GATEWAY_ENDPOINT ?? "").trim();
    const apiKey = String(process.env.OTA_ISRAEL_GATEWAY_API_KEY ?? "").trim();

    if (!endpoint || !apiKey) {
      return buildFailureResult(
        operationType,
        input,
        "Israeli gateway endpoint or API key is missing for HTTP mode",
      );
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          operationType,
          bookingId: input.bookingId,
          amount: normalizeAmount(input.amount),
          currencyCode: input.currencyCode,
          paymentToken: input.paymentToken ?? null,
          gatewayReference: input.gatewayReference ?? null,
          description: input.description ?? null,
          customerEmail: input.customerEmail ?? null,
          customerName: input.customerName ?? null,
          metadata: input.metadata ?? {},
          idempotencyKey: input.idempotencyKey ?? null,
        }),
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            gatewayReference?: string | null;
            providerReference?: string | null;
            message?: string;
          }
        | null;

      if (!response.ok || payload?.success === false) {
        return buildFailureResult(
          operationType,
          input,
          payload?.message ?? "Israeli gateway request failed",
        );
      }

      return {
        success: true,
        gateway: "ISRAEL",
        operationType,
        operationStatus: "SUCCEEDED",
        paymentStatus: toBookingPaymentStatus(operationType),
        amount: normalizeAmount(input.amount),
        currencyCode: input.currencyCode,
        gatewayReference: payload?.gatewayReference ?? input.gatewayReference ?? null,
        providerReference: payload?.providerReference ?? null,
        message: payload?.message ?? null,
        rawResponse: payload,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Israeli gateway request failed";
      return buildFailureResult(operationType, input, message);
    }
  }
}
