import "server-only";

import type { PrismaClient } from "@prisma/client";
import { getFirestoreAdmin } from "@/lib/firebase/admin";

const MODEL_TO_COLLECTION = {
  User: "users",
  Session: "sessions",
  RoleDefinition: "roleDefinitions",
  SystemSetting: "systemSettings",
  Hotel: "hotels",
  RoomType: "rooms",
  HotelApiProvider: "apiProviders",
  HotelApiSyncLog: "apiLogs",
  UserLoginHistory: "loginHistory",
  UserActivityLog: "activityLogs",
  Booking: "bookings",
  BookingPaymentOperation: "paymentOperations",
  Settlement: "settlements",
  Review: "reviews",
  HostingProperty: "hostingProperties",
  Deal: "deals",
  RoomAvailabilityOverride: "roomAvailabilityOverrides",
  Favorite: "favorites",
  BlockedDate: "blockedDates",
} as const;

type FirestoreSyncModel = keyof typeof MODEL_TO_COLLECTION;
type FirestoreHydrationModel = FirestoreSyncModel;
type FirestorePlainRecord = Record<string, unknown>;

const SUPPORTED_ACTIONS = new Set(["create", "update", "upsert", "delete"]);
const READ_ACTIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const extendedClients = new WeakMap<PrismaClient, PrismaClient>();
const firestoreHydrationState = {
  inFlight: null as Promise<void> | null,
  lastCompletedAt: 0,
};
type FirestoreMutationContext = {
  model?: string;
  operation: string;
  args?: unknown;
};
const HYDRATION_MODEL_ORDER: FirestoreHydrationModel[] = [
  "RoleDefinition",
  "User",
  "SystemSetting",
  "Session",
  "HotelApiProvider",
  "Hotel",
  "RoomType",
  "UserLoginHistory",
  "UserActivityLog",
  "Booking",
  "BookingPaymentOperation",
  "Settlement",
  "Review",
  "HostingProperty",
  "Deal",
  "RoomAvailabilityOverride",
  "Favorite",
  "BlockedDate",
  "HotelApiSyncLog",
];
const MODEL_DATE_FIELDS: Partial<Record<FirestoreHydrationModel, string[]>> = {
  User: ["lastLoginAt", "createdAt", "updatedAt"],
  Session: ["expiresAt", "createdAt"],
  RoleDefinition: ["createdAt", "updatedAt"],
  SystemSetting: ["createdAt", "updatedAt"],
  Hotel: ["lastImportedAt", "createdAt", "updatedAt"],
  RoomType: ["createdAt", "updatedAt"],
  HotelApiProvider: ["lastTestedAt", "lastRefreshedAt", "createdAt", "updatedAt"],
  HotelApiSyncLog: ["createdAt"],
  UserLoginHistory: ["createdAt"],
  UserActivityLog: ["createdAt"],
  Booking: ["checkIn", "checkOut", "paymentDate", "createdAt", "updatedAt"],
  BookingPaymentOperation: ["createdAt", "updatedAt"],
  Settlement: ["paymentDate", "createdAt", "updatedAt"],
  Review: ["createdAt", "updatedAt"],
  HostingProperty: ["createdAt", "updatedAt"],
  Deal: ["validFrom", "validTo", "createdAt", "updatedAt"],
  RoomAvailabilityOverride: ["date", "createdAt", "updatedAt"],
  Favorite: ["createdAt"],
  BlockedDate: ["date"],
};

function isFirestoreHydrationEnabled() {
  return process.env.FIRESTORE_SYNC_ENABLED?.trim().toLowerCase() !== "false";
}
function resolveHydrationIntervalMs() {
  const rawValue = Number(process.env.FIRESTORE_HYDRATION_INTERVAL_SECONDS ?? 20);
  const seconds = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 20;
  return seconds * 1000;
}
function resolveHydrationBatchSize() {
  const rawValue = Number(process.env.FIRESTORE_HYDRATION_MAX_DOCS ?? 1000);
  if (!Number.isFinite(rawValue) || rawValue < 1) {
    return 1000;
  }
  return Math.min(Math.floor(rawValue), 5000);
}

function isFirestoreSyncModel(model: string): model is FirestoreSyncModel {
  return Object.prototype.hasOwnProperty.call(MODEL_TO_COLLECTION, model);
}

function toPrismaDelegateKey(model: string) {
  return `${model.charAt(0).toLowerCase()}${model.slice(1)}`;
}

function readDocumentId(
  params: FirestoreMutationContext,
  result: unknown,
) {
  if (result && typeof result === "object" && "id" in result) {
    const candidate = (result as { id?: unknown }).id;
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate);
    }
  }

  const whereId = (params.args as { where?: { id?: unknown } } | undefined)?.where?.id;
  if (typeof whereId === "string" || typeof whereId === "number") {
    return String(whereId);
  }

  return null;
}

