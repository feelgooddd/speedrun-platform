import { Router } from "express";
import {
  submitRun,

  getRun,
  updateRun,
  deleteRun,
  submitCoopRun,
  updateCoopRun,
  deleteCoopRun
} from "../controllers/runs";
import { requireAuth } from "../middleware/auth";
import { isAdmin } from "../middleware/checkRole";

export const runsRouter = Router();

runsRouter.post("/", requireAuth, submitRun);
runsRouter.post("/coop", requireAuth, submitCoopRun);
runsRouter.patch("/coop/:id", requireAuth, isAdmin, updateCoopRun);
runsRouter.delete("/coop/:id", requireAuth, isAdmin, deleteCoopRun);

runsRouter.get("/:id", getRun);
runsRouter.patch("/:id", requireAuth, isAdmin, updateRun);
runsRouter.delete("/:id", requireAuth, isAdmin, deleteRun);