import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { getEmergencyGoal, normalizeEmergencyGoal } from "../services/financeService.js";

export const goalRoutes = Router();

const emergencySchema = z.object({
  months: z.number().int().min(1).max(24),
  current: z.number().nonnegative()
});

goalRoutes.get("/emergency", async (req, res, next) => {
  try {
    const goal = await getEmergencyGoal(req.user.id);
    return res.json({ goal });
  } catch (error) {
    return next(error);
  }
});

goalRoutes.put("/emergency", async (req, res, next) => {
  try {
    const data = emergencySchema.parse(req.body);
    const goal = await prisma.emergencyGoal.upsert({
      where: { userId: req.user.id },
      update: data,
      create: { ...data, userId: req.user.id }
    });

    return res.json({ goal: normalizeEmergencyGoal(goal) });
  } catch (error) {
    return next(error);
  }
});
