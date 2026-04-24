import {
  HotelDataSourceMode,
  HotelStatus,
  IntegrationLogLevel,
  Prisma,
  ProviderStatus,
  Role,
} from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

type NormalizedRoom = {
  externalRoomId: string;
  name: string;
  pricePerNight: number;
  maxGuests: number;
  inventory: number;
  availableInventory: number;
  isAvailable: boolean;
  photos: string[];
  cancellationPolicy: string;
};

type NormalizedHotel = {
  externalHotelId: string;
  name: string;
  location: string;
  description: string;
  facilities: string[];
  images: string[];
  rating: number | null;
  rooms: NormalizedRoom[];
};

const DEFAULT_ENCRYPTION_SECRET = "bookmenow-dev-hotel-api-secret-change-me";

function getEncryptionKey() {
  return createHash("sha256")
    .update(process.env.HOTEL_API_ENCRYPTION_SECRET ?? DEFAULT_ENCRYPTION_SECRET)
    .digest();
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function toSafeString(value: unknown, fallback: string) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return fallback;
}

function toSafeNumber(value: unknown, fallback: number) {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : fallback;
}

function normalizeRoom(rawRoom: unknown, index: number): NormalizedRoom {
  const room = typeof rawRoom === "object" && rawRoom !== null ? rawRoom : {};
  const inventory = Math.max(
    0,
    toSafeNumber(
      (room as {
        inventory?: unknown;
        totalUnits?: unknown;
        totalRooms?: unknown;
        stock?: unknown;
        availableUnits?: unknown;
      }).inventory ??
        (room as { totalUnits?: unknown }).totalUnits ??
        (room as { totalRooms?: unknown }).totalRooms ??
        (room as { stock?: unknown }).stock ??
        (room as { availableUnits?: unknown }).availableUnits,
      1,
    ),
  );
  const availableInventory = Math.max(
    0,
    toSafeNumber(
      (room as {
        availableInventory?: unknown;
        availableUnits?: unknown;
        freeUnits?: unknown;
        available?: unknown;
      }).availableInventory ??
        (room as { availableUnits?: unknown }).availableUnits ??
        (room as { freeUnits?: unknown }).freeUnits ??
        (room as { available?: unknown }).available,
      inventory,
    ),
  );

  return {
    externalRoomId: toSafeString(
      (room as { id?: unknown; externalId?: unknown; code?: unknown }).externalId ??
        (room as { id?: unknown }).id ??
        (room as { code?: unknown }).code,
      `room-${index + 1}`,
    ),
    name: toSafeString(
      (room as { name?: unknown; roomType?: unknown; title?: unknown }).name ??
        (room as { roomType?: unknown }).roomType ??
        (room as { title?: unknown }).title,
      `Room ${index + 1}`,
    ),
    pricePerNight: Math.max(
      1,
      toSafeNumber(
        (room as { price?: unknown; pricePerNight?: unknown; rate?: unknown }).pricePerNight ??
          (room as { price?: unknown }).price ??
          (room as { rate?: unknown }).rate,
        100,
      ),
    ),
    maxGuests: Math.max(
      1,
      toSafeNumber(
        (room as { maxGuests?: unknown; capacity?: unknown }).maxGuests ??
          (room as { capacity?: unknown }).capacity,
        2,
      ),
    ),
    inventory,
    availableInventory: Math.min(inventory, availableInventory),
    isAvailable:
      toSafeNumber(
        (room as { isAvailable?: unknown; available?: unknown }).isAvailable ??
          (room as { available?: unknown }).available,
        availableInventory > 0 ? 1 : 0,
      ) > 0 && availableInventory > 0,
    photos: toStringArray(
      (room as { photos?: unknown; images?: unknown; imageUrls?: unknown }).photos ??
        (room as { images?: unknown }).images ??
        (room as { imageUrls?: unknown }).imageUrls,
    ),
    cancellationPolicy: toSafeString(
      (room as { cancellationPolicy?: unknown; policy?: unknown }).cancellationPolicy ??
        (room as { policy?: unknown }).policy,
      "Cancellation policy provided by supplier",
    ),
  };
}

