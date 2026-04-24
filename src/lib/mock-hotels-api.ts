import { headers } from "next/headers";
import type { MockHotel } from "@/lib/mock-hotels";

type MockHotelsApiResponse = {
  success: boolean;
  items?: MockHotel[];
};

type MockHotelApiResponse = {
  success: boolean;
  item?: MockHotel;
};

async function resolveBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function fetchMockHotels(options?: {
  city?: string;
  facility?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}) {
  const baseUrl = await resolveBaseUrl();
  const query = new URLSearchParams();
  query.set("limit", String(options?.limit ?? 50));
  if (options?.city) {
    query.set("city", options.city);
  }
  if (options?.facility) {
    query.set("facility", options.facility);
  }
  if (typeof options?.minPrice === "number") {
    query.set("minPrice", String(options.minPrice));
  }
  if (typeof options?.maxPrice === "number") {
    query.set("maxPrice", String(options.maxPrice));
  }

  try {
    const response = await fetch(`${baseUrl}/api/mock/hotels?${query.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as MockHotelsApiResponse;
    return Array.isArray(payload.items) ? payload.items : [];
  } catch {
    return [];
  }
}

export async function fetchMockHotelById(id: string) {
  const baseUrl = await resolveBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/mock/hotels/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as MockHotelApiResponse;
    return payload.item ?? null;
  } catch {
    return null;
  }
}

