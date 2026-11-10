import { drizzle } from "drizzle-orm/netlify-db";
import { getDatabase, type DatabaseConnection } from "@netlify/database";
import * as schema from "./schema";

const connection = getDatabase();
export const pool: DatabaseConnection["pool"] = connection.pool;
export const db = drizzle({ client: connection, schema });
export * from "./schema";
