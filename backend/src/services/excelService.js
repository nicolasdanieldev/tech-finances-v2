import ExcelJS from "exceljs";

const moneyFormat = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const percentFormat = "0%";

export async function buildFinanceWorkbook({ user, transactions, budget, summary, period }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TechFinances";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties = {
    title: "TechFinances - Exportacao financeira",
    subject: "Relatorio financeiro mensal",
    company: "TechFinances"
  };

  addSummarySheet(workbook, user, summary, period);
  addTransactionSheet(workbook, "Receitas", transactions.filter((item) => item.type === "income"), {
    title: "Receitas do periodo",
    tabColor: "FF166534"
  });
  addTransactionSheet(workbook, "Despesas", transactions.filter((item) => item.type === "expense"), {
    title: "Despesas do periodo",
    tabColor: "FFB91C1C"
  });
  addBudgetSheet(workbook, budget, summary);
  addInvestmentsSheet(workbook, transactions, summary);

  return workbook;
}

function addTransactionSheet(workbook, name, rows, options) {
  const sheet = workbook.addWorksheet(name, {
    properties: { tabColor: { argb: options.tabColor } },
    pageSetup: pageSetup()
  });

  addTitle(sheet, options.title, "A1:D1");
  sheet.columns = [
    { key: "date", width: 14 },
    { key: "category", width: 26 },
    { key: "description", width: 38 },
    { key: "amount", width: 18 }
  ];

  addHeaderRow(sheet, ["Data", "Categoria/Fonte", "Descricao", "Valor"]);
  rows.forEach((item) => {
    const row = sheet.addRow({
      date: item.date,
      category: item.category,
      description: item.description,
      amount: Number(item.amount)
    });
    row.getCell("date").numFmt = "dd/mm/yyyy";
    row.getCell("amount").numFmt = moneyFormat;
  });

  addTotalRow(sheet, "Total", "D");
  formatSheet(sheet, "D");
}

function addBudgetSheet(workbook, budget, summary) {
  const sheet = workbook.addWorksheet("Orcamento", {
    properties: { tabColor: { argb: "FF2563EB" } },
    pageSetup: pageSetup()
  });

  addTitle(sheet, "Orcamento 50-30-20", "A1:E1");
  sheet.columns = [
    { key: "group", width: 28 },
    { key: "pct", width: 16 },
    { key: "limit", width: 18 },
    { key: "used", width: 18 },
    { key: "status", width: 24 }
  ];

  addHeaderRow(sheet, ["Grupo", "Percentual", "Limite", "Usado", "Status"]);
  sheet.addRows([
    { group: "Essenciais", pct: budget.needsPct / 100, limit: summary.totals.needsLimit, used: summary.totals.needsSpent, status: status(summary.totals.needsSpent, summary.totals.needsLimit) },
    { group: "Variaveis", pct: budget.wantsPct / 100, limit: summary.totals.wantsLimit, used: summary.totals.wantsSpent, status: status(summary.totals.wantsSpent, summary.totals.wantsLimit) },
    { group: "Prioridades financeiras", pct: budget.futurePct / 100, limit: summary.totals.futureLimit, used: summary.totals.futureSpent, status: status(summary.totals.futureSpent, summary.totals.futureLimit) }
  ]);

  sheet.getColumn("pct").numFmt = percentFormat;
  sheet.getColumn("limit").numFmt = moneyFormat;
  sheet.getColumn("used").numFmt = moneyFormat;
  formatSheet(sheet, "D");
}

