export const COLLECTIONS = {
  users: "users",
  hotels: "hotels",
  hotelImages: "hotelImages",
  rooms: "rooms",
  roomImages: "roomImages",
  roomAvailability: "roomAvailability",
  reviews: "reviews",
  deals: "deals",
  apiProviders: "apiProviders",
  apiLogs: "apiLogs",
  bookings: "bookings",
  payments: "payments",
  activityLogs: "activityLogs",
} as const;

export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
};

export type UserDocument = {
  name: string;
  email: string;
  role: "admin" | "hotel_manager" | "api_manager" | "editor" | "viewer" | "customer";
  status: "active" | "disabled";
  permissions: string[];
  lastLoginAt: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type HotelDocument = {
  name: string;
  location: string;
  description: string;
  amenities: string[];
  ratingAvg: number | null;
  ratingCount: number;
  source: "manual" | "api" | "hybrid";
  apiProviderId: string | null;
  status: "active" | "draft" | "archived";
  createdBy: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type RoomDocument = {
  hotelId: string;
  roomType: string;
  capacity: number;
  basePrice: number;
  currency: string;
  source: "manual" | "api" | "hybrid";
  apiRoomId: string | null;
  isActive: boolean;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type RoomAvailabilityDocument = {
  hotelId: string;
  roomId: string;
  date: string;
  available: boolean;
  inventory: number;
  price: number;
  updatedFrom: "manual" | "api";
};

export type ReviewDocument = {
  hotelId: string;
  bookingId: string;
  userId: string;
  rating: number;
  text: string;
  images: string[];
  verified: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt: FirestoreTimestamp;
  moderatedBy: string | null;
  moderatedAt: FirestoreTimestamp | null;
};

export type BookingDocument = {
  userId: string;
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: "pending" | "confirmed" | "cancelled";
  totalPrice: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentId: string | null;
  createdAt: FirestoreTimestamp;
  cancelledAt: FirestoreTimestamp | null;
};

export type PaymentDocument = {
  bookingId: string;
  userId: string;
  provider: "stripe" | "paypal";
  providerIntentId: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amount: number;
  currency: string;
  transactionId: string | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};
