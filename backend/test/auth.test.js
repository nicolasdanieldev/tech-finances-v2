import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, cleanDatabase, createSession, deviceId, disconnectPrisma, uniqueEmail } from "./helpers.js";
import { prisma } from "../src/prisma.js";

describe("auth", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("cadastra usuario com senha criptografada e cria defaults financeiros", async () => {
    const email = uniqueEmail("auth");
    const device = deviceId("auth-register");

    const response = await api
      .post("/api/auth/register")
      .set("X-Device-Id", device)
      .send({ name: "Nicolas", email, password: "SenhaTeste123" })
      .expect(201);

    expect(response.body.token).toBeTruthy();
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.emailVerified).toBe(false);
    expect(response.body.user.twoFactorEnabled).toBe(false);
    expect(response.body.emailVerification.link).toContain("verifyEmailToken=");

    const user = await prisma.user.findUnique({
      where: { email },
      include: { budgetSettings: true, emergencyGoal: true, trustedDevices: true }
    });

    expect(user.passwordHash).not.toBe("SenhaTeste123");
    expect(user.emailVerificationTokenHash).toBeTruthy();
    expect(user.passwordHash.startsWith("$2")).toBe(true);
    expect(user.budgetSettings.needsPct).toBe(50);
    expect(user.budgetSettings.wantsPct).toBe(30);
    expect(user.budgetSettings.futurePct).toBe(20);
    expect(user.emergencyGoal.months).toBe(6);
    expect(user.trustedDevices).toHaveLength(1);
  });

  it("faz login e bloqueia senha errada", async () => {
    const session = await createSession();

    const login = await api
      .post("/api/auth/login")
      .set("X-Device-Id", session.device)
      .send({ email: session.email, password: session.password })
      .expect(200);

    expect(login.body.token).toBeTruthy();

    await api
      .post("/api/auth/login")
      .set("X-Device-Id", session.device)
      .send({ email: session.email, password: "senha-errada" })
      .expect(401);
  });

  it("protege rotas autenticadas sem JWT", async () => {
    await api.get("/api/auth/me").expect(401);
    await api.get("/api/transactions").expect(401);
  });

  it("lista dispositivos confiaveis e remove outros dispositivos", async () => {
    const session = await createSession();
    const otherDevice = deviceId("other-device");

    await api
      .post("/api/auth/login")
      .set("X-Device-Id", otherDevice)
      .send({ email: session.email, password: session.password })
      .expect(200);

    const before = await api
      .get("/api/auth/me")
      .set(session.auth)
      .expect(200);

    expect(before.body.user.email).toBe(session.email);
    expect(before.body.trustedDevices.length).toBe(2);
    expect(before.body.trustedDevices.some((device) => device.current)).toBe(true);

    const revoke = await api
      .delete("/api/auth/trusted-devices")
      .set(session.auth)
      .expect(200);

    expect(revoke.body.trustedDevices).toHaveLength(1);
    expect(revoke.body.trustedDevices[0].current).toBe(true);
  });

  it("atualiza perfil e confirma email por token", async () => {
    const session = await createSession();

    const update = await api
      .put("/api/auth/profile")
      .set(session.auth)
      .send({ name: "Usuario Editado", email: uniqueEmail("perfil") })
      .expect(200);

    expect(update.body.user.name).toBe("Usuario Editado");
    expect(update.body.user.emailVerified).toBe(false);
    expect(update.body.emailVerification.token).toBeTruthy();

    const confirm = await api
      .post("/api/auth/email-verification/confirm")
      .send({ token: update.body.emailVerification.token })
      .expect(200);

    expect(confirm.body.user.emailVerified).toBe(true);
  });

  it("gera recuperacao de senha e redefine a senha", async () => {
    const session = await createSession();

    const forgot = await api
      .post("/api/auth/password/forgot")
      .send({ email: session.email })
      .expect(200);

    expect(forgot.body.passwordReset.token).toBeTruthy();

    await api
      .post("/api/auth/password/reset")
      .send({ token: forgot.body.passwordReset.token, password: "NovaSenha123" })
      .expect(200);

    await api
      .post("/api/auth/login")
      .set("X-Device-Id", deviceId("reset-login"))
      .send({ email: session.email, password: "NovaSenha123" })
      .expect(200);
  });
});