function addSummarySheet(workbook, user, summary, period) {
  const sheet = workbook.addWorksheet("Resumo", {
    properties: { tabColor: { argb: "FF0F172A" } },
    pageSetup: pageSetup()
  });

  addTitle(sheet, "Resumo financeiro TechFinances", "A1:D1");
  sheet.mergeCells("A3:D3");
  sheet.getCell("A3").value = `${user.name} | ${periodLabel(period)}`;
  sheet.getCell("A3").alignment = { horizontal: "center" };
  sheet.getCell("A3").font = { color: { argb: "FF475467" }, italic: true };

  sheet.columns = [
    { key: "metric", width: 30 },
    { key: "value", width: 24 },
    { key: "diagnosis", width: 32 },
    { key: "note", width: 42 }
  ];

  sheet.getRow(5).values = ["Indicador", "Valor", "Diagnostico", "Observacao"];
  styleHeaderRow(sheet.getRow(5));
  sheet.addRows([
    { metric: "Receitas", value: summary.totals.income, diagnosis: "Entrada total", note: "Soma das receitas do periodo." },
    { metric: "Despesas", value: summary.totals.expense, diagnosis: "Saida total", note: "Soma das despesas do periodo." },
    { metric: "Saldo", value: summary.totals.balance, diagnosis: summary.totals.balance >= 0 ? "Positivo" : "Negativo", note: "Receitas menos despesas." },
    { metric: "Saude financeira", value: `${summary.health.score}%`, diagnosis: summary.health.label, note: summary.health.message },
    { metric: "Meta de reserva", value: summary.emergency.target, diagnosis: `${Math.round(summary.emergency.progressPct)}% concluido`, note: "Baseada nos essenciais ou limite essencial." },
    { metric: "Reserva atual", value: summary.emergency.current, diagnosis: "Valor salvo", note: "Atualizado na tela de metas." }
  ]);

  ["B6", "B7", "B8", "B10", "B11"].forEach((cell) => {
    sheet.getCell(cell).numFmt = moneyFormat;
  });

  formatSheet(sheet, "B", 5);
}

function addInvestmentsSheet(workbook, transactions, summary) {
  const sheet = workbook.addWorksheet("Investimentos", {
    properties: { tabColor: { argb: "FF4F46E5" } },
    pageSetup: pageSetup()
  });
  const investmentRows = transactions.filter((item) => item.type === "expense" && item.category === "Reserva/Investimento");

  addTitle(sheet, "Investimentos e prioridades financeiras", "A1:D1");
  sheet.columns = [
    { key: "date", width: 14 },
    { key: "description", width: 40 },
    { key: "amount", width: 18 },
    { key: "note", width: 48 }
  ];

  addHeaderRow(sheet, ["Data", "Descricao", "Valor", "Observacao"]);
  investmentRows.forEach((item) => {
    const row = sheet.addRow({
      date: item.date,
      description: item.description,
      amount: Number(item.amount),
      note: "Aporte registrado como prioridade financeira."
    });
    row.getCell("date").numFmt = "dd/mm/yyyy";
    row.getCell("amount").numFmt = moneyFormat;
  });

  sheet.addRow({});
  const reference = sheet.addRow({
    description: "Referencia mensal 50-30-20",
    amount: summary.totals.futureLimit,
    note: "Valor esperado para reserva/investimentos no periodo."
  });
  reference.font = { bold: true };
  reference.getCell("amount").numFmt = moneyFormat;

  formatSheet(sheet, "C");
}

function addTitle(sheet, title, range) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(":")[0]);
  cell.value = title;
  cell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  sheet.getRow(1).height = 28;
  sheet.addRow({});
}

function addHeaderRow(sheet, headers) {
  const row = sheet.addRow(headers);
  styleHeaderRow(row);
}

function styleHeaderRow(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
  row.alignment = { horizontal: "center", vertical: "middle" };
  row.height = 22;
}

function addTotalRow(sheet, label, amountColumn) {
  const lastDataRow = sheet.lastRow.number;
  const totalRow = sheet.addRow({});
  totalRow.getCell(1).value = label;
  totalRow.getCell(amountColumn).value = lastDataRow >= 4 ? { formula: `SUM(${amountColumn}4:${amountColumn}${lastDataRow})` } : 0;
  totalRow.getCell(amountColumn).numFmt = moneyFormat;
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
}

function formatSheet(sheet, moneyColumn, headerRow = 3) {
  sheet.views = [{ state: "frozen", ySplit: headerRow }];
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: sheet.columnCount }
  };

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } }
      };
      cell.alignment = { vertical: "middle", horizontal: rowNumber <= headerRow ? "center" : "left", wrapText: true };
    });
  });

  if (moneyColumn) {
    sheet.getColumn(moneyColumn).alignment = { horizontal: "right", vertical: "middle" };
  }
}

function pageSetup() {
  return {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2
    }
  };
}

function status(value, limit) {
  if (!limit) return "Sem limite configurado";
  return Number(value || 0) <= Number(limit || 0) ? "Dentro do limite" : "Acima do limite";
}

function periodLabel(period) {
  if (!period) return "Periodo selecionado";
  return `${String(period.month).padStart(2, "0")}/${period.year}`;
}
