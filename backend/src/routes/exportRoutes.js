import { Router } from "express";
import { buildFinanceWorkbook } from "../services/excelService.js";
import { getBudgetSettings, getDashboardSummary } from "../services/financeService.js";
import { buildPeriodWhere, parsePeriod } from "../services/periodService.js";
import { prisma } from "../prisma.js";

export const exportRoutes = Router();

exportRoutes.get("/excel", async (req, res, next) => {
  try {
    const period = parsePeriod(req.query);
    const [user, transactions, budget, summary] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: req.user.id } }),
      prisma.transaction.findMany({
        where: {
          userId: req.user.id,
          date: buildPeriodWhere(period)
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }]
      }),
      getBudgetSettings(req.user.id),
      getDashboardSummary(req.user.id, period)
    ]);

    const workbook = await buildFinanceWorkbook({ user, transactions, budget, summary, period });
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="techfinances.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return next(error);
  }
});
