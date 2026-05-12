(function () {
  if (window.__stabilityRecoveryInitialized) {
    return;
  }
  window.__stabilityRecoveryInitialized = true;

  const RECORDS_KEY = "it_opex_records_v6";
  const LOCATION_DB_KEY = "it_opex_location_db_v3";
  const VIEW_IDS = {
    dashboard: "enterpriseDashboardView",
    planner: "plannerView",
    locationSummary: "locationSummaryView",
    unitBudget: "unitBudgetView",
    allocation: "allocationFixedView",
    utilization: "opexUtilizationView",
    reports: "reportsView"
  };

  const FIELD_DEFS = [
    { id: "coding", label: "Coding", key: "Coding", defaults: ["ITOPEX066", "ITOPEX205", "ITOPEX289"] },
    { id: "item", label: "Item", key: "Item", defaults: ["IMS", "Sify DC", "Enhancements (CRM)", "Complinity"] },
    { id: "subCategoryMapped", label: "Sub Category", key: "Sub Category (Mapped)", defaults: ["IT Cost - Support", "Communication - Connectivity", "IT Cost - License Subscription", "IT Cost - Consulting", "AMC - IT Software", "IT Cost - Consumables", "AMC - IT Equipment", "IT Cost - Managed Services & S/w implementation", "AMC - IT Infra"] },
    { id: "categoryIt", label: "Category_IT", key: "Category_IT", defaults: ["IT infra", "Emailing", "Data Center", "Outsourced IT Manpower (IMS)"] },
    { id: "subCategory", label: "Sub Category", key: "Sub Category", defaults: ["Existing renewal", "HRMS", "Support restructuring", "New project FY 26"] },
    { id: "newCategory", label: "New Category", key: "New Category", defaults: ["Existing renewal", "Annualized impact", "New project FY 26", "DR Upgradation"] },
    { id: "appCate", label: "App Cate.", key: "App Cate.", defaults: ["IMS", "Connectivity", "Emailing", "DC"] },
    { id: "cate3", label: "Cate.3", key: "Cate.3", defaults: ["Existing renewal", "Annualized Impact", "New Project"] },
    { id: "cate4", label: "Cate.4", key: "Cate.4", defaults: ["No Increment", "Projection", "Price Increase", "Tech Refresh"] },
    { id: "owner1", label: "Owner1", key: "Owner1", defaults: ["IT Infra", "Application", "Clinical", "Security"] },
    { id: "owner", label: "Owner", key: "Owner", defaults: ["Akshant", "Anil", "Rakesh", "Jatin"] },
    { id: "costCenter", label: "Cost Center / Department", key: "Cost Center / Department", defaults: ["30SUP020", "30SUP056", "30SUP066"] }
  ];

  const MAX_HOSPITAL_OPTIONS = ["Saket", "Max Smart", "Gurgaon", "Lajpat Nagar", "Panchsheel", "Patparganj", "Vaishali", "Noida", "Shalimar Bagh", "Mohali", "Dehradun", "Bathinda", "HO", "BLK", "Nanawati", "Nagpur", "Lucknow", "Dwarka", "Jaypee Noida"];

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function toNumber(value) {
    const cleaned = String(value == null ? "" : value).replace(/,/g, "").replace(/%/g, "").trim();
    if (!cleaned) {
      return 0;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function stamp() {
    return new Date().toLocaleString();
  }

  function ensureDashboardView() {
    if (document.getElementById(VIEW_IDS.dashboard)) {
      return document.getElementById(VIEW_IDS.dashboard);
    }
    const plannerView = document.getElementById(VIEW_IDS.planner);
    const dashboard = document.createElement("section");
    dashboard.id = VIEW_IDS.dashboard;
    dashboard.className = "md-dashboard-view";
    dashboard.innerHTML = `
      <div class="md-hero">
        <div>
          <div class="md-eyebrow">Enterprise Dashboard</div>
          <h2>MAXHEALTHCare IT OPEX Budget Dashboard</h2>
          <p>Live summary from saved website records.</p>
        </div>
      </div>
      <div class="md-kpi-grid">
        <div class="md-kpi-card md-kpi-blue"><span>Total Budget</span><strong id="srTotalBudget">0</strong></div>
        <div class="md-kpi-card md-kpi-sky"><span>Total Expense</span><strong id="srTotalExpense">0</strong></div>
        <div class="md-kpi-card md-kpi-indigo"><span>Total Records</span><strong id="srTotalRecords">0</strong></div>
        <div class="md-kpi-card md-kpi-teal"><span>Total Locations</span><strong id="srTotalLocations">0</strong></div>
      </div>
      <div class="md-card">
        <div class="md-card-head"><h3>Budget Snapshot</h3></div>
        <div class="md-table-wrap">
          <table class="md-table">
            <thead>
              <tr><th>Location</th><th>Budget</th><th>Expense</th><th>Rows</th></tr>
            </thead>
            <tbody id="srDashboardBody"></tbody>
          </table>
        </div>
      </div>
    `;
    if (plannerView && plannerView.parentElement) {
      plannerView.parentElement.insertBefore(dashboard, plannerView);
    } else {
      document.querySelector("main")?.appendChild(dashboard);
    }
    return dashboard;
  }

  function ensureSideMenu() {
    const navBody = document.querySelector(".side-nav-body") || document.querySelector(".side-nav");
    if (!navBody) {
      return;
    }
    const items = [
      { text: "Dashboard", view: "dashboard" },
      { text: "Budget Planner", view: "planner" },
      { text: "Location Summary", view: "locationSummary" },
      { text: "Unit Wise Budget", view: "unitBudget" },
      { text: "Allocation-Fixed and % wise", view: "allocation" },
      { text: "Opex Budget Utilization", view: "utilization" },
      { text: "Report", view: "reports" }
    ];
    items.forEach(function (item) {
      const exists = Array.from(navBody.querySelectorAll(".side-link, button, a")).some(function (node) {
        return normalizeText(node.textContent) === item.text;
      });
      if (!exists) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "side-link";
        button.dataset.recoveryView = item.view;
        button.textContent = item.text;
        navBody.appendChild(button);
      }
    });
  }

  function inferViewFromButton(button) {
    const explicit = button.getAttribute("data-recovery-view");
    if (explicit) {
      return explicit;
    }
    const text = normalizeText(button.textContent);
    if (/dashboard/i.test(text)) return "dashboard";
    if (/budget planner/i.test(text)) return "planner";
    if (/location summary/i.test(text)) return "locationSummary";
    if (/unit wise budget|unit budget/i.test(text)) return "unitBudget";
    if (/allocation/i.test(text)) return "allocation";
    if (/utilization/i.test(text)) return "utilization";
    if (/report|reports/i.test(text)) return "reports";
    return "";
  }

  function showView(viewKey) {
    ensureDashboardView();
    Object.keys(VIEW_IDS).forEach(function (key) {
      const node = document.getElementById(VIEW_IDS[key]);
      if (!node) {
        return;
      }
      const active = key === viewKey;
      node.style.display = active ? "block" : "none";
      node.hidden = !active;
    });

    document.querySelectorAll(".side-link, .side-nav button, .side-nav a").forEach(function (node) {
      const active = inferViewFromButton(node) === viewKey;
      node.classList.toggle("active", active);
    });
  }

  function bindSideMenu() {
    if (document.body.dataset.recoveryMenuBound) {
      return;
    }
    document.body.dataset.recoveryMenuBound = "1";
    document.body.addEventListener("click", function (event) {
      const target = event.target.closest(".side-link, .side-nav button, .side-nav a");
      if (!target) {
        return;
      }
      const viewKey = inferViewFromButton(target);
      if (!viewKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showView(viewKey);
    }, true);
  }

  function getRecords() {
    const rows = readJson(RECORDS_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function getLocationRows() {
    const rows = readJson(LOCATION_DB_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function getFieldOptions(def) {
    const options = new Set(def.defaults || []);
    getRecords().forEach(function (row) {
      const value = normalizeText(row[def.key]);
      if (value) {
        options.add(value);
      }
    });
    return Array.from(options);
  }

  function buildPlannerGrid() {
    const formGrid = document.getElementById("formGrid");
    if (!formGrid) {
      return;
    }
    formGrid.innerHTML = "";
    FIELD_DEFS.forEach(function (def) {
      const field = document.createElement("div");
      field.className = "field";
      const options = getFieldOptions(def);
      const listId = `${def.id}RecoveryList`;
      field.innerHTML = `
        <label for="${def.id}RecoveryInput">${def.label}</label>
        <input id="${def.id}RecoveryInput" class="num-input planner-recovery-input" type="text" list="${listId}" placeholder="Search ${def.label.toLowerCase()}">
        <datalist id="${listId}">
          ${options.map(function (option) { return `<option value="${option.replace(/"/g, "&quot;")}"></option>`; }).join("")}
        </datalist>
      `;
      formGrid.appendChild(field);
    });
  }

  function getPlannerFieldValue(def) {
    const input = document.getElementById(`${def.id}RecoveryInput`);
    return input ? normalizeText(input.value) : "";
  }

  function setPlannerFieldValue(def, value) {
    const input = document.getElementById(`${def.id}RecoveryInput`);
    if (input) {
      input.value = value || "";
    }
  }

  function clearPlannerFields() {
    FIELD_DEFS.forEach(function (def) {
      setPlannerFieldValue(def, "");
    });
  }

  function previousFinancialYear(fy) {
    const value = normalizeText(fy);
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return "";
    }
    const start = Number(match[1]) - 1;
    const end = String((Number(match[2]) + 99) % 100).padStart(2, "0");
    return `${start}-${end}`;
  }

  function ensureMaxHospitalOptions() {
    const select = document.getElementById("maxHospitalInput");
    if (!select || select.options.length > 3) {
      return;
    }
    MAX_HOSPITAL_OPTIONS.forEach(function (option) {
      const node = document.createElement("option");
      node.value = option;
      node.textContent = option;
      select.appendChild(node);
    });
  }

  function updateMetricLabels() {
    const fy = normalizeText(document.getElementById("financialYearInput")?.value);
    const location = normalizeText(document.getElementById("maxHospitalInput")?.value);
    const metricWrap = document.getElementById("metricWrap");
    const maxWrap = document.getElementById("maxHospitalIntFieldsWrap");
    const newAmcLabel = document.getElementById("newAmcFy26Label");
    const locLeLabel = document.getElementById("locLeLabel");
    const locCurrentLabel = document.getElementById("locFyCurrentLabel");
    const locLastLabel = document.getElementById("locFyLastLabel");
    const locPercentLabel = document.getElementById("locPercentLabel");
    const prevFy = previousFinancialYear(fy) || "Previous FY";

    if (!fy || !location) {
      if (metricWrap) metricWrap.classList.add("hidden-block");
      if (maxWrap) maxWrap.classList.add("hidden-block");
      if (newAmcLabel) newAmcLabel.textContent = "New AMC for FY";
      if (locLeLabel) locLeLabel.textContent = "Location LE";
      if (locCurrentLabel) locCurrentLabel.textContent = "Location FY Current";
      if (locLastLabel) locLastLabel.textContent = "Location FY Last";
      if (locPercentLabel) locPercentLabel.textContent = "Percentage";
      return;
    }

    if (metricWrap) metricWrap.classList.remove("hidden-block");
    if (maxWrap) maxWrap.classList.remove("hidden-block");
    if (newAmcLabel) newAmcLabel.textContent = `New AMC for FY ${fy}`;
    if (locLeLabel) locLeLabel.textContent = `${location} LE`;
    if (locCurrentLabel) locCurrentLabel.textContent = `${location} FY ${fy}`;
    if (locLastLabel) locLastLabel.textContent = `${location} FY ${prevFy}`;
    if (locPercentLabel) locPercentLabel.textContent = `% Change (${location} FY ${fy} vs ${prevFy})`;
  }

  function calculatePercentChange() {
    const le = toNumber(document.getElementById("locLeInput")?.value);
    const current = toNumber(document.getElementById("locFyCurrentInput")?.value);
    const target = document.getElementById("locPercentInput");
    if (!target) {
      return;
    }
    if (!le || !current) {
      target.value = "";
      return;
    }
    target.value = `${(((current - le) / le) * 100).toFixed(2)}%`;
  }

  function sumMaxHospitalParts() {
    return [
      "newAmcFy26Input",
      "newProjectInput",
      "annualizedInput",
      "priceIncreaseInput",
      "newUnitInput",
      "licenseIncreaseInput",
      "restInput"
    ].reduce(function (sum, id) {
      return sum + toNumber(document.getElementById(id)?.value);
    }, 0);
  }

  function buildRecordPayload() {
    const payload = {};
    FIELD_DEFS.forEach(function (def) {
      payload[def.key] = getPlannerFieldValue(def);
    });
    payload["Financial Year"] = normalizeText(document.getElementById("financialYearInput")?.value);
    payload["MAX Hospital"] = normalizeText(document.getElementById("maxHospitalInput")?.value);
    payload["New AMC for FY 26"] = normalizeText(document.getElementById("newAmcFy26Input")?.value);
    payload["New Project"] = normalizeText(document.getElementById("newProjectInput")?.value);
    payload.Annualized = normalizeText(document.getElementById("annualizedInput")?.value);
    payload["Price increase"] = normalizeText(document.getElementById("priceIncreaseInput")?.value);
    payload["New Unit"] = normalizeText(document.getElementById("newUnitInput")?.value);
    payload["License increase"] = normalizeText(document.getElementById("licenseIncreaseInput")?.value);
    payload.Rest = normalizeText(document.getElementById("restInput")?.value);
    payload["Location LE"] = normalizeText(document.getElementById("locLeInput")?.value);
    payload["Location FY Current"] = normalizeText(document.getElementById("locFyCurrentInput")?.value);
    payload["Location FY Last"] = normalizeText(document.getElementById("locFyLastInput")?.value);
    payload.Percentage = normalizeText(document.getElementById("locPercentInput")?.value);
    return payload;
  }

  function buildLocationRowFromPayload(payload) {
    const le = toNumber(payload["Location LE"]);
    const current = toNumber(payload["Location FY Current"]);
    const totalLocation = sumMaxHospitalParts();
    const diff = current - le;
    return {
      id: `L${Date.now()}${Math.floor(Math.random() * 1000)}`,
      savedAt: stamp(),
      financialYear: payload["Financial Year"],
      maxHospital: payload["MAX Hospital"],
      newAmcFy: payload["New AMC for FY 26"] || "0",
      newProject: payload["New Project"] || "0",
      annualized: payload.Annualized || "0",
      priceIncrease: payload["Price increase"] || "0",
      newUnit: payload["New Unit"] || "0",
      licenseIncrease: payload["License increase"] || "0",
      rest: payload.Rest || "0",
      locationLe: payload["Location LE"] || "0",
      locationFyCurrent: payload["Location FY Current"] || "0",
      locationFyLast: payload["Location FY Last"] || payload["Location LE"] || "0",
      percentChange: payload.Percentage || (le ? `${(((current - le) / le) * 100).toFixed(2)}%` : ""),
      leFy25: payload["Location LE"] || "0",
      budgetFy26: payload["Location FY Current"] || "0",
      differencePercentage: le ? `${((diff / le) * 100).toFixed(2)}%` : "",
      differenceAmount: String(diff || 0),
      totalBudgetCurrent: payload["Location FY Current"] || "0",
      totalBudgetLast: payload["Location LE"] || "0",
      share: "",
      cumulativeShare: "",
      totalLocation: String(totalLocation),
      total: String(totalLocation),
      justification: normalizeText(document.getElementById("locationDataJustificationInput")?.value)
    };
  }

  function renderSavedRecords() {
    const tbody = document.getElementById("tbody");
    const theadRow = document.getElementById("theadRow");
    const meta = document.getElementById("meta");
    if (!tbody || !theadRow) {
      return;
    }
    const headers = [
      "#", "Created At", "Updated At", ...FIELD_DEFS.map(function (def) { return def.label; }),
      "Financial Year", "MAX Hospital", "New AMC for FY 26", "New Project", "Annualized", "Price increase", "New Unit", "License increase", "Rest", "Location LE", "Location FY Current", "Location FY Last", "Percentage"
    ];
    theadRow.innerHTML = headers.map(function (header) { return `<th>${header}</th>`; }).join("");

    const rows = getRecords();
    if (meta) {
      meta.textContent = `Total records: ${rows.length}`;
    }
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${headers.length}" class="empty">No records yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(function (row, index) {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${row.createdAt || ""}</td>
          <td>${row.updatedAt || ""}</td>
          ${FIELD_DEFS.map(function (def) { return `<td>${row[def.key] || ""}</td>`; }).join("")}
          <td>${row["Financial Year"] || ""}</td>
          <td>${row["MAX Hospital"] || ""}</td>
          <td>${row["New AMC for FY 26"] || ""}</td>
          <td>${row["New Project"] || ""}</td>
          <td>${row.Annualized || ""}</td>
          <td>${row["Price increase"] || ""}</td>
          <td>${row["New Unit"] || ""}</td>
          <td>${row["License increase"] || ""}</td>
          <td>${row.Rest || ""}</td>
          <td>${row["Location LE"] || ""}</td>
          <td>${row["Location FY Current"] || ""}</td>
          <td>${row["Location FY Last"] || ""}</td>
          <td>${row.Percentage || ""}</td>
        </tr>
      `;
    }).join("");
  }

  function renderLocationDb() {
    const body = document.getElementById("locationDbBody");
    const meta = document.getElementById("locationDbMeta");
    if (!body) {
      return;
    }
    const rows = getLocationRows();
    if (meta) {
      meta.textContent = `Rows: ${rows.length}`;
    }
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="20" class="location-db-empty">No location data saved yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(function (row, index) {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${row.savedAt || ""}</td>
          <td>${row.financialYear || ""}</td>
          <td>${row.maxHospital || ""}</td>
          <td>${row.newAmcFy || ""}</td>
          <td>${row.newProject || ""}</td>
          <td>${row.annualized || ""}</td>
          <td>${row.priceIncrease || ""}</td>
          <td>${row.newUnit || ""}</td>
          <td>${row.licenseIncrease || ""}</td>
          <td>${row.rest || ""}</td>
          <td>${row.locationLe || ""}</td>
          <td>${row.locationFyCurrent || ""}</td>
          <td>${row.percentChange || ""}</td>
          <td>${row.budgetFy26 || ""}</td>
          <td>${row.leFy25 || ""}</td>
          <td>${row.share || ""}</td>
          <td>${row.cumulativeShare || ""}</td>
          <td><button type="button" class="row-btn delete-location-db" data-id="${row.id}">Delete</button></td>
        </tr>
      `;
    }).join("");
  }

  function renderDashboard() {
    ensureDashboardView();
    const records = getRecords();
    const locationMap = new Map();
    let totalBudget = 0;
    let totalExpense = 0;
    records.forEach(function (row) {
      const location = normalizeText(row["MAX Hospital"]) || "Unknown";
      const budget = toNumber(row["New AMC for FY 26"]) + toNumber(row["New Project"]) + toNumber(row.Annualized) + toNumber(row["Price increase"]) + toNumber(row["New Unit"]) + toNumber(row["License increase"]) + toNumber(row.Rest);
      const expense = toNumber(row["Location LE"]);
      totalBudget += budget;
      totalExpense += expense;
      const entry = locationMap.get(location) || { budget: 0, expense: 0, count: 0 };
      entry.budget += budget;
      entry.expense += expense;
      entry.count += 1;
      locationMap.set(location, entry);
    });
    const setText = function (id, value) {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };
    setText("srTotalBudget", totalBudget.toLocaleString());
    setText("srTotalExpense", totalExpense.toLocaleString());
    setText("srTotalRecords", String(records.length));
    setText("srTotalLocations", String(locationMap.size));
    const body = document.getElementById("srDashboardBody");
    if (body) {
      if (!locationMap.size) {
        body.innerHTML = `<tr><td colspan="4" class="md-empty">No data available.</td></tr>`;
      } else {
        body.innerHTML = Array.from(locationMap.entries()).map(function (entry) {
          const location = entry[0];
          const data = entry[1];
          return `<tr><td>${location}</td><td>${data.budget.toLocaleString()}</td><td>${data.expense.toLocaleString()}</td><td>${data.count}</td></tr>`;
        }).join("");
      }
    }
  }

  function addRecordFallback(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    calculatePercentChange();
    const payload = buildRecordPayload();
    if (!payload["Financial Year"] || !payload["MAX Hospital"]) {
      const status = document.getElementById("status");
      if (status) {
        status.textContent = "Select Financial Year and MAX Hospital before adding record.";
      }
      return;
    }

    const record = Object.assign({
      id: `R${Date.now()}${Math.floor(Math.random() * 1000)}`,
      createdAt: stamp(),
      updatedAt: stamp()
    }, payload);

    const records = getRecords();
    records.unshift(record);
    writeJson(RECORDS_KEY, records);
    window.dispatchEvent(new Event("records-updated"));

    const locationRows = getLocationRows();
    locationRows.unshift(buildLocationRowFromPayload(payload));
    writeJson(LOCATION_DB_KEY, locationRows);
    window.dispatchEvent(new Event("locationdb-updated"));

    renderSavedRecords();
    renderLocationDb();
    renderDashboard();
    clearPlannerFields();
    ["newAmcFy26Input","newProjectInput","annualizedInput","priceIncreaseInput","newUnitInput","licenseIncreaseInput","restInput","locLeInput","locFyCurrentInput","locFyLastInput","locPercentInput","locationDataJustificationInput"].forEach(function (id) {
      const node = document.getElementById(id);
      if (node) node.value = "";
    });
    const status = document.getElementById("status");
    if (status) {
      status.textContent = "Record added successfully.";
    }
  }

  function clearFormFallback(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    clearPlannerFields();
    ["financialYearInput","maxHospitalInput","newAmcFy26Input","newProjectInput","annualizedInput","priceIncreaseInput","newUnitInput","licenseIncreaseInput","restInput","locLeInput","locFyCurrentInput","locFyLastInput","locPercentInput","locationDataJustificationInput"].forEach(function (id) {
      const node = document.getElementById(id);
      if (node) node.value = "";
    });
    updateMetricLabels();
  }

  function bindPlannerButtons() {
    const addBtn = document.getElementById("addBtn");
    const clearBtn = document.getElementById("clearBtn");
    if (addBtn && !addBtn.dataset.recoveryBound) {
      addBtn.dataset.recoveryBound = "1";
      addBtn.addEventListener("click", addRecordFallback, true);
    }
    if (clearBtn && !clearBtn.dataset.recoveryBound) {
      clearBtn.dataset.recoveryBound = "1";
      clearBtn.addEventListener("click", clearFormFallback, true);
    }
  }

  function bindDynamicMetricEvents() {
    ["financialYearInput", "maxHospitalInput"].forEach(function (id) {
      const node = document.getElementById(id);
      if (node && !node.dataset.recoveryMetricBound) {
        node.dataset.recoveryMetricBound = "1";
        node.addEventListener("change", updateMetricLabels);
      }
    });
    ["locLeInput", "locFyCurrentInput"].forEach(function (id) {
      const node = document.getElementById(id);
      if (node && !node.dataset.recoveryMetricBound) {
        node.dataset.recoveryMetricBound = "1";
        node.addEventListener("input", calculatePercentChange);
      }
    });
  }

  function bindLocationDbDelete() {
    const body = document.getElementById("locationDbBody");
    if (!body || body.dataset.recoveryDeleteBound) {
      return;
    }
    body.dataset.recoveryDeleteBound = "1";
    body.addEventListener("click", function (event) {
      const button = event.target.closest(".delete-location-db");
      if (!button) {
        return;
      }
      const id = button.dataset.id;
      const rows = getLocationRows().filter(function (row) { return row.id !== id; });
      writeJson(LOCATION_DB_KEY, rows);
      window.dispatchEvent(new Event("locationdb-updated"));
      renderLocationDb();
      renderDashboard();
    });
  }

  function initRecovery() {
    ensureDashboardView();
    ensureSideMenu();
    bindSideMenu();
    ensureMaxHospitalOptions();
    buildPlannerGrid();
    bindPlannerButtons();
    bindDynamicMetricEvents();
    bindLocationDbDelete();
    updateMetricLabels();
    renderSavedRecords();
    renderLocationDb();
    renderDashboard();
    showView("dashboard");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRecovery);
  } else {
    initRecovery();
  }
})();
