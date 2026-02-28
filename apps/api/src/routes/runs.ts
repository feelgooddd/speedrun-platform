import { Router } from "express";
import {
  submitRun,
  verifyRun,
  rejectRun,
  getRun,
  updateRun,
  deleteRun,
} from "../controllers/runs";
import { requireAuth } from "../middleware/auth";
import { isAdmin } from "../middleware/checkRole";

export const runsRouter = Router();

runsRouter.post("/", requireAuth, submitRun);
runsRouter.patch("/:id/verify", requireAuth, verifyRun);
runsRouter.patch("/:id/reject", requireAuth, rejectRun);

runsRouter.get("/:id", getRun);

runsRouter.patch("/:id", requireAuth, isAdmin, updateRun);
runsRouter.delete("/:id", requireAuth, isAdmin, deleteRun);
