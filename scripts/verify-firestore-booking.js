#!/usr/bin/env node

const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

const HELP_TEXT = `
verify-firestore-booking

Captures Firestore bookings baseline, waits for you to perform a booking flow in the app,
then compares Firestore again and reports newly created booking documents.

Environment variables:
  VERIFY_FIRESTORE_PROJECT_ID      Firebase project id (default: bookmenow-7f4f2)
  VERIFY_FIRESTORE_DATABASE_ID     Firestore database id (default: (default))
  VERIFY_FIRESTORE_COLLECTION      Collection name (default: bookings)
  VERIFY_FIRESTORE_PAGE_SIZE       Documents page size (default: 200)
  VERIFY_APP_BASE_URL              App base URL for manual booking flow instructions
                                   (default: https://my-web-app--bookmenow-7f4f2.us-east4.hosted.app)
`;

const PROJECT_ID = process.env.VERIFY_FIRESTORE_PROJECT_ID?.trim() || "bookmenow-7f4f2";
const DATABASE_ID = process.env.VERIFY_FIRESTORE_DATABASE_ID?.trim() || "(default)";
const COLLECTION = process.env.VERIFY_FIRESTORE_COLLECTION?.trim() || "bookings";
const PAGE_SIZE = Number(process.env.VERIFY_FIRESTORE_PAGE_SIZE ?? 200);
const APP_BASE_URL =
  process.env.VERIFY_APP_BASE_URL?.trim() || "https://my-web-app--bookmenow-7f4f2.us-east4.hosted.app";

function buildCollectionUrl(pageToken) {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    PROJECT_ID,
  )}/databases/${encodeURIComponent(DATABASE_ID)}/documents/${encodeURIComponent(COLLECTION)}?pageSize=${encodeURIComponent(
    String(Number.isFinite(PAGE_SIZE) && PAGE_SIZE > 0 ? Math.floor(PAGE_SIZE) : 200),
  )}`;
  if (!pageToken) {
    return baseUrl;
  }
  return `${baseUrl}&pageToken=${encodeURIComponent(pageToken)}`;
}

function documentStatus(document) {
  return document?.fields?.status?.stringValue ?? null;
}

async function fetchAllCollectionDocuments() {
  const allDocs = [];
  let nextPageToken = null;
  let requestCount = 0;

  do {
    requestCount += 1;
    const response = await fetch(buildCollectionUrl(nextPageToken));
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Firestore REST request failed (${response.status}): ${body}`);
    }
    const payload = await response.json();
    const documents = Array.isArray(payload.documents) ? payload.documents : [];
    allDocs.push(...documents);
    nextPageToken = payload.nextPageToken ?? null;
  } while (nextPageToken && requestCount < 50);

  return allDocs;
}

function mapByName(documents) {
  return new Map(documents.map((doc) => [doc.name, doc]));
}

function printManualFlowInstructions() {
  console.log("");
  console.log("Run a manual booking attempt now:");
  console.log(`1. Open: ${APP_BASE_URL}/register`);
  console.log("2. Register a fresh guest user");
  console.log("3. Go to search results, open a real hotel, continue to payment");
  console.log("4. Submit payment with a tokenized value in paymentToken");
  console.log("");
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP_TEXT.trim());
    return;
  }

  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Database: ${DATABASE_ID}`);
  console.log(`Collection: ${COLLECTION}`);

  const beforeDocs = await fetchAllCollectionDocuments();
  const beforeByName = mapByName(beforeDocs);

  console.log(`Baseline documents: ${beforeDocs.length}`);
  printManualFlowInstructions();

  const rl = readline.createInterface({ input, output });
  try {
    await rl.question("Press Enter after completing the booking flow...");
  } finally {
    rl.close();
  }

  const afterDocs = await fetchAllCollectionDocuments();
  const afterByName = mapByName(afterDocs);

  const newNames = [];
  for (const name of afterByName.keys()) {
    if (!beforeByName.has(name)) {
      newNames.push(name);
    }
  }

  console.log("");
  console.log(`Documents after flow: ${afterDocs.length}`);
  console.log(`New documents detected: ${newNames.length}`);

  if (newNames.length === 0) {
    console.log("No new booking documents were detected.");
    console.log(
      `Check manually in console: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data/~2F${COLLECTION}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("New documents:");
  for (const name of newNames) {
    const doc = afterByName.get(name);
    console.log(`- ${name}`);
    console.log(`  status: ${documentStatus(doc) ?? "N/A"}`);
  }

  const lastName = newNames[newNames.length - 1];
  const encodedDocPath = lastName
    .split("/documents/")[1]
    ?.split("/")
    .map((segment) => `~2F${segment}`)
    .join("");
  if (encodedDocPath) {
    console.log("");
    console.log(
      `Latest document console link: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data/${encodedDocPath}`,
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Verification failed: ${message}`);
  process.exit(1);
});
