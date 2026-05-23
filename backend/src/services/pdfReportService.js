import PDFDocument from "pdfkit";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

const palette = {
  ink: "#111827",
  muted: "#64748b",
  line: "#d8e0ea",
  soft: "#f8fafc",
  header: "#0f172a",
  green: "#166534",
  greenSoft: "#dcfce7",
  blueSoft: "#dbeafe",
  danger: "#b91c1c"
};

export function buildMonthlyReportPdf({ user, transactions, summary, period }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true, autoFirstPage: true });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

  addHeader(doc, user, period);
  addMetricCards(doc, summary);
  addBudget(doc, summary);
  addVisualDiagnosis(doc, summary);
  addCategoryBreakdown(doc, summary.categoryExpenses);
  addActionPlan(doc, summary);
  addTransactions(doc, transactions);
    addFooter(doc);

    doc.end();
  });
}

function addHeader(doc, user, period) {
  const pageWidth = contentWidth(doc);
  const periodLabel = `${monthNames[period.month - 1]} de ${period.year}`;

  doc
    .roundedRect(doc.page.margins.left, doc.y, pageWidth, 92, 10)
    .fill(palette.header);

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("TechFinances", doc.page.margins.left, doc.y + 18, { width: pageWidth, align: "center" });

  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#cbd5e1")
    .text("Relatorio mensal financeiro", { width: pageWidth, align: "center" })
    .moveDown(0.25)
    .text(`${safeText(user.name)} | ${periodLabel}`, { width: pageWidth, align: "center" });

  doc.y = 154;
}

function addMetricCards(doc, summary) {
  sectionTitle(doc, "Resumo do periodo");
  const cards = [
    ["Receitas", money(summary.totals.income), palette.green],
    ["Despesas", money(summary.totals.expense), summary.totals.expense > summary.totals.income ? palette.danger : palette.ink],
    ["Saldo", money(summary.totals.balance), summary.totals.balance < 0 ? palette.danger : palette.green],
    ["Saude", `${summary.health.score}%`, palette.ink]
  ];

  const gap = 8;
  const width = (contentWidth(doc) - gap * 3) / 4;
  const startX = doc.page.margins.left;
  const y = doc.y;

  cards.forEach(([label, value, color], index) => {
    const x = startX + index * (width + gap);
    doc.roundedRect(x, y, width, 62, 8).fillAndStroke("#ffffff", palette.line);
    doc.font("Helvetica").fontSize(8).fillColor(palette.muted).text(label.toUpperCase(), x + 10, y + 12, { width: width - 20, align: "center" });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(color).text(value, x + 10, y + 30, { width: width - 20, align: "center" });
  });

  doc.y = y + 78;
  note(doc, summary.health.message, { align: "center" });
}

function addBudget(doc, summary) {
  sectionTitle(doc, "Orcamento 50-30-20");
  const rows = [
    ["Grupo", "Usado", "Limite", "Uso"],
    ["Essenciais", money(summary.totals.needsSpent), money(summary.totals.needsLimit), usage(summary.totals.needsSpent, summary.totals.needsLimit)],
    ["Variaveis", money(summary.totals.wantsSpent), money(summary.totals.wantsLimit), usage(summary.totals.wantsSpent, summary.totals.wantsLimit)],
    ["Prioridades", money(summary.totals.futureSpent), money(summary.totals.futureLimit), usage(summary.totals.futureSpent, summary.totals.futureLimit)]
  ];

  table(doc, rows, [142, 112, 112, 82], { centered: true, header: true });
}

