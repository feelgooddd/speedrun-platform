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
  deleteLevel,
  deleteLevelCategory,
  deleteSubcategory,
  getPlatformSystems,
  getAllSystems,
  addSystemToPlatform,
  createVariable,
  createLevelCategoryVariable,
  getILLeaderboard,
  createLevel,
  createLevelCategory,
  getPlatformLevels,
  setHiddenVariables,
} from "../controllers/games";
import { getPlatformRuns, getCategoryRuns } from "../controllers/runs";
import { requireAuth } from "../middleware/auth";
import { isAdmin } from "../middleware/checkRole";

export const gamesRouter = Router();

// ----------------------------------------------------------------
// Games
// ----------------------------------------------------------------
gamesRouter.get("/", getAllGames);
gamesRouter.get("/stats", getStats);
gamesRouter.get("/systems", getAllSystems);
gamesRouter.get("/:slug", getGameBySlug);
gamesRouter.post("/", requireAuth, isAdmin, createGame);
gamesRouter.delete("/:slug", requireAuth, isAdmin, deleteGame);



// ----------------------------------------------------------------
// Platforms
// ----------------------------------------------------------------
gamesRouter.post("/:slug/platforms", requireAuth, isAdmin, createPlatform);
gamesRouter.delete("/:slug/:platform", requireAuth, isAdmin, deletePlatform);

// ----------------------------------------------------------------
// Systems
// ----------------------------------------------------------------

gamesRouter.get("/:slug/:platform/systems", getPlatformSystems);
gamesRouter.post("/:slug/:platform/systems", requireAuth, isAdmin, addSystemToPlatform);


// ----------------------------------------------------------------
// Levels
// ----------------------------------------------------------------
gamesRouter.get("/:slug/:platform/levels", getPlatformLevels);

gamesRouter.post("/:slug/:platform/levels", requireAuth, isAdmin, createLevel);
gamesRouter.post("/:slug/:platform/levels/:level/categories", requireAuth, isAdmin, createLevelCategory);
gamesRouter.delete("/:slug/:platform/levels/:level", requireAuth, isAdmin, deleteLevel);
gamesRouter.delete("/:slug/:platform/levels/:level/categories/:category", requireAuth, isAdmin, deleteLevelCategory);


// ----------------------------------------------------------------
// Categories
// ----------------------------------------------------------------
gamesRouter.get("/:slug/:platform/categories", getPlatformCategories);
gamesRouter.post("/:slug/:platform/categories", requireAuth, isAdmin, createCategory);
gamesRouter.delete("/:slug/:platform/:category", requireAuth, isAdmin, deleteCategory);

// ----------------------------------------------------------------
// Subcategories (legacy — supports HP1-3)
// ----------------------------------------------------------------
gamesRouter.post("/:slug/:platform/:category/subcategories", requireAuth, isAdmin, createSubcategory);
gamesRouter.delete("/:slug/:platform/:category/:subcategory", requireAuth, isAdmin, deleteSubcategory);

// ----------------------------------------------------------------
// Variables
// ----------------------------------------------------------------
gamesRouter.post("/:slug/:platform/:category/variables", requireAuth, isAdmin, createVariable);
gamesRouter.post("/variable-values/:valueId/hidden-variables", requireAuth, isAdmin, setHiddenVariables);
gamesRouter.post("/:slug/:platform/:level/:category/level-category-variables", requireAuth, isAdmin, createLevelCategoryVariable);

// ----------------------------------------------------------------
// Runs
// ----------------------------------------------------------------
gamesRouter.get("/:slug/:platform/runs", getPlatformRuns);
gamesRouter.get("/:slug/:platform/:category/runs", getCategoryRuns);

// ----------------------------------------------------------------
// Leaderboards
// ----------------------------------------------------------------
gamesRouter.get("/:slug/:platform/levels/:category", getILLeaderboard);
gamesRouter.get("/:slug/:platform/:category/:subcategory", getLeaderboard);
gamesRouter.get("/:slug/:platform/:category", getLeaderboard);
