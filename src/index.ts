import AgentAPI from "apminsight";
AgentAPI.config();

import express from "express";
import cors from "cors";

import subjectsRouter from "./routes/subjects.js";
import usersRouter from "./routes/users.js";
import classesRouter from "./routes/classes.js";
import securityMiddleware from "./middleware/security.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";

const app = express();
const PORT = 8000;
const FRONTEND_URL = process.env.FRONTEND_URL;

if (!FRONTEND_URL) {
  throw new Error("FRONTEND_URL is required");
}

const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, "");
const allowedOrigins = FRONTEND_URL
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    const isAllowed = allowedOrigins.includes(normalizedOrigin);

    return callback(null, isAllowed ? origin : false);
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use(securityMiddleware);

app.use("/api/subjects", subjectsRouter);
app.use("/api/users", usersRouter);
app.use("/api/classes", classesRouter)

app.get("/", (req, res) => {
  res.send("Hello, welcome to the Classroom API");
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
