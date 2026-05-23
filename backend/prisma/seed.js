import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const demoUser = {
  name: "Demo TechFinances",
  email: "demo@techfinances.dev",
  password: "DemoSenha123"
};

async function main() {
  const passwordHash = await bcrypt.hash(demoUser.password, 12);

  const user = await prisma.user.upsert({
    where: { email: demoUser.email },
    update: {
      name: demoUser.name,
      passwordHash,
      emailVerifiedAt: new Date()
    },
    create: {
      name: demoUser.name,
      email: demoUser.email,
      passwordHash,
      emailVerifiedAt: new Date()
    }
  });

  await Promise.all([
    prisma.budgetSettings.upsert({
      where: { userId: user.id },
      update: { salary: 5200, needsPct: 50, wantsPct: 30, futurePct: 20 },
      create: { userId: user.id, salary: 5200, needsPct: 50, wantsPct: 30, futurePct: 20 }
    }),
    prisma.emergencyGoal.upsert({
      where: { userId: user.id },
      update: { months: 6, current: 4200 },
      create: { userId: user.id, months: 6, current: 4200 }
    })
  ]);

  await prisma.category.createMany({
    data: [
      { userId: user.id, name: "Pet", type: "expense", group: "variavel" },
      { userId: user.id, name: "Academia", type: "expense", group: "essencial" },
      { userId: user.id, name: "Cliente fixo", type: "income", group: "receita" }
    ],
    skipDuplicates: true
  });

  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.createMany({
    data: [
      { userId: user.id, type: "income", date: new Date("2026-05-05T00:00:00.000Z"), category: "Salario", description: "Salario mensal", amount: 5200 },
      { userId: user.id, type: "income", date: new Date("2026-05-12T00:00:00.000Z"), category: "Cliente fixo", description: "Projeto recorrente", amount: 1200 },
      { userId: user.id, type: "expense", date: new Date("2026-05-06T00:00:00.000Z"), category: "Moradia", description: "Aluguel", amount: 1450 },
      { userId: user.id, type: "expense", date: new Date("2026-05-07T00:00:00.000Z"), category: "Alimentacao", description: "Mercado", amount: 780 },
      { userId: user.id, type: "expense", date: new Date("2026-05-08T00:00:00.000Z"), category: "Academia", description: "Plano mensal", amount: 120 },
      { userId: user.id, type: "expense", date: new Date("2026-05-10T00:00:00.000Z"), category: "Pet", description: "Racao e veterinario", amount: 260 },
      { userId: user.id, type: "expense", date: new Date("2026-05-15T00:00:00.000Z"), category: "Reserva/Investimento", description: "Aporte reserva", amount: 900 }
    ]
  });

  console.log("Seed concluido.");
  console.log(`Login demo: ${demoUser.email}`);
  console.log(`Senha demo: ${demoUser.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
