(function () {
  const STORAGE_KEY = "maxhealth_dashboard_dataset_v1";
  const FILTER_ALL = "All";
  const WATCH_INTERVAL_MS = 5000;

  const API_BASE = "https://maxhealthcare-budget-system-production.up.railway.app";

async function loadDatabaseData() {
  try {
    const response = await fetch(`${API_BASE}/api/budget-data`);
    const data = await response.json();

    console.log("Database Data:", data);

    return data;

  } catch (error) {
    console.error("API Error:", error);
    return [];
  }
}

  const state = {
    data: null,
    charts: {},
    watchHandle: null,
    watchTimer: null,
    lastModified: 0,
    sourceName: "",
    filters: {
      location: FILTER_ALL,
      category: FILTER_ALL,
      year: FILTER_ALL,
      unit: FILTER_ALL
    }
  };

  const numberFormatter = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  });

  const elements = {};

  document.addEventListener("DOMContentLoaded", initDashboard);

  async function initDashboard() {
  cacheElements();
  bindEvents();

  const dbData = await loadDatabaseData();

  console.log("LIVE DATABASE:", dbData);

  loadPersistedData();
  renderAll();
}
  function cacheElements() {
    elements.navLinks = Array.from(document.querySelectorAll(".nav-link"));
    elements.views = Array.from(document.querySelectorAll(".view-section"));
    elements.workbookInput = document.getElementById("workbookInput");
    elements.chooseWorkbookBtn = document.getElementById("chooseWorkbookBtn");
    elements.watchWorkbookBtn = document.getElementById("watchWorkbookBtn");
    elements.refreshWorkbookBtn = document.getElementById("refreshWorkbookBtn");
    elements.exportSnapshotBtn = document.getElementById("exportSnapshotBtn");
    elements.syncStatus = document.getElementById("syncStatus");
    elements.locationFilter = document.getElementById("locationFilter");
    elements.categoryFilter = document.getElementById("categoryFilter");
    elements.yearFilter = document.getElementById("yearFilter");
    elements.unitFilter = document.getElementById("unitFilter");
  }

  function bindEvents() {
    elements.navLinks.forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    [elements.locationFilter, elements.categoryFilter, elements.yearFilter, elements.unitFilter].forEach((select) => {
      select.addEventListener("change", () => {
        state.filters.location = elements.locationFilter.value || FILTER_ALL;
        state.filters.category = elements.categoryFilter.value || FILTER_ALL;
        state.filters.year = elements.yearFilter.value || FILTER_ALL;
        state.filters.unit = elements.unitFilter.value || FILTER_ALL;
        renderAll();
      });
    });

    elements.chooseWorkbookBtn.addEventListener("click", () => {
      elements.workbookInput.click();
    });

    elements.workbookInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      await loadWorkbookFile(file, false);
    });

    elements.watchWorkbookBtn.addEventListener("click", enableLiveWatch);
    elements.refreshWorkbookBtn.addEventListener("click", refreshWorkbook);
    elements.exportSnapshotBtn.addEventListener("click", exportSnapshotWorkbook);
  }

  function switchView(viewId) {
    elements.navLinks.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === viewId);
    });
    elements.views.forEach((section) => {
      section.classList.toggle("active", section.id === viewId);
    });
  }

  function setSyncStatus(message, mode) {
    if (!elements.syncStatus) {
      return;
    }
    elements.syncStatus.textContent = message;
    elements.syncStatus.style.background =
      mode === "error"
        ? "rgba(209, 77, 91, 0.12)"
        : mode === "success"
          ? "rgba(27, 142, 103, 0.12)"
          : "rgba(13, 119, 199, 0.08)";
    elements.syncStatus.style.color =
      mode === "error"
        ? "#a13445"
        : mode === "success"
          ? "#226f59"
          : "#2a597b";
  }

  async function loadWorkbookFile(file, silentAutoUpdate) {
    if (!window.ExcelBudgetReader || !window.XLSX) {
      setSyncStatus("XLSX library is not available in the browser.", "error");
      return;
    }

    setSyncStatus(`Reading workbook: ${file.name}`, "info");

    try {
      const parsed = await window.ExcelBudgetReader.readFile(file);
      state.data = parsed;
      state.sourceName = file.name;
      state.lastModified = file.lastModified || 0;
      persistData();
      populateFilters();
      renderAll();
      setSyncStatus(
        silentAutoUpdate
          ? `Workbook auto-updated: ${file.name}`
          : `Workbook loaded successfully: ${file.name}`,
        "success"
      );
    } catch (error) {
      console.error(error);
      setSyncStatus(`Workbook load failed: ${error.message || "Unknown error"}`, "error");
    }
  }

  async function enableLiveWatch() {
    if (!window.showOpenFilePicker) {
      setSyncStatus("Live watch needs a Chromium browser with File System Access support. Use Choose Excel instead.", "error");
      return;
    }

    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "Excel Workbook",
            accept: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              "application/vnd.ms-excel": [".xls"]
            }
          }
        ]
      });

      if (!handle) {
        return;
      }

      state.watchHandle = handle;
      const file = await handle.getFile();
      await loadWorkbookFile(file, false);
      startWatchLoop();
      updateReportRefreshMode("Live Watch");
    } catch (error) {
      console.error(error);
      setSyncStatus(`Live watch could not start: ${error.message || "Permission denied"}`, "error");
    }
  }

  function startWatchLoop() {
    if (state.watchTimer) {
      clearInterval(state.watchTimer);
    }

    state.watchTimer = window.setInterval(async () => {
      if (!state.watchHandle) {
        return;
      }

      try {
        const file = await state.watchHandle.getFile();
        if (file.lastModified !== state.lastModified) {
          await loadWorkbookFile(file, true);
        }
      } catch (error) {
        console.error(error);
        clearInterval(state.watchTimer);
        state.watchTimer = null;
        updateReportRefreshMode("Manual");
        setSyncStatus("Live watch stopped because the selected file is no longer available.", "error");
      }
    }, WATCH_INTERVAL_MS);
  }

  async function refreshWorkbook() {
    if (state.watchHandle) {
      try {
        const file = await state.watchHandle.getFile();
        await loadWorkbookFile(file, false);
        updateReportRefreshMode("Live Watch");
        return;
      } catch (error) {
        console.error(error);
      }
    }

    const inputFile = elements.workbookInput.files && elements.workbookInput.files[0];
    if (inputFile) {
      await loadWorkbookFile(inputFile, false);
      updateReportRefreshMode("Manual");
      return;
    }

    setSyncStatus("Choose an Excel workbook first.", "error");
  }

  function persistData() {
    if (!state.data) {
      return;
    }
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sourceName: state.sourceName,
          lastModified: state.lastModified,
          payload: state.data
        })
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function loadPersistedData() {

  try {

    const response = await fetch(
      "https://maxhealthcare-budget-system-production.up.railway.app/api/budget-data"
    );

    const rows = await response.json();

    console.log("LIVE DB DATA:", rows);

    state.data = {
      unitBudgetRows: [],
      itOpexRows: rows.map(row => ({
        location: row.location || "",
        category: row.category_it || "",
        vendor: row.owner || "",
        unit: row.owner1 || "",
        year: row.financial_year || "",
        budget: Number(row.loc_fy_current || 0),
        expense: Number(row.loc_le || 0),
        coding: row.coding || "",
        item: row.item || "",
        owner: row.owner || ""
      })),
      allocationRows: [],
      utilizationRows: [],
      sheetSummary: [],
      dimensions: {
        locations: [],
        categories: [],
        years: [],
        units: []
      }
    };

    populateFilters();

    renderAll();

    setSyncStatus("Live Railway DB connected ✅", "success");

  } catch (error) {

    console.error(error);

    setSyncStatus(
      "Live API failed: " + error.message,
      "error"
    );

  }
}

      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.payload) {
        return;
      }

      state.data = parsed.payload;
      state.sourceName = parsed.sourceName || parsed.payload.sourceName || "Workbook";
      state.lastModified = parsed.lastModified || 0;
      populateFilters();
      setSyncStatus(`Loaded cached workbook: ${state.sourceName}`, "success");
    } catch (error) {
      console.error(error);
    }
  }

  function populateFilters() {
    const dimensions = (state.data && state.data.dimensions) || {
      locations: [],
      categories: [],
      years: [],
      units: []
    };

    syncSelect(elements.locationFilter, dimensions.locations, state.filters.location);
    syncSelect(elements.categoryFilter, dimensions.categories, state.filters.category);
    syncSelect(elements.yearFilter, dimensions.years, state.filters.year);
    syncSelect(elements.unitFilter, dimensions.units, state.filters.unit);
  }

  function syncSelect(select, values, currentValue) {
    if (!select) {
      return;
    }

    const nextValue = values.includes(currentValue) ? currentValue : FILTER_ALL;
    select.innerHTML = [`<option value="${FILTER_ALL}">${FILTER_ALL}</option>`]
      .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
      .join("");
    select.value = nextValue;
    state.filters[select.id.replace("Filter", "").toLowerCase()] = nextValue;
  }

  function getScopedData() {
    if (!state.data) {
      return {
        unitBudgetRows: [],
        itOpexRows: [],
        allocationRows: [],
        utilizationRows: [],
        sheetSummary: []
      };
    }

    return {
      unitBudgetRows: filterRows(state.data.unitBudgetRows, { location: "location", year: "year", unit: "unit" }),
      itOpexRows: filterRows(state.data.itOpexRows, {
        location: "location",
        category: "category",
        year: "year",
        unit: "unit"
      }),
      allocationRows: filterRows(state.data.allocationRows, {
        location: "location",
        category: "category",
        year: "year"
      }),
      utilizationRows: filterRows(state.data.utilizationRows, {
        location: "location",
        year: "year",
        unit: "unit"
      }),
      sheetSummary: state.data.sheetSummary || []
    };
  }

  function filterRows(rows, mapping) {
    return (rows || []).filter((row) => {
      if (state.filters.location !== FILTER_ALL && String(row[mapping.location] || "").trim() !== state.filters.location) {
        return false;
      }
      if (mapping.category && state.filters.category !== FILTER_ALL && String(row[mapping.category] || "").trim() !== state.filters.category) {
        return false;
      }
      if (mapping.year && state.filters.year !== FILTER_ALL && String(row[mapping.year] || "").trim() !== state.filters.year) {
        return false;
      }
      if (mapping.unit && state.filters.unit !== FILTER_ALL && String(row[mapping.unit] || "").trim() !== state.filters.unit) {
        return false;
      }
      return true;
    });
  }

  function renderAll() {
    const scoped = getScopedData();
    renderOverview(scoped);
    renderUnitBudget(scoped.unitBudgetRows);
    renderItOpex(scoped.itOpexRows);
    renderAllocation(scoped.allocationRows);
    renderUtilization(scoped.utilizationRows);
    renderReports(scoped.sheetSummary, scoped);
  }

  function renderOverview(scoped) {
    const totalBudget =
      sumNumbers(scoped.itOpexRows, "budget") ||
      sumNumbers(scoped.unitBudgetRows, "currentBudget") ||
      sumNumbers(scoped.utilizationRows, "budget");
    const totalExpense =
      sumNumbers(scoped.unitBudgetRows, "lastYearExpense") ||
      sumNumbers(scoped.itOpexRows, "expense");
    const totalAllocation = sumNumbers(scoped.allocationRows, "fixedAllocation");
    const totalUtilization = sumNumbers(scoped.utilizationRows, "usedBudget");
    const remainingBudget =
      sumNumbers(scoped.utilizationRows, "remainingBudget") ||
      Math.max(totalBudget - totalUtilization, 0);
    const growthPercent = totalExpense ? ((totalBudget - totalExpense) / totalExpense) * 100 : 0;

    setText("kpiTotalBudget", formatNumber(totalBudget));
    setText("kpiTotalExpense", formatNumber(totalExpense));
    setText("kpiGrowth", formatPercent(growthPercent));
    setText("kpiTotalAllocation", formatNumber(totalAllocation));
    setText("kpiTotalUtilization", formatNumber(totalUtilization));
    setText("kpiRemainingBudget", formatNumber(remainingBudget));

    setText(
      "dashboardMeta",
      state.data
        ? `${state.sourceName || state.data.sourceName || "Workbook"} • ${scoped.itOpexRows.length} IT OPEX rows after filters`
        : "Waiting for workbook"
    );

    renderBarChart(
      "locationBudgetChart",
      "Location vs Budget",
      aggregateByKey(scoped.itOpexRows, "location", "budget"),
      "Budget"
    );

    renderPieChart(
      "categoryDistributionChart",
      "Category Budget",
      aggregateByKey(scoped.itOpexRows, "category", "budget")
    );

    renderLineComparisonChart(
      "yearComparisonChart",
      buildYearComparison(scoped)
    );

    renderHeatmap(
      "heatmapMatrix",
      buildMatrix(scoped.itOpexRows, "location", "category", "budget"),
      "Budget"
    );

    renderDashboardInsights(scoped, {
      totalBudget,
      totalExpense,
      totalAllocation,
      totalUtilization,
      remainingBudget
    });
  }

  function renderUnitBudget(rows) {
    const totalBudget = sumNumbers(rows, "currentBudget");
    const totalExpense = sumNumbers(rows, "lastYearExpense");
    const totalDifference = sumNumbers(rows, "budgetDifference");
    const growthPercent = totalExpense ? ((totalBudget - totalExpense) / totalExpense) * 100 : 0;

    setText("unitBudgetMeta", `${rows.length} unit rows`);
    setText("unitTotalBudget", formatNumber(totalBudget));
    setText("unitTotalExpense", formatNumber(totalExpense));
    setText("unitGrowthPct", formatPercent(growthPercent));
    setText("unitBudgetDiff", formatNumber(totalDifference));

    renderGroupedBarChart(
      "unitBudgetChart",
      rows.slice(0, 12).map((row) => row.unit || row.location || "Unassigned"),
      [
        { label: "Current Budget", data: rows.slice(0, 12).map((row) => row.currentBudget), color: "#0d77c7" },
        { label: "Last Year Expense", data: rows.slice(0, 12).map((row) => row.lastYearExpense), color: "#9fc7e7" }
      ]
    );

    renderBarChart(
      "unitGrowthChart",
      "Growth %",
      rows.slice(0, 12).reduce((acc, row) => {
        acc[row.unit || row.location || "Unassigned"] = row.growthPercent;
        return acc;
      }, {}),
      "Growth %"
    );

    renderTable("unitBudgetTable", [
      { title: "Unit", key: "unit" },
      { title: "Location", key: "location" },
      { title: "Year", key: "year" },
      { title: "Last Year Expense", key: "lastYearExpense", format: formatNumber },
      { title: "Current Budget", key: "currentBudget", format: formatNumber },
      { title: "Budget Difference", key: "budgetDifference", format: formatNumber },
      { title: "Growth %", key: "growthPercent", format: formatPercent }
    ], rows);
  }

  function renderItOpex(rows) {
    setText("itOpexMeta", `${rows.length} rows from main source`);

    renderBarChart(
      "itOpexLocationChart",
      "Location Budget",
      aggregateByKey(rows, "location", "budget"),
      "Budget"
    );

    renderPieChart(
      "itOpexCategoryChart",
      "Category Distribution",
      aggregateByKey(rows, "category", "budget")
    );

    renderBarChart(
      "itOpexVendorChart",
      "Vendor Budget",
      aggregateByKey(rows, "vendor", "budget"),
      "Budget"
    );

    renderTable("itOpexTable", [
      { title: "Location", key: "location" },
      { title: "Category", key: "category" },
      { title: "Vendor", key: "vendor" },
      { title: "Unit", key: "unit" },
      { title: "Year", key: "year" },
      { title: "Budget", key: "budget", format: formatNumber },
      { title: "Expense", key: "expense", format: formatNumber },
      { title: "Coding", key: "coding" },
      { title: "Item", key: "item" },
      { title: "Owner", key: "owner" }
    ], rows);
  }

  function renderAllocation(rows) {
    const totalFixed = sumNumbers(rows, "fixedAllocation");
    const averagePct = rows.length ? sumNumbers(rows, "allocationPercent") / rows.length : 0;
    const categoryGroups = aggregateByKey(rows, "category", "fixedAllocation");
    const categoryNames = Object.keys(categoryGroups);
    const peakCategory = categoryNames.length
      ? categoryNames.sort((a, b) => categoryGroups[b] - categoryGroups[a])[0]
      : "-";

    setText("allocationMeta", `${rows.length} allocation rows`);
    setText("allocationTotal", formatNumber(totalFixed));
    setText("allocationAveragePct", formatPercent(averagePct));
    setText("allocationCategoryCount", String(categoryNames.length));
    setText("allocationPeakCategory", peakCategory);

    renderPieChart("allocationPieChart", "Allocation %", aggregateByKey(rows, "category", "allocationPercent"));
    renderBarChart("allocationBarChart", "Fixed Allocation", categoryGroups, "Fixed Allocation");

    renderTable("allocationTable", [
      { title: "Location", key: "location" },
      { title: "Category", key: "category" },
      { title: "Year", key: "year" },
      { title: "Fixed Allocation", key: "fixedAllocation", format: formatNumber },
      { title: "Allocation %", key: "allocationPercent", format: formatPercent },
      { title: "Budget", key: "budget", format: formatNumber }
    ], rows);
  }

  function renderUtilization(rows) {
    const usedBudget = sumNumbers(rows, "usedBudget");
    const remainingBudget = sumNumbers(rows, "remainingBudget");
    const totalBudget = sumNumbers(rows, "budget");
    const utilizationPercent = totalBudget ? (usedBudget / totalBudget) * 100 : 0;
    const alerts = rows.filter((row) => row.overBudget).length;

    setText("utilizationMeta", `${rows.length} utilization rows`);
    setText("utilUsedBudget", formatNumber(usedBudget));
    setText("utilRemainingBudget", formatNumber(remainingBudget));
    setText("utilizationPercentKpi", formatPercent(utilizationPercent));
    setText("utilizationAlerts", String(alerts));

    renderGroupedBarChart(
      "utilizationBarChart",
      rows.slice(0, 12).map((row) => row.unit || row.location || "Unassigned"),
      [
        { label: "Used Budget", data: rows.slice(0, 12).map((row) => row.usedBudget), color: "#dd7c24" },
        { label: "Remaining Budget", data: rows.slice(0, 12).map((row) => row.remainingBudget), color: "#4ea3db" }
      ]
    );

    renderHeatmap(
      "utilizationHeatmap",
      buildMatrix(rows, "location", "unit", "utilizationPercent"),
      "Utilization %"
    );

    renderTable("utilizationTable", [
      { title: "Location", key: "location" },
      { title: "Unit", key: "unit" },
      { title: "Year", key: "year" },
      { title: "Budget", key: "budget", format: formatNumber },
      { title: "Used Budget", key: "usedBudget", format: formatNumber },
      { title: "Remaining Budget", key: "remainingBudget", format: formatNumber },
      { title: "Utilization %", key: "utilizationPercent", format: formatPercent },
      {
        title: "Over Budget",
        key: "overBudget",
        format: (value) => (value ? "Alert" : "Normal")
      }
    ], rows);
  }

  function renderReports(sheetSummary, scoped) {
    const loadedSheets = sheetSummary.filter((row) => row.mappedSheet !== "Missing").length;
    const totalRows =
      scoped.unitBudgetRows.length +
      scoped.itOpexRows.length +
      scoped.allocationRows.length +
      scoped.utilizationRows.length;
    const locationCount = new Set(
      []
        .concat(scoped.unitBudgetRows.map((row) => row.location))
        .concat(scoped.itOpexRows.map((row) => row.location))
        .concat(scoped.allocationRows.map((row) => row.location))
        .concat(scoped.utilizationRows.map((row) => row.location))
        .filter(Boolean)
    ).size;

    setText("reportsMeta", state.data ? `${state.sourceName} • generated ${formatDateTime(state.data.generatedAt)}` : "No workbook loaded");
    setText("reportLoadedSheets", String(loadedSheets));
    setText("reportTotalRows", String(totalRows));
    setText("reportLocationCount", String(locationCount));
    updateReportRefreshMode(state.watchTimer ? "Live Watch" : "Manual");

    renderTable("sheetSummaryTable", [
      { title: "Sheet", key: "sheet" },
      { title: "Mapped Sheet", key: "mappedSheet" },
      { title: "Rows", key: "rows" },
      { title: "Purpose", key: "purpose" }
    ], sheetSummary);
  }

  function updateReportRefreshMode(label) {
    setText("reportRefreshMode", label);
  }

  function renderDashboardInsights(scoped, totals) {
    const insights = [];
    const locationBudget = aggregateByKey(scoped.itOpexRows, "location", "budget");
    const categoryBudget = aggregateByKey(scoped.itOpexRows, "category", "budget");
    const topLocation = topEntry(locationBudget);
    const topCategory = topEntry(categoryBudget);

    if (topLocation) {
      insights.push(`Top location budget is ${topLocation.label} with ${formatNumber(topLocation.value)}.`);
    }
    if (topCategory) {
      insights.push(`Highest category spend is ${topCategory.label} at ${formatNumber(topCategory.value)}.`);
    }
    insights.push(`Total allocation currently contributes ${formatNumber(totals.totalAllocation)} to the planning pool.`);
    insights.push(`Remaining budget stands at ${formatNumber(totals.remainingBudget)} after utilization.`);

    const container = document.getElementById("dashboardInsights");
    if (!container) {
      return;
    }

    if (!insights.length) {
      container.innerHTML = `<div class="empty-panel">Load an Excel workbook to unlock automated insights.</div>`;
      return;
    }

    container.innerHTML = insights
      .map((item) => `<div class="insight-pill">${escapeHtml(item)}</div>`)
      .join("");
  }

  function renderTable(tableId, columns, rows) {
    const table = document.getElementById(tableId);
    if (!table) {
      return;
    }

    table.innerHTML = `
      <thead>
        <tr>${columns.map((column) => `<th>${escapeHtml(column.title)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
          return `<tr>${columns.map((column) => {
            const value = row[column.key];
            const rendered = column.format ? column.format(value) : (value || value === 0 ? value : "-");
            return `<td>${escapeHtml(rendered)}</td>`;
          }).join("")}</tr>`;
        }).join("")}
      </tbody>
    `;

    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.DataTable) {
      const $table = window.jQuery(table);
      if (window.jQuery.fn.DataTable.isDataTable(table)) {
        $table.DataTable().destroy();
      }
      $table.DataTable({
        pageLength: 8,
        lengthChange: false,
        searching: true,
        info: true,
        order: []
      });
    }
  }

  function renderBarChart(canvasId, label, groupedData, datasetLabel) {
    const labels = Object.keys(groupedData);
    const data = Object.values(groupedData);
    renderChart(canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: datasetLabel || label,
            data,
            borderRadius: 10,
            backgroundColor: createPalette(data.length, 0.88),
            borderWidth: 0
          }
        ]
      },
      options: baseChartOptions()
    });
  }

  function renderPieChart(canvasId, label, groupedData) {
    const labels = Object.keys(groupedData);
    const data = Object.values(groupedData);
    renderChart(canvasId, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor: createPalette(data.length, 0.94),
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#36546c",
              boxWidth: 12,
              usePointStyle: true,
              pointStyle: "circle"
            }
          }
        }
      }
    });
  }

  function renderLineComparisonChart(canvasId, comparison) {
    renderChart(canvasId, {
      type: "line",
      data: {
        labels: comparison.labels,
        datasets: [
          {
            label: "Budget",
            data: comparison.budget,
            borderColor: "#0d77c7",
            backgroundColor: "rgba(13, 119, 199, 0.14)",
            fill: true,
            tension: 0.32
          },
          {
            label: "Expense",
            data: comparison.expense,
            borderColor: "#dd7c24",
            backgroundColor: "rgba(221, 124, 36, 0.12)",
            fill: true,
            tension: 0.32
          }
        ]
      },
      options: baseChartOptions()
    });
  }

  function renderGroupedBarChart(canvasId, labels, datasets) {
    renderChart(canvasId, {
      type: "bar",
      data: {
        labels,
        datasets: datasets.map((dataset) => ({
          label: dataset.label,
          data: dataset.data,
          backgroundColor: dataset.color,
          borderRadius: 10,
          borderWidth: 0
        }))
      },
      options: baseChartOptions()
    });
  }

  function renderChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) {
      return;
    }

    if (state.charts[canvasId]) {
      state.charts[canvasId].destroy();
    }

    state.charts[canvasId] = new window.Chart(canvas.getContext("2d"), config);
  }

  function baseChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#36546c"
          }
        },
        tooltip: {
          backgroundColor: "#16384f",
          titleColor: "#fff",
          bodyColor: "#fff"
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#5f7b91"
          },
          grid: {
            display: false
          }
        },
        y: {
          ticks: {
            color: "#5f7b91"
          },
          grid: {
            color: "rgba(183, 203, 220, 0.32)"
          }
        }
      }
    };
  }

  function renderHeatmap(containerId, matrix, metricLabel) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    if (!matrix.rowLabels.length || !matrix.columnLabels.length) {
      container.innerHTML = `<div class="empty-panel">No ${escapeHtml(metricLabel)} data available for the selected filters.</div>`;
      return;
    }

    const maxValue = Math.max(...matrix.values.flat(), 0);
    const header = `<tr><th>${escapeHtml(metricLabel)}</th>${matrix.columnLabels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr>`;
    const rows = matrix.rowLabels.map((rowLabel, rowIndex) => {
      const cells = matrix.columnLabels.map((_, columnIndex) => {
        const value = matrix.values[rowIndex][columnIndex];
        const alpha = maxValue ? Math.max(0.12, value / maxValue) : 0.08;
        return `<td style="background: rgba(13, 119, 199, ${alpha.toFixed(3)});">${escapeHtml(formatNumber(value))}</td>`;
      }).join("");
      return `<tr><th>${escapeHtml(rowLabel)}</th>${cells}</tr>`;
    }).join("");

    container.innerHTML = `<table class="heatmap-table"><thead>${header}</thead><tbody>${rows}</tbody></table>`;
  }

  function buildYearComparison(scoped) {
    const budgetBuckets = {};
    const expenseBuckets = {};
    const source = scoped.itOpexRows.length ? scoped.itOpexRows : scoped.unitBudgetRows;

    source.forEach((row) => {
      const year = row.year || "Current";
      budgetBuckets[year] = (budgetBuckets[year] || 0) + toNumber(row.budget || row.currentBudget);
      expenseBuckets[year] = (expenseBuckets[year] || 0) + toNumber(row.expense || row.lastYearExpense);
    });

    const labels = Array.from(new Set(Object.keys(budgetBuckets).concat(Object.keys(expenseBuckets))));
    return {
      labels,
      budget: labels.map((label) => budgetBuckets[label] || 0),
      expense: labels.map((label) => expenseBuckets[label] || 0)
    };
  }

  function aggregateByKey(rows, key, valueKey) {
    const buckets = {};
    (rows || []).forEach((row) => {
      const bucketKey = String(row[key] || "Unassigned").trim() || "Unassigned";
      buckets[bucketKey] = (buckets[bucketKey] || 0) + toNumber(row[valueKey]);
    });
    return sortGroupedObject(buckets);
  }

  function buildMatrix(rows, rowKey, columnKey, valueKey) {
    const rowLabels = Array.from(new Set((rows || []).map((row) => String(row[rowKey] || "").trim()).filter(Boolean)));
    const columnLabels = Array.from(new Set((rows || []).map((row) => String(row[columnKey] || "").trim()).filter(Boolean)));
    const values = rowLabels.map((rowLabel) =>
      columnLabels.map((columnLabel) => {
        return rows
          .filter((row) => String(row[rowKey] || "").trim() === rowLabel && String(row[columnKey] || "").trim() === columnLabel)
          .reduce((sum, row) => sum + toNumber(row[valueKey]), 0);
      })
    );

    return { rowLabels, columnLabels, values };
  }

  function sumNumbers(rows, key) {
    return (rows || []).reduce((sum, row) => sum + toNumber(row[key]), 0);
  }

  function toNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  }

  function formatNumber(value) {
    return numberFormatter.format(toNumber(value));
  }

  function formatPercent(value) {
    const num = toNumber(value);
    return `${num.toFixed(2)}%`;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleString();
  }

  function sortGroupedObject(grouped) {
    return Object.fromEntries(
      Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 12)
    );
  }

  function topEntry(grouped) {
    const entries = Object.entries(grouped || {});
    if (!entries.length) {
      return null;
    }
    const [label, value] = entries.sort((a, b) => b[1] - a[1])[0];
    return { label, value };
  }

  function createPalette(count, alpha) {
    const base = [
      `rgba(13, 119, 199, ${alpha})`,
      `rgba(24, 168, 216, ${alpha})`,
      `rgba(53, 90, 169, ${alpha})`,
      `rgba(27, 142, 103, ${alpha})`,
      `rgba(221, 124, 36, ${alpha})`,
      `rgba(209, 77, 91, ${alpha})`,
      `rgba(120, 99, 219, ${alpha})`,
      `rgba(53, 192, 187, ${alpha})`
    ];

    return Array.from({ length: count }, (_, index) => base[index % base.length]);
  }

  function exportSnapshotWorkbook() {
    if (!window.XLSX || !state.data) {
      setSyncStatus("Load a workbook before exporting a snapshot.", "error");
      return;
    }

    const scoped = getScopedData();
    const workbook = window.XLSX.utils.book_new();

    addSheetToWorkbook(workbook, "Unit Budget", scoped.unitBudgetRows);
    addSheetToWorkbook(workbook, "IT OPEX FY 25-26", scoped.itOpexRows);
    addSheetToWorkbook(workbook, "Allocation", scoped.allocationRows);
    addSheetToWorkbook(workbook, "Utilization", scoped.utilizationRows);
    addSheetToWorkbook(workbook, "Sheet Summary", scoped.sheetSummary);

    const timestamp = new Date();
    const fileName = `MAXHEALTHCare-IT-OPEX-Dashboard-${timestamp.getFullYear()}-${String(
      timestamp.getMonth() + 1
    ).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}.xlsx`;

    window.XLSX.writeFile(workbook, fileName);
    setSyncStatus(`Snapshot exported: ${fileName}`, "success");
  }

  function addSheetToWorkbook(workbook, name, rows) {
    const safeRows = (rows || []).map((row) => {
      const copy = {};
      Object.keys(row).forEach((key) => {
        if (key !== "raw") {
          copy[key] = row[key];
        }
      });
      return copy;
    });

    const sheet = window.XLSX.utils.json_to_sheet(safeRows.length ? safeRows : [{ Message: "No data for current filters" }]);
    window.XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
})();
