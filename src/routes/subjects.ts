import express from "express";

const router = express.Router();

// Get all subjects with optional search, filtering nd pagination
router.get("/", async (req, res) => {
  try {
    const { search, department, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);

    const offset = (currentPage - 1) * limitPerPage;
    const filterConditions = [];

    if (search) {
      filterConditions.push(
      );
    };

  } catch (e) {
    console.error(`GET /subjects error: ${e}`);
    res.status(500).json({ error: "Failed to get subjects" });
  }
});
