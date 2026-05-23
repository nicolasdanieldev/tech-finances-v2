import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";

export const api = request(app);

export function uniqueEmail(prefix = "teste") {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@techfinances.test`;
}

export function deviceId(prefix = "device") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}-abcdef123456`;
}

export async function createSession({ email = uniqueEmail(), password = "SenhaTeste123", name = "Usuario Teste" } = {}) {
  const device = deviceId("session");
  const response = await api
    .post("/api/auth/register")
    .set("X-Device-Id", device)
    .send({ name, email, password })
    .expect(201);

  return {
    email,
    password,
    device,
    token: response.body.token,
    user: response.body.user,
    auth: { Authorization: `Bearer ${response.body.token}`, "X-Device-Id": device }
  };
}

export async function cleanDatabase() {
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.trustedDevice.deleteMany();
  await prisma.budgetSettings.deleteMany();
  await prisma.emergencyGoal.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
