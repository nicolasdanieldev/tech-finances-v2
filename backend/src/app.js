import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "node:url";
import { aiRoutes } from "./routes/aiRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { config } from "./config.js";
import { dashboardRoutes } from "./routes/dashboardRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { exportRoutes } from "./routes/exportRoutes.js";
import { categoryRoutes } from "./routes/categoryRoutes.js";
import { goalRoutes } from "./routes/goalRoutes.js";
import { requireAuth } from "./middleware/auth.js";
import { reportRoutes } from "./routes/reportRoutes.js";
import { settingsRoutes } from "./routes/settingsRoutes.js";
import { transactionRoutes } from "./routes/transactionRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../../frontend");

export const app = express();

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:"],
      "connect-src": ["'self'", ...config.frontendOrigins],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
      "upgrade-insecure-requests": config.isProduction ? [] : null
    }
  }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.frontendOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origem nao permitida pelo CORS."));
  }
}));
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}
app.use(express.static(frontendPath));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "TechFinances API" });
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/categories", requireAuth, categoryRoutes);
app.use("/api/transactions", requireAuth, transactionRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);
app.use("/api/goals", requireAuth, goalRoutes);
app.use("/api/exports", requireAuth, exportRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use("/api/ai", requireAuth, aiRoutes);

app.get("*splat", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.use(errorHandler);