function addVisualDiagnosis(doc, summary) {
  sectionTitle(doc, "Diagnostico visual");
  ensureSpace(doc, 178);

  const gap = 14;
  const panelWidth = (contentWidth(doc) - gap) / 2;
  const panelHeight = 154;
  const startX = doc.page.margins.left;
  const y = doc.y;

  drawPanel(doc, startX, y, panelWidth, panelHeight, "Uso do orcamento");
  drawPanel(doc, startX + panelWidth + gap, y, panelWidth, panelHeight, "Top despesas");

  const budgetRows = [
    ["Essenciais", summary.totals.needsSpent, summary.totals.needsLimit, palette.green],
    ["Variaveis", summary.totals.wantsSpent, summary.totals.wantsLimit, "#2563eb"],
    ["Prioridades", summary.totals.futureSpent, summary.totals.futureLimit, "#4f46e5"]
  ];

  budgetRows.forEach(([label, spent, limit, color], index) => {
    const pct = percentNumber(spent, limit);
    drawHorizontalBar(doc, {
      x: startX + 14,
      y: y + 38 + index * 34,
      width: panelWidth - 28,
      label,
      value: `${Math.round(pct)}%`,
      progress: Math.min(100, pct),
      color
    });
  });

  const categoryRows = Object.entries(summary.categoryExpenses)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4);
  const maxCategoryAmount = Math.max(...categoryRows.map(([, amount]) => Number(amount)), 1);
  const categoryX = startX + panelWidth + gap;

  if (!categoryRows.length) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(palette.muted)
      .text("Sem despesas no periodo.", categoryX + 14, y + 62, { width: panelWidth - 28, align: "center" });
  } else {
    categoryRows.forEach(([category, amount], index) => {
      drawHorizontalBar(doc, {
        x: categoryX + 14,
        y: y + 34 + index * 28,
        width: panelWidth - 28,
        label: category,
        value: money(amount),
        progress: (Number(amount) / maxCategoryAmount) * 100,
        color: index === 0 ? palette.danger : "#2563eb"
      });
    });
  }

  doc.y = y + panelHeight + 16;
}

function addCategoryBreakdown(doc, categoryExpenses) {
  sectionTitle(doc, "Despesas por categoria");
  const rows = Object.entries(categoryExpenses)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([category, amount]) => [category, money(amount)]);

  if (!rows.length) {
    note(doc, "Nenhuma despesa cadastrada neste periodo.", { align: "center" });
    return;
  }

  table(doc, [["Categoria", "Valor"], ...rows], [270, 160], { centered: true, header: true });
}

function addActionPlan(doc, summary) {
  sectionTitle(doc, "Plano de acao para o proximo mes");
  const actions = buildActions(summary);
  const width = contentWidth(doc) - 44;
  const x = centeredX(doc, width);

  actions.forEach((item, index) => {
    ensureSpace(doc, 38);
    const y = doc.y;
    doc.roundedRect(x, y, width, 31, 7).fillAndStroke(index === 0 ? palette.greenSoft : palette.soft, palette.line);
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(palette.ink)
      .text(`${index + 1}. ${item}`, x + 12, y + 9, { width: width - 24, lineGap: 2 });
    doc.y = y + 38;
  });

  doc.moveDown(0.25);
}

function addTransactions(doc, transactions) {
  sectionTitle(doc, "Lancamentos do periodo");

  if (!transactions.length) {
    note(doc, "Nenhum lancamento encontrado no periodo selecionado.", { align: "center" });
    return;
  }

  const rows = transactions.slice(0, 20).map((item) => [
    formatDate(item.date),
    item.type === "income" ? "Receita" : "Despesa",
    item.category,
    money(item.amount)
  ]);

  table(doc, [["Data", "Tipo", "Categoria", "Valor"], ...rows], [82, 82, 210, 104], { centered: true, header: true });

  if (transactions.length > 20) {
    note(doc, `Mostrando 20 de ${transactions.length} lancamentos. Exporte o Excel para a lista completa.`, { align: "center" });
  }
}

function addFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor(palette.muted)
      .text(
        `TechFinances | Conteudo educativo, nao substitui consultoria financeira profissional | Pagina ${i + 1} de ${pages.count}`,
        doc.page.margins.left,
        doc.page.height - 34,
        { align: "center", width: contentWidth(doc) }
      );
  }
}

