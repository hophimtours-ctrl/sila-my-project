import type {
  BookingPaymentStatus,
  CurrencyCode,
  PaymentGateway,
  PaymentOperationStatus,
  PaymentOperationType,
  RoomPaymentPolicy,
} from "@prisma/client";

export type PaymentOperationInput = {
  bookingId: string;
  amount: number;
  currencyCode: CurrencyCode;
  paymentToken?: string | null;
  gatewayReference?: string | null;
  description?: string;
  customerEmail?: string | null;
  customerName?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentOperationResult = {
  success: boolean;
  gateway: PaymentGateway;
  operationType: PaymentOperationType;
  operationStatus: PaymentOperationStatus;
  paymentStatus: BookingPaymentStatus;
  amount: number;
  currencyCode: CurrencyCode;
  gatewayReference?: string | null;
  providerReference?: string | null;
  message?: string | null;
  rawResponse?: unknown;
};

export type BookingPaymentInitInput = {
  bookingId: string;
  amount: number;
  currencyCode: CurrencyCode;
  paymentPolicy: RoomPaymentPolicy;
  paymentToken: string;
  customerEmail?: string | null;
  customerName?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
};

export interface PaymentGatewayAdapter {
  readonly gateway: PaymentGateway;
  charge(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  authorize(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  capture(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  void(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  refund(input: PaymentOperationInput): Promise<PaymentOperationResult>;
}
