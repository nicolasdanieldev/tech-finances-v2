import { prisma } from "../prisma.js";
import { getCategoryGroupMap } from "./categoryService.js";
import { buildPeriodWhere } from "./periodService.js";

function toNumber(value) {
  return Number(value || 0);
}

export async function ensureUserDefaults(userId) {
  const [budgetSettings, emergencyGoal] = await Promise.all([
    prisma.budgetSettings.upsert({
      where: { userId },
      update: {},
      create: { userId }
    }),
    prisma.emergencyGoal.upsert({
      where: { userId },
      update: {},
      create: { userId }
    })
  ]);

  return { budgetSettings, emergencyGoal };
}

export async function getBudgetSettings(userId) {
  const { budgetSettings } = await ensureUserDefaults(userId);
  return normalizeBudgetSettings(budgetSettings);
}

export async function getEmergencyGoal(userId) {
  const { emergencyGoal } = await ensureUserDefaults(userId);
  return normalizeEmergencyGoal(emergencyGoal);
}

export async function getDashboardSummary(userId, period) {
  const [transactions, budgetSettings, emergencyGoal] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        ...(period ? { date: buildPeriodWhere(period) } : {})
      }
    }),
    getBudgetSettings(userId),
    getEmergencyGoal(userId)
  ]);
  const categoryGroupMap = await getCategoryGroupMap(userId);

  const income = sum(transactions, (item) => item.type === "income");
  const expense = sum(transactions, (item) => item.type === "expense");
  const balance = income - expense;

  const needsSpent = sum(
    transactions,
    (item) => item.type === "expense" && getCategoryGroup(categoryGroupMap, item.category) === "essencial"
  );
  const wantsSpent = sum(
    transactions,
    (item) => item.type === "expense" && getCategoryGroup(categoryGroupMap, item.category) === "variavel"
  );
  const futureSpent = sum(
    transactions,
    (item) => item.type === "expense" && getCategoryGroup(categoryGroupMap, item.category) === "prioridade"
  );

  const salary = budgetSettings.salary;
  const needsLimit = salary * (budgetSettings.needsPct / 100);
  const wantsLimit = salary * (budgetSettings.wantsPct / 100);
  const futureLimit = salary * (budgetSettings.futurePct / 100);
  const emergencyTarget = (needsSpent || needsLimit || 0) * emergencyGoal.months;

  return {
    period: period
      ? {
          month: period.month,
          year: period.year,
          start: period.start.toISOString().slice(0, 10),
          end: period.end.toISOString().slice(0, 10)
        }
      : null,
    totals: {
      income,
      expense,
      balance,
      needsSpent,
      wantsSpent,
      futureSpent,
      salary,
      needsLimit,
      wantsLimit,
      futureLimit
    },
    health: calculateHealth({ income, expense, balance, needsSpent, wantsSpent, futureSpent, needsLimit, wantsLimit, futureLimit, salary }),
    emergency: {
      ...emergencyGoal,
      target: emergencyTarget,
      progressPct: emergencyTarget ? Math.min(100, (emergencyGoal.current / emergencyTarget) * 100) : 0
    },
    categoryExpenses: buildCategoryExpenses(transactions)
  };
}

export function calculateHealth(totals) {
  if (!totals.income && !totals.salary) {
    return { score: 0, label: "Sem dados", message: "Cadastre receitas e salario para comecar." };
  }

  let score = 100;
  if (totals.balance < 0) score -= 40;
  if (totals.needsSpent > totals.needsLimit && totals.needsLimit > 0) score -= 20;
  if (totals.wantsSpent > totals.wantsLimit && totals.wantsLimit > 0) score -= 20;
  if (totals.futureSpent < totals.futureLimit * 0.5 && totals.futureLimit > 0) score -= 10;
  if (totals.expense > totals.income && totals.income > 0) score -= 25;

  score = Math.max(0, Math.min(100, score));
  if (score < 45) {
    return {
      score,
      label: "Atencao",
      message: "Ha sinais de desequilibrio. Priorize reduzir gastos e proteger o saldo."
    };
  }

  if (score < 75) {
    return {
      score,
      label: "Em evolucao",
      message: "Voce esta no caminho, mas ainda pode ajustar limites e aportes."
    };
  }

  return {
    score,
    label: "Excelente",
    message: "Seu orcamento esta equilibrado e com espaco para crescimento."
  };
}

