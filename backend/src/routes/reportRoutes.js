import { Router } from "express";
import { buildMonthlyReportPdf } from "../services/pdfReportService.js";
import { buildPeriodWhere, parsePeriod } from "../services/periodService.js";
import { getDashboardSummary } from "../services/financeService.js";
import { prisma } from "../prisma.js";

export const reportRoutes = Router();

reportRoutes.get("/monthly", async (req, res, next) => {
  try {
    const period = parsePeriod(req.query);
    const [user, transactions, summary] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: req.user.id } }),
      prisma.transaction.findMany({
        where: {
          userId: req.user.id,
          date: buildPeriodWhere(period)
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }]
      }),
      getDashboardSummary(req.user.id, period)
    ]);

    const buffer = await buildMonthlyReportPdf({ user, transactions, summary, period });
    const filename = `techfinances_relatorio_${period.year}_${String(period.month).padStart(2, "0")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});