function drawPanel(doc, x, y, width, height, title) {
  doc.roundedRect(x, y, width, height, 8).fillAndStroke("#ffffff", palette.line);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(palette.ink)
    .text(title, x + 14, y + 13, { width: width - 28 });
}

function drawHorizontalBar(doc, { x, y, width, label, value, progress, color }) {
  const barY = y + 15;
  const barHeight = 8;
  const safeProgress = clamp(progress, 0, 100);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(palette.muted)
    .text(label, x, y, { width: width * 0.58, ellipsis: true });

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(palette.ink)
    .text(value, x + width * 0.58, y, { width: width * 0.42, align: "right", ellipsis: true });

  doc.roundedRect(x, barY, width, barHeight, 4).fill("#e5e7eb");
  doc.roundedRect(x, barY, Math.max(4, width * (safeProgress / 100)), barHeight, 4).fill(color);
}

function buildActions(summary) {
  const actions = [];

  if (summary.totals.balance < 0) {
    actions.push("Priorize recuperar saldo positivo antes de aumentar gastos variaveis.");
  } else {
    actions.push("Mantenha o saldo positivo e automatize uma parte para reserva ou investimentos.");
  }

  if (summary.totals.needsSpent > summary.totals.needsLimit) {
    actions.push("Revise despesas essenciais acima do limite e procure renegociar contas recorrentes.");
  }

  if (summary.totals.wantsSpent > summary.totals.wantsLimit) {
    actions.push("Reduza gastos variaveis no proximo mes para proteger o orcamento.");
  }

  if (summary.totals.futureSpent < summary.totals.futureLimit * 0.5) {
    actions.push("Planeje um aporte inicial no proximo mes para aproximar a reserva da meta mensal.");
  }

  actions.push("No fechamento do proximo mes, compare saldo, essenciais e variaveis com este relatorio.");
  return actions;
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 72);
  doc
    .moveDown(0.2)
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(palette.green)
    .text(title.toUpperCase(), doc.page.margins.left, doc.y, { width: contentWidth(doc), align: "center" });
  doc.moveDown(0.55);
}

function table(doc, rows, widths, options = {}) {
  const totalWidth = widths.reduce((total, width) => total + width, 0);
  let y = doc.y;

  rows.forEach((row, rowIndex) => {
    const rowHeight = 25;
    ensureSpace(doc, rowHeight + 8);
    y = doc.y;
    let x = options.centered ? centeredX(doc, totalWidth) : doc.page.margins.left;
    const isHeader = options.header && rowIndex === 0;

    row.forEach((cell, index) => {
      const align = index === row.length - 1 ? "right" : index === 0 ? "left" : "center";
      doc
        .rect(x, y, widths[index], rowHeight)
        .fillAndStroke(isHeader ? palette.greenSoft : rowIndex % 2 === 0 ? "#ffffff" : palette.soft, palette.line);
      doc
        .fillColor(isHeader ? palette.green : palette.ink)
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8.8)
        .text(String(cell), x + 7, y + 8, { width: widths[index] - 14, align, ellipsis: true });
      x += widths[index];
    });

    doc.y = y + rowHeight;
  });

  doc.moveDown(0.7);
}

function note(doc, text, options = {}) {
  ensureSpace(doc, 34);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(palette.muted)
    .text(text, doc.page.margins.left, doc.y, { width: contentWidth(doc), lineGap: 3, align: options.align || "left" });
  doc.moveDown(0.7);
}

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - 58) {
    doc.addPage();
  }
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function centeredX(doc, width) {
  return doc.page.margins.left + (contentWidth(doc) - width) / 2;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function usage(value, limit) {
  if (!limit) return "0%";
  return `${Math.round((Number(value || 0) / Number(limit || 0)) * 100)}%`;
}

function percentNumber(value, limit) {
  if (!limit) return 0;
  return (Number(value || 0) / Number(limit || 0)) * 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function formatDate(date) {
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function safeText(value) {
  return String(value || "Usuario");
}
