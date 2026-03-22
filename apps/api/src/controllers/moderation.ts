import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { formatTime } from "../lib/utils";
import { AuthRequest } from "../middleware/auth";

export const getModQueue = async (req: Request, res: Response) => {
  try {
    const gameSlug = req.params.gameSlug as string;

    const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platforms = await prisma.platform.findMany({
      where: { game_id: game.id },
      select: { id: true },
    });

    const platformIds = platforms.map((p) => p.id);

    const runs = await prisma.run.findMany({
      where: {
        verified: false,
        platform_id: { in: platformIds },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            country: true,
            display_name: true,
          },
        },
        runners: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                country: true,
                display_name: true,
              },
            },
          },
        },
        category: true,
        level_category: { include: { level: true } },
        platform: true,
        subcategory: true,
        system: true,
        variable_values: {
          include: { variable_value: { include: { variable: true } } },
        },
      },
      orderBy: { submitted_at: "asc" },
    });

    const items = runs.map((run) => ({
      id: run.id,
      is_coop: run.is_coop,
      is_il: run.level_category_id !== null,
      user: run.is_coop ? null : run.user,
      runners: run.is_coop ? run.runners.map((r) => r.user) : null,
      system: run.system?.name ?? null,
      category: run.category?.name ?? run.level_category?.name ?? null,
      level: run.level_category?.level?.name ?? null,
      subcategory: run.subcategory?.name ?? null,
      variable_values: run.variable_values.map((rv) => ({
        variable: rv.variable_value.variable.name,
        variable_slug: rv.variable_value.variable.slug,
        value: rv.variable_value.name,
        value_slug: rv.variable_value.slug,
      })),
      platform: run.platform.name,
      realtime_ms: run.realtime_ms,
      realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
      gametime_ms: run.gametime_ms,
      gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
      score_value: run.score_value ?? null,
scoring_type: run.category?.scoring_type ?? run.level_category?.scoring_type ?? null,      video_url: run.video_url,
      submitted_at: run.submitted_at,
      rejected: run.rejected,
      reject_reason: run.reject_reason,
      comment: run.comment,
    }));

    res.json({ game: game.name, pending: items.length, runs: items });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch mod queue" });
  }
};

