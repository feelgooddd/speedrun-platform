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

    const id = user.id;

    // Solo runs
    const runs = await prisma.run.findMany({
      where: { user_id: id, verified: true },
      include: {
        category: { include: { platform: { include: { game: true } } } },
        platform: true,
      },
    });

    const pbMap = new Map<string, (typeof runs)[0]>();

    for (const run of runs) {
      const timingMethod = run.platform.timing_method;
      const time =
        timingMethod === "gametime" ? run.gametime_ms : run.realtime_ms;
      if (!time) continue;

      const existing = pbMap.get(run.category_id);
      if (!existing) {
        pbMap.set(run.category_id, run);
      } else {
        const existingTime =
          timingMethod === "gametime"
            ? existing.gametime_ms
            : existing.realtime_ms;
        if (existingTime && time < existingTime) {
          pbMap.set(run.category_id, run);
        }
      }
    }

    const soloPBs = await Promise.all(
      Array.from(pbMap.values()).map(async (run) => {
        const timingMethod = run.platform.timing_method;
        const timeField =
          timingMethod === "gametime" ? "gametime_ms" : "realtime_ms";

        const categoryRuns = await prisma.run.findMany({
          where: {
            category_id: run.category_id,
            platform_id: run.platform_id,
            subcategory_id: run.subcategory_id ?? null,
            verified: true,
          },
          select: {
            user_id: true,
            realtime_ms: true,
            gametime_ms: true,
          },
          orderBy: { [timeField]: "asc" as const },
        });

        const seen = new Set<string>();
        const dedupedRuns = categoryRuns.filter((r) => {
          if (seen.has(r.user_id)) return false;
          seen.add(r.user_id);
          return true;
        });

        const rank = dedupedRuns.findIndex((r) => r.user_id === id) + 1;

        return {
          is_coop: false,
          game_id: run.category.platform!.game.id,
          game_name: run.category.platform!.game.name,
          game_slug: run.category.platform!.game.slug,
          category_id: run.category_id,
          category_name: run.category.name,
          category_slug: run.category.slug,
          platform: run.platform.name,
          platform_slug: run.platform.slug,
          timing_method: timingMethod,
          realtime_ms: run.realtime_ms,
          realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
          gametime_ms: run.gametime_ms,
          gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
          video_url: run.video_url,
          comment: run.comment,
          rank,
          runners: null,
        };
      }),
    );

    // Co-op PBs
    const coopParticipations = await prisma.coopRunRunner.findMany({
      where: { user_id: id },
      include: {
        coop_run: {
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
          },
        },
      },
    });

    // Filter to verified only
    const verifiedCoopRuns = coopParticipations
      .map((p) => p.coop_run)
      .filter((r) => r.verified);

    // Deduplicate to PB per subcategory
    const coopPBMap = new Map<string, (typeof verifiedCoopRuns)[0]>();

    for (const run of verifiedCoopRuns) {
      const timingMethod = run.platform.timing_method;
      const time =
        timingMethod === "gametime" ? run.gametime_ms : run.realtime_ms;
      if (!time) continue;

      const key = run.subcategory_id ?? run.category_id;
      const existing = coopPBMap.get(key);
      if (!existing) {
        coopPBMap.set(key, run);
      } else {
        const existingTime =
          timingMethod === "gametime"
            ? existing.gametime_ms
            : existing.realtime_ms;
        if (existingTime && time < existingTime) {
          coopPBMap.set(key, run);
        }
      }
    }

    const coopPBs = await Promise.all(
      Array.from(coopPBMap.values()).map(async (run) => {
        const timingMethod = run.platform.timing_method;
        const timeField =
          timingMethod === "gametime" ? "gametime_ms" : "realtime_ms";

        // Rank: count coop runs in this subcategory where user has a faster PB
        const allCoopRuns = await prisma.coopRun.findMany({
          where: {
            subcategory_id: run.subcategory_id ?? undefined,
            category_id: run.category_id,
            platform_id: run.platform_id,
            verified: true,
          },
          include: {
            runners: true,
          },
          orderBy: { [timeField]: "asc" as const },
        });

        // Build PB per user across all coop runs in this subcategory
        const userBestTime = new Map<string, number>();
        for (const cr of allCoopRuns) {
          const t = (cr as any)[timeField] ?? Infinity;
          for (const runner of cr.runners) {
            const existing = userBestTime.get(runner.user_id);
            if (existing === undefined || t < existing) {
              userBestTime.set(runner.user_id, t);
            }
          }
        }

        const dedupedCoopRuns = allCoopRuns.filter((cr) => {
          const t = (cr as any)[timeField] ?? Infinity;
          return cr.runners.some(
            (runner) => userBestTime.get(runner.user_id) === t
          );
        });

        const rank = dedupedCoopRuns.findIndex((cr) => cr.id === run.id) + 1;

        return {
          is_coop: true,
          game_id: run.category.platform!.game.id,
          game_name: run.category.platform!.game.name,
          game_slug: run.category.platform!.game.slug,
          category_id: run.category_id,
          category_name: run.category.name,
          category_slug: run.category.slug,
          subcategory_name: run.subcategory?.name ?? null,
          platform: run.platform.name,
          platform_slug: run.platform.slug,
          timing_method: timingMethod,
          realtime_ms: run.realtime_ms,
          realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
          gametime_ms: run.gametime_ms,
          gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
          video_url: run.video_url,
          comment: run.comment,
          rank,
          runners: run.runners.map((r) => r.user),
        };
      }),
    );

    const personalBests = [...soloPBs, ...coopPBs];

    const totalRuns = await prisma.run.count({ where: { user_id: id } });
    const verifiedRuns = await prisma.run.count({
      where: { user_id: id, verified: true },
    });

    const goldRuns = personalBests.filter((pb) => pb.rank === 1).length;

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
        gold_runs: goldRuns,
      },
      moderated_games: user.moderated_games.map((m) => ({
        id: m.game.id,
        name: m.game.name,
        slug: m.game.slug,
        role: m.role,
      })),
      personal_bests: personalBests,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
};

export const getUserRuns = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { page = "1", limit = "25" } = req.query;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [runs, total] = await Promise.all([
      prisma.run.findMany({
        where: { user_id: id },
        include: {
          category: { include: { platform: { include: { game: true } } } },
          platform: true,
        },
        orderBy: { submitted_at: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.run.count({ where: { user_id: id } }),
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
        const timingMethod = run.platform.timing_method;

        return {
          id: run.id,
          game: run.category.platform!.game.name,
          category: run.category.name,
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
      return Promise.all(games.map(async (game) => {
        const platformIds = game.platforms.map((p: any) => p.id);
        const pending_runs = await prisma.run.count({
          where: {
            platform_id: { in: platformIds },
            verified: false,
            rejected: false,
          },
        });
        return { ...game, pending_runs };
      }));
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

    const { email, country } = req.body;

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

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(email !== undefined && { email }),
        ...(country !== undefined && { country: country || null }),
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
