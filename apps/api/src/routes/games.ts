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
  createSubcategory,
  deleteCategory,
  deletePlatform,
  deleteSubcategory,
  getPlatformSystems,
  getAllSystems,
  addSystemToPlatform,
  createVariable,
} from "../controllers/games";
import { getPlatformRuns, getCategoryRuns } from "../controllers/runs";
import { requireAuth } from "../middleware/auth";
import { isAdmin } from "../middleware/checkRole";

export const gamesRouter = Router();

gamesRouter.get("/", getAllGames);
gamesRouter.get("/stats", getStats);
gamesRouter.get("/systems", getAllSystems);

gamesRouter.get("/:slug", getGameBySlug);
gamesRouter.get("/:slug/:platform/systems", getPlatformSystems);
gamesRouter.post(
  "/:slug/:platform/systems",
  requireAuth,
  isAdmin,
  addSystemToPlatform,
);

gamesRouter.get("/:slug/:platform/categories", getPlatformCategories);
gamesRouter.get("/:slug/:platform/runs", getPlatformRuns);
gamesRouter.post("/:slug/:platform/:category/variables", requireAuth, isAdmin, createVariable);
gamesRouter.get("/:slug/:platform/:category/runs", getCategoryRuns);
gamesRouter.get("/:slug/:platform/:category/:subcategory", getLeaderboard);
gamesRouter.get("/:slug/:platform/:category", getLeaderboard);
gamesRouter.post("/", requireAuth, isAdmin, createGame);
gamesRouter.delete("/:slug", requireAuth, isAdmin, deleteGame);
gamesRouter.post("/:slug/platforms", requireAuth, isAdmin, createPlatform);
gamesRouter.post(
  "/:slug/:platform/categories",
  requireAuth,
  isAdmin,
  createCategory,
);
gamesRouter.post(
  "/:slug/:platform/:category/subcategories",
  requireAuth,
  isAdmin,
  createSubcategory,
);
gamesRouter.delete("/:slug/:platform", requireAuth, isAdmin, deletePlatform);
gamesRouter.delete(
  "/:slug/:platform/:category",
  requireAuth,
  isAdmin,
  deleteCategory,
);
gamesRouter.delete(
  "/:slug/:platform/:category/:subcategory",
  requireAuth,
  isAdmin,
  deleteSubcategory,
);
