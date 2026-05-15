import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { departments, subjects } from "../db/schema";
import { db } from "../db";

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

// Get all subjects with optional search, filtering and pagination
router.get("/", async (req, res) => {
  try {
    const { search, department, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);

    const offset = (currentPage - 1) * limitPerPage;
    const filterConditions = [];

    // If search query exists, filter by subject name or subject code
    if (search) {
      filterConditions.push(
        or(
          ilike(subjects.name, `%${search}%`),
          ilike(subjects.code, `%${search}%`),
        )
      );
    }

    // If department filter exists, match department name
    if (department) {
      filterConditions.push(ilike(departments.name, `%${department}%`));
    }

    // Combine all filters using AND if any exist
    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await withDbRetry(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(subjects)
        .leftJoin(departments, eq(subjects.departmentId, departments.id))
        .where(whereClause)
    );

    const totalCount = Number(countResult[0]?.count ?? 0);

    const subjectList = await withDbRetry(() =>
      db
        .select({
          ...getTableColumns(subjects),
          department: { ...getTableColumns(departments) }
        })
        .from(subjects)
        .leftJoin(departments, eq(subjects.departmentId, departments.id))
        .where(whereClause)
        .orderBy(desc(subjects.createdAt))
        .limit(limitPerPage)
        .offset(offset)
    );

    res.status(200).json({
      data: subjectList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });

  } catch (e) {
    console.error("GET /subjects error:", e);

    const cause = e instanceof Error ? (e as Error & { cause?: unknown }).cause : undefined;
    if (cause) {
      console.error("GET /subjects error cause:", cause);
    }

    res.status(500).json({ error: "Failed to get subjects" });
  }
});

export default router;
