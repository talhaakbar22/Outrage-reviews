import IORedis from "ioredis";
import { env } from "@/lib/env";

let connection: IORedis | undefined;

export function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(env.redisUrl(), {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}
