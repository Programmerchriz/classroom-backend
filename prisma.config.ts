/// <reference types="node" />
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is not set in .env file");

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
});
