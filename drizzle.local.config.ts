/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.LOCAL_DATABASE_URL) {
  throw new Error("LOCAL_DATABASE_URL is not set in .env file");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.LOCAL_DATABASE_URL!,
  },
});
