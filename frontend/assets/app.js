const API_BASE = "/api";
const TOKEN_KEY = "techfinances_v2_token";
const USER_KEY = "techfinances_v2_user";
const DEVICE_KEY = "techfinances_v2_device_id";
const THEME_KEY = "techfinances_theme";

const expenseCategories = [
  { name: "Moradia", group: "essencial" },
  { name: "Alimentacao", group: "essencial" },
  { name: "Transporte", group: "essencial" },
  { name: "Saude", group: "essencial" },
  { name: "Lazer", group: "variavel" },
  { name: "Educacao", group: "variavel" },
  { name: "Outros", group: "variavel" },
  { name: "Reserva/Investimento", group: "prioridade" }
];
const incomeCategories = ["Salario", "Freelancer", "Bonus", "Rendimento", "Outros"];
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

let token = localStorage.getItem(TOKEN_KEY);
let currentUser = JSON.parse(localStorage.getItem(USER_KEY) || "null");
let authMode = "login";
let state = {
  transactions: [],
  summary: null,
  user: currentUser,
  trustedDevices: [],
  categories: {
    income: incomeCategories.map((name) => ({ name, type: "income", group: "receita", isDefault: true })),
    expense: expenseCategories.map((item) => ({ ...item, type: "expense", isDefault: true }))
  },
  period: getCurrentPeriod(),
  resetPasswordToken: new URLSearchParams(window.location.search).get("resetPasswordToken"),
  verifyEmailToken: new URLSearchParams(window.location.search).get("verifyEmailToken")
};

const $ = (selector) => document.querySelector(selector);

function getOrCreateDeviceId() {
  const saved = localStorage.getItem(DEVICE_KEY);
  if (saved) return saved;

  const deviceId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(DEVICE_KEY, deviceId);
  return deviceId;
}

function initSplashScreen() {
  const splash = $("#splashScreen");
  if (!splash) return;

  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    window.setTimeout(() => splash.remove(), 650);
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 3000);
}

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", theme === "light" ? "#f7f8fb" : "#08090d");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Tema ainda funciona na sessao atual se o navegador bloquear armazenamento.
  }
  const isLight = theme === "light";
  const toggle = $("#themeToggle");
  const label = $("#themeToggleLabel");
  if (toggle) toggle.setAttribute("aria-pressed", String(isLight));
  if (label) label.textContent = isLight ? "Modo escuro" : "Modo claro";
  redrawCharts();
}

function initTheme() {
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
  } catch {
    savedTheme = null;
  }
  setTheme(savedTheme || document.documentElement.dataset.theme || "dark");
  $("#themeToggle")?.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentPeriod() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function getPeriodQuery() {
  return new URLSearchParams({
    month: String(state.period.month),
    year: String(state.period.year)
  }).toString();
}

function getDemoDateForSelectedPeriod() {
  const current = getCurrentPeriod();
  if (state.period.month === current.month && state.period.year === current.year) {
    return today();
  }

  return `${state.period.year}-${String(state.period.month).padStart(2, "0")}-15`;
}

