import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { formatTime } from "../lib/utils";
import { AuthRequest } from "../middleware/auth";

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const identifier = req.params.id as string;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier.toLowerCase() }, { id: identifier }],
      },
      include: {
        moderated_games: {
          include: { game: true },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const [totalRuns, verifiedRuns] = await Promise.all([
      prisma.run.count({ where: { user_id: user.id } }),
      prisma.run.count({ where: { user_id: user.id, verified: true } }),
    ]);

    res.json({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      country: user.country,
      twitch: user.twitch,
      is_placeholder: user.is_placeholder,
      created_at: user.created_at,
      stats: {
        total_runs: totalRuns,
        verified_runs: verifiedRuns,
      },
      moderated_games: user.moderated_games.map((m) => ({
        id: m.game.id,
        name: m.game.name,
        slug: m.game.slug,
        role: m.role,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
};

export const getUserRuns = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { page = "1", limit = "25" } = req.query;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id }, { username: id }],
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [runs, total] = await Promise.all([
      prisma.run.findMany({
        where: { user_id: user.id },
        include: {
          category: { include: { platform: { include: { game: true } } } },
          level_category: {
            include: {
              level: { include: { platform: { include: { game: true } } } },
            },
          },
          platform: true,
        },
        orderBy: { submitted_at: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.run.count({ where: { user_id: user.id } }),
    ]);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
      },
      total,
      page: pageNum,
      limit: limitNum,
      runs: runs.map((run) => {
        const isIL = run.level_category_id !== null;
        const game = isIL
          ? run.level_category?.level?.platform?.game
          : run.category?.platform?.game;
        const timingMethod = run.platform.timing_method;

        return {
          id: run.id,
          is_il: isIL,
          game: game?.name ?? null,
          game_slug: game?.slug ?? null,
          category: run.category?.name ?? run.level_category?.name ?? null,
          level: run.level_category?.level?.name ?? null,
          platform: run.platform.name,
          timing_method: timingMethod,
          realtime_ms: run.realtime_ms,
          realtime_display: run.realtime_ms
            ? formatTime(run.realtime_ms)
            : null,
          gametime_ms: run.gametime_ms,
          gametime_display: run.gametime_ms
            ? formatTime(run.gametime_ms)
            : null,
          score_value: run.score_value ?? null,
          scoring_type: run.category?.scoring_type ?? null,
          verified: run.verified,
          video_url: run.video_url,
          submitted_at: run.submitted_at,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user runs" });
  }
};

export const getUserPBs = async (req: Request, res: Response) => {
  try {
    const identifier = req.params.id as string;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier.toLowerCase() }, { id: identifier }],
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const id = user.id;

    function getPbKey(run: {
      category_id: string | null;
      subcategory_id: string | null;
      variable_values: { variable_value_id: string }[];
    }): string {
      const varPart = run.variable_values
        .map((rv) => rv.variable_value_id)
        .sort()
        .join("+");
      return `${run.category_id}:${run.subcategory_id ?? ""}:${varPart}`;
    }

    function getILPbKey(run: {
      level_category_id: string | null;
      variable_values: { variable_value_id: string }[];
    }): string {
      const varPart = run.variable_values
        .map((rv) => rv.variable_value_id)
        .sort()
        .join("+");
      return `${run.level_category_id}:${varPart}`;
    }

    const [soloRuns, coopParticipations, soloILRuns] = await Promise.all([
      prisma.run.findMany({
        where: {
          user_id: id,
          verified: true,
          is_coop: false,
          category_id: { not: null },
        },
        include: {
          category: { include: { platform: { include: { game: true } } } },
          platform: true,
          subcategory: true,
          variable_values: {
            include: { variable_value: { include: { variable: true } } },
          },
        },
      }),
      prisma.runRunner.findMany({
        where: { user_id: id },
        include: {
          run: {
            include: {
              category: { include: { platform: { include: { game: true } } } },
              platform: true,
              subcategory: true,
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
              variable_values: {
                include: { variable_value: { include: { variable: true } } },
              },
            },
          },
        },
      }),
      prisma.run.findMany({
        where: {
          user_id: id,
          verified: true,
          is_coop: false,
          level_category_id: { not: null },
        },
        include: {
          level_category: {
            include: {
              level: { include: { platform: { include: { game: true } } } },
            },
          },
          platform: true,
          variable_values: {
            include: { variable_value: { include: { variable: true } } },
          },
        },
      }),
    ]);

    // ----------------------------------------------------------------
    // Solo Full Game PBs
    // ----------------------------------------------------------------
    const soloPBMap = new Map<string, (typeof soloRuns)[0]>();
    for (const run of soloRuns) {
      const key = getPbKey(run);
      const existing = soloPBMap.get(key);
      const scoringType = run.category?.scoring_type ?? null;

      if (!existing) {
        soloPBMap.set(key, run);
        continue;
      }

      if (scoringType !== null) {
        const runScore = run.score_value ?? null;
        const existingScore = existing.score_value ?? null;
        if (runScore === null || existingScore === null) continue;
        const isBetter =
          scoringType === "highscore"
            ? runScore > existingScore
            : runScore < existingScore; // lowcast: fewer = better
        if (isBetter) soloPBMap.set(key, run);
      } else {
        const timingMethod = run.platform.timing_method;
        const time =
          timingMethod === "gametime"
            ? (run.gametime_ms ?? run.realtime_ms)
            : run.realtime_ms;
        const existingTime =
          timingMethod === "gametime"
            ? (existing.gametime_ms ?? existing.realtime_ms)
            : existing.realtime_ms;
        if (!time) continue;
        if (existingTime && time < existingTime) soloPBMap.set(key, run);
      }
    }

    const soloPBs = await Promise.all(
      Array.from(soloPBMap.values()).map(async (run) => {
        const timingMethod = run.platform.timing_method;
        const timeField =
          timingMethod === "gametime" ? "gametime_ms" : "realtime_ms";
        const varValueIds = run.variable_values.map(
          (rv) => rv.variable_value_id,
        );
        const scoringType = run.category?.scoring_type ?? null;
        const isScored = scoringType !== null;

        const categoryRuns = await prisma.run.findMany({
          where: {
            category_id: run.category_id,
            platform_id: run.platform_id,
            subcategory_id: run.subcategory_id ?? null,
            verified: true,
            is_coop: false,
            ...(varValueIds.length > 0
              ? {
                  variable_values: {
                    some: { variable_value_id: { in: varValueIds } },
                  },
                }
              : {}),
          },
          select: {
            user_id: true,
            realtime_ms: true,
            gametime_ms: true,
            score_value: true,
            variable_values: { select: { variable_value_id: true } },
          },
          orderBy: isScored
            ? [
                { score_value: scoringType === "highscore" ? "desc" : "asc" },
                { [timeField]: "asc" as const },
              ]
            : { [timeField]: "asc" as const },
        });

        const exactRuns =
          varValueIds.length > 0
            ? categoryRuns.filter((r) =>
                varValueIds.every((vid) =>
                  r.variable_values.some((rv) => rv.variable_value_id === vid),
                ),
              )
            : categoryRuns;

        // Dedup one per user, keeping their best run for the scoring mode
        const seenUsers = new Map<string, (typeof exactRuns)[0]>();
        for (const r of exactRuns) {
          const prev = seenUsers.get(r.user_id);
          if (!prev) {
            seenUsers.set(r.user_id, r);
            continue;
          }
          if (isScored) {
            const rScore = r.score_value ?? null;
            const pScore = prev.score_value ?? null;
            if (rScore !== null && pScore !== null) {
              const isBetter =
                scoringType === "highscore" ? rScore > pScore : rScore < pScore;
              if (isBetter) seenUsers.set(r.user_id, r);
            }
          }
          // time-based: already ordered asc, first-seen is best
        }

        const dedupedRuns = Array.from(seenUsers.values());

        // Re-sort after dedup so findIndex lands in the right position
        if (isScored) {
          dedupedRuns.sort((a, b) => {
            const aScore = a.score_value ?? Infinity;
            const bScore = b.score_value ?? Infinity;
            return scoringType === "highscore" ? bScore - aScore : aScore - bScore;
          });
        }

        const rank = dedupedRuns.findIndex((r) => r.user_id === id) + 1;

        return {
          id: run.id,
          is_il: false,
          is_coop: false,
          game_id: run.category!.platform!.game.id,
          game_name: run.category!.platform!.game.name,
          game_slug: run.category!.platform!.game.slug,
          category_id: run.category_id,
          category_name: run.category!.name,
          category_slug: run.category!.slug,
          subcategory_name: run.subcategory?.name ?? null,
          variable_values: run.variable_values.map((rv) => ({
            variable: rv.variable_value.variable.name,
            variable_slug: rv.variable_value.variable.slug,
            value: rv.variable_value.name,
            value_slug: rv.variable_value.slug,
          })),
          platform: run.platform.name,
          platform_slug: run.platform.slug,
          timing_method: timingMethod,
          realtime_ms: run.realtime_ms,
          realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
          gametime_ms: run.gametime_ms,
          gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
          score_value: run.score_value ?? null,
          scoring_type: run.category?.scoring_type ?? null,
          video_url: run.video_url,
          comment: run.comment,
          rank,
          runners: null,
        };
      }),
    );

    // ----------------------------------------------------------------
    // Solo IL PBs
    // ----------------------------------------------------------------
    const soloILPBMap = new Map<string, (typeof soloILRuns)[0]>();
    for (const run of soloILRuns) {
      const timingMethod = run.platform.timing_method;
      const time =
        timingMethod === "gametime"
          ? (run.gametime_ms ?? run.realtime_ms)
          : run.realtime_ms;
      if (!time) continue;
      const key = getILPbKey(run);
      const existing = soloILPBMap.get(key);
      if (!existing) {
        soloILPBMap.set(key, run);
      } else {
        const existingTime =
          timingMethod === "gametime"
            ? existing.gametime_ms
            : existing.realtime_ms;
        if (existingTime && time < existingTime) soloILPBMap.set(key, run);
      }
    }

    const soloILPBs = await Promise.all(
      Array.from(soloILPBMap.values()).map(async (run) => {
        const timingMethod = run.platform.timing_method;
        const timeField =
          timingMethod === "gametime" ? "gametime_ms" : "realtime_ms";
        const varValueIds = run.variable_values.map(
          (rv) => rv.variable_value_id,
        );

        const levelRuns = await prisma.run.findMany({
          where: {
            level_category_id: run.level_category_id,
            platform_id: run.platform_id,
            verified: true,
            is_coop: false,
            ...(varValueIds.length > 0
              ? {
                  variable_values: {
                    some: { variable_value_id: { in: varValueIds } },
                  },
                }
              : {}),
          },
          select: {
            user_id: true,
            realtime_ms: true,
            gametime_ms: true,
            variable_values: { select: { variable_value_id: true } },
          },
          orderBy: { [timeField]: "asc" as const },
        });

        const exactRuns =
          varValueIds.length > 0
            ? levelRuns.filter((r) =>
                varValueIds.every((vid) =>
                  r.variable_values.some((rv) => rv.variable_value_id === vid),
                ),
              )
            : levelRuns;

        const seen = new Set<string>();
        const dedupedRuns = exactRuns.filter((r) => {
          if (seen.has(r.user_id)) return false;
          seen.add(r.user_id);
          return true;
        });

        const rank = dedupedRuns.findIndex((r) => r.user_id === id) + 1;
        const levelCategory = run.level_category!;
        const game = levelCategory.level.platform.game;

        return {
          id: run.id,
          is_il: true,
          is_coop: false,
          game_id: game.id,
          game_name: game.name,
          game_slug: game.slug,
          level_id: levelCategory.level.id,
          level_name: levelCategory.level.name,
          category_id: run.level_category_id,
          category_name: levelCategory.name,
          category_slug: levelCategory.slug,
          subcategory_name: null,
          variable_values: run.variable_values.map((rv) => ({
            variable: rv.variable_value.variable.name,
            variable_slug: rv.variable_value.variable.slug,
            value: rv.variable_value.name,
            value_slug: rv.variable_value.slug,
          })),
          platform: run.platform.name,
          platform_slug: run.platform.slug,
          timing_method: timingMethod,
          realtime_ms: run.realtime_ms,
          realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
          gametime_ms: run.gametime_ms,
          gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
          score_value: run.score_value ?? null,
          scoring_type: null,
          video_url: run.video_url,
          comment: run.comment,
          rank,
          runners: null,
        };
      }),
    );

    // ----------------------------------------------------------------
    // Coop Full Game PBs
    // ----------------------------------------------------------------
    const verifiedCoopRuns = coopParticipations
      .map((p) => p.run)
      .filter((r) => r.verified && r.category_id !== null);

    const coopPBMap = new Map<string, (typeof verifiedCoopRuns)[0]>();
    for (const run of verifiedCoopRuns) {
      const timingMethod = run.platform.timing_method;
      const time =
        timingMethod === "gametime"
          ? (run.gametime_ms ?? run.realtime_ms)
          : run.realtime_ms;
      if (!time) continue;
      const key = getPbKey(run);
      const existing = coopPBMap.get(key);
      if (!existing) {
        coopPBMap.set(key, run);
      } else {
        const existingTime =
          timingMethod === "gametime"
            ? existing.gametime_ms
            : existing.realtime_ms;
        if (existingTime && time < existingTime) coopPBMap.set(key, run);
      }
    }

    const coopPBs = await Promise.all(
      Array.from(coopPBMap.values()).map(async (run) => {
        const timingMethod = run.platform.timing_method;
        const timeField =
          timingMethod === "gametime" ? "gametime_ms" : "realtime_ms";
        const varValueIds = run.variable_values.map(
          (rv) => rv.variable_value_id,
        );

        const allCoopRuns = await prisma.run.findMany({
          where: {
            category_id: run.category_id,
            platform_id: run.platform_id,
            subcategory_id: run.subcategory_id ?? null,
            verified: true,
            is_coop: true,
            ...(varValueIds.length > 0
              ? {
                  variable_values: {
                    some: { variable_value_id: { in: varValueIds } },
                  },
                }
              : {}),
          },
          include: {
            runners: true,
            variable_values: { select: { variable_value_id: true } },
          },
          orderBy: { [timeField]: "asc" as const },
        });

        const exactCoopRuns =
          varValueIds.length > 0
            ? allCoopRuns.filter((r) =>
                varValueIds.every((vid) =>
                  r.variable_values.some((rv) => rv.variable_value_id === vid),
                ),
              )
            : allCoopRuns;

        const userBestTime = new Map<string, number>();
        for (const cr of exactCoopRuns) {
          const t = (cr as any)[timeField] ?? Infinity;
          for (const runner of cr.runners) {
            const existing = userBestTime.get(runner.user_id);
            if (existing === undefined || t < existing)
              userBestTime.set(runner.user_id, t);
          }
        }

        const dedupedCoopRuns = exactCoopRuns.filter((cr) => {
          const t = (cr as any)[timeField] ?? Infinity;
          return cr.runners.some(
            (runner) => userBestTime.get(runner.user_id) === t,
          );
        });

        const rank = dedupedCoopRuns.findIndex((cr) => cr.id === run.id) + 1;

        return {
          id: run.id,
          is_il: false,
          is_coop: true,
          game_id: run.category!.platform!.game.id,
          game_name: run.category!.platform!.game.name,
          game_slug: run.category!.platform!.game.slug,
          category_id: run.category_id,
          category_name: run.category!.name,
          category_slug: run.category!.slug,
          subcategory_name: run.subcategory?.name ?? null,
          variable_values: run.variable_values.map((rv) => ({
            variable: rv.variable_value.variable.name,
            variable_slug: rv.variable_value.variable.slug,
            value: rv.variable_value.name,
            value_slug: rv.variable_value.slug,
          })),
          platform: run.platform.name,
          platform_slug: run.platform.slug,
          timing_method: timingMethod,
          realtime_ms: run.realtime_ms,
          realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
          gametime_ms: run.gametime_ms,
          gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
          score_value: run.score_value ?? null,
          scoring_type: run.category?.scoring_type ?? null,
          video_url: run.video_url,
          comment: run.comment,
          rank,
          runners: run.runners.map((r) => r.user),
        };
      }),
    );

    // ----------------------------------------------------------------
    // Assemble
    // ----------------------------------------------------------------
    const personalBests = [...soloPBs, ...coopPBs, ...soloILPBs];
    const goldRuns = personalBests.filter((pb) => pb.rank === 1).length;

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
      },
      total: personalBests.length,
      gold_runs: goldRuns,
      personal_bests: personalBests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user PBs" });
  }
};

export const getMyModeratedGames = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        moderated_games: {
          include: {
            game: {
              include: {
                platforms: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const addPendingCounts = async (games: any[]) => {
      return Promise.all(
        games.map(async (game) => {
          const platformIds = game.platforms.map((p: any) => p.id);
          const pending_runs = await prisma.run.count({
            where: {
              platform_id: { in: platformIds },
              verified: false,
              rejected: false,
            },
          });
          return { ...game, pending_runs };
        }),
      );
    };

    if (user.role === "admin") {
      const allGames = await prisma.game.findMany({
        include: { platforms: true },
      });
      const games = await addPendingCounts(allGames);
      return res.json({ games, isAdmin: true });
    }

    const moderatedGames = user.moderated_games.map((mod) => mod.game);
    const games = await addPendingCounts(moderatedGames);
    res.json({ games, isAdmin: false });
  } catch (error) {
    console.error("Error fetching moderated games:", error);
    res.status(500).json({ error: "Failed to fetch moderated games" });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId)
      return res.status(401).json({ error: "Not authenticated" });

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      avatar_url: user.avatar_url,
      country: user.country,
      twitch: user.twitch,
      role: user.role,
      created_at: user.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId)
      return res.status(401).json({ error: "Not authenticated" });

    const { email, country, display_name } = req.body;

    // Validate email format if provided
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Check email not already taken by someone else
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: req.userId } },
      });
      if (existing) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    if (display_name !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { username: true },
      });
      if (!current || display_name.toLowerCase() !== current.username) {
        return res
          .status(400)
          .json({ error: "Display name must match your username." });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(email !== undefined && { email }),
        ...(country !== undefined && { country: country || null }),
        ...(display_name !== undefined && {
          display_name: display_name || null,
        }),
      },
    });

    res.json({
      id: updated.id,
      username: updated.username,
      display_name: updated.display_name,
      email: updated.email,
      avatar_url: updated.avatar_url,
      country: updated.country,
      twitch: updated.twitch,
      role: updated.role,
      created_at: updated.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
};
export const searchUsers = async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: "Query required" });

    const users = await prisma.user.findMany({
      where: {
        username: { contains: q.toLowerCase() },
      },
      select: {
        id: true,
        username: true,
        display_name: true,
        email: true,
        role: true,
        country: true,
        created_at: true,
        moderated_games: {
          include: { game: true },
        },
      },
      take: 20,
    });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Failed to search users" });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;

    if (!["user", "moderator", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, role: true },
    });

    res.json({ user: updated });
  } catch (error) {
    res.status(500).json({ error: "Failed to update role" });
  }
};

export const assignGameModerator = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const gameSlug = req.params.gameSlug as string;

    const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    await prisma.gameModerator.upsert({
      where: { user_id_game_id: { user_id: id, game_id: game.id } },
      create: { user_id: id, game_id: game.id, role: "moderator" },
      update: {},
    });

    res.json({ message: "Moderator assigned" });
  } catch (error) {
    res.status(500).json({ error: "Failed to assign moderator" });
  }
};

export const removeGameModerator = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const gameSlug = req.params.gameSlug as string;

    const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    await prisma.gameModerator.deleteMany({
      where: { user_id: id, game_id: game.id },
    });

    res.json({ message: "Moderator removed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove moderator" });
  }
};
