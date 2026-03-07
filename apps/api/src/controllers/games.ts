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

    // Variable filters: e.g. ?players=1p&cut=standard
    const variableFilters: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (key === "page" || key === "limit") continue;
      if (typeof value === "string") variableFilters[key] = value;
    }

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

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const timingField =
      platform.timing_method === "gametime" ? "gametime_ms" : "realtime_ms";

    // ----------------------------------------------------------------
    // Resolve subcategory (HP1-3)
    // ----------------------------------------------------------------
    let subcategory = null;
    if (subcategorySlug) {
      subcategory = await prisma.subcategory.findFirst({
        where: { slug: subcategorySlug, category_id: category.id },
      });
      if (!subcategory)
        return res.status(404).json({ error: "Subcategory not found" });
    }

    // ----------------------------------------------------------------
    // Resolve variable value IDs from query params (HP4+)
    // ----------------------------------------------------------------
    const resolvedVariableValueIds: string[] = [];
    let isCoop = false;

    if (Object.keys(variableFilters).length > 0) {
      const variables = await prisma.variable.findMany({
        where: { category_id: category.id },
        include: { values: true },
      });

      for (const [varSlug, valSlug] of Object.entries(variableFilters)) {
        const variable = variables.find((v) => v.slug === varSlug);
        if (!variable)
          return res
            .status(404)
            .json({ error: `Variable '${varSlug}' not found` });

        const value = variable.values.find((v) => v.slug === valSlug);
        if (!value)
          return res
            .status(404)
            .json({
              error: `Value '${valSlug}' not found for variable '${varSlug}'`,
            });

        resolvedVariableValueIds.push(value.id);
        if (value.is_coop) isCoop = true;
      }
    }

    const hasVariableFilter = resolvedVariableValueIds.length > 0;

    // ----------------------------------------------------------------
    // Build run query
    // ----------------------------------------------------------------
    const baseWhere = {
      category_id: category.id,
      platform_id: platform.id,
      verified: true,
      ...(subcategory ? { subcategory_id: subcategory.id } : {}),
      ...(hasVariableFilter ? { is_coop: isCoop } : {}),
      ...(hasVariableFilter
        ? {
            variable_values: {
              some: {
                variable_value_id: { in: resolvedVariableValueIds },
              },
            },
          }
        : {}),
    };

    const allRuns = await prisma.run.findMany({
      where: baseWhere,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            display_name: true,
            country: true,
          },
        },
        runners: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                display_name: true,
                country: true,
              },
            },
          },
        },
        system: true,
        variable_values: {
          include: {
            variable_value: {
              include: { variable: true },
            },
          },
        },
      },
      orderBy: { [timingField]: "asc" as const },
    });

    // ----------------------------------------------------------------
    // Ensure run has ALL requested variable values (Prisma `some` is OR)
    // ----------------------------------------------------------------
    const filteredRuns = hasVariableFilter
      ? allRuns.filter((run) => {
          const runValueIds = run.variable_values.map(
            (rv) => rv.variable_value_id,
          );
          return resolvedVariableValueIds.every((id) =>
            runValueIds.includes(id),
          );
        })
      : allRuns;

    // ----------------------------------------------------------------
    // PB dedup
    // ----------------------------------------------------------------
    let dedupedRuns: typeof filteredRuns;

    if (isCoop) {
      const bestTimePerUser = new Map<string, number>();
      for (const run of filteredRuns) {
        const time = (run as any)[timingField] ?? Infinity;
        for (const runner of run.runners) {
          const existing = bestTimePerUser.get(runner.user_id);
          if (existing === undefined || time < existing) {
            bestTimePerUser.set(runner.user_id, time);
          }
        }
      }
      dedupedRuns = filteredRuns.filter((run) => {
        const time = (run as any)[timingField] ?? Infinity;
        return run.runners.some(
          (runner) => bestTimePerUser.get(runner.user_id) === time,
        );
      });
    } else {
      const seen = new Set<string>();
      dedupedRuns =
        subcategory || hasVariableFilter
          ? filteredRuns.filter((run) => {
              if (seen.has(run.user_id)) return false;
              seen.add(run.user_id);
              return true;
            })
          : filteredRuns;
    }

    // ----------------------------------------------------------------
    // Assign tie-aware ranks across full deduped list
    // ----------------------------------------------------------------
    const rankedWithTies: ((typeof dedupedRuns)[number] & { _rank: number })[] =
      [];
    for (let i = 0; i < dedupedRuns.length; i++) {
      const run = dedupedRuns[i];
      let rank: number;
      if (i === 0) {
        rank = 1;
      } else {
        const prevTime = (dedupedRuns[i - 1] as any)[timingField];
        const currTime = (run as any)[timingField];
        rank = currTime === prevTime ? rankedWithTies[i - 1]._rank : i + 1;
      }
      rankedWithTies.push({ ...run, _rank: rank });
    }

    // ----------------------------------------------------------------
    // Paginate + build response
    // ----------------------------------------------------------------
    const total = rankedWithTies.length;
    const paginatedRuns = rankedWithTies.slice(skip, skip + limitNum);

    const rankedRuns = paginatedRuns.map((run) => ({
      rank: run._rank,
      id: run.id,
      is_coop: run.is_coop,
      ...(run.is_coop
        ? { runners: run.runners.map((r) => r.user) }
        : { user: run.user }),
      system: run.system?.name ?? null,
      system_id: run.system_id,
      comment: run.comment,
      realtime_ms: run.realtime_ms,
      gametime_ms: run.gametime_ms,
      realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
      gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
      platform: platform.name,
      timing_method: platform.timing_method,
      video_url: run.video_url,
      submitted_at: run.submitted_at,
      variable_values: run.variable_values.map((rv) => ({
        variable: rv.variable_value.variable.name,
        variable_slug: rv.variable_value.variable.slug,
        value: rv.variable_value.name,
        value_slug: rv.variable_value.slug,
      })),
    }));

    // ----------------------------------------------------------------
    // Response metadata
    // ----------------------------------------------------------------
    const subcategoryName = subcategory?.name ?? null;
    const variableContext = hasVariableFilter
      ? Object.entries(variableFilters).map(([varSlug, valSlug]) => ({
          variable: varSlug,
          value: valSlug,
        }))
      : [];

    return res.json({
      game: game.name,
      platform: platform.name,
      timing_method: platform.timing_method,
      category: category.name,
      subcategory: subcategoryName,
      variable_filters: variableContext,
      is_coop: isCoop,
      total,
      page: pageNum,
      limit: limitNum,
      runs: rankedRuns,
    });
  } catch (error) {
    console.error(error);
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
      where: {
        slug: platformSlug,
        game_id: game.id,
        deleted_at: null,
      },
      include: {
        categories: {
          where: { deleted_at: null },
          orderBy: { order: "asc" },

          include: {
            subcategories: {
              where: { deleted_at: null },
              orderBy: { order: "asc" }, // ← add this
            },
            variables: {
              include: {
                values: true,
              },
            },
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
    if (!game) return res.status(404).json({ error: "Game not found" });

    await prisma.game.update({
      where: { id: game.id },
      data: { deleted_at: new Date() },
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
      // All verified runs (solo + coop unified)
      prisma.run.count({ where: { verified: true } }),

      // Unique runners: solo runs + coop run runners
      prisma.run.groupBy({
        by: ["user_id"],
        where: { verified: true, is_coop: false },
      }),

      prisma.category.count(),

      // PBs: unique user+category+platform combos for solo runs
      prisma.run.groupBy({
        by: ["user_id", "category_id", "platform_id"],
        where: { verified: true, is_coop: false },
      }),
    ]);

    // Unique runners from coop runs via RunRunner join table
    const coopRunners = await prisma.runRunner.groupBy({
      by: ["user_id"],
    });

    // Unique coop PBs: unique category+platform combos across coop runs
    const coopPbs = await prisma.run.groupBy({
      by: ["category_id", "platform_id"],
      where: { verified: true, is_coop: true },
    });

    const soloRunnerIds = new Set(runners.map((r) => r.user_id));
    const coopRunnerIds = new Set(coopRunners.map((r) => r.user_id));
    const allRunnerIds = new Set([...soloRunnerIds, ...coopRunnerIds]);

    res.json({
      total_runs: totalRuns,
      total_pbs: pbs.length + coopPbs.length,
      runners: allRunnerIds.size,
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

export const createSubcategory = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const categorySlug = req.params.category as string;
    const { name, subcategory_slug } = req.body;

    if (!name || !subcategory_slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const category = await prisma.category.findFirst({
      where: { slug: categorySlug, platform_id: platform.id },
      include: { subcategories: true },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });

    const hadNoSubcategories = category.subcategories.length === 0;

    const subcategory = await prisma.subcategory.create({
      data: {
        name,
        slug: subcategory_slug,
        category_id: category.id,
      },
    });

    // If this is the first subcategory, migrate all existing runs to it
    if (hadNoSubcategories) {
      const migrated = await prisma.run.updateMany({
        where: {
          category_id: category.id,
          subcategory_id: null,
        },
        data: {
          subcategory_id: subcategory.id,
        },
      });
      return res.status(201).json({
        subcategory,
        migrated_runs: migrated.count,
      });
    }

    res.status(201).json({ subcategory });
  } catch (error) {
    res.status(500).json({ error: "Failed to create subcategory" });
  }
};
export const deletePlatform = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    await prisma.platform.update({
      where: { id: platform.id },
      data: { deleted_at: new Date() },
    });

    res.json({ message: "Platform deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete platform" });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const categorySlug = req.params.category as string;

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

    await prisma.category.update({
      where: { id: category.id },
      data: { deleted_at: new Date() },
    });

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete category" });
  }
};

export const deleteSubcategory = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const categorySlug = req.params.category as string;
    const subcategorySlug = req.params.subcategory as string;

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

    const subcategory = await prisma.subcategory.findFirst({
      where: { slug: subcategorySlug, category_id: category.id },
    });
    if (!subcategory)
      return res.status(404).json({ error: "Subcategory not found" });

    await prisma.subcategory.update({
      where: { id: subcategory.id },
      data: { deleted_at: new Date() },
    });

    res.json({ message: "Subcategory deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete subcategory" });
  }
};

export const getPlatformSystems = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const platformSystems = await prisma.platformSystem.findMany({
      where: { platform_id: platform.id },
      include: { system: true },
    });

    res.json({ systems: platformSystems.map((ps) => ps.system) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch systems" });
  }
};
