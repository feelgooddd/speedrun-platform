import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { formatTime } from "../lib/utils";
import { AuthRequest } from "../middleware/auth";

// ----------------------------------------------------------------
// Games
// ----------------------------------------------------------------

export const getAllGames = async (req: Request, res: Response) => {
  try {
    const games = await prisma.game.findMany({
      include: {
        platforms: true,
      },
      orderBy: {
        created_at: "asc",
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

export const createGame = async (req: AuthRequest, res: Response) => {
  try {
    const { slug, name } = req.body;

    if (!slug || !name) {
      return res.status(400).json({ error: "Slug and name are required" });
    }

    const existing = await prisma.game.findUnique({ where: { slug } });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Game with this slug already exists" });
    }

    const game = await prisma.game.create({
      data: { slug, name },
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
      prisma.run.count({ where: { verified: true } }),
      prisma.run.groupBy({
        by: ["user_id"],
        where: { verified: true, is_coop: false },
      }),
      prisma.category.count(),
      prisma.run.groupBy({
        by: ["user_id", "category_id", "platform_id"],
        where: { verified: true, is_coop: false },
      }),
    ]);

    const coopRunners = await prisma.runRunner.groupBy({ by: ["user_id"] });
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

// ----------------------------------------------------------------
// Platforms
// ----------------------------------------------------------------

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

// ----------------------------------------------------------------
// Systems
// ----------------------------------------------------------------

export const getAllSystems = async (req: Request, res: Response) => {
  try {
    const systems = await prisma.system.findMany({ orderBy: { name: "asc" } });
    res.json({ systems });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch systems" });
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

export const addSystemToPlatform = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const { name } = req.body;

    if (!name)
      return res.status(400).json({ error: "System name is required" });

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const system = await prisma.system.upsert({
      where: { name },
      create: { name },
      update: {},
    });

    await prisma.platformSystem.upsert({
      where: {
        platform_id_system_id: {
          platform_id: platform.id,
          system_id: system.id,
        },
      },
      create: { platform_id: platform.id, system_id: system.id },
      update: {},
    });

    res.status(201).json({ system });
  } catch (error) {
    res.status(500).json({ error: "Failed to add system to platform" });
  }
};

// ----------------------------------------------------------------
// Categories
// ----------------------------------------------------------------

export const getPlatformCategories = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;

    const game = await prisma.game.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, platforms: true },
    });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id, deleted_at: null },
      include: {
        categories: {
          where: { deleted_at: null },
          orderBy: { order: "asc" },
          include: {
            subcategories: {
              where: { deleted_at: null },
              orderBy: { order: "asc" },
            },
            variables: {
              orderBy: { order: "asc" },
              include: {
                values: {
                  include: {
                    hidden_variables: {
                      select: { variable_id: true },
                    },
                  },
                },
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

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platform = req.params.platform as string;
    const { name, category_slug, category_type, scoring_type } = req.body;

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
        ...(category_type && { category_type }),
        ...(scoring_type && { scoring_type }),
      },
    });

    res.status(201).json({ category });
  } catch (error) {
    res.status(500).json({ error: "Failed to create category" });
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

// ----------------------------------------------------------------
// Subcategories (legacy — supports HP1-3)
// ----------------------------------------------------------------

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

    // Migrate existing runs to first subcategory
    if (hadNoSubcategories) {
      const migrated = await prisma.run.updateMany({
        where: { category_id: category.id, subcategory_id: null },
        data: { subcategory_id: subcategory.id },
      });
      return res
        .status(201)
        .json({ subcategory, migrated_runs: migrated.count });
    }

    res.status(201).json({ subcategory });
  } catch (error) {
    res.status(500).json({ error: "Failed to create subcategory" });
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

// ----------------------------------------------------------------
// Variables
// ----------------------------------------------------------------

export const createVariable = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const categorySlug = req.params.category as string;
    const {
      variable_name,
      variable_slug,
      is_subcategory = false,
      order,
      values,
    } = req.body;

    if (
      !variable_name ||
      !variable_slug ||
      !Array.isArray(values) ||
      values.length === 0
    ) {
      return res.status(400).json({
        error:
          "variable_name, variable_slug, and at least one value are required",
      });
    }

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

    // Enforce one is_subcategory variable per category
    if (is_subcategory) {
      const existing = await prisma.variable.findFirst({
        where: { category_id: category.id, is_subcategory: true },
      });
      if (existing) {
        return res.status(400).json({
          error: `Category already has a subcategory variable: "${existing.name}". Only one is allowed.`,
        });
      }
    }

    // Auto-calculate order if not provided
    let resolvedOrder = order;
    if (resolvedOrder === undefined || resolvedOrder === null) {
      const count = await prisma.variable.count({
        where: { category_id: category.id },
      });
      resolvedOrder = count;
    }

    const variable = await prisma.variable.create({
      data: {
        name: variable_name,
        slug: variable_slug,
        is_subcategory,
        order: resolvedOrder,
        category_id: category.id,
        values: {
          create: values.map(
            (v: {
              name: string;
              slug: string;
              is_coop?: boolean;
              required_players?: number;
            }) => ({
              name: v.name,
              slug: v.slug,
              is_coop: v.is_coop ?? false,
              required_players: v.required_players ?? null,
            }),
          ),
        },
      },
      include: { values: true },
    });

    res.status(201).json({ variable });
  } catch (error) {
    console.error("Error creating variable:", error);
    res.status(500).json({ error: "Failed to create variable" });
  }
};
export const setHiddenVariables = async (req: AuthRequest, res: Response) => {
  try {
    const valueId = req.params.valueId as string;
    const { variable_ids } = req.body;

    if (!Array.isArray(variable_ids)) {
      return res.status(400).json({ error: "variable_ids must be an array" });
    }

    const value = await prisma.variableValue.findUnique({
      where: { id: valueId },
    });
    if (!value)
      return res.status(404).json({ error: "Variable value not found" });

    // Replace all hidden variables for this value
    await prisma.$transaction([
      prisma.variableValueHiddenVariable.deleteMany({
        where: { value_id: valueId },
      }),
      ...(variable_ids.length > 0
        ? [
            prisma.variableValueHiddenVariable.createMany({
              data: variable_ids.map((variable_id: string) => ({
                value_id: valueId,
                variable_id,
              })),
            }),
          ]
        : []),
    ]);

    res.json({
      message: "Hidden variables updated",
      value_id: valueId,
      variable_ids,
    });
  } catch (error) {
    console.error("Error setting hidden variables:", error);
    res.status(500).json({ error: "Failed to set hidden variables" });
  }
};

export const createLevelCategoryVariable = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const levelSlug = req.params.level as string;
    const levelCategorySlug = req.params.category as string;
    const {
      variable_name,
      variable_slug,
      is_subcategory = false,
      order,
      values,
    } = req.body;

    if (
      !variable_name ||
      !variable_slug ||
      !Array.isArray(values) ||
      values.length === 0
    ) {
      return res.status(400).json({
        error:
          "variable_name, variable_slug, and at least one value are required",
      });
    }

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const level = await prisma.level.findFirst({
      where: { slug: levelSlug, platform_id: platform.id },
    });
    if (!level) return res.status(404).json({ error: "Level not found" });

    const levelCategory = await prisma.levelCategory.findFirst({
      where: { slug: levelCategorySlug, level_id: level.id },
    });
    if (!levelCategory)
      return res.status(404).json({ error: "Level category not found" });

    if (is_subcategory) {
      const existing = await prisma.variable.findFirst({
        where: { level_category_id: levelCategory.id, is_subcategory: true },
      });
      if (existing) {
        return res.status(400).json({
          error: `Level category already has a subcategory variable: "${existing.name}". Only one is allowed.`,
        });
      }
    }

    let resolvedOrder = order;
    if (resolvedOrder === undefined || resolvedOrder === null) {
      const count = await prisma.variable.count({
        where: { level_category_id: levelCategory.id },
      });
      resolvedOrder = count;
    }

    const variable = await prisma.variable.create({
      data: {
        name: variable_name,
        slug: variable_slug,
        is_subcategory,
        order: resolvedOrder,
        level_category_id: levelCategory.id,
        values: {
          create: values.map(
            (v: {
              name: string;
              slug: string;
              is_coop?: boolean;
              required_players?: number;
            }) => ({
              name: v.name,
              slug: v.slug,
              is_coop: v.is_coop ?? false,
              required_players: v.required_players ?? null,
            }),
          ),
        },
      },
      include: { values: true },
    });

    res.status(201).json({ variable });
  } catch (error) {
    console.error("Error creating level category variable:", error);
    res.status(500).json({ error: "Failed to create variable" });
  }
};