function updatePeriodLabel(period = state.period) {
  const label = $("#periodLabel");
  if (!label) return;
  label.textContent = `${monthNames[period.month - 1]} de ${period.year}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(value) {
  return `${Math.round(value || 0)}%`;
}

function displayCategory(category) {
  const labels = {
    Alimentacao: "Alimenta&ccedil;&atilde;o",
    Saude: "Sa&uacute;de",
    Educacao: "Educa&ccedil;&atilde;o"
  };
  return labels[category] || category;
}

async function withBusy(button, loadingText, task) {
  const originalText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.dataset.busy = "true";
    button.textContent = loadingText;
  }

  try {
    return await task();
  } finally {
    if (button) {
      button.disabled = false;
      button.dataset.busy = "false";
      button.textContent = originalText;
    }
  }
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Device-Id": getOrCreateDeviceId(),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.blob();

  if (!response.ok) {
    throw new Error(data?.message || "Erro ao chamar a API.");
  }

  return data;
}

function setSession(session) {
  token = session.token;
  currentUser = session.user;
  state.user = session.user;
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

function clearSession() {
  token = null;
  currentUser = null;
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authTab === mode);
  });
  $("#nameField").classList.toggle("field-hidden", mode === "login");
  $("#twoFactorLoginField").classList.add("field-hidden");
  $("#twoFactorLoginCode").value = "";
  $("#authSubmitBtn").textContent = mode === "login" ? "Entrar" : "Criar conta";
  $("#passwordInput").autocomplete = mode === "login" ? "current-password" : "new-password";
}

function focusAuth(mode) {
  setAuthMode(mode);
  $("#authSection").scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    const target = mode === "register" ? $("#nameInput") : $("#emailInput");
    target.focus();
  }, 350);
}

function syncAuthView() {
  const isLogged = Boolean(token);
  $("#welcomeTemplate").classList.toggle("welcome-hidden", isLogged);
  $("#authSection").classList.toggle("app-hidden", isLogged);
  $("#appSection").classList.toggle("app-hidden", !isLogged);
  $("#logoutBtn").style.display = isLogged ? "inline-flex" : "none";
  syncSecurityView();
}

async function bootstrapApp() {
  syncAuthView();
  $("#dateInput").value = today();
  updateCategoryOptions();
  initPeriodControls();
  await handleAccountTokensFromUrl();

  if (token) {
    await refreshAll();
  } else {
    drawHeroChart(emptyTotals());
    drawCategoryChart({});
  }
}

async function refreshAll() {
  const query = getPeriodQuery();
  const [meResult, categoriesResult, transactionsResult, summary] = await Promise.all([
    api("/auth/me"),
    api("/categories"),
    api(`/transactions?${query}`),
    api(`/dashboard/summary?${query}`)
  ]);

  currentUser = meResult.user;
  state.user = meResult.user;
  state.trustedDevices = meResult.trustedDevices || [];
  state.categories = categoriesResult.categories;
  localStorage.setItem(USER_KEY, JSON.stringify(meResult.user));
  state.transactions = transactionsResult.transactions;
  state.summary = summary;
  syncSecurityView();
  renderCategories();
  updateCategoryOptions();
  renderSummary(summary);
  renderTransactions();
}

function initPeriodControls() {
  const monthSelect = $("#periodMonth");
  const yearSelect = $("#periodYear");
  if (!monthSelect || !yearSelect) return;

  monthSelect.innerHTML = monthNames
    .map((name, index) => `<option value="${index + 1}">${name}</option>`)
    .join("");

  const currentYear = getCurrentPeriod().year;
  const years = [];
  for (let year = currentYear - 5; year <= currentYear + 1; year += 1) {
    years.push(year);
  }
  if (!years.includes(state.period.year)) years.push(state.period.year);
  years.sort((a, b) => b - a);

  yearSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  monthSelect.value = String(state.period.month);
  yearSelect.value = String(state.period.year);
  updatePeriodLabel();
}

async function applySelectedPeriod() {
  state.period = {
    month: Number($("#periodMonth").value),
    year: Number($("#periodYear").value)
  };
  updatePeriodLabel();
  await refreshAll();
  toast(`Per\u00edodo aplicado: ${monthNames[state.period.month - 1]} de ${state.period.year}.`);
}

function syncSecurityView() {
  const enabled = Boolean(state.user?.twoFactorEnabled);
  const status = $("#twoFactorStatus");
  if (!status) return;

  renderProfile();
  renderTrustedDevices();
  renderOnboarding();
  status.textContent = enabled ? "2FA ativo" : "2FA inativo";
  $("#setupTwoFactorBtn").textContent = enabled ? "Reconfigurar 2FA" : "Configurar 2FA";
  $("#twoFactorDisablePanel").classList.toggle("field-hidden", !enabled);
}

function renderProfile() {
  if (!state.user) return;

  $("#profileName").textContent = state.user.name || "-";
  $("#profileEmail").textContent = state.user.email || "-";
  $("#profileAvatar").textContent = getInitials(state.user.name || state.user.email || "TF");
  $("#profileNameInput").value = state.user.name || "";
  $("#profileEmailInput").value = state.user.email || "";
}

function renderOnboarding() {
  if (!state.user) return;

  const hasTransactions = state.transactions.length > 0;
  $("#emailVerifiedStatus").textContent = state.user.emailVerified ? "Email confirmado" : "Email pendente";
  $("#resendVerificationBtn").classList.toggle("field-hidden", state.user.emailVerified);
  setCheck("#checkEmail", state.user.emailVerified);
  setCheck("#checkTwoFactor", state.user.twoFactorEnabled);
  setCheck("#checkTransactions", hasTransactions);
}

function setCheck(selector, done) {
  const item = $(selector);
  if (!item) return;
  item.classList.toggle("done", Boolean(done));
}

async function handleAccountTokensFromUrl() {
  if (state.verifyEmailToken) {
    try {
      const result = await api("/auth/email-verification/confirm", {
        method: "POST",
        body: JSON.stringify({ token: state.verifyEmailToken })
      });
      if (result.user && state.user?.id === result.user.id) {
        state.user = result.user;
        currentUser = result.user;
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      }
      toast(result.message);
      clearUrlAccountTokens();
    } catch (error) {
      toast(error.message);
    }
  }

  if (state.resetPasswordToken) {
    $("#resetPasswordPanel")?.classList.remove("field-hidden");
    $("#authSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast("Informe a nova senha para concluir a recupera\u00e7\u00e3o.");
  }
}

function clearUrlAccountTokens() {
  state.verifyEmailToken = null;
  const url = new URL(window.location.href);
  url.searchParams.delete("verifyEmailToken");
  window.history.replaceState({}, "", url);
}

function showDevLink(selector, label, link) {
  const el = $(selector);
  if (!el) return;
  el.classList.remove("field-hidden");
  el.innerHTML = `${label}: <a href="${link}">${link}</a>`;
}

function renderTrustedDevices() {
  const list = $("#trustedDevicesList");
  if (!list) return;

  const devices = state.trustedDevices || [];
  if (!devices.length) {
    list.innerHTML = `<p class="muted">Nenhum dispositivo confi&aacute;vel encontrado.</p>`;
    return;
  }

  list.innerHTML = devices
    .map((device) => `
      <div class="trusted-device">
        <div>
          <strong>${escapeHtml(device.label)}</strong>
          <span>Confi&aacute;vel desde ${formatDateTime(device.trustedAt)} | &Uacute;ltimo uso ${formatDateTime(device.lastUsedAt)}</span>
        </div>
        ${device.current ? `<span class="tag info">Atual</span>` : `<span class="tag">Confi&aacute;vel</span>`}
      </div>
    `)
    .join("");
}

function getInitials(text) {
  return String(text)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "TF";
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function renderSummary(summary) {
  const totals = summary.totals;
  const health = summary.health;
  if (summary.period) {
    updatePeriodLabel(summary.period);
  }

  $("#totalIncome").textContent = money(totals.income);
  $("#totalExpense").textContent = money(totals.expense);
  $("#netBalance").textContent = money(totals.balance);
  $("#heroBalance").textContent = money(totals.balance);
  $("#healthScore").textContent = pct(health.score);
  $("#healthMessage").textContent = health.message;
  $("#healthTag").textContent = health.label;

  $("#miniNeeds").textContent = money(totals.needsLimit);
  $("#miniWants").textContent = money(totals.wantsLimit);
  $("#miniFuture").textContent = money(totals.futureLimit);

  $("#salaryInput").value = totals.salary;
  $("#needsPct").value = Math.round((totals.needsLimit / Math.max(totals.salary, 1)) * 100);
  $("#wantsPct").value = Math.round((totals.wantsLimit / Math.max(totals.salary, 1)) * 100);
  $("#futurePct").value = Math.round((totals.futureLimit / Math.max(totals.salary, 1)) * 100);
  $("#emergencyMonths").value = summary.emergency.months;
  $("#emergencyCurrent").value = summary.emergency.current;

  setUsage("#needsUsageText", "#needsBar", totals.needsSpent, totals.needsLimit);
  setUsage("#wantsUsageText", "#wantsBar", totals.wantsSpent, totals.wantsLimit);
  setUsage("#futureUsageText", "#futureBar", totals.futureSpent, totals.futureLimit);
  setUsage("#emergencyText", "#emergencyBar", summary.emergency.current, summary.emergency.target);

  drawHeroChart(totals);
  drawCategoryChart(summary.categoryExpenses);
}

function setUsage(textSelector, barSelector, used, limit) {
  $(textSelector).textContent = `${money(used)} / ${money(limit)}`;
  const value = limit ? Math.min(140, (used / limit) * 100) : 0;
  const bar = $(barSelector);
  bar.style.width = `${Math.min(100, value)}%`;
  bar.classList.toggle("warn", value > 85 && value <= 100);
  bar.classList.toggle("danger", value > 100);
}

function renderTransactions() {
  const tbody = $("#transactionsBody");
  const filter = $("#filterType").value;
  const search = $("#searchInput").value.toLowerCase().trim();

  const list = state.transactions
    .filter((item) => filter === "all" || item.type === filter)
    .filter((item) => !search || `${item.category} ${item.description}`.toLowerCase().includes(search));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty"><strong>Nenhum lan&ccedil;amento encontrado.</strong><span>Cadastre um novo item ou ajuste os filtros de busca.</span></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((item) => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td><span class="tag ${item.type === "income" ? "income" : "expense"}">${item.type === "income" ? "Receita" : "Despesa"}</span></td>
      <td>${displayCategory(escapeHtml(item.category))}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${money(item.amount)}</td>
      <td><button class="delete-btn" type="button" data-delete-id="${item.id}">Excluir</button></td>
    </tr>
  `).join("");
}

