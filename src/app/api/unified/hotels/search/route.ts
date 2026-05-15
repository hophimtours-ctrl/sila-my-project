import { NextResponse } from "next/server";
import type { NormalizedHotel } from "@/lib/hotel-api";
import type { UnifiedHotelSearchQuery, UnifiedHotelsSearchResult } from "@/lib/unified/contracts";
import { getConnector, listRegisteredConnectors, registerConnector } from "@/lib/unified/connectors/registry";
import { RapidPmsConnector } from "@/lib/unified/connectors/rapid-adapter";
import { HotelbedsPmsConnector } from "@/lib/unified/connectors/hotelbeds-adapter";
import { mapRapidHotelsToUnified } from "@/lib/unified/mappers/rapid-mapper";
import { unifiedCatalogService } from "@/lib/unified/services/catalog-service";
import { prisma } from "@/lib/db";

function parsePositiveNumber(value: string | null) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
}

function parseBoolean(value: string | null) {
  if (!value) {
    return undefined;
  }
  return value.trim().toLowerCase() === "true";
}

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function toBoundedInt(value: number | undefined, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(value));
}
function resolveProviderCodeForProvider(provider: { name: string; endpoint: string; hotelsPath: string }) {
  const endpoint = provider.endpoint.toLowerCase();
  const path = provider.hotelsPath.toLowerCase();
  const name = provider.name.toLowerCase();
  const isRapid =
    endpoint.includes("rapidapi.com") ||
    endpoint.includes("ean.com") ||
    endpoint.includes("expediagroup.com") ||
    name.includes("rapid") ||
    path.includes("/properties/content") ||
    path.includes("/properties/availability");
  if (isRapid) {
    return "rapid" as const;
  }

  const isHotelbeds =
    endpoint.includes("hotelbeds") ||
    endpoint.includes("hb-api") ||
    name.includes("hotelbeds") ||
    path.includes("/hotel-content-api/") ||
    path.includes("/hotel-api/");
  if (isHotelbeds) {
    return "hotelbeds" as const;
  }

  return null;
}
async function resolveDefaultAdapterContext() {
  const configuredProviderId = process.env.UNIFIED_DEFAULT_PROVIDER_ID?.trim();
  if (configuredProviderId) {
    const configuredProvider = await prisma.hotelApiProvider.findUnique({
      where: { id: configuredProviderId },
      select: {
        id: true,
        name: true,
        endpoint: true,
        hotelsPath: true,
        enabled: true,
        status: true,
      },
    });
    const providerCode = configuredProvider
      ? resolveProviderCodeForProvider(configuredProvider)
      : null;
    if (configuredProvider?.enabled && configuredProvider.status === "ACTIVE" && providerCode) {
      return {
        providerCode,
        providerId: configuredProvider.id,
      };
    }
  }

  const providers = await prisma.hotelApiProvider.findMany({
    where: {
      enabled: true,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      endpoint: true,
      hotelsPath: true,
    },
    orderBy: [{ lastTestedAt: "desc" }, { updatedAt: "desc" }],
    take: 20,
  });
  for (const provider of providers) {
    const providerCode = resolveProviderCodeForProvider(provider);
    if (providerCode) {
      return {
        providerCode,
        providerId: provider.id,
      };
    }
  }
  return null;
}

if (!getConnector("rapid")) {
  registerConnector(new RapidPmsConnector());
}
if (!getConnector("hotelbeds")) {
  registerConnector(new HotelbedsPmsConnector());
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query: UnifiedHotelSearchQuery = {
      city: url.searchParams.get("city") ?? undefined,
      country: url.searchParams.get("country") ?? undefined,
      facility: url.searchParams.get("facility") ?? undefined,
      guests: parsePositiveNumber(url.searchParams.get("guests")),
      checkIn: url.searchParams.get("checkIn") ?? undefined,
      checkOut: url.searchParams.get("checkOut") ?? undefined,
      limit: parsePositiveNumber(url.searchParams.get("limit")),
      offset: parsePositiveNumber(url.searchParams.get("offset")),
      includeUnavailable: parseBoolean(url.searchParams.get("includeUnavailable")),
    };
    const explicitProviderCode = url.searchParams.get("providerCode")?.trim().toLowerCase() ?? "";
    const explicitProviderId = url.searchParams.get("providerId")?.trim() ?? "";
    const hasExplicitProviderInput = Boolean(explicitProviderCode || explicitProviderId);

    let providerCode = explicitProviderCode;
    let providerId = explicitProviderId;
    if (!hasExplicitProviderInput) {
      const defaultAdapterContext = await resolveDefaultAdapterContext();
      if (defaultAdapterContext) {
        providerCode = defaultAdapterContext.providerCode;
        providerId = defaultAdapterContext.providerId;
      }
    }

    if (providerCode || providerId) {
      if (!providerCode || !providerId) {
        return NextResponse.json(
          { success: false, error: "Both providerCode and providerId are required for adapter mode" },
          { status: 400 },
        );
      }

      const connector = getConnector(providerCode);
      if (!connector) {
        if (!hasExplicitProviderInput) {
          const fallbackResult = await unifiedCatalogService.search(query);
          return NextResponse.json(fallbackResult);
        }
        return NextResponse.json(
          {
            success: false,
            error: `Connector not registered: ${providerCode}`,
            availableConnectors: listRegisteredConnectors(),
          },
          { status: 400 },
        );
      }
      try {
        const connectorHotels = await connector.pullHotels({
          providerId,
          checkIn: parseDate(query.checkIn),
          checkOut: parseDate(query.checkOut),
          guests: query.guests,
          includeAvailability: true,
        });
        const mappedItems = mapRapidHotelsToUnified({
          hotels: connectorHotels as NormalizedHotel[],
          providerId,
          providerCode,
          requestedGuests: query.guests,
          includeUnavailable: query.includeUnavailable,
          city: query.city,
          country: query.country,
          facility: query.facility,
        });
        const limit = toBoundedInt(query.limit, 20, 100);
        const offset = toBoundedInt(query.offset, 0, 10_000);
        const pagedItems = mappedItems.slice(offset, offset + limit);
        const result: UnifiedHotelsSearchResult = {
          success: true,
          source: "unified-catalog-v1",
          generatedAt: new Date().toISOString(),
          total: mappedItems.length,
          count: pagedItems.length,
          limit,
          offset,
          items: pagedItems,
        };
        return NextResponse.json(result);
      } catch (adapterError) {
        if (hasExplicitProviderInput) {
          throw adapterError;
        }
      }
    }
    const result = await unifiedCatalogService.search(query);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unified catalog search failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
