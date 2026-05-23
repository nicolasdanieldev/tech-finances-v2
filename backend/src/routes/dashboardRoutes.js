import { Router } from "express";
import { getDashboardSummary } from "../services/financeService.js";
import { parsePeriod } from "../services/periodService.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/summary", async (req, res, next) => {
  try {
    const period = parsePeriod(req.query);
    const summary = await getDashboardSummary(req.user.id, period);
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
});