function resolveHotelsArray(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.hotels)) {
    return record.hotels;
  }
  if (Array.isArray(record.data)) {
    return record.data;
  }
  if (Array.isArray(record.results)) {
    return record.results;
  }
  if (Array.isArray(record.items)) {
    return record.items;
  }

  return [];
}

function normalizeHotel(rawHotel: unknown, index: number): NormalizedHotel {
  const hotel = typeof rawHotel === "object" && rawHotel !== null ? rawHotel : {};

  const rawRooms =
    (hotel as { rooms?: unknown; roomTypes?: unknown }).rooms ??
    (hotel as { roomTypes?: unknown }).roomTypes;

  return {
    externalHotelId: toSafeString(
      (hotel as { id?: unknown; externalId?: unknown; code?: unknown }).externalId ??
        (hotel as { id?: unknown }).id ??
        (hotel as { code?: unknown }).code,
      `hotel-${index + 1}`,
    ),
    name: toSafeString(
      (hotel as { name?: unknown; title?: unknown; hotelName?: unknown }).name ??
        (hotel as { hotelName?: unknown }).hotelName ??
        (hotel as { title?: unknown }).title,
      `Imported Hotel ${index + 1}`,
    ),
    location: toSafeString(
      (hotel as { location?: unknown; city?: unknown; destination?: unknown }).location ??
        (hotel as { city?: unknown }).city ??
        (hotel as { destination?: unknown }).destination,
      "Unknown location",
    ),
    description: toSafeString(
      (hotel as { description?: unknown; summary?: unknown }).description ??
        (hotel as { summary?: unknown }).summary,
      "No description provided by API.",
    ),
    facilities: toStringArray(
      (hotel as { amenities?: unknown; facilities?: unknown }).amenities ??
        (hotel as { facilities?: unknown }).facilities,
    ),
    images: toStringArray(
      (hotel as { images?: unknown; photos?: unknown; imageUrls?: unknown }).images ??
        (hotel as { photos?: unknown }).photos ??
        (hotel as { imageUrls?: unknown }).imageUrls,
    ),
    rating: (() => {
      const parsedRating = toSafeNumber(
        (hotel as { rating?: unknown; stars?: unknown }).rating ??
          (hotel as { stars?: unknown }).stars,
        Number.NaN,
      );

      return Number.isFinite(parsedRating) ? parsedRating : null;
    })(),
    rooms: Array.isArray(rawRooms) ? rawRooms.map((room, roomIndex) => normalizeRoom(room, roomIndex)) : [],
  };
}

function resolveProviderEndpointUrl(endpoint: string, hotelsPath: string) {
  if (/^https?:\/\//i.test(hotelsPath)) {
    return hotelsPath;
  }

  const cleanedEndpoint = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  const normalizedPath = hotelsPath.startsWith("/") ? hotelsPath : `/${hotelsPath}`;
  return `${cleanedEndpoint}${normalizedPath}`;
}

export function encryptApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptApiKey(payload: string) {
  const [ivBase64, tagBase64, encryptedBase64] = payload.split(":");
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted API key payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivBase64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskApiKey(apiKey: string) {
  if (apiKey.length <= 4) {
    return "*".repeat(apiKey.length);
  }

  return `${apiKey.slice(0, 2)}${"*".repeat(Math.max(4, apiKey.length - 4))}${apiKey.slice(-2)}`;
}

export async function logProviderEvent(
  providerId: string,
  level: IntegrationLogLevel,
  action: string,
  message: string,
  metadata?: Prisma.InputJsonValue,
) {
  await prisma.hotelApiSyncLog.create({
    data: {
      providerId,
      level,
      action,
      message,
      metadata,
    },
  });
}

async function fetchProviderHotelPayload(providerId: string) {
  const provider = await prisma.hotelApiProvider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new Error("Provider not found");
  }

  const apiKey = decryptApiKey(provider.apiKeyEncrypted);
  const endpointUrl = resolveProviderEndpointUrl(provider.endpoint, provider.hotelsPath);
  const response = await fetch(endpointUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    cache: "no-store",
  });

  const responseText = await response.text();
  let payload: unknown = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = responseText;
  }

  return { provider, response, payload };
}

