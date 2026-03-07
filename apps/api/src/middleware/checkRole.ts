import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import prisma from "../lib/prisma";

// Check if user is admin
export const isAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
  });

  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};

// Check if user is moderator for a specific game
export const isGameModerator = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  let gameSlug: string | undefined;

  if (typeof req.params.slug === "string") {
    gameSlug = req.params.slug;
  } else if (typeof req.params.gameSlug === "string") {
    gameSlug = req.params.gameSlug;
  }

  // If no gameSlug in params, try to get it from the run
  if (!gameSlug && req.params.id) {
    const runId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!runId) {
      return res.status(400).json({ error: "Invalid run ID" });
    }

    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        category: {
          include: {
            platform: {
              include: { game: true },
            },
          },
        },
      },
    });

    if (!run?.category?.platform?.game) {
      return res.status(404).json({ error: "Run not found or invalid data" });
    }

    gameSlug = run.category.platform.game.slug;
  }

  const game = await prisma.game.findUnique({
    where: { slug: gameSlug },
  });

  if (!game) {
    return res.status(404).json({ error: "Game not found" });
  }

  // Check if user is admin OR moderator for this game
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      moderated_games: {
        where: { game_id: game.id },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.role !== "admin" && user.moderated_games.length === 0) {
    return res
      .status(403)
      .json({ error: "Moderator access required for this game" });
  }

  next();
};