export const getGlobalModQueue = async (req: Request, res: Response) => {
  try {
    const runs = await prisma.run.findMany({
      where: { verified: false },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            country: true,
            display_name: true,
          },
        },
        runners: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                country: true,
                display_name: true,
              },
            },
          },
        },
        category: { include: { platform: { include: { game: true } } } },
        level_category: {
          include: {
            level: { include: { platform: { include: { game: true } } } },
          },
        },
        platform: true,
        subcategory: true,
        variable_values: {
          include: { variable_value: { include: { variable: true } } },
        },
      },
      orderBy: { submitted_at: "asc" },
    });

    res.json({
      pending: runs.length,
      runs: runs.map((run) => {
        const isIL = run.level_category_id !== null;
        const game = isIL
          ? run.level_category?.level?.platform?.game
          : run.category?.platform?.game;

        return {
          id: run.id,
          is_coop: run.is_coop,
          is_il: isIL,
          user: run.is_coop ? null : run.user,
          runners: run.is_coop ? run.runners.map((r) => r.user) : null,
          game: game?.name ?? null,
          game_slug: game?.slug ?? null,
          category: run.category?.name ?? run.level_category?.name ?? null,
          level: run.level_category?.level?.name ?? null,
          subcategory: run.subcategory?.name ?? null,
          variable_values: run.variable_values.map((rv) => ({
            variable: rv.variable_value.variable.name,
            variable_slug: rv.variable_value.variable.slug,
            value: rv.variable_value.name,
            value_slug: rv.variable_value.slug,
          })),
          platform: run.platform.name,
          timing_method: run.platform.timing_method,
          realtime_ms: run.realtime_ms,
          realtime_display: run.realtime_ms
            ? formatTime(run.realtime_ms)
            : null,
          gametime_ms: run.gametime_ms,
          gametime_display: run.gametime_ms
            ? formatTime(run.gametime_ms)
            : null,
          score_value: run.score_value ?? null,
scoring_type: run.category?.scoring_type ?? run.level_category?.scoring_type ?? null,
          video_url: run.video_url,
          submitted_at: run.submitted_at,
          comment: run.comment,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch global mod queue" });
  }
};

export const verifyRun = async (req: AuthRequest, res: Response) => {
  try {
    const runId = req.params.id as string;
    const { verified, reject_reason } = req.body;

    if (typeof verified !== "boolean") {
      return res
        .status(400)
        .json({ error: "verified field is required (true/false)" });
    }

    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        category: {
          include: {
            platform: {
              include: {
                game: true,
              },
            },
          },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }

    // Update run verification/rejection status
    const updatedRun = await prisma.run.update({
      where: { id: runId },
      data: {
        verified: verified,
        rejected: !verified,
        reject_reason: !verified ? reject_reason : null,
        comment: run.comment,
        verified_at: verified ? new Date() : null,
      },
    });

    res.json({
      run: updatedRun,
      message: verified ? "Run verified successfully" : "Run rejected",
    });
  } catch (error) {
    console.error("Error verifying run:", error);
    res.status(500).json({ error: "Failed to verify run" });
  }
};
export const updatePlatformRules = async (req: Request, res: Response) => {
  try {
const { slug, platform: platformSlug } = req.params as Record<string, string>;
    const { rules } = req.body;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const updated = await prisma.platform.update({
      where: { id: platform.id },
      data: { rules: rules ?? null },
    });

    res.json({ platform: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to update platform rules" });
  }
};

export const updateCategoryRules = async (req: Request, res: Response) => {
  try {
const { slug, platform: platformSlug, category: categorySlug } = req.params as Record<string, string>;
    const { rules } = req.body;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const category = await prisma.category.findFirst({
      where: { slug: categorySlug, platform_id: platform.id },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });

    const updated = await prisma.category.update({
      where: { id: category.id },
      data: { rules: rules ?? null },
    });

    res.json({ category: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to update category rules" });
  }
};

export const updateLevelRules = async (req: Request, res: Response) => {
  try {
const { slug, platform: platformSlug, level: levelSlug } = req.params as Record<string, string>;
    const { rules } = req.body;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const level = await prisma.level.findFirst({
      where: { slug: levelSlug, platform_id: platform.id },
    });
    if (!level) return res.status(404).json({ error: "Level not found" });

    const updated = await prisma.level.update({
      where: { id: level.id },
      data: { rules: rules ?? null },
    });

    res.json({ level: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to update level rules" });
  }
};

export const updateLevelCategoryRules = async (req: Request, res: Response) => {
  try {
    const { slug, platform: platformSlug, levelCategory: levelCategorySlug } = req.params as Record<string, string>;
    const { rules } = req.body;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const updated = await prisma.levelCategory.updateMany({
      where: {
        slug: levelCategorySlug,
        level: { platform_id: platform.id },
      },
      data: { rules: rules ?? null },
    });

    res.json({ updated: updated.count });
  } catch (error) {
    res.status(500).json({ error: "Failed to update level category rules" });
  }
};

export const getPlatformRules = async (req: Request, res: Response) => {
  try {
    const { slug, platform: platformSlug } = req.params as Record<string, string>;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const categories = await prisma.category.findMany({
      where: { platform_id: platform.id, deleted_at: null },
      select: { id: true, name: true, slug: true, rules: true, category_type: true },
      orderBy: { order: "asc" },
    });

    const levels = await prisma.level.findMany({
      where: { platform_id: platform.id, deleted_at: null },
      select: { id: true, name: true, slug: true, rules: true },
      orderBy: { order: "asc" },
    });

    // Unique level categories
    const allLevelCategories = await prisma.levelCategory.findMany({
      where: {
        level: { platform_id: platform.id },
        deleted_at: null,
      },
      select: { id: true, name: true, slug: true, rules: true },
    });

    const seen = new Set<string>();
    const levelCategories = allLevelCategories.filter((lc) => {
      if (seen.has(lc.slug)) return false;
      seen.add(lc.slug);
      return true;
    });

    res.json({
      platform_rules: platform.rules ?? null,
      categories,
      levels,
      level_categories: levelCategories,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch platform rules" });
  }
};