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

export function instantEpochMs(
  value: DbInstant | Date | null | undefined,
): number | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (value instanceof Temporal.Instant) {
    return Number(value.epochMilliseconds);
  }

  if (typeof value === "object" && "epochMilliseconds" in value) {
    const epochMilliseconds = (value as { epochMilliseconds: unknown })
      .epochMilliseconds;
    return typeof epochMilliseconds === "number" ? epochMilliseconds : null;
  }

  return null;
}

export function isBefore(
  left: DbInstant | Date | null | undefined,
  right: DbInstant | Date | null | undefined,
): boolean {
  const leftMs = instantEpochMs(left);
  const rightMs = instantEpochMs(right);
  if (leftMs == null || rightMs == null) {
    return false;
  }
  return leftMs < rightMs;
}

export function addDays(instant: DbInstant, days: number): DbInstant {
  return instant.add({ days });
}

export function toIsoString(
  value: DbInstant | Date | string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Temporal.Instant) {
    return value.toString();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "epochMilliseconds" in value
  ) {
    const epochMilliseconds = (value as { epochMilliseconds: unknown })
      .epochMilliseconds;
    if (typeof epochMilliseconds === "number") {
      return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds).toString();
    }
  }

  return String(value);
}

export function formatDbInstant(
  value: DbInstant | Date | string | null | undefined,
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  const iso = toIsoString(value);
  if (!iso) {
    return "";
  }

  return new Date(iso).toLocaleString(locales ?? "en-US", options);
}