// ----------------------------------------------------------------
// Levels
// ----------------------------------------------------------------

export const createLevel = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const { name, level_slug, order = 0 } = req.body;

    if (!name || !level_slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const level = await prisma.level.create({
      data: {
        name,
        slug: level_slug,
        order,
        platform_id: platform.id,
      },
    });

    res.status(201).json({ level });
  } catch (error) {
    res.status(500).json({ error: "Failed to create level" });
  }
};

export const createLevelCategory = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const levelSlug = req.params.level as string;
    const { name, category_slug, order = 0, scoring_type } = req.body;

    if (!name || !category_slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const level = await prisma.level.findFirst({
      where: { slug: levelSlug, platform_id: platform.id },
    });
    if (!level) return res.status(404).json({ error: "Level not found" });

    const levelCategory = await prisma.levelCategory.create({
      data: {
        name,
        slug: category_slug,
        order,
        level_id: level.id,
        ...(scoring_type && { scoring_type }),
      },
    });

    res.status(201).json({ levelCategory });
  } catch (error) {
    res.status(500).json({ error: "Failed to create level category" });
  }
};

export const deleteLevel = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const levelSlug = req.params.level as string;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const level = await prisma.level.findFirst({
      where: { slug: levelSlug, platform_id: platform.id },
    });
    if (!level) return res.status(404).json({ error: "Level not found" });

    await prisma.level.update({
      where: { id: level.id },
      data: { deleted_at: new Date() },
    });

    res.json({ message: "Level deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete level" });
  }
};

