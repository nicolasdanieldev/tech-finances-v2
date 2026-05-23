# Banco de dados

O TechFinances V2 usa PostgreSQL via Prisma.

## Modelo principal

- `users`: dados da conta, senha criptografada e configuracao de 2FA.
- `trusted_devices`: dispositivos ja validados por senha/2FA para reduzir prompts desnecessarios.
- `transactions`: receitas e despesas do usuario autenticado.
- `budget_settings`: salario e regra 50-30-20.
- `emergency_goals`: meses e valor atual da reserva.

## Rodando localmente com Docker

```bash
docker run --name techfinances-postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -e POSTGRES_DB=techfinances ^
  -p 5432:5432 ^
  -d postgres:16
```

Depois copie `backend/.env.example` para `backend/.env` e rode:

```bash
npm run install:all
npm run prisma:migrate
npm run dev
```
