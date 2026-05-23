export const expenseCategories = [
  { name: "Moradia", group: "essencial" },
  { name: "Alimentacao", group: "essencial" },
  { name: "Transporte", group: "essencial" },
  { name: "Saude", group: "essencial" },
  { name: "Lazer", group: "variavel" },
  { name: "Educacao", group: "variavel" },
  { name: "Outros", group: "variavel" },
  { name: "Reserva/Investimento", group: "prioridade" }
];

export const incomeCategories = ["Salario", "Freelancer", "Bonus", "Rendimento", "Outros"];

export function getDefaultCategories(type) {
  if (type === "income") {
    return incomeCategories.map((name) => ({ name, type: "income", group: "receita", isDefault: true }));
  }

  return expenseCategories.map((item) => ({ ...item, type: "expense", isDefault: true }));
}

export function getDefaultCategoryNames(type) {
  return getDefaultCategories(type).map((item) => item.name);
}

export function getCategoryGroup(category) {
  return expenseCategories.find((item) => item.name === category)?.group || "variavel";
}
