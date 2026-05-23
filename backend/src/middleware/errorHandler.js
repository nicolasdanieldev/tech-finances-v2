import { ZodError } from "zod";

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Dados invalidos.",
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    });
  }

  const status = error.status || 500;
  const message = status === 500 ? "Erro interno do servidor." : error.message;

  if (status === 500) {
    console.error(error);
  }

  return res.status(status).json({ message });
}
