(function () {
  if (window.__reportEnhancementsInitialized) {
    return;
  }
  window.__reportEnhancementsInitialized = true;

  const REPORT_VIEW_ID = "reportsView";
  const RECORDS_KEY = "it_opex_records_v6";
  const LOCATION_DB_KEY = "it_opex_location_db_v3";
  const ALLOCATION_DB_KEY = "it_opex_allocation_local_db_v2";
  const DATASET_KEY = "maxhealth_dashboard_dataset_v1";
  const STYLE_ID = "report-enhancements-style";

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function toNumber(value) {
    const cleaned = String(value == null ? "" : value).replace(/,/g, "").replace(/%/g, "").trim();
    if (!cleaned) {
      return 0;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getRecords() {
    const rows = readJson(RECORDS_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function getLocationDbRows() {
    const rows = readJson(LOCATION_DB_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function getAllocationRows() {
    const rows = readJson(ALLOCATION_DB_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function getDataset() {
    const data = readJson(DATASET_KEY, null);
    return data && typeof data === "object" ? data : null;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function formatPercent(value) {
    return `${Number(value || 0).toFixed(2)}%`;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${REPORT_VIEW_ID} {
        display: none;
      }
      .report-shell {
        display: grid;
        gap: 18px;
      }
      .report-hero {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        padding: 18px 20px;
        border: 1px solid #d7e3ee;
        border-radius: 20px;
        background: linear-gradient(135deg, #ffffff, #eef7ff);
        box-shadow: 0 16px 38px rgba(10, 52, 84, 0.08);
      }
      .report-hero h2 {
        margin: 0;
        font-size: 1.4rem;
        color: #10354f;
      }
      .report-hero p {
        margin: 6px 0 0;
        color: #5d778d;
        font-size: 0.92rem;
      }
      .report-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .report-btn {
        min-height: 40px;
        padding: 0 16px;
        border: 1px solid #c8dced;
        border-radius: 12px;
        background: linear-gradient(135deg, #0b3f6e, #15598e);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
      .report-kpis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }
      .report-kpi {
        padding: 16px;
        border: 1px solid #d7e3ee;
        border-radius: 18px;
        background: linear-gradient(180deg, #ffffff, #f6fbff);
        box-shadow: 0 12px 30px rgba(10, 52, 84, 0.06);
      }
      .report-kpi span {
        display: block;
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #5d778d;
        font-weight: 800;
      }
      .report-kpi strong {
        display: block;
        margin-top: 8px;
        font-size: 1.5rem;
        color: #10354f;
      }
      .report-card {
        border: 1px solid #d7e3ee;
        border-radius: 20px;
        background: linear-gradient(180deg, #ffffff, #f7fbff);
        box-shadow: 0 14px 34px rgba(10, 52, 84, 0.06);
        overflow: hidden;
      }
      .report-card-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 16px 18px;
        border-bottom: 1px solid #e4eef6;
      }
      .report-card-head h3 {
        margin: 0;
        font-size: 1rem;
        color: #123149;
      }
      .report-card-head span {
        color: #658096;
        font-size: 0.82rem;
      }
      .report-table-wrap {
        overflow: auto;
        max-height: 360px;
      }
      .report-table {
        width: 100%;
        min-width: 980px;
        border-collapse: collapse;
      }
      .report-table th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #eef6ff;
        color: #214d73;
        font-size: 12px;
        text-transform: uppercase;
        border-bottom: 1px solid #d7e3ee;
        padding: 10px;
        text-align: left;
      }
      .report-table td {
        border-bottom: 1px solid #edf3f8;
        padding: 10px;
        color: #123149;
        font-size: 13px;
        vertical-align: top;
      }
      .report-empty {
        padding: 18px;
        text-align: center;
        color: #688196;
      }
      @media (max-width: 1024px) {
        .report-kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 620px) {
        .report-kpis {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureReportView() {
    ensureStyles();
    let view = document.getElementById(REPORT_VIEW_ID);
    if (view) {
      return view;
    }

    view = document.createElement("section");
    view.id = REPORT_VIEW_ID;
    view.className = "panel";

    const plannerView = document.getElementById("plannerView") || document.querySelector(".app");
    if (plannerView && plannerView.parentElement) {
      plannerView.parentElement.appendChild(view);
    } else {
      document.body.appendChild(view);
    }

    return view;
  }

  function ensureReportMenu() {
    const navBody = document.querySelector(".side-nav-body") || document.querySelector(".side-nav");
    if (!navBody) {
      return;
    }
    const exists = Array.from(navBody.querySelectorAll(".side-link, button, a")).some(function (node) {
      return /report/i.test(normalizeText(node.textContent));
    });
    if (exists) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "side-link";
    button.dataset.recoveryView = "reports";
    button.textContent = "Report";
    navBody.appendChild(button);
  }

  function buildUnitSummary(records, locationRows) {
    const map = new Map();

    locationRows.forEach(function (row) {
      const location = normalizeText(row.maxHospital);
      if (!location) {
        return;
      }
      const entry = map.get(location) || {
        unit: location,
        lastYearExpense: 0,
        currentBudget: 0,
        plannerRows: 0
      };
      entry.lastYearExpense += toNumber(row.locationLe || row.leFy25);
      entry.currentBudget += toNumber(row.locationFyCurrent || row.budgetFy26);
      map.set(location, entry);
    });

    records.forEach(function (row) {
      const location = normalizeText(row["MAX Hospital"]);
      if (!location) {
        return;
      }
      const entry = map.get(location) || {
        unit: location,
        lastYearExpense: 0,
        currentBudget: 0,
        plannerRows: 0
      };
      entry.plannerRows += 1;
      map.set(location, entry);
    });

    return Array.from(map.values()).map(function (row) {
      const diff = row.currentBudget - row.lastYearExpense;
      const growth = row.lastYearExpense ? (diff / row.lastYearExpense) * 100 : 0;
      return {
        Unit: row.unit,
        "Last Year Expense": row.lastYearExpense,
        "Current Budget": row.currentBudget,
        "Budget Difference": diff,
        "Growth %": growth,
        "Planner Rows": row.plannerRows
      };
    }).sort(function (a, b) {
      return a.Unit.localeCompare(b.Unit);
    });
  }

  function buildUtilizationSummary(locationRows) {
    return locationRows.map(function (row) {
      return {
        Location: row.maxHospital || "",
        "LE FY 25": toNumber(row.leFy25 || row.locationLe),
        "Budget FY 26": toNumber(row.budgetFy26 || row.locationFyCurrent),
        "% Change": row.percentChange || row.differencePercentage || "",
        "Share %": row.share || "",
        "Cumulative %": row.cumulativeShare || "",
        "Total Location": toNumber(row.totalLocation || row.total),
        Justification: row.justification || ""
      };
    });
  }

  function buildDatasetSummary(dataset) {
    if (!dataset || !dataset.sheetSummary) {
      return [];
    }
    return Object.keys(dataset.sheetSummary).map(function (key) {
      const item = dataset.sheetSummary[key] || {};
      return {
        Sheet: key,
        Rows: item.rows || 0,
        Columns: item.columns || 0
      };
    });
  }

  function buildTable(headers, rows) {
    if (!rows.length) {
      return `<div class="report-empty">No data available.</div>`;
    }
    return `
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>${headers.map(function (header) { return `<th>${header}</th>`; }).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map(function (row) {
              return `<tr>${headers.map(function (header) {
                const value = row[header];
                return `<td>${value == null ? "" : value}</td>`;
              }).join("")}</tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderReport() {
    const view = ensureReportView();
    ensureReportMenu();

    const records = getRecords();
    const locationRows = getLocationDbRows();
    const allocationRows = getAllocationRows();
    const dataset = getDataset();
    const unitSummary = buildUnitSummary(records, locationRows);
    const utilizationSummary = buildUtilizationSummary(locationRows);
    const datasetSummary = buildDatasetSummary(dataset);

    const totalBudget = locationRows.reduce(function (sum, row) {
      return sum + toNumber(row.budgetFy26 || row.locationFyCurrent);
    }, 0);
    const totalExpense = locationRows.reduce(function (sum, row) {
      return sum + toNumber(row.leFy25 || row.locationLe);
    }, 0);

    const savedRecordsTableRows = records.map(function (row) {
      return {
        "Created At": row.createdAt || "",
        Coding: row.Coding || "",
        Item: row.Item || "",
        "Sub Category (Mapped)": row["Sub Category (Mapped)"] || "",
        Category_IT: row.Category_IT || "",
        Owner: row.Owner || "",
        "Financial Year": row["Financial Year"] || "",
        "MAX Hospital": row["MAX Hospital"] || "",
        "Location LE": row["Location LE"] || "",
        "Location FY Current": row["Location FY Current"] || "",
        Percentage: row.Percentage || ""
      };
    });

    const locationDbTableRows = locationRows.map(function (row) {
      return {
        "Saved At": row.savedAt || "",
        "Financial Year": row.financialYear || "",
        "MAX Hospital": row.maxHospital || "",
        "Location LE": row.locationLe || "",
        "Location FY Current": row.locationFyCurrent || "",
        "Budget FY 26": row.budgetFy26 || "",
        "LE FY 25": row.leFy25 || "",
        "% Change": row.percentChange || row.differencePercentage || "",
        "% Of Share": row.share || "",
        "Cumulative %": row.cumulativeShare || "",
        "Total Location": row.totalLocation || "",
        Justification: row.justification || ""
      };
    });

    const allocationTableRows = allocationRows.map(function (row) {
      return {
        "Saved At": row.savedAt || "",
        Coding: row.coding || "",
        Item: row.item || "",
        Owner: row.owner || "",
        Mode: row.mode || "",
        "Total Budget": row.totalBudget || "",
        "Selected Locations": Array.isArray(row.selectedLocations) ? row.selectedLocations.join(", ") : "",
        Details: Array.isArray(row.details)
          ? row.details.map(function (detail) {
              return `${detail.location}: ${detail.percentage}% = ${detail.amount}`;
            }).join(" | ")
          : ""
      };
    });

    view.innerHTML = `
      <div class="report-shell">
        <div class="report-hero">
          <div>
            <h2>Report</h2>
            <p>Combined report view for all local database tables and saved planning data across tabs.</p>
          </div>
          <div class="report-actions">
            <button type="button" class="report-btn" id="downloadFullReportBtn">Download Whole Report</button>
          </div>
        </div>

        <div class="report-kpis">
          <div class="report-kpi"><span>Saved Records</span><strong>${records.length}</strong></div>
          <div class="report-kpi"><span>Location DB Rows</span><strong>${locationRows.length}</strong></div>
          <div class="report-kpi"><span>Allocation Rows</span><strong>${allocationRows.length}</strong></div>
          <div class="report-kpi"><span>Total Budget</span><strong>${formatNumber(totalBudget)}</strong></div>
        </div>

        <div class="report-kpis">
          <div class="report-kpi"><span>Total Expense</span><strong>${formatNumber(totalExpense)}</strong></div>
          <div class="report-kpi"><span>Budget Difference</span><strong>${formatNumber(totalBudget - totalExpense)}</strong></div>
          <div class="report-kpi"><span>Growth %</span><strong>${formatPercent(totalExpense ? ((totalBudget - totalExpense) / totalExpense) * 100 : 0)}</strong></div>
          <div class="report-kpi"><span>Workbook Sheets</span><strong>${datasetSummary.length}</strong></div>
        </div>

        <section class="report-card">
          <div class="report-card-head"><h3>Saved Records</h3><span>${records.length} rows</span></div>
          ${buildTable(Object.keys(savedRecordsTableRows[0] || { "Saved Records": "" }), savedRecordsTableRows)}
        </section>

        <section class="report-card">
          <div class="report-card-head"><h3>Location Data Local Database</h3><span>${locationRows.length} rows</span></div>
          ${buildTable(Object.keys(locationDbTableRows[0] || { "Location DB": "" }), locationDbTableRows)}
        </section>

        <section class="report-card">
          <div class="report-card-head"><h3>Allocation Local Database</h3><span>${allocationRows.length} rows</span></div>
          ${buildTable(Object.keys(allocationTableRows[0] || { "Allocation DB": "" }), allocationTableRows)}
        </section>

        <section class="report-card">
          <div class="report-card-head"><h3>Unit Budget Summary</h3><span>${unitSummary.length} units</span></div>
          ${buildTable(Object.keys(unitSummary[0] || { Unit: "" }), unitSummary)}
        </section>

        <section class="report-card">
          <div class="report-card-head"><h3>OPEX Utilization Summary</h3><span>${utilizationSummary.length} rows</span></div>
          ${buildTable(Object.keys(utilizationSummary[0] || { Location: "" }), utilizationSummary)}
        </section>

        <section class="report-card">
          <div class="report-card-head"><h3>Imported Workbook Summary</h3><span>${datasetSummary.length} sheet(s)</span></div>
          ${buildTable(Object.keys(datasetSummary[0] || { Sheet: "" }), datasetSummary)}
        </section>
      </div>
    `;

    bindReportActions(savedRecordsTableRows, locationDbTableRows, allocationTableRows, unitSummary, utilizationSummary, datasetSummary);
  }

  function loadXlsxLibrary() {
    if (typeof window.XLSX !== "undefined") {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      const existing = document.getElementById("report-xlsx-loader");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = "report-xlsx-loader";
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.async = true;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", function () {
        reject(new Error("Failed to load XLSX library."));
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  function bindReportActions(savedRecordsTableRows, locationDbTableRows, allocationTableRows, unitSummary, utilizationSummary, datasetSummary) {
    const button = document.getElementById("downloadFullReportBtn");
    if (!button || button.dataset.boundReportDownload) {
      return;
    }
    button.dataset.boundReportDownload = "1";
    button.addEventListener("click", async function () {
      try {
        await loadXlsxLibrary();
        if (typeof window.XLSX === "undefined") {
          window.alert("Report export failed: XLSX library is not available.");
          return;
        }
        const workbook = window.XLSX.utils.book_new();
        const sheets = [
          { name: "Saved Records", rows: savedRecordsTableRows },
          { name: "Location DB", rows: locationDbTableRows },
          { name: "Allocation DB", rows: allocationTableRows },
          { name: "Unit Summary", rows: unitSummary },
          { name: "Utilization", rows: utilizationSummary },
          { name: "Workbook Summary", rows: datasetSummary }
        ];

        sheets.forEach(function (sheet) {
          const safeRows = sheet.rows.length ? sheet.rows : [{ Empty: "No data" }];
          const worksheet = window.XLSX.utils.json_to_sheet(safeRows);
          window.XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
        });

        const fileName = `maxhealthcare-it-opex-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
        window.XLSX.writeFile(workbook, fileName);
      } catch (error) {
        window.alert(`Report export failed: ${error && error.message ? error.message : "Unknown error"}`);
      }
    });
  }

  function init() {
    renderReport();
    window.addEventListener("storage", renderReport);
    window.addEventListener("records-updated", renderReport);
    window.addEventListener("locationdb-updated", renderReport);

    let scheduled = false;
    const schedule = function () {
      if (scheduled) {
        return;
      }
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        renderReport();
      });
    };

    document.body.addEventListener("click", function (event) {
      const target = event.target.closest(".side-link, .side-nav button, .side-nav a");
      if (!target) {
        return;
      }
      if (/report/i.test(normalizeText(target.textContent))) {
        schedule();
      }
    }, true);

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
