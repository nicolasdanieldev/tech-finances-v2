import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, cleanDatabase, createSession, disconnectPrisma } from "./helpers.js";

describe("categorias", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("lista categorias padrao e permite categoria personalizada", async () => {
    const session = await createSession();

    const initial = await api
      .get("/api/categories")
      .set(session.auth)
      .expect(200);

    expect(initial.body.categories.income.some((item) => item.name === "Salario")).toBe(true);
    expect(initial.body.categories.expense.some((item) => item.name === "Moradia")).toBe(true);

    const created = await api
      .post("/api/categories")
      .set(session.auth)
      .send({ name: "Pet", type: "expense", group: "variavel" })
      .expect(201);

    expect(created.body.category.name).toBe("Pet");
    expect(created.body.categories.expense.some((item) => item.name === "Pet")).toBe(true);

    await api
      .post("/api/transactions")
      .set(session.auth)
      .send({ type: "expense", date: "2026-05-11", category: "Pet", description: "Racao", amount: 120 })
      .expect(201);
  });

  it("bloqueia remocao de categoria em uso", async () => {
    const session = await createSession();

    const created = await api
      .post("/api/categories")
      .set(session.auth)
      .send({ name: "Academia", type: "expense", group: "essencial" })
      .expect(201);

    await api
      .post("/api/transactions")
      .set(session.auth)
      .send({ type: "expense", date: "2026-05-11", category: "Academia", description: "Plano mensal", amount: 100 })
      .expect(201);

    await api
      .delete(`/api/categories/${created.body.category.id}`)
      .set(session.auth)
      .expect(409);
  });
});
