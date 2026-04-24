export type UserRole =
  | "admin"
  | "hotel_manager"
  | "api_manager"
  | "editor"
  | "viewer"
  | "customer";

export type HotelSourceMode = "manual" | "api" | "hybrid";

export type BookingStatus = "pending" | "confirmed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type SearchHotelsRequest = {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
};

export type SearchHotelResultItem = {
  id: string;
  name: string;
  location: string;
  ratingAvg: number | null;
  source: HotelSourceMode;
  cheapestPrice: number | null;
  currency: string;
  imageUrl: string | null;
};

export type SearchHotelsResponse = {
  items: SearchHotelResultItem[];
};

export type CreateBookingRequest = {
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
};

export type CreateBookingResponse = {
  bookingId: string;
  status: BookingStatus;
  totalPrice: number;
  currency: string;
};

export type CreatePaymentIntentRequest = {
  bookingId: string;
  provider: "stripe" | "paypal";
};

export type CreatePaymentIntentResponse = {
  paymentId: string;
  status: PaymentStatus;
  clientSecret: string | null;
  checkoutUrl: string | null;
};
