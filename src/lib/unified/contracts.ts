export type UnifiedHotelSource = "manual" | "hybrid" | "pms" | "mock";

export type UnifiedIntegrationRef = {
  providerId: string | null;
  providerCode: string | null;
  externalHotelId: string | null;
};

export type UnifiedRoomSummary = {
  id: string;
  externalRoomId: string | null;
  name: string;
  maxGuests: number;
  baseRate: number;
  currency: string;
  inventory: number;
  availableInventory: number;
  isAvailable: boolean;
  cancellationPolicy: string;
};

export type UnifiedHotel = {
  id: string;
  name: string;
  location: string;
  city: string | null;
  country: string | null;
  description: string;
  facilities: string[];
  images: string[];
  rating: number | null;
  averageReviewScore: number | null;
  source: UnifiedHotelSource;
  integration: UnifiedIntegrationRef;
  rooms: UnifiedRoomSummary[];
};

export type UnifiedHotelSearchQuery = {
  city?: string;
  country?: string;
  facility?: string;
  guests?: number;
  checkIn?: string;
  checkOut?: string;
  limit?: number;
  offset?: number;
  includeUnavailable?: boolean;
};

export type UnifiedHotelsSearchResult = {
  success: true;
  source: "unified-catalog-v1";
  generatedAt: string;
  total: number;
  count: number;
  limit: number;
  offset: number;
  items: UnifiedHotel[];
};

export type UnifiedRoomAvailability = {
  roomId: string;
  isAvailable: boolean;
  remainingInventory: number;
  nightlyRate: number;
  currency: string;
};

export type UnifiedHotelAvailabilityResult = {
  success: true;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: UnifiedRoomAvailability[];
};

export type UnifiedPaymentOperation =
  | "initialize"
  | "capture"
  | "void"
  | "refund";

export type UnifiedPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "VOIDED"
  | "REFUNDED"
  | "FAILED";

export type UnifiedPaymentGateway = "ISRAEL" | "STRIPE";

export type UnifiedPaymentOperationRequest = {
  operation: UnifiedPaymentOperation;
  bookingId: string;
  paymentToken?: string;
  paymentSessionId?: string;
  amount?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type UnifiedBookingPaymentOperation = {
  id: string;
  operationType: string;
  operationStatus: string;
  gateway: UnifiedPaymentGateway;
  amount: number;
  currencyCode: string;
  gatewayReference: string | null;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: string;
};

export type UnifiedBookingPaymentSnapshot = {
  id: string;
  status: string;
  payment: {
    policy: string;
    gateway: UnifiedPaymentGateway | null;
    status: UnifiedPaymentStatus;
    currencyCode: string;
    reference: string | null;
    authorizedAmount: number;
    capturedAmount: number;
    refundedAmount: number;
    errorMessage: string | null;
    updatedAt: string;
  };
  operations: UnifiedBookingPaymentOperation[];
};

export type UnifiedPaymentOperationResponse = {
  success: boolean;
  operation: {
    success: boolean;
    gateway: UnifiedPaymentGateway;
    operationType: string;
    operationStatus: string;
    paymentStatus: UnifiedPaymentStatus;
    amount: number;
    currencyCode: string;
    gatewayReference?: string | null;
    providerReference?: string | null;
    message?: string | null;
  } | null;
  message: string | null;
  booking: UnifiedBookingPaymentSnapshot;
};

export type UnifiedPaymentWebhookPayload = {
  bookingId?: string;
  gatewayReference?: string;
  paymentStatus: UnifiedPaymentStatus;
  operationType?: "CHARGE" | "AUTHORIZE" | "CAPTURE" | "VOID" | "REFUND";
  operationStatus?: "SUCCEEDED" | "FAILED";
  gateway?: UnifiedPaymentGateway;
  amount?: number;
  currencyCode?: "ILS" | "USD" | "EUR" | "GBP";
  providerReference?: string | null;
  message?: string | null;
  idempotencyKey?: string | null;
  payload?: unknown;
};
