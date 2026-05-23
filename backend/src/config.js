import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET || (isProduction ? null : "dev-secret-change-me");

if (!jwtSecret) {
  throw new Error("JWT_SECRET precisa ser definido em producao.");
}

export const config = {
  port: Number(process.env.PORT || 3333),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3333"
};
