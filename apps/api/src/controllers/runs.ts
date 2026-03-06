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
      subcategory_slug,
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

    // Find game
    const game = await prisma.game.findUnique({
      where: { slug: game_slug },
    });
    if (!game) return res.status(404).json({ error: "Game not found" });

    // Find platform
    const platform = await prisma.platform.findFirst({
      where: { slug: platform_slug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    // Find category
    const category = await prisma.category.findFirst({
      where: { slug: category_slug, platform_id: platform.id },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });

    // Find subcategory if provided
    let subcategory_id = null;
    if (subcategory_slug) {
      const subcategory = await prisma.subcategory.findFirst({
        where: { slug: subcategory_slug, category_id: category.id },
      });
      if (!subcategory)
        return res.status(404).json({ error: "Subcategory not found" });

      subcategory_id = subcategory.id;
    }

    // Create run
    const run = await prisma.run.create({
      data: {
        user_id: req.userId,
        category_id: category.id,
        platform_id: platform.id,
        system_id: system_id ? system_id : null,
        subcategory_id,
        realtime_ms: realtime_ms ? parseInt(realtime_ms) : null,
        gametime_ms: gametime_ms ? parseInt(gametime_ms) : null,
        video_url,
        comment,
        verified: false,
      },
      include: {
        user: { select: { id: true, username: true, country: true } },
        category: true,
        platform: true,
        subcategory: true,
        system: true,
      },
    });

    res.status(201).json({
      run,
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

    // Try solo run first
    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, display_name: true, country: true } },
        category: {
          include: {
            platform: {
              include: { game: true },
            },
          },
        },
        platform: true,
      },
    });

    if (run) {
      return res.json({
        id: run.id,
        is_coop: false,
        user: run.user,
        runners: null,
        game: run.category.platform!.game.name,
        category: run.category.name,
        platform: run.platform.name,
        realtime_ms: run.realtime_ms,
        gametime_ms: run.gametime_ms,
        realtime_display: run.realtime_ms ? formatTime(run.realtime_ms) : null,
        gametime_display: run.gametime_ms ? formatTime(run.gametime_ms) : null,
        verified: run.verified,
        video_url: run.video_url,
        comment: run.comment,
        submitted_at: run.submitted_at,
        verified_at: run.verified_at,
      });
    }

    // Fall back to co-op run
    const coopRun = await prisma.coopRun.findUnique({
      where: { id },
      include: {
        runners: {
          include: {
            user: { select: { id: true, username: true, display_name: true, country: true } },
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
      },
    });

    if (!coopRun) return res.status(404).json({ error: "Run not found" });

    res.json({
      id: coopRun.id,
      is_coop: true,
      user: null,
      runners: coopRun.runners.map((r) => r.user),
      game: coopRun.category.platform!.game.name,
      category: coopRun.category.name,
      platform: coopRun.platform.name,
      realtime_ms: coopRun.realtime_ms,
      gametime_ms: coopRun.gametime_ms,
      realtime_display: coopRun.realtime_ms ? formatTime(coopRun.realtime_ms) : null,
      gametime_display: coopRun.gametime_ms ? formatTime(coopRun.gametime_ms) : null,
      verified: coopRun.verified,
      video_url: coopRun.video_url,
      comment: coopRun.comment,
      submitted_at: coopRun.submitted_at,
      verified_at: coopRun.verified_at,
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

export const updateCoopRun = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { realtime_ms, gametime_ms, video_url, comment } = req.body;

    const run = await prisma.coopRun.findUnique({ where: { id } });
    if (!run) return res.status(404).json({ error: "Co-op run not found" });

    const updated = await prisma.coopRun.update({
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
    res.status(500).json({ error: "Failed to update co-op run" });
  }
};
export const deleteCoopRun = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const run = await prisma.coopRun.findUnique({ where: { id } });
    if (!run) return res.status(404).json({ error: "Co-op run not found" });

    // Only submitter or admin can delete
    if (run.submitted_by_id !== req.userId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.role !== "admin") {
        return res.status(403).json({ error: "Not authorized to delete this run" });
      }
    }

    await prisma.coopRunRunner.deleteMany({ where: { coop_run_id: id } });
    await prisma.coopRun.delete({ where: { id } });

    res.json({ message: "Co-op run deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete co-op run" });
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

export const submitCoopRun = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const {
      game_slug,
      platform_slug,
      category_slug,
      subcategory_slug,
      realtime_ms,
      gametime_ms,
      video_url,
      comment,
      system_id,
      runner_ids,
    } = req.body;

    if (!game_slug || !platform_slug || !category_slug || !subcategory_slug) {
      return res.status(400).json({
        error: "game_slug, platform_slug, category_slug, and subcategory_slug are required",
      });
    }

    if (!runner_ids || !Array.isArray(runner_ids) || runner_ids.length < 2) {
      return res.status(400).json({ error: "Co-op runs require at least 2 runners" });
    }

    // Ensure submitter is in the runners list
    if (!runner_ids.includes(req.userId)) {
      return res.status(400).json({ error: "Submitter must be one of the runners" });
    }

    // Find game
    const game = await prisma.game.findUnique({ where: { slug: game_slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    // Find platform
    const platform = await prisma.platform.findFirst({
      where: { slug: platform_slug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    // Find category
    const category = await prisma.category.findFirst({
      where: { slug: category_slug, platform_id: platform.id },
    });
    if (!category) return res.status(404).json({ error: "Category not found" });

    // Find subcategory and verify it's co-op
    const subcategory = await prisma.subcategory.findFirst({
      where: { slug: subcategory_slug, category_id: category.id },
    });
    if (!subcategory) return res.status(404).json({ error: "Subcategory not found" });
    if (!subcategory.is_coop) {
      return res.status(400).json({ error: "This subcategory is not a co-op category" });
    }
    if (subcategory.required_players && runner_ids.length !== subcategory.required_players) {
  return res.status(400).json({ 
    error: `This subcategory requires exactly ${subcategory.required_players} runners` 
  });
}

    // Verify all runner_ids exist
    const users = await prisma.user.findMany({
      where: { id: { in: runner_ids } },
      select: { id: true },
    });
    if (users.length !== runner_ids.length) {
      return res.status(400).json({ error: "One or more runners not found" });
    }

    // Create co-op run with runners
    const coopRun = await prisma.coopRun.create({
      data: {
        category_id: category.id,
        platform_id: platform.id,
        subcategory_id: subcategory.id,
        realtime_ms: realtime_ms ? parseInt(realtime_ms) : null,
        gametime_ms: gametime_ms ? parseInt(gametime_ms) : null,
        video_url,
        comment,
        system_id: system_id || null,
        verified: false,
        submitted_by_id: req.userId,
        runners: {
          create: runner_ids.map((id: string) => ({ user_id: id })),
        },
      },
      include: {
        runners: {
          include: {
            user: { select: { id: true, username: true, display_name: true, country: true } },
          },
        },
        category: true,
        platform: true,
        subcategory: true,
        system: true,
      },
    });

    res.status(201).json({
      run: coopRun,
      message: "Co-op run submitted successfully. Awaiting verification.",
    });
  } catch (error) {
    console.error("Error submitting co-op run:", error);
    res.status(500).json({ error: "Failed to submit co-op run" });
  }
};