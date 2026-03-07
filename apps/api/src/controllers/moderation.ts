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
        rejected: false,
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
      orderBy: { submitted_at: "asc" },
    });

    const items = runs.map((run) => ({
      id: run.id,
      is_coop: run.is_coop,
      user: run.is_coop ? null : run.user,
      runners: run.is_coop ? run.runners.map((r) => r.user) : null,
      system: run.system?.name ?? null,
      category: run.category.name,
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
      video_url: run.video_url,
      submitted_at: run.submitted_at,
      rejected: run.rejected,
      reject_reason: run.reject_reason,
      comment: run.comment,
    }));

    res.json({
      game: game.name,
      pending: items.length,
      runs: items,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch mod queue" });
  }
};

export const getGlobalModQueue = async (req: Request, res: Response) => {
  try {
    const runs = await prisma.run.findMany({
      where: {
        verified: false,
        rejected: false,
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
        category: { include: { platform: { include: { game: true } } } },
        platform: true,
        subcategory: true,
        variable_values: {
          include: {
            variable_value: {
              include: { variable: true },
            },
          },
        },
      },
      orderBy: { submitted_at: "asc" },
    });

    res.json({
      pending: runs.length,
      runs: runs.map((run) => ({
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
        timing_method: run.platform.timing_method,
        realtime_ms: run.realtime_ms,
        realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
        gametime_ms: run.gametime_ms,
        gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
        video_url: run.video_url,
        submitted_at: run.submitted_at,
        comment: run.comment,
      })),
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

