import { Router } from "express";
import {
  getAllGames,
  getGameBySlug,
  getLeaderboard,
  getPlatformCategories,
  createGame,
  deleteGame,
  getStats,
  createPlatform,
  createCategory,
} from "../controllers/games";
import { requireAuth } from "../middleware/auth";
import { isAdmin } from "../middleware/checkRole";

export const gamesRouter = Router();

gamesRouter.get("/", getAllGames);
gamesRouter.get("/stats", getStats);
gamesRouter.get("/:slug", getGameBySlug);
gamesRouter.get("/:slug/:platform/categories", getPlatformCategories);
gamesRouter.get("/:slug/:platform/:category/:subcategory", getLeaderboard);
gamesRouter.get("/:slug/:platform/:category", getLeaderboard);
gamesRouter.post("/", requireAuth, isAdmin, createGame);
gamesRouter.delete("/:slug", requireAuth, isAdmin, deleteGame);
gamesRouter.post("/:slug/platforms", requireAuth, isAdmin, createPlatform);
gamesRouter.post("/:slug/:platform/categories", requireAuth, isAdmin, createCategory);