function updateCategoryOptions() {
  const type = $("#typeInput").value;
  const options = (type === "income" ? state.categories.income : state.categories.expense)
    .map((item) => item.name);
  $("#categoryInput").innerHTML = options.map((item) => `<option value="${item}">${displayCategory(item)}</option>`).join("");
}

function renderCategories() {
  const list = $("#categoriesList");
  if (!list) return;

  const customCategories = [...state.categories.income, ...state.categories.expense].filter((item) => !item.isDefault);
  if (!customCategories.length) {
    list.innerHTML = `<p class="muted">Nenhuma categoria personalizada. As categorias padr&atilde;o j&aacute; est&atilde;o dispon&iacute;veis nos lan&ccedil;amentos.</p>`;
    return;
  }

  list.innerHTML = customCategories
    .map((category) => `
      <div class="category-item">
        <div>
          <strong>${displayCategory(escapeHtml(category.name))}</strong>
          <span>${category.type === "income" ? "Receita" : "Despesa"} | ${displayCategory(category.group)}</span>
        </div>
        <button class="delete-btn" type="button" data-category-delete-id="${category.id}">Excluir</button>
      </div>
    `)
    .join("");
}

function formatDate(date) {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function emptyTotals() {
  return {
    income: 0,
    expense: 0,
    balance: 0,
    needsSpent: 0,
    wantsSpent: 0,
    futureSpent: 0,
    needsLimit: 0,
    wantsLimit: 0,
    futureLimit: 0
  };
}

function redrawCharts() {
  if (!$("#heroChart") || !$("#categoryChart")) return;
  drawHeroChart(state.summary?.totals || emptyTotals());
  drawCategoryChart(state.summary?.categoryExpenses || {});
}

function drawHeroChart(totals) {
  const canvas = $("#heroChart");
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 360;
  const height = canvas.clientHeight || 190;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const values = [totals.needsSpent, totals.wantsSpent, totals.futureSpent];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const colors = [cssVar("--primary", "#8b5cf6"), cssVar("--primary-2", "#60a5fa"), cssVar("--accent", "#a78bfa")];
  const labels = ["Essenciais", "Vari\u00e1veis", "Reserva"];
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(46, Math.min(width, height) / 2 - 18);
  let start = -Math.PI / 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.lineWidth = 20;
  ctx.strokeStyle = cssVar("--chart-track", "rgba(255,255,255,.09)");
  ctx.stroke();

  values.forEach((value, index) => {
    if (value <= 0) return;
    const angle = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, start, start + angle);
    ctx.lineWidth = 20;
    ctx.strokeStyle = colors[index];
    ctx.lineCap = "round";
    ctx.stroke();
    start += angle;
  });

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 20, 0, Math.PI * 2);
  ctx.fillStyle = cssVar("--chart-center", "rgba(255,255,255,.055)");
  ctx.fill();
  ctx.fillStyle = cssVar("--text", "#f7f7fb");
  ctx.font = "900 17px Inter, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("50-30-20", centerX, centerY - 4);
  ctx.fillStyle = cssVar("--muted", "#8b8d98");
  ctx.font = "700 12px Inter, system-ui";
  ctx.fillText("distribui\u00e7\u00e3o", centerX, centerY + 17);

  labels.forEach((label, i) => {
    ctx.fillStyle = colors[i];
    ctx.fillRect(12, 16 + i * 22, 9, 9);
    ctx.fillStyle = cssVar("--muted", "#8b8d98");
    ctx.font = "700 11px Inter, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(label, 28, 25 + i * 22);
  });
}