export function generateLocalRecommendation(payload) {
  const { totals, investorProfile, goalHorizon, monthlyContribution } = payload;
  const map = {
    conservador: {
      curto: ["Tesouro Selic", "CDB com liquidez diaria", "Fundos DI com baixa taxa"],
      medio: ["Tesouro Selic", "CDB 100%+ CDI", "LCI/LCA com prazo compativel"],
      longo: ["Tesouro IPCA+", "CDBs de bancos solidos", "Fundos de renda fixa"]
    },
    moderado: {
      curto: ["Tesouro Selic", "CDB liquidez diaria", "pequena parcela em fundo conservador"],
      medio: ["Tesouro IPCA+", "CDB prefixado/hibrido", "fundos multimercados"],
      longo: ["Tesouro IPCA+", "ETFs amplos", "fundos multimercados com controle de risco"]
    },
    arrojado: {
      curto: ["Reserva em Tesouro Selic antes de renda variavel", "CDB liquidez diaria", "caixa estrategico"],
      medio: ["ETFs", "fundos imobiliarios", "Tesouro IPCA+"],
      longo: ["acoes", "ETFs", "fundos imobiliarios", "Tesouro IPCA+ longo"]
    }
  };

  const balanceAdvice =
    totals.balance < 0
      ? "Antes de investir, equilibre o saldo e reduza despesas que ultrapassam sua renda."
      : "Seu saldo esta positivo. O proximo passo e automatizar aportes e fortalecer a reserva.";
  const futureUsagePct =
    payload.budgetUsage?.futurePct ??
    (totals.futureLimit ? (totals.futureSpent / totals.futureLimit) * 100 : 0);
  const futureGap = Math.max(0, 100 - futureUsagePct);
  const contributionAdvice =
    monthlyContribution > 0
      ? `Com aporte planejado de R$ ${monthlyContribution.toFixed(2)}, acompanhe se ele melhora a cobertura da reserva e o percentual de prioridades.`
      : `Seu uso atual da faixa de prioridades financeiras esta em ${futureUsagePct.toFixed(1)}% do limite configurado.`;

  return {
    source: "local-fallback",
    privacy: "A recomendacao foi gerada apenas com resumo financeiro anonimo.",
    profile: investorProfile,
    horizon: goalHorizon,
    balanceAdvice,
    contributionAdvice,
    futureGap,
    studyOptions: map[investorProfile][goalHorizon],
    disclaimer: "Conteudo educativo. Nao e recomendacao individual de investimento."
  };
}

function sum(list, predicate) {
  return list.filter(predicate).reduce((total, item) => total + toNumber(item.amount), 0);
}

function buildCategoryExpenses(transactions) {
  return transactions
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + toNumber(item.amount);
      return acc;
    }, {});
}

function getCategoryGroup(categoryGroupMap, category) {
  return categoryGroupMap.get(category) || "variavel";
}

export function normalizeBudgetSettings(settings) {
  return {
    id: settings.id,
    salary: toNumber(settings.salary),
    needsPct: settings.needsPct,
    wantsPct: settings.wantsPct,
    futurePct: settings.futurePct
  };
}

export function normalizeEmergencyGoal(goal) {
  return {
    id: goal.id,
    months: goal.months,
    current: toNumber(goal.current)
  };
}

export function normalizeTransaction(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    date: transaction.date.toISOString().slice(0, 10),
    category: transaction.category,
    description: transaction.description,
    amount: toNumber(transaction.amount),
    createdAt: transaction.createdAt
  };
}
