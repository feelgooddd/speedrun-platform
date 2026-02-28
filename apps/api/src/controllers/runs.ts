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
    if (!platform)
      return res.status(404).json({ error: "Platform not found" });

    // Find category
    const category = await prisma.category.findFirst({
      where: { slug: category_slug, platform_id: platform.id },
    });
    if (!category)
      return res.status(404).json({ error: "Category not found" });

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

export const verifyRun = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const run = await prisma.run.findUnique({ where: { id } });
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (run.verified)
      return res.status(400).json({ error: "Run already verified" });

    const updated = await prisma.run.update({
      where: { id },
      data: {
        verified: true,
        verified_at: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to verify run" });
  }
};

export const rejectRun = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const run = await prisma.run.findUnique({ where: { id } });
    if (!run)
      return res.status(404).json({ error: "Run not found" });

    await prisma.run.delete({ where: { id } });

    res.json({ message: "Run rejected and removed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject run" });
  }
};

export const getRun = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, country: true } },
        category: {
          include: {
            platform: {
              include: {
                game: true,
              },
            },
          },
        },
        platform: true,
      },
    });

    if (!run)
      return res.status(404).json({ error: "Run not found" });

    if (!run.category.platform)
      return res.status(500).json({ error: "Invalid run data" });

    res.json({
      id: run.id,
      user: run.user,
      game: run.category.platform.game.name,
      category: run.category.name,
      platform: run.platform.name,
      realtime_ms: run.realtime_ms,
      gametime_ms: run.gametime_ms,
      realtime_display: run.realtime_ms
        ? formatTime(run.realtime_ms)
        : null,
      gametime_display: run.gametime_ms
        ? formatTime(run.gametime_ms)
        : null,
      verified: run.verified,
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
        ...(realtime_ms !== undefined && { realtime_ms: parseInt(realtime_ms) }),
        ...(gametime_ms !== undefined && { gametime_ms: gametime_ms ? parseInt(gametime_ms) : null }),
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