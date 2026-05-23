import { Router } from "express";
import { z } from "zod";
import { HttpError, notFound } from "../errors.js";
import { prisma } from "../prisma.js";
import { normalizeTransaction } from "../services/financeService.js";
import { buildPeriodWhere, parsePeriod } from "../services/periodService.js";
import { findAllowedCategory } from "../services/categoryService.js";

export const transactionRoutes = Router();

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve usar formato YYYY-MM-DD."),
  category: z.string().min(2),
  description: z.string().min(2).max(120),
  amount: z.number().positive()
});

transactionRoutes.get("/", async (req, res, next) => {
  try {
    const period = parsePeriod(req.query);
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
        date: buildPeriodWhere(period)
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });

    return res.json({
      period: {
        month: period.month,
        year: period.year,
        start: period.start.toISOString().slice(0, 10),
        end: period.end.toISOString().slice(0, 10)
      },
      transactions: transactions.map(normalizeTransaction)
    });
  } catch (error) {
    return next(error);
  }
});

transactionRoutes.post("/", async (req, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);
    await validateCategory(req.user.id, data);

    const transaction = await prisma.transaction.create({
      data: {
        ...data,
        date: new Date(`${data.date}T00:00:00.000Z`),
        userId: req.user.id
      }
    });

    return res.status(201).json({ transaction: normalizeTransaction(transaction) });
  } catch (error) {
    return next(error);
  }
});

transactionRoutes.delete("/:id", async (req, res, next) => {
  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!transaction) {
      throw notFound("Lancamento nao encontrado.");
    }

    await prisma.transaction.delete({ where: { id: transaction.id } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

async function validateCategory(userId, data) {
  const allowed = await findAllowedCategory(userId, data.type, data.category);
  if (!allowed) {
    throw new HttpError(400, "Categoria nao permitida para este tipo de lancamento.");
  }
}