function drawCategoryChart(categoryExpenses) {
  const canvas = $("#categoryChart");
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 560;
  const height = 280;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const categories = state.categories.expense.map((item) => item.name);
  const values = categories.map((cat) => categoryExpenses[cat] || 0);
  const max = Math.max(...values, 1);
  const left = width < 430 ? 90 : 132;
  const right = width < 430 ? 52 : 76;
  const top = 20;
  const gap = 8;
  const rowHeight = Math.max(14, (height - top * 2 - gap * (categories.length - 1)) / categories.length);
  const chartWidth = Math.max(80, width - left - right);
  const muted = cssVar("--muted", "#8b8d98");
  const text = cssVar("--text", "#f7f7fb");
  const track = cssVar("--chart-track", "rgba(255,255,255,.09)");
  const grid = cssVar("--chart-grid", "rgba(255,255,255,.12)");
  const primary = cssVar("--primary", "#8b5cf6");
  const primary2 = cssVar("--primary-2", "#60a5fa");

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach((step) => {
    const x = left + chartWidth * step;
    ctx.beginPath();
    ctx.moveTo(x, top - 4);
    ctx.lineTo(x, height - top + 4);
    ctx.stroke();
  });

  categories.forEach((cat, index) => {
    const value = values[index];
    const y = top + index * (rowHeight + gap);
    const barWidth = (value / max) * chartWidth;
    const gradient = ctx.createLinearGradient(left, 0, left + chartWidth, 0);
    gradient.addColorStop(0, primary);
    gradient.addColorStop(1, primary2);

    ctx.fillStyle = muted;
    ctx.font = "800 11px Inter, system-ui";
    ctx.textAlign = "left";
    const label = displayCategory(cat).replace(/&ccedil;/g, "\u00e7").replace(/&atilde;/g, "\u00e3").replace(/&uacute;/g, "\u00fa");
    ctx.fillText(label.slice(0, width < 430 ? 12 : 18), 0, y + rowHeight * .68);

    roundedRect(ctx, left, y, chartWidth, rowHeight, 6, track);
    if (value > 0) roundedRect(ctx, left, y, Math.max(5, barWidth), rowHeight, 6, gradient);

    if (value > 0) {
      ctx.fillStyle = text;
      ctx.font = "850 11px Inter, system-ui";
      ctx.textAlign = "right";
      ctx.fillText(money(value).replace("R$", "").trim(), width - 4, y + rowHeight * .68);
    }
  });

  if (values.every((v) => v === 0)) {
    ctx.fillStyle = muted;
    ctx.font = "800 14px Inter, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Cadastre despesas para visualizar o gr\u00e1fico", width / 2, height / 2);
  }
}

