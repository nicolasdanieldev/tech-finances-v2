# TechFinances V2

TechFinances V2 e uma aplicacao full-stack de financas pessoais criada para portfolio. Ela evolui um MVP em HTML/CSS/JS com `localStorage` para uma arquitetura com API, login, banco de dados, exportacao Excel e recomendacao educativa com privacidade.

## Deploy em producao

- Aplicacao: https://tech-finances-v2.onrender.com
- Health check da API: https://tech-finances-v2.onrender.com/api/health
- Repositorio: https://github.com/nicolasdanieldev/tech-finances-v2

## Problema

Planilhas ajudam no controle financeiro, mas ficam limitadas quando o objetivo e demonstrar habilidades reais de mercado: autenticacao, persistencia, validacao, seguranca, API REST, banco relacional e deploy.

## Solucao

A V2 transforma a experiencia em um produto web:

- Login e cadastro com JWT.
- Senhas criptografadas com bcrypt.
- 2FA opcional com TOTP e QR Code para apps autenticadores.
- PostgreSQL com Prisma.
- Dashboard financeiro calculado no back-end.
- Lancamentos protegidos por usuario.
- Orcamento 50-30-20 persistido por conta.
- Meta de reserva de emergencia.
- Exportacao `.xlsx` real com abas financeiras.
- Endpoint de recomendacao educativa local, gratuito e com resumo anonimo.

## Prints

### Landing page

![Landing page do TechFinances](docs/screenshots/landing.png)

### Dashboard autenticado

![Dashboard financeiro autenticado](docs/screenshots/dashboard.png)

## Stack

- Front-end: HTML, CSS e JavaScript puro.
- Back-end: Node.js, Express, Zod, JWT, bcrypt.
- Banco: PostgreSQL + Prisma.
- Excel: exceljs.
- Deploy: Render + PostgreSQL gerenciado.

## GitHub Topics

Sugestao de topicos para configurar no repositorio:

```txt
nodejs
express
prisma
postgresql
javascript
finance
dashboard
jwt
portfolio
fullstack
```

## Estrutura

```text
frontend/
  index.html
  assets/
    styles.css
    app.js
backend/
  src/
    routes/
    services/
    middleware/
  prisma/
    schema.prisma
database/
  README.md
```

A aplicacao V2 esta em `frontend/` e tambem e servida pelo Express.

## Como rodar

1. Instale as dependencias:

```bash
npm run install:all
```

2. Configure o ambiente:

```bash
copy backend\.env.example backend\.env
```

3. Ajuste `DATABASE_URL` e `JWT_SECRET` no `backend/.env`.

Para desenvolvimento local, uma URL comum fica assim:

```txt
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/techfinances?schema=public"
```

Em producao, use a URL do provedor de PostgreSQL e gere um `JWT_SECRET` forte. O arquivo `backend/.env` nao deve ser enviado para o GitHub.

Observacao: se `NODE_ENV=production`, a API exige `JWT_SECRET` configurado e nao usa segredo padrao de desenvolvimento.

4. Suba um PostgreSQL local e confira `DATABASE_URL` no `backend/.env`.

No Windows deste projeto, voce tambem pode usar o PostgreSQL local instalado em `C:\Program Files\PostgreSQL\17`:

```bash
npm run db:start
npm run db:push
```

5. Se quiser usar migrations formais em vez de `db:push`, rode:

```bash
npm run prisma:migrate
```

6. Rode a API e o front-end:

```bash
npm run dev
```

Abra `http://localhost:3333`.

## Login demo

Depois de rodar o seed, use:

```txt
Email: demo@techfinances.dev
Senha: DemoSenha123
```

## Deploy

O projeto esta pronto para deploy como um unico servico Node, porque o Express serve a API e tambem os arquivos de `frontend/`.

### Render

1. Crie ou use um PostgreSQL gerenciado. Uma opcao gratuita comum e Neon. Se usar Neon, copie a connection string com `sslmode=require`.
2. No Render, crie um novo **Blueprint** apontando para este repositorio.
3. O arquivo `render.yaml` cria o Web Service `tech-finances-v2`.
4. Quando o Render pedir variaveis secretas, informe:

```txt
DATABASE_URL=sua_connection_string_postgresql
```

O `JWT_SECRET` sera gerado automaticamente pelo Render via `generateValue`.

Comandos usados no deploy:

```txt
Build: npm run render:build
Start: npm run deploy:start
```

O Prisma CLI fica em `dependencies` porque e necessario no ambiente de deploy para gerar o client e aplicar migrations. O start valida as variaveis de ambiente e executa `prisma migrate deploy` antes de iniciar a API, garantindo que o banco receba as migrations versionadas.

Se o deploy falhar, confira primeiro:

- `DATABASE_URL` foi preenchido no Render.
- A URL nao pode usar `localhost`; precisa ser a URL do PostgreSQL online.
- Em bancos como Neon, a URL geralmente termina com `?sslmode=require`.
- O banco precisa estar ativo antes do deploy rodar.
- Se aparecer `Deploy env error`, corrija a variavel indicada no painel do Render.

Depois do deploy, teste:

```txt
https://tech-finances-v2.onrender.com/api/health
```

## Testes automatizados

Para rodar os testes do back-end:

```bash
npm test
```

Esse comando sobe o PostgreSQL local, cria/sincroniza o banco `techfinances_test` e executa a suite com Vitest + Supertest.

Cobertura atual:

- cadastro com senha criptografada;
- login e bloqueio de senha errada;
- rotas protegidas sem JWT;
- listagem e revogacao de dispositivos confiaveis;
- filtro por mes/ano;
- isolamento de dados por usuario;
- exportacao Excel;
- relatorio PDF;
- recomendacao educativa local com payload anonimo.

## Endpoints

### Publicos

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/health`

### Protegidos por JWT

- `GET /api/transactions`
- `POST /api/transactions`
- `DELETE /api/transactions/:id`
- `GET /api/dashboard/summary`
- `GET /api/settings/budget`
- `PUT /api/settings/budget`
- `GET /api/goals/emergency`
- `PUT /api/goals/emergency`
- `GET /api/exports/excel`
- `GET /api/reports/monthly`
- `POST /api/ai/recommendation`
- `GET /api/auth/me`
- `GET /api/auth/trusted-devices`
- `DELETE /api/auth/trusted-devices`
- `POST /api/auth/2fa/setup`
- `POST /api/auth/2fa/enable`
- `POST /api/auth/2fa/disable`

### Filtro por mes/ano

As rotas de leitura financeira aceitam `month` e `year` por query string:

```bash
GET /api/dashboard/summary?month=5&year=2026
GET /api/transactions?month=5&year=2026
GET /api/exports/excel?month=5&year=2026
GET /api/reports/monthly?month=5&year=2026
POST /api/ai/recommendation?month=5&year=2026
```

Se o front-end nao enviar periodo, a API usa o mes e ano atuais.

## Custo das APIs

O projeto nao usa APIs externas pagas. Todas as rotas `/api/...` sao do proprio back-end Express do TechFinances.

Recursos gratuitos/local-first:

- Auth com JWT e bcrypt roda no seu back-end.
- 2FA usa bibliotecas open-source (`otplib` e `qrcode`).
- Dashboard e recomendacao educativa sao calculados localmente na API.
- Excel e gerado pelo back-end com `exceljs`.
- PDF mensal e gerado pelo back-end com resumo, diagnostico visual, barras de orcamento, top despesas e plano de acao.
- PostgreSQL pode rodar localmente gratis ou em provedor com plano gratuito.

## Seguranca

- `.env`, banco local, logs, `.tmp/` e `node_modules/` ficam fora do Git.
- Em producao, a API exige `JWT_SECRET` configurado.
- CORS fica restrito ao `FRONTEND_ORIGIN` configurado.
- Helmet aplica cabecalhos de seguranca e Content Security Policy.
- As rotas `/api` usam rate limit para reduzir abuso e brute force.
- Tokens de confirmacao de email e recuperacao de senha so aparecem fora de producao para facilitar testes locais.
- `npm audit --omit=dev` deve retornar `found 0 vulnerabilities` antes do deploy.

## Login seguro

O login usa bcrypt para senha, JWT para sessao, dispositivos confiaveis e 2FA opcional por TOTP. Quando o 2FA esta ativo, a API valida email e senha primeiro; se o acesso vier de um dispositivo ainda nao confiavel, ela pede o codigo de 6 digitos antes de entregar o JWT.

Fluxo do 2FA:

- O usuario logado chama `/api/auth/2fa/setup`.
- A API gera um segredo TOTP e um QR Code.
- O usuario escaneia o QR Code no app autenticador.
- O usuario confirma o codigo em `/api/auth/2fa/enable`.
- O dispositivo atual fica confiavel depois da ativacao.
- Nos proximos logins no mesmo dispositivo, o codigo nao aparece.
- Em outro navegador, celular ou computador, `/api/auth/login` retorna `requiresTwoFactor: true`.

## Privacidade da IA

O endpoint `/api/ai/recommendation` nao recebe nome, email, descricao de transacoes nem lista completa de lancamentos. O fluxo exige consentimento explicito (`consentToAnonymousAnalysis: true`) e monta o payload no back-end a partir do resumo financeiro do usuario autenticado.

O payload permitido contem somente:

- periodo analisado;
- totais agregados de receitas, despesas e saldo;
- percentuais de uso do orcamento;
- progresso da reserva;
- score/rotulo de saude financeira;
- perfil, prazo e aporte informados pelo usuario.

Essa V2 nao chama OpenAI nem outra API paga. A recomendacao e educativa, local e baseada em regras do proprio projeto.

Campos bloqueados: nome, email, descricoes, lista de transacoes, ids de transacoes, `userId`, categorias detalhadas e dados bancarios brutos. A resposta inclui `privacyAudit`, com hash do resumo, confirmacao de que nenhuma API externa foi chamada e se algum dado sensivel foi detectado.

## Diferenca para o MVP inicial

Antes, o JavaScript salvava tudo no `localStorage`, bom para estudo visual. Agora, a aplicacao mostra habilidades mais valorizadas em vagas:

- Separacao front-end/back-end.
- Autenticacao.
- Banco relacional.
- Validacao de entrada.
- Controle de acesso por usuario.
- Exportacao real em Excel.
- Relatorio mensal em PDF com resumo, diagnostico visual, orcamento, categorias, plano de acao para o proximo mes e lancamentos.
- Pensamento de privacidade em IA.

## Proximos passos

- Adicionar refresh token.
- Adicionar importacao CSV.
- Conectar provedor externo de IA somente se houver decisao futura clara sobre custo, privacidade e termos de uso.
- Publicar prints e link de deploy no README.

## Licenca

Este projeto esta sob a licenca MIT. Consulte o arquivo [LICENSE](LICENSE).
