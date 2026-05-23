import { expenseCategories, getDefaultCategories, incomeCategories } from "../constants.js";
import { prisma } from "../prisma.js";

export const categoryGroups = ["essencial", "variavel", "prioridade"];

export async function listCategories(userId) {
  const customCategories = await prisma.category.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { name: "asc" }]
  });

  return {
    income: mergeCategories(getDefaultCategories("income"), customCategories.filter((item) => item.type === "income")),
    expense: mergeCategories(getDefaultCategories("expense"), customCategories.filter((item) => item.type === "expense"))
  };
}

export async function findAllowedCategory(userId, type, name) {
  const defaultCategory =
    type === "income"
      ? incomeCategories.includes(name)
      : expenseCategories.find((item) => item.name === name);

  if (defaultCategory) {
    return type === "income"
      ? { name, type, group: "receita", isDefault: true }
      : { ...defaultCategory, type, isDefault: true };
  }

  const customCategory = await prisma.category.findFirst({
    where: { userId, type, name }
  });

  return customCategory ? normalizeCategory(customCategory) : null;
}

export async function getCategoryGroupMap(userId) {
  const customCategories = await prisma.category.findMany({
    where: { userId, type: "expense" }
  });

  const map = new Map(expenseCategories.map((item) => [item.name, item.group]));
  customCategories.forEach((item) => map.set(item.name, item.group));
  return map;
}

export function normalizeCategory(category) {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    group: category.group,
    isDefault: Boolean(category.isDefault),
    createdAt: category.createdAt
  };
}

function mergeCategories(defaults, customCategories) {
  return [
    ...defaults.map(normalizeCategory),
    ...customCategories.map((item) => normalizeCategory({ ...item, isDefault: false }))
  ];
}
