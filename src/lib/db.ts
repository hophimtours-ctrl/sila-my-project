import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) {
    return undefined;
  }

  if (!configuredUrl.startsWith("file:")) {
    return configuredUrl;
  }

  const rawPath = configuredUrl.replace("file:", "");
  const normalizedRelativePath = rawPath.replace(/^[.\\/]+/, "");
  const schemaRelativePath = path.join(process.cwd(), "prisma", normalizedRelativePath);
  const cwdRelativePath = path.join(process.cwd(), rawPath);
  const resolvedPath = path.isAbsolute(rawPath)
    ? rawPath
    : fs.existsSync(schemaRelativePath)
      ? schemaRelativePath
      : cwdRelativePath;
  const bundledDbPath = path.join(process.cwd(), "prisma", "dev.db");

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  if (!fs.existsSync(resolvedPath)) {
    if (fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, resolvedPath);
    } else {
      fs.closeSync(fs.openSync(resolvedPath, "w"));
    }
  }

  return `file:${resolvedPath}`;
}

const databaseUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl
      ? {
          datasources: {
            db: {
              url: databaseUrl,
            },
          },
        }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