export async function testHotelProviderConnection(providerId: string) {
  try {
    const { provider, response, payload } = await fetchProviderHotelPayload(providerId);
    const hotels = resolveHotelsArray(payload);

    if (!response.ok) {
      const message = `Provider test failed (${response.status})`;
      await prisma.hotelApiProvider.update({
        where: { id: provider.id },
        data: {
          status: ProviderStatus.ERROR,
          lastError: message,
          lastTestedAt: new Date(),
        },
      });
      await logProviderEvent(provider.id, IntegrationLogLevel.ERROR, "test-connection", message, {
        statusCode: response.status,
      });

      return { success: false, message };
    }

    await prisma.hotelApiProvider.update({
      where: { id: provider.id },
      data: {
        status: provider.enabled ? ProviderStatus.ACTIVE : ProviderStatus.DISABLED,
        lastError: null,
        lastTestedAt: new Date(),
      },
    });
    await logProviderEvent(
      provider.id,
      IntegrationLogLevel.INFO,
      "test-connection",
      `Connection successful. Received ${hotels.length} hotel records.`,
    );

    return {
      success: true,
      message: `Connection successful. Received ${hotels.length} hotel records.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error";
    await prisma.hotelApiProvider.update({
      where: { id: providerId },
      data: {
        status: ProviderStatus.ERROR,
        lastError: message,
        lastTestedAt: new Date(),
      },
    });
    await logProviderEvent(providerId, IntegrationLogLevel.ERROR, "test-connection", message);

    return { success: false, message };
  }
}

async function resolveDefaultOwnerId() {
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (admin) {
    return admin.id;
  }

  const owner = await prisma.user.findFirst({ where: { role: Role.OWNER } });
  if (owner) {
    return owner.id;
  }

  const fallbackUser = await prisma.user.findFirst();
  if (!fallbackUser) {
    throw new Error("Cannot import hotels because there are no users in the system");
  }

  return fallbackUser.id;
}

export async function syncHotelProviderData(providerId: string, trigger: "manual" | "auto" = "manual") {
  const provider = await prisma.hotelApiProvider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    return { success: false, message: "Provider not found", importedCount: 0 };
  }

  if (!provider.enabled) {
    await prisma.hotelApiProvider.update({
      where: { id: provider.id },
      data: { status: ProviderStatus.DISABLED },
    });
    await logProviderEvent(
      provider.id,
      IntegrationLogLevel.WARNING,
      "sync-skipped",
      "Sync skipped because provider is disabled",
    );
    return { success: false, message: "Provider is disabled", importedCount: 0 };
  }

  try {
    const { response, payload } = await fetchProviderHotelPayload(provider.id);
    if (!response.ok) {
      const message = `Sync failed with status ${response.status}`;
      await prisma.hotelApiProvider.update({
        where: { id: provider.id },
        data: {
          status: ProviderStatus.ERROR,
          lastError: message,
          lastRefreshedAt: new Date(),
        },
      });
      await logProviderEvent(provider.id, IntegrationLogLevel.ERROR, "sync", message, {
        trigger,
        statusCode: response.status,
      });
      return { success: false, message, importedCount: 0 };
    }

    const rawHotels = resolveHotelsArray(payload);
    const normalizedHotels = rawHotels.map((item, index) => normalizeHotel(item, index));
    const ownerId = await resolveDefaultOwnerId();
    let importedCount = 0;

    for (const normalizedHotel of normalizedHotels) {
      const existingHotel = await prisma.hotel.findFirst({
        where: {
          providerId: provider.id,
          externalHotelId: normalizedHotel.externalHotelId,
        },
      });

      let hotelId = existingHotel?.id;

      if (existingHotel) {
        const shouldPreserveManual =
          existingHotel.manualOverride || existingHotel.dataSourceMode === HotelDataSourceMode.MANUAL;

        await prisma.hotel.update({
          where: { id: existingHotel.id },
          data: {
            ...(shouldPreserveManual
              ? {}
              : {
                  name: normalizedHotel.name,
                  location: normalizedHotel.location,
                  description: normalizedHotel.description,
                  facilities: normalizedHotel.facilities,
                  images: normalizedHotel.images,
                }),
            rating: normalizedHotel.rating,
            status: HotelStatus.APPROVED,
            providerId: provider.id,
            externalHotelId: normalizedHotel.externalHotelId,
            dataSourceMode: shouldPreserveManual
              ? HotelDataSourceMode.HYBRID
              : existingHotel.dataSourceMode === HotelDataSourceMode.MANUAL
                ? HotelDataSourceMode.HYBRID
                : HotelDataSourceMode.API,
            lastImportedAt: new Date(),
          },
        });
      } else {
        const createdHotel = await prisma.hotel.create({
          data: {
            ownerId,
            providerId: provider.id,
            externalHotelId: normalizedHotel.externalHotelId,
            name: normalizedHotel.name,
            location: normalizedHotel.location,
            description: normalizedHotel.description,
            facilities: normalizedHotel.facilities,
            images: normalizedHotel.images,
            rating: normalizedHotel.rating,
            dataSourceMode: HotelDataSourceMode.API,
            status: HotelStatus.APPROVED,
            lastImportedAt: new Date(),
          },
        });

        hotelId = createdHotel.id;
      }

      if (!hotelId) {
        continue;
      }

      for (const room of normalizedHotel.rooms) {
        const existingRoom = await prisma.roomType.findFirst({
          where: {
            hotelId,
            externalRoomId: room.externalRoomId,
          },
        });

        if (existingRoom) {
          await prisma.roomType.update({
            where: { id: existingRoom.id },
            data: {
              name: room.name,
              pricePerNight: room.pricePerNight,
              maxGuests: room.maxGuests,
              inventory: room.inventory,
              availableInventory: room.availableInventory,
              isAvailable: room.isAvailable,
              photos: room.photos,
              cancellationPolicy: room.cancellationPolicy,
            },
          });
        } else {
          await prisma.roomType.create({
            data: {
              hotelId,
              externalRoomId: room.externalRoomId,
              name: room.name,
              pricePerNight: room.pricePerNight,
              maxGuests: room.maxGuests,
              inventory: room.inventory,
              availableInventory: room.availableInventory,
              isAvailable: room.isAvailable,
              photos: room.photos,
              cancellationPolicy: room.cancellationPolicy,
            },
          });
        }
      }

      importedCount += 1;
    }

    await prisma.hotelApiProvider.update({
      where: { id: provider.id },
      data: {
        status: ProviderStatus.ACTIVE,
        lastError: null,
        lastRefreshedAt: new Date(),
      },
    });
    await logProviderEvent(
      provider.id,
      IntegrationLogLevel.INFO,
      "sync",
      `Sync complete: imported ${importedCount} hotels`,
      { trigger, importedCount },
    );

    return {
      success: true,
      message: `Sync complete: imported ${importedCount} hotels`,
      importedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await prisma.hotelApiProvider.update({
      where: { id: provider.id },
      data: {
        status: ProviderStatus.ERROR,
        lastError: message,
        lastRefreshedAt: new Date(),
      },
    });
    await logProviderEvent(provider.id, IntegrationLogLevel.ERROR, "sync", message, { trigger });

    return { success: false, message, importedCount: 0 };
  }
}

export async function runAutoRefreshForProviders() {
  const now = Date.now();
  const providers = await prisma.hotelApiProvider.findMany({
    where: {
      enabled: true,
      autoRefreshEnabled: true,
    },
  });

  for (const provider of providers) {
    const lastRefresh = provider.lastRefreshedAt?.getTime() ?? 0;
    const intervalMs = provider.refreshIntervalMinutes * 60 * 1000;
    const isDue = lastRefresh === 0 || now - lastRefresh >= intervalMs;

    if (isDue) {
      await syncHotelProviderData(provider.id, "auto");
    }
  }
}
