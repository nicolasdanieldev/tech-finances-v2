import { Router } from "express";
import { z } from "zod";
import { generateLocalRecommendation, getDashboardSummary } from "../services/financeService.js";
import { assertAnonymousPayload, buildAiPrivacyAudit, buildAnonymizedAiPayload } from "../services/aiPrivacyService.js";
import { parsePeriod } from "../services/periodService.js";

export const aiRoutes = Router();

const aiSchema = z.object({
  investorProfile: z.enum(["conservador", "moderado", "arrojado"]),
  goalHorizon: z.enum(["curto", "medio", "longo"]),
  monthlyContribution: z.number().nonnegative(),
  consentToAnonymousAnalysis: z.boolean().refine((value) => value === true, {
    message: "Consentimento obrigatorio para analisar o resumo anonimo."
  })
});

aiRoutes.post("/recommendation", async (req, res, next) => {
  try {
    const input = aiSchema.parse(req.body);
    const period = parsePeriod(req.query);
    const summary = await getDashboardSummary(req.user.id, period);
    const anonymizedPayload = buildAnonymizedAiPayload(summary, input);
    assertAnonymousPayload(anonymizedPayload);
    const privacyAudit = buildAiPrivacyAudit(anonymizedPayload);

    return res.json({
      recommendation: generateLocalRecommendation(anonymizedPayload),
      anonymizedPayload,
      privacyAudit,
      note: "Recomendacao local gratuita. Nenhuma API externa paga foi chamada."
    });
  } catch (error) {
    return next(error);
  }
});
