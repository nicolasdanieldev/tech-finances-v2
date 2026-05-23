import { afterAll, beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { api, cleanDatabase, createSession, disconnectPrisma } from "./helpers.js";

function binaryParser(res, callback) {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("exports e relatorios", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("gera Excel e PDF do periodo selecionado", async () => {
    const session = await createSession();

    await api
      .post("/api/transactions")
      .set(session.auth)
      .send({ type: "income", date: "2026-05-09", category: "Salario", description: "Receita para relatorio", amount: 2500 })
      .expect(201);

    await api
      .post("/api/transactions")
      .set(session.auth)
      .send({ type: "expense", date: "2026-05-10", category: "Moradia", description: "Despesa para relatorio", amount: 700 })
      .expect(201);

    const excel = await api
      .get("/api/exports/excel?month=5&year=2026")
      .set(session.auth)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(excel.headers["content-type"]).toContain("spreadsheetml.sheet");
    expect(excel.body.length).toBeGreaterThan(1000);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excel.body);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Resumo",
      "Receitas",
      "Despesas",
      "Orcamento",
      "Investimentos"
    ]);
    expect(workbook.getWorksheet("Resumo").getCell("A1").value).toBe("Resumo financeiro TechFinances");
    expect(workbook.getWorksheet("Receitas").pageSetup.fitToPage).toBe(true);
    expect(workbook.getWorksheet("Receitas").pageSetup.orientation).toBe("landscape");
    expect(workbook.getWorksheet("Despesas").getCell("D4").numFmt).toContain("R$");

    const pdf = await api
      .get("/api/reports/monthly?month=5&year=2026")
      .set(session.auth)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.body.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(pdf.body.length).toBeGreaterThan(2500);
  });

  it("gera recomendacao educativa local com payload anonimo do periodo", async () => {
    const session = await createSession();

    await api
      .post("/api/transactions")
      .set(session.auth)
      .send({ type: "income", date: "2026-05-09", category: "Salario", description: "Receita IA", amount: 1200 })
      .expect(201);

    const response = await api
      .post("/api/ai/recommendation?month=5&year=2026")
      .set(session.auth)
      .send({
        investorProfile: "conservador",
        goalHorizon: "curto",
        monthlyContribution: 100,
        consentToAnonymousAnalysis: true
      })
      .expect(200);

    expect(response.body.recommendation.source).toBe("local-fallback");
    expect(response.body.anonymizedPayload.totals.income).toBe(1200);
    expect(response.body.anonymizedPayload).not.toHaveProperty("transactions");
    expect(response.body.anonymizedPayload).not.toHaveProperty("health");
    expect(response.body.anonymizedPayload.financialHealth.score).toBeTypeOf("number");
    expect(response.body.privacyAudit.externalProviderCalled).toBe(false);
    expect(response.body.privacyAudit.piiDetected).toBe(false);
    expect(JSON.stringify(response.body.anonymizedPayload)).not.toContain(session.email);
    expect(JSON.stringify(response.body.anonymizedPayload)).not.toContain("Receita IA");
  });

  it("bloqueia IA sem consentimento explicito", async () => {
    const session = await createSession();

    await api
      .post("/api/ai/recommendation?month=5&year=2026")
      .set(session.auth)
      .send({ investorProfile: "moderado", goalHorizon: "medio", monthlyContribution: 250 })
      .expect(400);
  });
});
