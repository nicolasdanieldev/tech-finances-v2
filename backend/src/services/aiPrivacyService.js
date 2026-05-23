import crypto from "node:crypto";

const blockedFields = [
  "name",
  "email",
  "description",
  "transactions",
  "transactionIds",
  "userId",
  "categoryDetails",
  "rawBankData"
];

const allowedFields = [
  "period",
  "totals.income",
  "totals.expense",
  "totals.balance",
  "budgetUsage.needsPct",
  "budgetUsage.wantsPct",
  "budgetUsage.futurePct",
  "emergency.months",
  "emergency.progressPct",
  "financialHealth.score",
  "financialHealth.label",
  "investorProfile",
  "goalHorizon",
  "monthlyContribution"
];

export function buildAnonymizedAiPayload(summary, input) {
  const totals = summary.totals;

  return {
    period: summary.period
      ? {
          month: summary.period.month,
          year: summary.period.year
        }
      : null,
    totals: {
      income: roundMoney(totals.income),
      expense: roundMoney(totals.expense),
      balance: roundMoney(totals.balance)
    },
    budgetUsage: {
      needsPct: percent(totals.needsSpent, totals.needsLimit),
      wantsPct: percent(totals.wantsSpent, totals.wantsLimit),
      futurePct: percent(totals.futureSpent, totals.futureLimit)
    },
    emergency: {
      months: summary.emergency.months,
      progressPct: roundPercent(summary.emergency.progressPct)
    },
    financialHealth: {
      score: summary.health.score,
      label: summary.health.label
    },
    investorProfile: input.investorProfile,
    goalHorizon: input.goalHorizon,
    monthlyContribution: roundMoney(input.monthlyContribution)
  };
}

export function buildAiPrivacyAudit(payload) {
  return {
    mode: "local-free",
    externalProviderCalled: false,
    dataMinimization: true,
    consentRequired: true,
    piiDetected: hasBlockedData(payload),
    allowedFields,
    blockedFields,
    payloadHash: hashPayload(payload),
    message: "A analise usa apenas indicadores agregados. Dados pessoais e transacoes completas ficam fora do payload."
  };
}

export function assertAnonymousPayload(payload) {
  if (hasBlockedData(payload)) {
    throw new Error("Payload de IA contem campos sensiveis bloqueados.");
  }
}

function hasBlockedData(value) {
  const json = JSON.stringify(value).toLowerCase();
  return blockedFields.some((field) => json.includes(field.toLowerCase()));
}

function hashPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function percent(value, limit) {
  if (!limit) return 0;
  return roundPercent((Number(value || 0) / Number(limit || 0)) * 100);
}

function roundPercent(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
