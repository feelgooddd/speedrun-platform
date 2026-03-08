import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { formatTime } from "../lib/utils";

export const submitRun = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const {
      game_slug,
      platform_slug,
      category_slug,
      subcategory_slug, // for simple single-dimension games (HP1-3)
      variable_values, // for multi-dimensional games (HP4+): [{ variable_slug, value_slug }]
      runner_ids, // for coop runs: array of user IDs including submitter
      realtime_ms,
      gametime_ms,
      video_url,
      comment,
      system_id,
    } = req.body;

    if (!game_slug || !platform_slug || !category_slug) {
      return res.status(400).json({
        error: "game_slug, platform_slug, and category_slug are required",
      });
    }

    // ----------------------------------------------------------------
    // Resolve game / platform / category
    // ----------------------------------------------------------------
    const game = await prisma.game.findUnique({ where: { slug: game_slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platform_slug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const category = await prisma.category.findFirst({
      where: { slug: category_slug, platform_id: platform.id },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });

    // ----------------------------------------------------------------
    // Resolve subcategory (simple games)
    // ----------------------------------------------------------------
    let subcategory_id: string | null = null;
    if (subcategory_slug) {
      const subcategory = await prisma.subcategory.findFirst({
        where: { slug: subcategory_slug, category_id: category.id },
      });
      if (!subcategory)
        return res.status(404).json({ error: "Subcategory not found" });
      subcategory_id = subcategory.id;
    }

    // ----------------------------------------------------------------
    // Resolve variable values (multi-dimensional games)
    // ----------------------------------------------------------------
    let resolvedVariableValueIds: string[] = [];
    let isCoop = false;
    let requiredPlayers: number | null = null;

    if (
      variable_values &&
      Array.isArray(variable_values) &&
      variable_values.length > 0
    ) {
      const variables = await prisma.variable.findMany({
        where: { category_id: category.id },
        include: { values: true },
      });

      for (const { variable_slug, value_slug } of variable_values) {
        if (!variable_slug || !value_slug) {
          return res.status(400).json({
            error:
              "Each variable_value entry must have variable_slug and value_slug",
          });
        }

        const variable = variables.find((v) => v.slug === variable_slug);
        if (!variable)
          return res
            .status(404)
            .json({ error: `Variable '${variable_slug}' not found` });

        const value = variable.values.find((v) => v.slug === value_slug);
        if (!value)
          return res.status(404).json({
            error: `Value '${value_slug}' not found for variable '${variable_slug}'`,
          });

        resolvedVariableValueIds.push(value.id);

        if (value.is_coop) {
          isCoop = true;
          requiredPlayers = value.required_players ?? null;
        }
      }
    }

    // ----------------------------------------------------------------
    // Coop validation
    // ----------------------------------------------------------------
    if (isCoop) {
      if (!runner_ids || !Array.isArray(runner_ids) || runner_ids.length < 2) {
        return res
          .status(400)
          .json({ error: "Co-op runs require at least 2 runners" });
      }
      if (!runner_ids.includes(req.userId)) {
        return res
          .status(400)
          .json({ error: "Submitter must be one of the runners" });
      }
      if (requiredPlayers && runner_ids.length !== requiredPlayers) {
        return res.status(400).json({
          error: `This category requires exactly ${requiredPlayers} runners`,
        });
      }
      const users = await prisma.user.findMany({
        where: { id: { in: runner_ids } },
        select: { id: true },
      });
      if (users.length !== runner_ids.length) {
        return res.status(400).json({ error: "One or more runners not found" });
      }
    }

    // ----------------------------------------------------------------
    // Create run
    // ----------------------------------------------------------------
    const run = await prisma.run.create({
      data: {
        user_id: req.userId,
        category_id: category.id,
        platform_id: platform.id,
        subcategory_id,
        is_coop: isCoop,
        realtime_ms: realtime_ms ? parseInt(realtime_ms) : null,
        gametime_ms: gametime_ms ? parseInt(gametime_ms) : null,
        video_url: video_url ?? null,
        comment: comment ?? null,
        system_id: system_id ?? null,
        submitted_by_id: req.userId,
        verified: false,
        // Variable values
        ...(resolvedVariableValueIds.length > 0 && {
          variable_values: {
            create: resolvedVariableValueIds.map((id) => ({
              variable_value_id: id,
            })),
          },
        }),
        // Coop runners
        ...(isCoop && {
          runners: {
            create: (runner_ids as string[]).map((id) => ({ user_id: id })),
          },
        }),
      },
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
        category: true,
        platform: true,
        subcategory: true,
        system: true,
        variable_values: {
          include: {
            variable_value: {
              include: { variable: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      run: {
        ...run,
        user: isCoop ? null : run.user,
        runners: isCoop ? run.runners.map((r) => r.user) : null,
        variable_values: run.variable_values.map((rv) => ({
          variable: rv.variable_value.variable.name,
          variable_slug: rv.variable_value.variable.slug,
          value: rv.variable_value.name,
          value_slug: rv.variable_value.slug,
        })),
      },
      message: "Run submitted successfully. Awaiting verification.",
    });
  } catch (error) {
    console.error("Error submitting run:", error);
    res.status(500).json({ error: "Failed to submit run" });
  }
};

export const getRun = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const run = await prisma.run.findUnique({
      where: { id },
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
        category: {
          include: {
            platform: {
              include: { game: true },
            },
          },
        },
        platform: true,
        subcategory: true,
        system: true,
        variable_values: {
          include: {
            variable_value: {
              include: { variable: true },
            },
          },
        },
      },
    });

    if (!run) return res.status(404).json({ error: "Run not found" });

    res.json({
      id: run.id,
      is_coop: run.is_coop,
      user: run.is_coop ? null : run.user,
      runners: run.is_coop ? run.runners.map((r) => r.user) : null,
      game: run.category.platform!.game.name,
      game_slug: run.category.platform!.game.slug,
      category: run.category.name,
      subcategory: run.subcategory?.name ?? null,
      variable_values: run.variable_values.map((rv) => ({
        variable: rv.variable_value.variable.name,
        variable_slug: rv.variable_value.variable.slug,
        value: rv.variable_value.name,
        value_slug: rv.variable_value.slug,
      })),
      platform: run.platform.name,
      system: run.system?.name ?? null,
      timing_method: run.platform.timing_method,
      realtime_ms: run.realtime_ms,
      gametime_ms: run.gametime_ms,
      realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
      gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
      verified: run.verified,
      rejected: run.rejected,
      reject_reason: run.reject_reason,
      video_url: run.video_url,
      comment: run.comment,
      submitted_at: run.submitted_at,
      verified_at: run.verified_at,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch run" });
  }
};

export const updateRun = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { realtime_ms, gametime_ms, video_url, comment } = req.body;

    const run = await prisma.run.findUnique({ where: { id } });
    if (!run) return res.status(404).json({ error: "Run not found" });

    const updated = await prisma.run.update({
      where: { id },
      data: {
        ...(realtime_ms !== undefined && {
          realtime_ms: parseInt(realtime_ms),
        }),
        ...(gametime_ms !== undefined && {
          gametime_ms: gametime_ms ? parseInt(gametime_ms) : null,
        }),
        ...(video_url !== undefined && { video_url }),
        ...(comment !== undefined && { comment }),
      },
    });

    res.json({ run: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to update run" });
  }
};

export const deleteRun = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const run = await prisma.run.findUnique({ where: { id } });
    if (!run) return res.status(404).json({ error: "Run not found" });

    await prisma.run.delete({ where: { id } });

    res.json({ message: "Run deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete run" });
  }
};

// GET /api/games/:slug/:platform/runs
// All runs across all categories for a platform (no dedup)
export const getPlatformRuns = async (req: AuthRequest, res: Response) => {
  try {
    const {
      slug,
      platform: platformSlug,
      category: categorySlug,
    } = req.params as Record<string, string>;
    const { page = "1", limit = "50" } = req.query;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    const timingField =
      platform.timing_method === "gametime" ? "gametime_ms" : "realtime_ms";

    const [runs, total] = await Promise.all([
      prisma.run.findMany({
        where: { platform_id: platform.id, verified: true },
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
          category: true,
          system: true,
          variable_values: {
            include: { variable_value: { include: { variable: true } } },
          },
        },
        orderBy: { submitted_at: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.run.count({
        where: { platform_id: platform.id, verified: true },
      }),
    ]);

    return res.json({
      game: game.name,
      platform: platform.name,
      timing_method: platform.timing_method,
      total,
      page: pageNum,
      limit: limitNum,
      runs: runs.map((run) => ({
        id: run.id,
        is_coop: run.is_coop,
        ...(run.is_coop
          ? { runners: run.runners.map((r) => r.user) }
          : { user: run.user }),
        category: run.category.name,
        category_slug: run.category.slug,
        system: run.system?.name ?? null,
        comment: run.comment,
        realtime_ms: run.realtime_ms,
        gametime_ms: run.gametime_ms,
        realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
        gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
        video_url: run.video_url,
        submitted_at: run.submitted_at,
        variable_values: run.variable_values.map((rv) => ({
          variable: rv.variable_value.variable.name,
          variable_slug: rv.variable_value.variable.slug,
          value: rv.variable_value.name,
          value_slug: rv.variable_value.slug,
        })),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch platform runs" });
  }
};

// GET /api/games/:slug/:platform/:category/runs
// All runs for a specific category (no dedup, full history)
export const getCategoryRuns = async (req: AuthRequest, res: Response) => {
  try {
    const {
      slug,
      platform: platformSlug,
      category: categorySlug,
    } = req.params as Record<string, string>;
    const { page = "1", limit = "50" } = req.query;

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

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    const timingField =
      platform.timing_method === "gametime" ? "gametime_ms" : "realtime_ms";

    const [runs, total] = await Promise.all([
      prisma.run.findMany({
        where: {
          category_id: category.id,
          platform_id: platform.id,
          verified: true,
        },
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
            include: { variable_value: { include: { variable: true } } },
          },
        },
        orderBy: { [timingField]: "asc" as const },
        skip,
        take: limitNum,
      }),
      prisma.run.count({
        where: {
          category_id: category.id,
          platform_id: platform.id,
          verified: true,
        },
      }),
    ]);

    return res.json({
      game: game.name,
      platform: platform.name,
      timing_method: platform.timing_method,
      category: category.name,
      total,
      page: pageNum,
      limit: limitNum,
      runs: runs.map((run) => ({
        id: run.id,
        is_coop: run.is_coop,
        ...(run.is_coop
          ? { runners: run.runners.map((r) => r.user) }
          : { user: run.user }),
        system: run.system?.name ?? null,
        comment: run.comment,
        realtime_ms: run.realtime_ms,
        gametime_ms: run.gametime_ms,
        realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
        gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
        video_url: run.video_url,
        submitted_at: run.submitted_at,
        variable_values: run.variable_values.map((rv) => ({
          variable: rv.variable_value.variable.name,
          variable_slug: rv.variable_value.variable.slug,
          value: rv.variable_value.name,
          value_slug: rv.variable_value.slug,
        })),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch category runs" });
  }
};
