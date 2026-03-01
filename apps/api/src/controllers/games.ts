import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { formatTime } from "../lib/utils";
import { AuthRequest } from "../middleware/auth";
export const getAllGames = async (req: Request, res: Response) => {
  try {
    const games = await prisma.game.findMany({
      include: {
        platforms: true,
      },
    });
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch games" });
  }
};

export const getGameBySlug = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const game = await prisma.game.findUnique({
      where: { slug },
      include: {
        platforms: true,
      },
    });

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    res.json(game);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch game" });
  }
};

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const categorySlug = req.params.category as string;
    const subcategorySlug = req.params.subcategory as string | undefined;
    const { page = "1", limit = "25" } = req.query;

    const game = await prisma.game.findUnique({
      where: { slug },
      include: { platforms: true },
    });

    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });

    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const category = await prisma.category.findFirst({
      where: { slug: categorySlug, platform_id: platform.id },
    });

    if (!category) return res.status(404).json({ error: "Category not found" });

    let subcategory = null;
    if (subcategorySlug) {
      subcategory = await prisma.subcategory.findFirst({
        where: { slug: subcategorySlug, category_id: category.id },
      });

      if (!subcategory)
        return res.status(404).json({ error: "Subcategory not found" });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

const where = {
  category_id: category.id,
  platform_id: platform.id,
  ...(subcategory ? { subcategory_id: subcategory.id } : {}),
  verified: true,
};

    // Use platform.timing_method
    const timingField =
      platform.timing_method === "gametime" ? "gametime_ms" : "realtime_ms";

    const allRuns = await prisma.run.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            country: true,
            display_name: true,
          },
        },
        platform: true,
      },
      orderBy: { [timingField]: "asc" as const },
    });

const seen = new Set<string>();
const dedupedRuns = allRuns.filter((run) => {
  const key = `${run.user.id}-${run.subcategory_id ?? 'none'}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

    const total = dedupedRuns.length;
    const paginatedRuns = dedupedRuns.slice(skip, skip + limitNum);

    const rankedRuns = paginatedRuns.map((run, index) => ({
      rank: skip + index + 1,
      user: run.user,
      id: run.id,
      ubcategory_id: run.subcategory_id,
      comment: run.comment,
      realtime_ms: run.realtime_ms,
      gametime_ms: run.gametime_ms,
      realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
      gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
      platform: run.platform.name,
      timing_method: platform.timing_method,
      video_url: run.video_url,
      submitted_at: run.submitted_at,
    }));

    res.json({
      game: game.name,
      category: category.name,
      subcategory: subcategory?.name || null,
      platform: platform.name,
      timing_method: platform.timing_method,
      total,
      page: pageNum,
      limit: limitNum,
      runs: rankedRuns,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
};

export const getPlatformCategories = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;

    const game = await prisma.game.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        platforms: true,
      },
    });

    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
      include: {
        categories: {
          include: {
            subcategories: true,
          },
        },
      },
    });

    if (!platform) return res.status(404).json({ error: "Platform not found" });

    res.json({ categories: platform.categories });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

export const createGame = async (req: AuthRequest, res: Response) => {
  try {
    const { slug, name } = req.body;

    if (!slug || !name) {
      return res.status(400).json({ error: "Slug and name are required" });
    }

    // Check if game already exists
    const existing = await prisma.game.findUnique({ where: { slug } });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Game with this slug already exists" });
    }

    const game = await prisma.game.create({
      data: {
        slug,
        name,
      },
    });

    res.status(201).json({ game });
  } catch (error) {
    console.error("Error creating game:", error);
    res.status(500).json({ error: "Failed to create game" });
  }
};

export const deleteGame = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    // Delete all related data (cascading delete)
    // Runs -> Categories -> Platforms -> Game
    await prisma.run.deleteMany({
      where: { platform: { game_id: game.id } },
    });

    await prisma.subcategory.deleteMany({
      where: { category: { platform: { game_id: game.id } } },
    });

    await prisma.category.deleteMany({
      where: { platform: { game_id: game.id } },
    });

    await prisma.platform.deleteMany({
      where: { game_id: game.id },
    });

    await prisma.gameModerator.deleteMany({
      where: { game_id: game.id },
    });

    await prisma.game.delete({
      where: { id: game.id },
    });

    res.json({ message: "Game deleted successfully" });
  } catch (error) {
    console.error("Error deleting game:", error);
    res.status(500).json({ error: "Failed to delete game" });
  }
};

export const getStats = async (req: Request, res: Response) => {
  try {
    const [totalRuns, runners, categories, pbs] = await Promise.all([
      prisma.run.count(),
      prisma.run.groupBy({
        by: ["user_id"],
        where: { verified: true },
      }),
      prisma.category.count(),
      prisma.run.groupBy({
        by: ["user_id", "category_id", "platform_id"],
        where: { verified: true },
      }),
    ]);

    res.json({
      total_runs: totalRuns,
      total_pbs: pbs.length,
      runners: runners.length,
      world_records: categories,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

export const createPlatform = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const { name, platform_slug, timing_method = "realtime" } = req.body;

    if (!name || !platform_slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.create({
      data: {
        name,
        slug: platform_slug,
        timing_method,
        game_id: game.id,
      },
    });

    res.status(201).json({ platform });
  } catch (error) {
    res.status(500).json({ error: "Failed to create platform" });
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platform = req.params.platform as string;
    const { name, category_slug } = req.body;

    if (!name || !category_slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platformRecord = await prisma.platform.findFirst({
      where: { slug: platform, game_id: game.id },
    });
    if (!platformRecord)
      return res.status(404).json({ error: "Platform not found" });

    const category = await prisma.category.create({
      data: {
        name,
        slug: category_slug,
        platform_id: platformRecord.id,
      },
    });

    res.status(201).json({ category });
  } catch (error) {
    res.status(500).json({ error: "Failed to create category" });
  }
};
