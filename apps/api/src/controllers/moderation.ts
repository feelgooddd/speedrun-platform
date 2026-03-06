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

    const [runs, coopRuns] = await Promise.all([
      prisma.run.findMany({
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
          category: true,
          platform: true,
          system: true,
        },
        orderBy: { submitted_at: "asc" },
      }),
      prisma.coopRun.findMany({
        where: {
          verified: false,
          rejected: false,
          platform_id: { in: platformIds },
        },
        include: {
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
        },
        orderBy: { submitted_at: "asc" },
      }),
    ]);

    const soloItems = runs.map((run) => ({
      id: run.id,
      is_coop: false,
      user: run.user,
      runners: null,
      system: run.system?.name ?? null,
      category: run.category.name,
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

    const coopItems = coopRuns.map((run) => ({
      id: run.id,
      is_coop: true,
      user: null,
      runners: run.runners.map((r) => r.user),
      system: run.system?.name ?? null,
      category: run.category.name,
      subcategory: run.subcategory.name,
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

    const allItems = [...soloItems, ...coopItems].sort(
      (a, b) =>
        new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
    );

    res.json({
      game: game.name,
      pending: allItems.length,
      runs: allItems,
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
        category: { include: { platform: { include: { game: true } } } },
        platform: true,
      },
      orderBy: { submitted_at: "asc" },
    });

    res.json({
      pending: runs.length,
      runs: runs.map((run) => ({
        id: run.id,
        user: run.user,
        game: run.category.platform!.game.name,
        game_slug: run.category.platform!.game.slug,
        category: run.category.name,
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

export const verifyCoopRun = async (req: AuthRequest, res: Response) => {
  console.log("route hit")
  try {
    const runId = req.params.id as string;
    const { verified, reject_reason } = req.body;

    if (typeof verified !== "boolean") {
      return res
        .status(400)
        .json({ error: "verified field is required (true/false)" });
    }

    const run = await prisma.coopRun.findUnique({ where: { id: runId } });
    console.log("found run:", run);

    if (!run) return res.status(404).json({ error: "Co-op run not found" });

    const updatedRun = await prisma.coopRun.update({
      where: { id: runId },
      data: {
        verified,
        rejected: !verified,
        reject_reason: !verified ? reject_reason : null,
        verified_at: verified ? new Date() : null,
      },
    });

    res.json({
      run: updatedRun,
      message: verified
        ? "Co-op run verified successfully"
        : "Co-op run rejected",
    });
  } catch (error) {
    console.error("Error verifying co-op run:", error);
    res.status(500).json({ error: "Failed to verify co-op run" });
  }
};
