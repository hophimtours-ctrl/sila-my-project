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
