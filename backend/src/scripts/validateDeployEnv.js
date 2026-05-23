const required = ["DATABASE_URL", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  fail(`Variaveis obrigatorias ausentes no deploy: ${missing.join(", ")}.`);
}

const databaseUrl = process.env.DATABASE_URL;

if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  fail("DATABASE_URL precisa ser uma URL PostgreSQL valida, iniciando com postgresql:// ou postgres://.");
}

let parsedDatabaseUrl;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL nao pode ser interpretada como URL. Confira usuario, senha, host e database.");
}

if (["localhost", "127.0.0.1", "::1"].includes(parsedDatabaseUrl.hostname)) {
  fail("DATABASE_URL nao pode usar localhost no Render. Use a URL do PostgreSQL online.");
}

if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) {
  fail("JWT_SECRET em producao precisa ter pelo menos 32 caracteres.");
}

console.log("Deploy env OK.");

function fail(message) {
  console.error(`Deploy env error: ${message}`);
  process.exit(1);
}
