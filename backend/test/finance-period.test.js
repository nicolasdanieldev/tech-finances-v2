import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, cleanDatabase, createSession, disconnectPrisma } from "./helpers.js";

describe("filtro mensal financeiro", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("filtra transacoes e dashboard por mes/ano", async () => {
    const session = await createSession();

    await api
      .post("/api/transactions")
      .set(session.auth)
      .send({ type: "income", date: "2026-05-09", category: "Salario", description: "Receita maio", amount: 1000 })
      .expect(201);

    await api
      .post("/api/transactions")
      .set(session.auth)
      .send({ type: "income", date: "2026-04-09", category: "Salario", description: "Receita abril", amount: 5000 })
      .expect(201);

    const mayTransactions = await api
      .get("/api/transactions?month=5&year=2026")
      .set(session.auth)
      .expect(200);

    expect(mayTransactions.body.period).toMatchObject({ month: 5, year: 2026 });
    expect(mayTransactions.body.transactions.map((item) => item.description)).toContain("Receita maio");
    expect(mayTransactions.body.transactions.map((item) => item.description)).not.toContain("Receita abril");

    const maySummary = await api
      .get("/api/dashboard/summary?month=5&year=2026")
      .set(session.auth)
      .expect(200);

    const aprilSummary = await api
      .get("/api/dashboard/summary?month=4&year=2026")
      .set(session.auth)
      .expect(200);

    expect(maySummary.body.totals.income).toBe(1000);
    expect(aprilSummary.body.totals.income).toBe(5000);
  });

  it("mantem dados isolados por usuario", async () => {
    const first = await createSession({ email: "first." + Date.now() + "@techfinances.test" });
    const second = await createSession({ email: "second." + Date.now() + "@techfinances.test" });

    await api
      .post("/api/transactions")
      .set(first.auth)
      .send({ type: "income", date: "2026-05-09", category: "Salario", description: "Somente primeiro", amount: 777 })
      .expect(201);

    const secondTransactions = await api
      .get("/api/transactions?month=5&year=2026")
      .set(second.auth)
      .expect(200);

    expect(secondTransactions.body.transactions).toHaveLength(0);
  });
});
