import { Router } from "express";
import { z } from "zod";
import { HttpError, notFound } from "../errors.js";
import { expenseCategories, incomeCategories } from "../constants.js";
import { categoryGroups, listCategories, normalizeCategory } from "../services/categoryService.js";
import { prisma } from "../prisma.js";

export const categoryRoutes = Router();

const categorySchema = z.object({
  name: z.string().min(2, "Categoria precisa ter pelo menos 2 caracteres.").max(40),
  type: z.enum(["income", "expense"]),
  group: z.enum(categoryGroups).optional()
});

categoryRoutes.get("/", async (req, res, next) => {
  try {
    return res.json({ categories: await listCategories(req.user.id) });
  } catch (error) {
    return next(error);
  }
});

categoryRoutes.post("/", async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const name = data.name.trim();

    if (isDefaultCategory(data.type, name)) {
      throw new HttpError(409, "Esta categoria ja existe como padrao.");
    }

    const category = await prisma.category.create({
      data: {
        name,
        type: data.type,
        group: data.type === "income" ? "receita" : data.group || "variavel",
        userId: req.user.id
      }
    });

    return res.status(201).json({
      category: normalizeCategory(category),
      categories: await listCategories(req.user.id)
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(new HttpError(409, "Voce ja cadastrou uma categoria com este nome e tipo."));
    }
    return next(error);
  }
});

categoryRoutes.delete("/:id", async (req, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!category) {
      throw notFound("Categoria nao encontrada.");
    }

    const used = await prisma.transaction.findFirst({
      where: { userId: req.user.id, type: category.type, category: category.name }
    });

    if (used) {
      throw new HttpError(409, "Categoria em uso por lancamentos. Remova ou edite os lancamentos antes.");
    }

    await prisma.category.delete({ where: { id: category.id } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

function isDefaultCategory(type, name) {
  return type === "income"
    ? incomeCategories.includes(name)
    : expenseCategories.some((item) => item.name === name);
}
