import { headers } from "next/headers";
import type { UnifiedHotelsSearchResult } from "@/lib/unified/contracts";

type UnifiedHotelsApiError = {
  success: false;
  error?: string;
};

type UnifiedHotelsApiResponse = UnifiedHotelsSearchResult | UnifiedHotelsApiError;

type FetchUnifiedHotelsSearchOptions = {
  city?: string;
  country?: string;
  facility?: string;
  guests?: number;
  checkIn?: string;
  checkOut?: string;
  limit?: number;
  offset?: number;
  includeUnavailable?: boolean;
  providerCode?: string;
  providerId?: string;
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

export async function fetchUnifiedHotelsSearch(options?: FetchUnifiedHotelsSearchOptions) {
  const baseUrl = await resolveBaseUrl();
  const query = new URLSearchParams();
  query.set("limit", String(options?.limit ?? 50));
  if (typeof options?.offset === "number") {
    query.set("offset", String(options.offset));
  }
  if (options?.city) {
    query.set("city", options.city);
  }
  if (options?.country) {
    query.set("country", options.country);
  }
  if (options?.facility) {
    query.set("facility", options.facility);
  }
  if (typeof options?.guests === "number" && Number.isFinite(options.guests) && options.guests > 0) {
    query.set("guests", String(Math.floor(options.guests)));
  }
  if (options?.checkIn) {
    query.set("checkIn", options.checkIn);
  }
  if (options?.checkOut) {
    query.set("checkOut", options.checkOut);
  }
  if (typeof options?.includeUnavailable === "boolean") {
    query.set("includeUnavailable", String(options.includeUnavailable));
  }
  if (options?.providerCode && options?.providerId) {
    query.set("providerCode", options.providerCode);
    query.set("providerId", options.providerId);
  }

  try {
    const response = await fetch(`${baseUrl}/api/unified/hotels/search?${query.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as UnifiedHotelsApiResponse;
    if (!payload.success || !("items" in payload) || !Array.isArray(payload.items)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