function normalizeForFirestore(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForFirestore(entry));
  }
  if (typeof value === "object") {
    if ("toJSON" in value && typeof value.toJSON === "function") {
      return normalizeForFirestore(value.toJSON());
    }

    const record = value as Record<string, unknown>;
    const normalizedEntries = Object.entries(record)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, normalizeForFirestore(entry)]);
    return Object.fromEntries(normalizedEntries);
  }
  return value;
}
function normalizeFirestoreRecordForPrisma(
  model: FirestoreHydrationModel,
  id: string,
  source: FirestorePlainRecord,
) {
  const dateFields = new Set(MODEL_DATE_FIELDS[model] ?? []);
  const recordEntries = Object.entries(source)
    .filter(([key]) => key !== "_meta")
    .map(([key, value]) => {
      if (value === undefined) {
        return [key, null] as const;
      }
      if (dateFields.has(key) && typeof value === "string" && value.trim()) {
        const asDate = new Date(value);
        if (!Number.isNaN(asDate.getTime())) {
          return [key, asDate] as const;
        }
      }
      return [key, value] as const;
    });
  const normalized = Object.fromEntries(recordEntries) as Record<string, unknown>;
  return { ...normalized, id };
}
async function upsertFirestoreDocumentToPrisma(
  prisma: PrismaClient,
  model: FirestoreHydrationModel,
  id: string,
  payload: FirestorePlainRecord,
) {
  const delegateKey = toPrismaDelegateKey(model) as keyof PrismaClient;
  const delegate = prisma[delegateKey] as
    | {
        upsert?: (args: {
          where: { id: string };
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }) => Promise<unknown>;
      }
    | undefined;
  if (!delegate?.upsert) {
    return;
  }
  const normalizedPayload = normalizeFirestoreRecordForPrisma(model, id, payload);
  await delegate.upsert({
    where: { id },
    update: normalizedPayload,
    create: normalizedPayload,
  });
}
async function hydratePrismaFromFirestore(prisma: PrismaClient) {
  const db = getFirestoreAdmin();
  if (!db) {
    return;
  }
  const maxDocs = resolveHydrationBatchSize();
  for (const model of HYDRATION_MODEL_ORDER) {
    const collectionName = MODEL_TO_COLLECTION[model];
    const snapshot = await db.collection(collectionName).limit(maxDocs).get();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data || typeof data !== "object") {
        continue;
      }
      try {
        await upsertFirestoreDocumentToPrisma(prisma, model, doc.id, data as FirestorePlainRecord);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[firestore-hydration] ${model}.${doc.id} upsert failed: ${message}`);
      }
    }
  }
}
async function ensureFirestoreHydrated(prisma: PrismaClient) {
  if (!isFirestoreHydrationEnabled()) {
    return;
  }
  const now = Date.now();
  const intervalMs = resolveHydrationIntervalMs();
  if (!firestoreHydrationState.inFlight && now - firestoreHydrationState.lastCompletedAt < intervalMs) {
    return;
  }
  if (!firestoreHydrationState.inFlight) {
    firestoreHydrationState.inFlight = (async () => {
      try {
        await hydratePrismaFromFirestore(prisma);
        firestoreHydrationState.lastCompletedAt = Date.now();
      } finally {
        firestoreHydrationState.inFlight = null;
      }
    })();
  }
  await firestoreHydrationState.inFlight;
}

async function readModelRecordById(
  prisma: PrismaClient,
  model: FirestoreSyncModel,
  id: string,
) {
  const delegateKey = toPrismaDelegateKey(model) as keyof PrismaClient;
  const delegate = prisma[delegateKey] as
    | { findUnique?: (args: { where: { id: string } }) => Promise<unknown> }
    | undefined;

  if (!delegate?.findUnique) {
    return null;
  }

  return delegate.findUnique({ where: { id } });
}

async function syncModelMutationToFirestore(
  prisma: PrismaClient,
  params: FirestoreMutationContext,
  result: unknown,
) {
  const model = params.model;
  if (!model || !isFirestoreSyncModel(model)) {
    return;
  }
  if (!SUPPORTED_ACTIONS.has(params.operation)) {
    return;
  }

  const docId = readDocumentId(params, result);
  if (!docId) {
    return;
  }

  const db = getFirestoreAdmin();
  if (!db) {
    return;
  }

  const collectionName = MODEL_TO_COLLECTION[model];
  const docRef = db.collection(collectionName).doc(docId);
  if (params.operation === "delete") {
    await docRef.delete();
    return;
  }

  const record = await readModelRecordById(prisma, model, docId);
  if (!record) {
    await docRef.delete();
    return;
  }

  await docRef.set(
    {
      ...((normalizeForFirestore(record) as Record<string, unknown>) ?? {}),
      _meta: {
        model,
        syncedAt: new Date().toISOString(),
      },
    },
    { merge: false },
  );
}

export function withPrismaFirestoreSync(prisma: PrismaClient) {
  const existingExtendedClient = extendedClients.get(prisma);
  if (existingExtendedClient) {
    return existingExtendedClient;
  }

  const extendedClient = prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && isFirestoreSyncModel(model) && READ_ACTIONS.has(operation)) {
            await ensureFirestoreHydrated(prisma);
          }
          const result = await query(args);

          try {
            await syncModelMutationToFirestore(prisma, { model, operation, args }, result);
          } catch (error) {
            const modelName = model ?? "unknown-model";
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[firestore-sync] ${modelName}.${operation} mirror failed: ${message}`);
          }

          return result;
        },
      },
    },
  });

  extendedClients.set(prisma, extendedClient as PrismaClient);
  return extendedClient as PrismaClient;
}