function roundedRect(ctx, x, y, w, h, r, fillStyle) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initEvents() {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      setAuthMode(button.dataset.authTab);
    });
  });

  setAuthMode("login");

  $("#startRegisterBtn").addEventListener("click", () => focusAuth("register"));
  $("#startLoginBtn").addEventListener("click", () => focusAuth("login"));

  $("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = {
        email: $("#emailInput").value.trim(),
        password: $("#passwordInput").value
      };

      if (authMode === "register") {
        payload.name = $("#nameInput").value.trim();
      }

      if (!$("#twoFactorLoginField").classList.contains("field-hidden")) {
        payload.twoFactorCode = $("#twoFactorLoginCode").value.trim();
      }

      const session = await api(authMode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (session.requiresTwoFactor) {
        $("#twoFactorLoginField").classList.remove("field-hidden");
        $("#twoFactorLoginCode").focus();
        $("#authSubmitBtn").textContent = "Validar codigo";
        toast("Digite o c\u00f3digo 2FA para concluir o login.");
        return;
      }

      setSession(session);
      if (session.emailVerification?.link) {
        showDevLink("#accountActionLink", "Link de confirma&ccedil;&atilde;o", session.emailVerification.link);
      }
      toast(authMode === "login" ? "Login realizado." : "Conta criada.");
      syncAuthView();
      await refreshAll();
    } catch (error) {
      toast(error.message);
    }
  });

  $("#logoutBtn").addEventListener("click", () => {
    clearSession();
    syncAuthView();
    setAuthMode("login");
    toast("Voc\u00ea saiu da conta.");
  });

  $("#forgotPasswordBtn").addEventListener("click", () => {
    $("#forgotPasswordPanel").classList.toggle("field-hidden");
    $("#forgotEmailInput").value = $("#emailInput").value.trim();
  });

  $("#requestPasswordResetBtn").addEventListener("click", async (event) => {
    try {
      await withBusy(event.currentTarget, "Gerando...", async () => {
        const result = await api("/auth/password/forgot", {
          method: "POST",
          body: JSON.stringify({ email: $("#forgotEmailInput").value.trim() })
        });
        if (result.passwordReset?.link) {
          showDevLink("#accountActionLink", "Link de recupera&ccedil;&atilde;o", result.passwordReset.link);
        }
        toast(result.message);
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#resetPasswordBtn").addEventListener("click", async (event) => {
    try {
      await withBusy(event.currentTarget, "Redefinindo...", async () => {
        const result = await api("/auth/password/reset", {
          method: "POST",
          body: JSON.stringify({
            token: state.resetPasswordToken,
            password: $("#resetPasswordInput").value
          })
        });
        clearSession();
        syncAuthView();
        setAuthMode("login");
        const url = new URL(window.location.href);
        url.searchParams.delete("resetPasswordToken");
        window.history.replaceState({}, "", url);
        state.resetPasswordToken = null;
        $("#resetPasswordPanel").classList.add("field-hidden");
        toast(result.message);
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#setupTwoFactorBtn").addEventListener("click", async () => {
    try {
      const setup = await api("/auth/2fa/setup", { method: "POST" });
      $("#twoFactorQrCode").src = setup.qrCodeDataUrl;
      $("#twoFactorManualKey").textContent = setup.manualKey;
      $("#twoFactorEnableCode").value = "";
      $("#twoFactorSetupPanel").classList.remove("field-hidden");
      toast("Escaneie o QR Code e confirme o c\u00f3digo.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#enableTwoFactorBtn").addEventListener("click", async () => {
    try {
      const result = await api("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: $("#twoFactorEnableCode").value.trim() })
      });
      currentUser = result.user;
      state.user = result.user;
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      $("#twoFactorSetupPanel").classList.add("field-hidden");
      await refreshAll();
      toast(result.message);
    } catch (error) {
      toast(error.message);
    }
  });

  $("#disableTwoFactorBtn").addEventListener("click", async () => {
    try {
      const result = await api("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({
          password: $("#twoFactorDisablePassword").value,
          code: $("#twoFactorDisableCode").value.trim()
        })
      });
      currentUser = result.user;
      state.user = result.user;
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      $("#twoFactorDisablePassword").value = "";
      $("#twoFactorDisableCode").value = "";
      await refreshAll();
      toast(result.message);
    } catch (error) {
      toast(error.message);
    }
  });

  $("#revokeDevicesBtn").addEventListener("click", async () => {
    try {
      const result = await api("/auth/trusted-devices", { method: "DELETE" });
      state.trustedDevices = result.trustedDevices || [];
      renderTrustedDevices();
      toast(result.message);
    } catch (error) {
      toast(error.message);
    }
  });

  $("#categoryTypeInput").addEventListener("change", () => {
    const isIncome = $("#categoryTypeInput").value === "income";
    $("#categoryGroupInput").disabled = isIncome;
    $("#categoryGroupInput").value = isIncome ? "variavel" : $("#categoryGroupInput").value;
  });

  $("#categoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    try {
      await withBusy(button, "Criando...", async () => {
        const type = $("#categoryTypeInput").value;
        const payload = {
          name: $("#categoryNameInput").value.trim(),
          type,
          group: type === "income" ? undefined : $("#categoryGroupInput").value
        };
        const result = await api("/categories", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        state.categories = result.categories;
        $("#categoryNameInput").value = "";
        renderCategories();
        updateCategoryOptions();
        redrawCharts();
        toast("Categoria criada.");
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#categoriesList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-category-delete-id]");
    if (!button) return;

    try {
      await api(`/categories/${button.dataset.categoryDeleteId}`, { method: "DELETE" });
      const result = await api("/categories");
      state.categories = result.categories;
      renderCategories();
      updateCategoryOptions();
      redrawCharts();
      toast("Categoria removida.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#saveProfileBtn").addEventListener("click", async (event) => {
    try {
      await withBusy(event.currentTarget, "Salvando...", async () => {
        const result = await api("/auth/profile", {
          method: "PUT",
          body: JSON.stringify({
            name: $("#profileNameInput").value.trim(),
            email: $("#profileEmailInput").value.trim()
          })
        });
        currentUser = result.user;
        state.user = result.user;
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        renderProfile();
        renderOnboarding();
        if (result.emailVerification?.link) {
          showDevLink("#emailVerificationLink", "Link de confirma&ccedil;&atilde;o", result.emailVerification.link);
        }
        toast(result.message);
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#resendVerificationBtn").addEventListener("click", async (event) => {
    try {
      await withBusy(event.currentTarget, "Gerando...", async () => {
        const result = await api("/auth/email-verification/resend", { method: "POST" });
        if (result.user) {
          currentUser = result.user;
          state.user = result.user;
          localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        }
        if (result.emailVerification?.link) {
          showDevLink("#emailVerificationLink", "Link de confirma&ccedil;&atilde;o", result.emailVerification.link);
        }
        renderOnboarding();
        toast(result.message);
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#typeInput").addEventListener("change", updateCategoryOptions);

  $("#transactionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    try {
      await withBusy(button, "Salvando...", async () => {
        await api("/transactions", {
          method: "POST",
          body: JSON.stringify({
            type: $("#typeInput").value,
            date: $("#dateInput").value,
            category: $("#categoryInput").value,
            description: $("#descriptionInput").value.trim(),
            amount: Number($("#amountInput").value)
          })
        });
        event.target.reset();
        $("#dateInput").value = today();
        updateCategoryOptions();
        toast("Lan\u00e7amento salvo na API.");
        await refreshAll();
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#transactionsBody").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (!button) return;

    try {
      await api(`/transactions/${button.dataset.deleteId}`, { method: "DELETE" });
      toast("Lan\u00e7amento removido.");
      await refreshAll();
    } catch (error) {
      toast(error.message);
    }
  });

  $("#saveConfigBtn").addEventListener("click", async (event) => {
    try {
      await withBusy(event.currentTarget, "Salvando...", async () => {
        await api("/settings/budget", {
          method: "PUT",
          body: JSON.stringify({
            salary: Number($("#salaryInput").value || 0),
            needsPct: Number($("#needsPct").value || 0),
            wantsPct: Number($("#wantsPct").value || 0),
            futurePct: Number($("#futurePct").value || 0)
          })
        });
        toast("Or\u00e7amento salvo no banco.");
        await refreshAll();
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#saveGoalBtn").addEventListener("click", async (event) => {
    try {
      await withBusy(event.currentTarget, "Atualizando...", async () => {
        await api("/goals/emergency", {
          method: "PUT",
          body: JSON.stringify({
            months: Number($("#emergencyMonths").value || 6),
            current: Number($("#emergencyCurrent").value || 0)
          })
        });
        toast("Meta salva no banco.");
        await refreshAll();
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#applyPeriodBtn").addEventListener("click", async (event) => {
    try {
      await withBusy(event.currentTarget, "Aplicando...", applySelectedPeriod);
    } catch (error) {
      toast(error.message);
    }
  });

  $("#generateRecommendationBtn").addEventListener("click", async (event) => {
    try {
      if (!$("#aiConsentInput").checked) {
        toast("Marque o consentimento para usar apenas o resumo anonimo.");
        return;
      }

      await withBusy(event.currentTarget, "Gerando...", async () => {
        const data = await api(`/ai/recommendation?${getPeriodQuery()}`, {
          method: "POST",
          body: JSON.stringify({
            investorProfile: $("#riskProfile").value,
            goalHorizon: $("#goalHorizon").value,
            monthlyContribution: Number($("#monthlyContribution").value || 0),
            consentToAnonymousAnalysis: $("#aiConsentInput").checked
          })
        });
        renderRecommendation(data.recommendation, data.anonymizedPayload, data.privacyAudit);
        toast("Recomenda\u00e7\u00e3o gerada com dados an\u00f4nimos.");
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#exportExcelBtn").addEventListener("click", async (event) => {
    try {
      await withBusy(event.currentTarget, "Exportando...", async () => {
        const blob = await api(`/exports/excel?${getPeriodQuery()}`, {
          method: "GET",
          headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `techfinances_${state.period.year}_${String(state.period.month).padStart(2, "0")}.xlsx`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast("Excel do per\u00edodo gerado pela API.");
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#exportPdfBtn").addEventListener("click", async (event) => {
    try {
      await withBusy(event.currentTarget, "Gerando...", async () => {
        const blob = await api(`/reports/monthly?${getPeriodQuery()}`, {
          method: "GET",
          headers: { Accept: "application/pdf" }
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `techfinances_relatorio_${state.period.year}_${String(state.period.month).padStart(2, "0")}.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast("Relat\u00f3rio PDF do per\u00edodo gerado.");
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#exportPdfBtnConsole")?.addEventListener("click", () => {
    $("#exportPdfBtn").click();
  });

  $("#demoBtn").addEventListener("click", async (event) => {
    const demoDate = getDemoDateForSelectedPeriod();
    const demo = [
      { type: "income", date: demoDate, category: "Salario", description: "Salario liquido mensal", amount: 2500 },
      { type: "expense", date: demoDate, category: "Moradia", description: "Ajuda em casa / aluguel", amount: 650 },
      { type: "expense", date: demoDate, category: "Alimentacao", description: "Mercado e refeicoes", amount: 420 },
      { type: "expense", date: demoDate, category: "Transporte", description: "Onibus, app e deslocamento", amount: 220 },
      { type: "expense", date: demoDate, category: "Educacao", description: "Curso, livros e materiais", amount: 180 },
      { type: "expense", date: demoDate, category: "Lazer", description: "Saidas e assinaturas", amount: 160 },
      { type: "expense", date: demoDate, category: "Reserva/Investimento", description: "Aporte para reserva", amount: 300 }
    ];

    try {
      await withBusy(event.currentTarget, "Criando...", async () => {
        for (const transaction of demo) {
          await api("/transactions", { method: "POST", body: JSON.stringify(transaction) });
        }
        toast("Exemplo salvo no per\u00edodo selecionado.");
        await refreshAll();
      });
    } catch (error) {
      toast(error.message);
    }
  });

  $("#filterType").addEventListener("change", renderTransactions);
  $("#searchInput").addEventListener("input", renderTransactions);
  $("#globalSearchInput")?.addEventListener("input", (event) => {
    $("#searchInput").value = event.target.value;
    renderTransactions();
  });
  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#globalSearchInput")?.focus();
    }
  });
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(redrawCharts);
  });
}

function renderRecommendation(recommendation, anonymizedPayload, privacyAudit) {
  $("#recommendationBox").innerHTML = `
    <span class="tag info">Resumo an&ocirc;nimo</span>
    <p><strong>Perfil:</strong> ${escapeHtml(recommendation.profile)} | <strong>Prazo:</strong> ${escapeHtml(recommendation.horizon)}</p>
    <p>${escapeHtml(recommendation.balanceAdvice)}</p>
    <p>${escapeHtml(recommendation.contributionAdvice)}</p>
    <p><strong>Tipos para estudar:</strong></p>
    <ul>${recommendation.studyOptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p><strong>Privacidade:</strong> ${escapeHtml(recommendation.privacy)}</p>
    <p><strong>Payload enviado:</strong> saldo ${money(anonymizedPayload.totals.balance)}, sa&uacute;de ${anonymizedPayload.financialHealth?.score ?? anonymizedPayload.health?.score ?? 0}%, aporte ${money(anonymizedPayload.monthlyContribution)}.</p>
    <div class="privacy-audit">
      <div><span>Modo</span><strong>${escapeHtml(privacyAudit?.mode || "local-free")}</strong></div>
      <div><span>API externa</span><strong>${privacyAudit?.externalProviderCalled ? "Sim" : "N&atilde;o"}</strong></div>
      <div><span>PII detectado</span><strong>${privacyAudit?.piiDetected ? "Sim" : "N&atilde;o"}</strong></div>
      <div><span>Hash do resumo</span><strong>${escapeHtml(privacyAudit?.payloadHash || "-")}</strong></div>
    </div>
    <p>${escapeHtml(recommendation.disclaimer)}</p>
  `;
}

initTheme();
initSplashScreen();
initEvents();
bootstrapApp().catch((error) => {
  clearSession();
  syncAuthView();
  toast(error.message);
});
