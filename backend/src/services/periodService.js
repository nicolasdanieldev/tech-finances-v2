import { z } from "zod";

const periodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional()
});

export function parsePeriod(query) {
  const now = new Date();
  const parsed = periodSchema.parse(query);
  const month = parsed.month || now.getMonth() + 1;
  const year = parsed.year || now.getFullYear();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return { month, year, start, end };
}

export function buildPeriodWhere(period) {
  return {
    gte: period.start,
    lt: period.end
  };
}
