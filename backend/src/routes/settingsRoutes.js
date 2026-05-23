import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors.js";
import { prisma } from "../prisma.js";
import { getBudgetSettings, normalizeBudgetSettings } from "../services/financeService.js";

export const settingsRoutes = Router();

const budgetSchema = z.object({
  salary: z.number().nonnegative(),
  needsPct: z.number().int().min(0).max(100),
  wantsPct: z.number().int().min(0).max(100),
  futurePct: z.number().int().min(0).max(100)
});

settingsRoutes.get("/budget", async (req, res, next) => {
  try {
    const budget = await getBudgetSettings(req.user.id);
    return res.json({ budget });
  } catch (error) {
    return next(error);
  }
});

settingsRoutes.put("/budget", async (req, res, next) => {
  try {
    const data = budgetSchema.parse(req.body);
    if (data.needsPct + data.wantsPct + data.futurePct !== 100) {
      throw new HttpError(400, "Os percentuais precisam somar 100.");
    }

    const budget = await prisma.budgetSettings.upsert({
      where: { userId: req.user.id },
      update: data,
      create: { ...data, userId: req.user.id }
    });

    return res.json({ budget: normalizeBudgetSettings(budget) });
  } catch (error) {
    return next(error);
  }
});
