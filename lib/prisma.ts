import "temporal-polyfill/full/global";
import { Temporal } from "temporal-polyfill";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "@/prisma/contract.d.ts";
import contractJson from "@/prisma/contract.json" with { type: "json" };
import { env } from "@/lib/env";

type Db = ReturnType<typeof postgres<Contract>>;

const globalForDb = globalThis as typeof globalThis & {
  __db?: Db;
  __dbConnectPromise?: Promise<void>;
};

function logConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[database] Connection failed:", message);

  if (error instanceof Error && error.cause) {
    console.error("[database] Cause:", error.cause);
  }
}

async function verifyConnection(db: Db) {
  try {
    console.log("DATABASE_URL", env.databaseUrl());
    await db.connect();
    console.log("[database] Database connected successfully");
  } catch (error) {
    logConnectionError(error);
    throw error;
  }
}

function startConnectionVerification(db: Db) {
  if (!globalForDb.__dbConnectPromise) {
    globalForDb.__dbConnectPromise = verifyConnection(db).catch((error) => {
      globalForDb.__dbConnectPromise = undefined;
      throw error;
    });
  }

  return globalForDb.__dbConnectPromise;
}

export function getDb(): Db {
  if (!globalForDb.__db) {
    globalForDb.__db = postgres<Contract>({
      url: env.databaseUrl(),
      contract: contractJson as unknown as Contract,
    });

    void startConnectionVerification(globalForDb.__db).catch(() => {
      // Error is already logged in verifyConnection.
    });
  }

  return globalForDb.__db;
}

/** Verify the database connection (await before running queries in workers). */
export async function connectDb() {
  return startConnectionVerification(getDb());
}

/** @alias getDb */
export const prisma = getDb;

export function nowInstant() {
  return Temporal.Now.instant();
}

export type DbInstant = ReturnType<typeof nowInstant>;

export function toInstant(value: Date | DbInstant): DbInstant {
  return value instanceof Temporal.Instant
    ? value
    : Temporal.Instant.fromEpochMilliseconds(value.getTime());
}