export const deleteLevelCategory = async (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const levelSlug = req.params.level as string;
    const categorySlug = req.params.category as string;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const level = await prisma.level.findFirst({
      where: { slug: levelSlug, platform_id: platform.id },
    });
    if (!level) return res.status(404).json({ error: "Level not found" });

    const levelCategory = await prisma.levelCategory.findFirst({
      where: { slug: categorySlug, level_id: level.id },
    });
    if (!levelCategory)
      return res.status(404).json({ error: "Level category not found" });

    await prisma.levelCategory.update({
      where: { id: levelCategory.id },
      data: { deleted_at: new Date() },
    });

    res.json({ message: "Level category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete level category" });
  }
};

export const getPlatformLevels = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;

    const game = await prisma.game.findUnique({ where: { slug } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const platform = await prisma.platform.findFirst({
      where: { slug: platformSlug, game_id: game.id },
    });
    if (!platform) return res.status(404).json({ error: "Platform not found" });

    const levels = await prisma.level.findMany({
      where: { platform_id: platform.id, deleted_at: null },
      orderBy: { order: "asc" },
      include: {
        level_categories: {
          where: { deleted_at: null },
          orderBy: { order: "asc" },
          include: {
            variables: {
              orderBy: { order: "asc" },
              include: {
                values: {
                  include: {
                    hidden_variables: {
                      select: { variable_id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    res.json({ levels });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch levels" });
  }
};
// ----------------------------------------------------------------
// Leaderboards
// ----------------------------------------------------------------

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

    const scoringType = category.scoring_type ?? null;
    const isScored = scoringType !== null;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const timingField =
      platform.timing_method === "gametime" ? "gametime_ms" : "realtime_ms";

    // Resolve subcategory (HP1-3)
    let subcategory = null;
    if (subcategorySlug) {
      subcategory = await prisma.subcategory.findFirst({
        where: { slug: subcategorySlug, category_id: category.id },
      });
      if (!subcategory)
        return res.status(404).json({ error: "Subcategory not found" });
    }

    // Resolve variable value IDs from query params (HP4+)
    const resolvedVariableValueIds: string[] = [];
    let isCoop = false;

    if (Object.keys(variableFilters).length > 0) {
      const variables = await prisma.variable.findMany({
        where: { category_id: category.id },
        include: {
          values: {
            include: {
              hidden_variables: { select: { variable_id: true } },
            },
          },
        },
      });

      // First pass: resolve all values and collect hidden variable IDs
      const hiddenVariableIds = new Set<string>();
      const resolvedValues: {
        variableId: string;
        valueId: string;
        is_coop: boolean;
      }[] = [];

      for (const [varSlug, valSlug] of Object.entries(variableFilters)) {
        const variable = variables.find((v) => v.slug === varSlug);
        if (!variable)
          return res
            .status(404)
            .json({ error: `Variable '${varSlug}' not found` });

        const value = variable.values.find((v) => v.slug === valSlug);
        if (!value)
          return res.status(404).json({
            error: `Value '${valSlug}' not found for variable '${varSlug}'`,
          });

        // Collect variables this value hides
        for (const h of value.hidden_variables) {
          hiddenVariableIds.add(h.variable_id);
        }

        resolvedValues.push({
          variableId: variable.id,
          valueId: value.id,
          is_coop: value.is_coop,
        });
        if (value.is_coop) isCoop = true;
      }

      // Second pass: only include value IDs for variables that aren't hidden
      for (const { variableId, valueId } of resolvedValues) {
        if (!hiddenVariableIds.has(variableId)) {
          resolvedVariableValueIds.push(valueId);
        }
      }
    }

    const hasVariableFilter = resolvedVariableValueIds.length > 0;

    const baseWhere = {
      category_id: category.id,
      platform_id: platform.id,
      verified: true,
      ...(subcategory ? { subcategory_id: subcategory.id } : {}),
      ...(hasVariableFilter ? { is_coop: isCoop } : {}),
      ...(hasVariableFilter
        ? {
            variable_values: {
              some: { variable_value_id: { in: resolvedVariableValueIds } },
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
          include: { variable_value: { include: { variable: true } } },
        },
      },
      orderBy: isScored
        ? [
            { score_value: scoringType === "highscore" ? "desc" : "asc" },
            { [timingField]: "asc" },
          ]
        : { [timingField]: "asc" as const },
    });

    // Ensure run has ALL requested variable values (Prisma `some` is OR)
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

    // PB dedup
    let dedupedRuns: typeof filteredRuns;
    if (isCoop) {
      const bestTimePerUser = new Map<string, number>();
      for (const run of filteredRuns) {
        const time = (run as any)[timingField] ?? Infinity;
        for (const runner of run.runners) {
          const existing = bestTimePerUser.get(runner.user_id);
          if (existing === undefined || time < existing)
            bestTimePerUser.set(runner.user_id, time);
        }
      }
      dedupedRuns = filteredRuns.filter((run) => {
        const time = (run as any)[timingField] ?? Infinity;
        return run.runners.some(
          (runner) => bestTimePerUser.get(runner.user_id) === time,
        );
      });
    } else {
      const seen = new Map<
        string,
        { score: number | null; time: number | null }
      >();
      dedupedRuns = filteredRuns.filter((run) => {
        const existing = seen.get(run.user_id);
        const runScore = run.score_value ?? Infinity;
        const runTime = (run as any)[timingField] ?? Infinity;

        if (!existing) {
          seen.set(run.user_id, { score: runScore, time: runTime });
          return true;
        }

        if (isScored) {
          const isBetter =
            scoringType === "highscore"
              ? runScore > (existing.score ?? -Infinity)
              : runScore < (existing.score ?? Infinity);
          const isTiebreak =
            runScore === existing.score &&
            runTime < (existing.time ?? Infinity);
          if (isBetter || isTiebreak) {
            seen.set(run.user_id, { score: runScore, time: runTime });
            return true;
          }
          return false;
        } else {
          return false; // already seen, normal dedup
        }
      });
    }
    console.log(
      "dedupedRuns order:",
      dedupedRuns.map((r) => ({
        score: r.score_value,
        time: (r as any)[timingField],
      })),
    );

    // Tie-aware ranking
    const rankedWithTies: ((typeof dedupedRuns)[number] & { _rank: number })[] =
      [];
    for (let i = 0; i < dedupedRuns.length; i++) {
      const run = dedupedRuns[i];
      let rank: number;
      if (i === 0) {
        rank = 1;
      } else {
        const prev = dedupedRuns[i - 1];
        const curr = run;
        if (isScored) {
          // Tie on score_value, then tiebreak on time
          const sameScore = prev.score_value === curr.score_value;
          const sameTime =
            (prev as any)[timingField] === (curr as any)[timingField];
          rank = sameScore && sameTime ? rankedWithTies[i - 1]._rank : i + 1;
        } else {
          const prevTime = (prev as any)[timingField];
          const currTime = (curr as any)[timingField];
          rank = currTime === prevTime ? rankedWithTies[i - 1]._rank : i + 1;
        }
      }
      rankedWithTies.push({ ...run, _rank: rank });
    }

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
      score_value: run.score_value ?? null,
      variable_values: run.variable_values.map((rv) => ({
        variable: rv.variable_value.variable.name,
        variable_slug: rv.variable_value.variable.slug,
        value: rv.variable_value.name,
        value_slug: rv.variable_value.slug,
      })),
    }));

    return res.json({
      game: game.name,
      platform: platform.name,
      timing_method: platform.timing_method,
      category: category.name,
      subcategory: subcategory?.name ?? null,
      variable_filters: hasVariableFilter
        ? Object.entries(variableFilters).map(([varSlug, valSlug]) => ({
            variable: varSlug,
            value: valSlug,
          }))
        : [],
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

export const getILLeaderboard = async (req: Request, res: Response) => {
  console.log("IL params:", req.params);
  console.log("IL query:", req.query);
  try {
    const slug = req.params.slug as string;
    const platformSlug = req.params.platform as string;
    const categorySlug = req.params.category as string;
    const { page = "1", limit = "25" } = req.query;

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

    const levelCategories = await prisma.levelCategory.findMany({
      where: {
        slug: categorySlug,
        level: { platform_id: platform.id },
        deleted_at: null,
      },
    });
    console.log("levelCategories found:", levelCategories.length);

    if (levelCategories.length === 0)
      return res.status(404).json({ error: "IL category not found" });

    const levelCategoryIds = levelCategories.map((lc) => lc.id);
    const levelCategory = levelCategories[0];

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const timingField =
      platform.timing_method === "gametime" ? "gametime_ms" : "realtime_ms";

    const resolvedVariableValueIds: string[] = [];
    let isCoop = false;

    if (Object.keys(variableFilters).length > 0) {
      const variables = await prisma.variable.findMany({
        where: { level_category_id: { in: levelCategoryIds } },
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
          return res.status(404).json({
            error: `Value '${valSlug}' not found for variable '${varSlug}'`,
          });

        resolvedVariableValueIds.push(value.id);
        if (value.is_coop) isCoop = true;
      }
    }

    const hasVariableFilter = resolvedVariableValueIds.length > 0;

    const levels = await prisma.level.findMany({
      where: {
        platform_id: platform.id,
        deleted_at: null,
        level_categories: { some: { slug: categorySlug, deleted_at: null } },
      },
      orderBy: { order: "asc" },
    });
    console.log("levels found:", levels.length);

    const baseWhere = {
      level_category_id: { in: levelCategoryIds },
      platform_id: platform.id,
      verified: true,
      ...(hasVariableFilter ? { is_coop: isCoop } : {}),
      ...(hasVariableFilter
        ? {
            variable_values: {
              some: { variable_value_id: { in: resolvedVariableValueIds } },
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
        level_category: { include: { level: true } },
        system: true,
        variable_values: {
          include: { variable_value: { include: { variable: true } } },
        },
      },
      orderBy:
        levelCategory.scoring_type === "highscore"
          ? { score_value: "desc" as const }
          : levelCategory.scoring_type === "lowcast"
            ? { score_value: "asc" as const }
            : { [timingField]: "asc" as const },
    });

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

    const levelMap = new Map<string, typeof filteredRuns>();
    for (const level of levels) levelMap.set(level.id, []);
    for (const run of filteredRuns) {
      const levelId = run.level_category?.level?.id;
      if (levelId && levelMap.has(levelId)) levelMap.get(levelId)!.push(run);
    }

    // PB dedup + tie-aware ranking per level
    const levelResults = levels.map((level) => {
      const runs = levelMap.get(level.id) ?? [];

      let dedupedRuns: typeof runs;
      if (isCoop) {
        const bestTimePerUser = new Map<string, number>();
        for (const run of runs) {
          const time = (run as any)[timingField] ?? Infinity;
          for (const runner of run.runners) {
            const existing = bestTimePerUser.get(runner.user_id);
            if (existing === undefined || time < existing)
              bestTimePerUser.set(runner.user_id, time);
          }
        }
        dedupedRuns = runs.filter((run) => {
          const time = (run as any)[timingField] ?? Infinity;
          return run.runners.some(
            (runner) => bestTimePerUser.get(runner.user_id) === time,
          );
        });
      } else {
        const bestPerUser = new Map<string, (typeof runs)[0]>();
        for (const run of runs) {
          const existing = bestPerUser.get(run.user_id);
          if (!existing) {
            bestPerUser.set(run.user_id, run);
          } else if (levelCategory.scoring_type === "highscore") {
            const runScore = run.score_value ?? -Infinity;
            const existingScore = existing.score_value ?? -Infinity;
            if (
              runScore > existingScore ||
              (runScore === existingScore &&
                (run as any)[timingField] < (existing as any)[timingField])
            )
              bestPerUser.set(run.user_id, run);
          } else if (levelCategory.scoring_type === "lowcast") {
            const runScore = run.score_value ?? Infinity;
            const existingScore = existing.score_value ?? Infinity;
            if (
              runScore < existingScore ||
              (runScore === existingScore &&
                (run as any)[timingField] < (existing as any)[timingField])
            )
              bestPerUser.set(run.user_id, run);
          } else {
            if ((run as any)[timingField] < (existing as any)[timingField])
              bestPerUser.set(run.user_id, run);
          }
        }
        dedupedRuns = [...bestPerUser.values()];
      }

      const ranked = dedupedRuns.map((run, i) => {
        let rank: number;
        if (i === 0) {
          rank = 1;
        } else {
          const prev = dedupedRuns[i - 1];
          const isTie =
            levelCategory.scoring_type === "highscore" ||
            levelCategory.scoring_type === "lowcast"
              ? run.score_value === prev.score_value
              : (run as any)[timingField] === (prev as any)[timingField];
          rank = isTie ? i : i + 1;
        }
        return {
          rank,
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
          realtime_display: run.realtime_ms
            ? formatTime(run.realtime_ms)
            : null,
          gametime_display: run.gametime_ms
            ? formatTime(run.gametime_ms)
            : null,
          score_value: run.score_value ?? null,
          scoring_type: levelCategory.scoring_type ?? null,
          video_url: run.video_url,
          submitted_at: run.submitted_at,
          variable_values: run.variable_values.map((rv) => ({
            variable: rv.variable_value.variable.name,
            variable_slug: rv.variable_value.variable.slug,
            value: rv.variable_value.name,
            value_slug: rv.variable_value.slug,
          })),
        };
      });

      return {
        level: level.name,
        level_slug: level.slug,
        order: level.order,
        total: ranked.length,
        runs: ranked,
      };
    });

    return res.json({
      game: game.name,
      platform: platform.name,
      timing_method: platform.timing_method,
      category: levelCategory.name,
      category_slug: categorySlug,
      scoring_type: levelCategory.scoring_type ?? null,
      variable_filters: hasVariableFilter
        ? Object.entries(variableFilters).map(([varSlug, valSlug]) => ({
            variable: varSlug,
            value: valSlug,
          }))
        : [],
      is_coop: isCoop,
      page: pageNum,
      limit: limitNum,
      levels: levelResults,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch IL leaderboard" });
  }
};
