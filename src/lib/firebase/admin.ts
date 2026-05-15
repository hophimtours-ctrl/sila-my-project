import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type GlobalFirebaseAdminState = {
  firebaseAdminApp?: App;
  firebaseAdminDb?: Firestore;
  firebaseAdminInitErrorLogged?: boolean;
};

const globalForFirebaseAdmin = globalThis as typeof globalThis & GlobalFirebaseAdminState;

function readProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    undefined
  );
}

function hasServiceAccountCredentials() {
  return (
    !!process.env.FIREBASE_PROJECT_ID?.trim() &&
    !!process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
    !!process.env.FIREBASE_PRIVATE_KEY?.trim()
  );
}

function createFirebaseAdminApp() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const projectId = readProjectId();
  if (hasServiceAccountCredentials()) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      ...(projectId ? { projectId } : {}),
    });
  }

  return initializeApp(projectId ? { projectId } : undefined);
}

export function getFirestoreAdmin() {
  if (globalForFirebaseAdmin.firebaseAdminDb) {
    return globalForFirebaseAdmin.firebaseAdminDb;
  }

  try {
    const app = globalForFirebaseAdmin.firebaseAdminApp ?? createFirebaseAdminApp();
    const db = getFirestore(app);
    globalForFirebaseAdmin.firebaseAdminApp = app;
    globalForFirebaseAdmin.firebaseAdminDb = db;
    return db;
  } catch (error) {
    if (!globalForFirebaseAdmin.firebaseAdminInitErrorLogged) {
      globalForFirebaseAdmin.firebaseAdminInitErrorLogged = true;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[firebase-admin] Firestore init failed, Prisma sync disabled: ${message}`);
    }
    return null;
  }
}
