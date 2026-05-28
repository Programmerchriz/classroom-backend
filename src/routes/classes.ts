import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { db } from "../db/index.js";
import { classes, subjects, user as teacher } from "../db/schema/index.js";

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

// Get all classes with optional search, filtering and pagination
router.get("/", async (req, res) => {
  try {
    const { search, subject, teacher: teacherName, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);

    const offset = (currentPage - 1) * limitPerPage;
    const filterConditions = [];

    // If search query exists, filter by class name or invite code
    if (search) {
      filterConditions.push(
        or(
          ilike(classes.name, `%${search}%`),
          ilike(classes.inviteCode, `%${search}%`),
        )
      );
    }

    // If subject filter exists, match subject name
    if (subject) {
      filterConditions.push(ilike(subjects.name, `%${subject}%`));
    }

    // If teacher filter exists, match teacher name
    if (teacherName) {
      filterConditions.push(ilike(teacher.name, `%${teacherName}%`));
    }

    // Combine all filters using AND if any exist
    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await withDbRetry(() =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(teacher, eq(classes.teacherId, teacher.id))
        .where(whereClause)
    );

    const totalCount = Number(countResult[0]?.count ?? 0);

    const classList = await withDbRetry(() =>
      db
        .select({
          ...getTableColumns(classes),
          subject: { ...getTableColumns(subjects) },
          teacher: { ...getTableColumns(teacher) }
        })
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(teacher, eq(classes.teacherId, teacher.id))
        .where(whereClause)
        .orderBy(desc(classes.createdAt))
        .limit(limitPerPage)
        .offset(offset)
    );

    res.status(200).json({
      data: classList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });

  } catch (e) {
    console.error("GET /classes error:", e);

    const cause = e instanceof Error ? (e as Error & { cause?: unknown }).cause : undefined;
    if (cause) {
      console.error("GET /classes error cause:", cause);
    }

    res.status(500).json({ error: "Failed to get classes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const [createdClass] = await db
      .insert(classes)
      .values({...req.body, inviteCode: Math.random().toString(36).substring(2, 9), schedules: []})
      .returning({ id: classes.id });

    if (!createdClass) throw Error;

    res.status(201).json({ data: createdClass });

  } catch (e) {
    console.error(`POST /classes error ${e}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
