import { Router } from "express";
import {
  getModQueue,
  verifyRun,
  getGlobalModQueue,
  updateCategoryRules,
  updateLevelCategoryRules,
  updateLevelRules,
  updatePlatformRules,
  getPlatformRules
} from "../controllers/moderation";
import { requireAuth } from "../middleware/auth";
import { isGameModerator } from "../middleware/checkRole";
import { isAdmin } from "../middleware/checkRole";

export const moderationRouter = Router();

moderationRouter.get("/queue", requireAuth, isAdmin, getGlobalModQueue);

moderationRouter.get(
  "/:gameSlug/mod-queue",
  requireAuth,
  isGameModerator,
  getModQueue,
);
moderationRouter.patch(
  "/runs/:id/verify",
  requireAuth,
  isGameModerator,
  verifyRun,
);

// Rules
moderationRouter.patch(
  "/games/:slug/:platform/rules",
  requireAuth,
  isAdmin,
  updatePlatformRules,
);
moderationRouter.patch(
  "/games/:slug/:platform/:category/rules",
  requireAuth,
  isAdmin,
  updateCategoryRules,
);
moderationRouter.patch(
  "/games/:slug/:platform/levels/categories/:levelCategory/rules",
  requireAuth,
  isAdmin,
  updateLevelCategoryRules,
);

moderationRouter.patch(
  "/games/:slug/:platform/levels/:level/rules",
  requireAuth,
  isAdmin,
  updateLevelRules,
);
moderationRouter.get('/games/:slug/:platform/rules', requireAuth, isAdmin, getPlatformRules);