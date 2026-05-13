/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.NEON_DATABASE_URL) {
  throw new Error("NEON_DATABASE_URL is not set in .env file");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_DATABASE_URL!,
  },
});
