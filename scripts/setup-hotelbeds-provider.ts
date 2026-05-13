import { ProviderStatus } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { encryptApiKey, syncHotelProviderData, testHotelProviderConnection } from "../src/lib/hotel-api";

type SetupSummary = {
  providerId: string;
  providerName: string;
  endpoint: string;
  hotelsPath: string;
  enabled: boolean;
  tested: boolean;
  testSuccess?: boolean;
  testMessage?: string;
  synced: boolean;
  syncSuccess?: boolean;
  syncMessage?: string;
  importedCount?: number;
};

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    return "";
  }

  if (/^\{\{[^{}]+\}\}$/.test(value)) {
    return "";
  }

  return value;
}

function loadLocalEnvFiles() {
  const processWithLoadEnv = process as typeof process & {
    loadEnvFile?: (path?: string) => void;
  };

  if (!processWithLoadEnv.loadEnvFile) {
    return;
  }

  try {
    processWithLoadEnv.loadEnvFile(".env");
  } catch {
    // ignore missing .env
  }

  try {
    processWithLoadEnv.loadEnvFile(".env.local");
  } catch {
    // ignore missing .env.local
  }
}

function getRequiredEnv(name: string) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getFirstEnv(names: string[]) {
  for (const name of names) {
    const value = getEnv(name);
    if (value) {
      return value;
    }
  }
  return "";
}

function getBooleanEnv(name: string, defaultValue: boolean) {
  const rawValue = getEnv(name);
  if (!rawValue) {
    return defaultValue;
  }
  return rawValue.toLowerCase() === "true";
}

function getNumberEnv(name: string, defaultValue: number) {
  const rawValue = getEnv(name);
  if (!rawValue) {
    return defaultValue;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultValue;
  }
  return parsed;
}

async function run() {
  loadLocalEnvFiles();
  const providerName = getEnv("HOTELBEDS_PROVIDER_NAME") || "Hotelbeds Provider";
  const endpoint = getEnv("HOTELBEDS_PROVIDER_ENDPOINT") || "https://api.test.hotelbeds.com";
  const hotelsPath =
    getEnv("HOTELBEDS_PROVIDER_HOTELS_PATH") || "/hotel-content-api/1.0/hotels";
  const enabled = getBooleanEnv("HOTELBEDS_PROVIDER_ENABLED", true);
  const autoRefreshEnabled = getBooleanEnv("HOTELBEDS_PROVIDER_AUTO_REFRESH_ENABLED", false);
  const refreshIntervalMinutes = getNumberEnv("HOTELBEDS_PROVIDER_REFRESH_INTERVAL_MINUTES", 60);
  const runConnectionTest = getBooleanEnv("HOTELBEDS_SETUP_RUN_TEST", true);
  const runSync = getBooleanEnv("HOTELBEDS_SETUP_RUN_SYNC", true);
  const forceSyncAfterFailedTest = getBooleanEnv("HOTELBEDS_SETUP_FORCE_SYNC", false);
  const apiKey =
    getFirstEnv([
      "HOTELBEDS_PROVIDER_API_KEY",
      "HOTELBEDS_API_KEY",
    ]) || getRequiredEnv("HOTELBEDS_PROVIDER_API_KEY");
  const apiSecret =
    getFirstEnv([
      "HOTELBEDS_PROVIDER_API_SECRET",
      "HOTELBEDS_API_SECRET",
    ]) || getRequiredEnv("HOTELBEDS_PROVIDER_API_SECRET");

  const encryptedApiKey = encryptApiKey(apiKey);
  const encryptedApiSecret = encryptApiKey(apiSecret);

  const existingProvider = await prisma.hotelApiProvider.findFirst({
    where: {
      OR: [{ name: providerName }, { endpoint, hotelsPath }],
    },
    select: { id: true },
  });

  const provider = existingProvider
    ? await prisma.hotelApiProvider.update({
        where: { id: existingProvider.id },
        data: {
          name: providerName,
          endpoint,
          hotelsPath,
          apiKeyEncrypted: encryptedApiKey,
          apiSecretEncrypted: encryptedApiSecret,
          enabled,
          autoRefreshEnabled,
          refreshIntervalMinutes,
          status: enabled ? ProviderStatus.ERROR : ProviderStatus.DISABLED,
          ...(enabled ? {} : { lastError: null }),
        },
      })
    : await prisma.hotelApiProvider.create({
        data: {
          name: providerName,
          endpoint,
          hotelsPath,
          apiKeyEncrypted: encryptedApiKey,
          apiSecretEncrypted: encryptedApiSecret,
          enabled,
          autoRefreshEnabled,
          refreshIntervalMinutes,
          status: enabled ? ProviderStatus.ERROR : ProviderStatus.DISABLED,
        },
      });

  const summary: SetupSummary = {
    providerId: provider.id,
    providerName: provider.name,
    endpoint: provider.endpoint,
    hotelsPath: provider.hotelsPath,
    enabled: provider.enabled,
    tested: false,
    synced: false,
  };

  if (runConnectionTest) {
    const testResult = await testHotelProviderConnection(provider.id);
    summary.tested = true;
    summary.testSuccess = testResult.success;
    summary.testMessage = testResult.message;
  }

  const shouldRunSync =
    runSync &&
    (!summary.tested || summary.testSuccess === true || forceSyncAfterFailedTest);
  if (shouldRunSync) {
    const syncResult = await syncHotelProviderData(provider.id, "manual");
    summary.synced = true;
    summary.syncSuccess = syncResult.success;
    summary.syncMessage = syncResult.message;
    summary.importedCount = syncResult.importedCount;
  }

  console.log(JSON.stringify(summary, null, 2));
}

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown setup error";
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
