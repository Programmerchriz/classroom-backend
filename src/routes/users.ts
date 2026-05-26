import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { user } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();
const TRANSIENT_DB_ERROR_CODE = "UND_ERR_CONNECT_TIMEOUT";
const DB_RETRY_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientDbError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const cause = (error as Error & { cause?: unknown }).cause;
  if (!(cause instanceof Error)) return false;

  const sourceError = (cause as Error & { sourceError?: unknown }).sourceError;
  if (!(sourceError instanceof Error)) {
    return cause.message.includes("fetch failed");
  }

  const nestedCause = (sourceError as Error & { cause?: unknown }).cause;
  const errorCode =
    nestedCause && typeof nestedCause === "object" && "code" in nestedCause
      ? nestedCause.code
      : undefined;

  return (
    errorCode === TRANSIENT_DB_ERROR_CODE ||
    sourceError.message.includes("fetch failed")
  );
};

const withDbRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientDbError(error) || attempt === DB_RETRY_ATTEMPTS) {
        throw error;
      }

      await sleep(attempt * 200);
    }
  }

  throw lastError;
};

// Get all users with optional search, filtering and pagination
router.get("/", async (req, res) => {
  try {
    const { search, role, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);

    const offset = (currentPage - 1) * limitPerPage;
    const filterConditions = [];

    // If search query exists, filter by user name or user email
    if (search) {
      filterConditions.push(
        or(
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
        )
      );
    }

    // If role filter exists, match user role exactly
    if (role) {
      filterConditions.push(eq(user.role, `${role}` as "student" | "teacher" | "admin"));
    }

    // Combine all filters using AND if any exist
    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await withDbRetry(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .where(whereClause)
    );

    const totalCount = Number(countResult[0]?.count ?? 0);

    const userList = await withDbRetry(() =>
      db
        .select({
          ...getTableColumns(user),
        })
        .from(user)
        .where(whereClause)
        .orderBy(desc(user.createdAt))
        .limit(limitPerPage)
        .offset(offset)
    );

    res.status(200).json({
      data: userList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });

  } catch (e) {
    console.error("GET /users error:", e);

    const cause = e instanceof Error ? (e as Error & { cause?: unknown }).cause : undefined;
    if (cause) {
      console.error("GET /users error cause:", cause);
    }

    res.status(500).json({ error: "Failed to get users" });
  }
});

export default router;
