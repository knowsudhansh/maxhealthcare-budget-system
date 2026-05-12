(function () {
  const LOCATIONS = [
    "Saket",
    "Max Smart",
    "Gurgaon",
    "Lajpat Nagar",
    "Panchsheel",
    "Patparganj",
    "Vaishali",
    "Noida",
    "Shalimar Bagh",
    "Mohali",
    "Dehradun",
    "Bathinda",
    "HO",
    "BLK",
    "Nanawati",
    "Nagpur",
    "Lucknow",
    "Dwarka",
    "Jaypee Noida"
  ];

  const UI_STATE_KEY = "it_opex_allocation_controls_v2";
  const ALLOCATION_DB_KEY = "it_opex_allocation_local_db_v2";
  const STYLE_ID = "allocation-enhancements-style";

  let refreshTimer = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function cleanText(value) {
    return String(value || "").trim();
  }

  function toNumber(value) {
    const raw = String(value == null ? "" : value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim();
    if (!raw) {
      return 0;
    }
    const number = Number(raw);
    return Number.isFinite(number) ? number : 0;
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    return number.toLocaleString("en-IN", {
      minimumFractionDigits: number % 1 ? 2 : 0,
      maximumFractionDigits: 2
    });
  }

  function formatPercent(value) {
    const number = Number(value || 0);
    return number.toFixed(2) + "%";
  }

  function findLooseKey(source, wantedKeys) {
    if (!source || typeof source !== "object") {
      return null;
    }
    const keys = Object.keys(source);
    const normalizedWanted = wantedKeys.map(normalizeText);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const normalizedKey = normalizeText(key);
      if (normalizedWanted.includes(normalizedKey)) {
        return key;
      }
    }
    return null;
  }

  function getAny(source, wantedKeys) {
    const key = findLooseKey(source, wantedKeys);
    return key ? source[key] : "";
  }

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function looksLikePlannerRecord(row) {
    if (!isPlainObject(row)) {
      return false;
    }
    const coding = cleanText(getAny(row, ["coding", "Coding"]));
    const item = cleanText(getAny(row, ["item", "Item"]));
    const location = cleanText(getAny(row, ["maxHospital", "MAX Hospital", "location", "Location"]));
    return Boolean(location && (coding || item));
  }

  function getBudgetTotal(row) {
    return (
      toNumber(getAny(row, ["newAmcFy", "newAmcFy26", "newAmcForFy", "New AMC for FY", "New AMC for FY 26"])) +
      toNumber(getAny(row, ["newProject", "New Project"])) +
      toNumber(getAny(row, ["annualized", "Annualized"])) +
      toNumber(getAny(row, ["priceIncrease", "Price increase", "Price Increase"])) +
      toNumber(getAny(row, ["newUnit", "New Unit"])) +
      toNumber(getAny(row, ["licenseIncrease", "License increase", "License Increase"])) +
      toNumber(getAny(row, ["rest", "Rest"]))
    );
  }

  function normalizePlannerRecord(row) {
    return {
      id: cleanText(getAny(row, ["id", "Id"])) || String(Math.random()),
      coding: cleanText(getAny(row, ["coding", "Coding"])),
      item: cleanText(getAny(row, ["item", "Item"])),
      owner: cleanText(getAny(row, ["owner", "Owner"])),
      location: cleanText(getAny(row, ["maxHospital", "MAX Hospital", "location", "Location"])),
      financialYear: cleanText(getAny(row, ["financialYear", "Financial Year"])),
      costDistribution: cleanText(getAny(row, ["costDistribution", "Cost Distribution"])) || "Fixed Cost",
      totalBudget: getBudgetTotal(row)
    };
  }

  function walkForPlannerRecords(node, output, seen) {
    if (Array.isArray(node)) {
      node.forEach(function (item) {
        walkForPlannerRecords(item, output, seen);
      });
      return;
    }

    if (!isPlainObject(node)) {
      return;
    }

    if (looksLikePlannerRecord(node)) {
      const record = normalizePlannerRecord(node);
      const signature = [
        record.id,
        record.coding,
        record.item,
        record.owner,
        record.location,
        record.financialYear,
        record.totalBudget
      ].join("|");
      if (!seen.has(signature)) {
        seen.add(signature);
        output.push(record);
      }
      return;
    }

    Object.keys(node).forEach(function (key) {
      const value = node[key];
      if (Array.isArray(value) || isPlainObject(value)) {
        walkForPlannerRecords(value, output, seen);
      }
    });
  }

  function readPlannerRecords() {
    const records = [];
    const seen = new Set();

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) {
        continue;
      }

      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed = JSON.parse(raw);
        walkForPlannerRecords(parsed, records, seen);
      } catch (_error) {
        // Ignore non-JSON localStorage values.
      }
    }

    return records.filter(function (record) {
      return record.location && record.totalBudget >= 0;
    });
  }

  function readUiState() {
    try {
      const raw = localStorage.getItem(UI_STATE_KEY);
      if (!raw) {
        return {
          mode: "Fixed Cost",
          amount: "",
          percent: "",
          locations: []
        };
      }
      const parsed = JSON.parse(raw);
      return {
        mode: parsed.mode === "Distributed" ? "Distributed" : "Fixed Cost",
        amount: cleanText(parsed.amount),
        percent: cleanText(parsed.percent),
        locations: Array.isArray(parsed.locations) ? parsed.locations.filter(Boolean) : []
      };
    } catch (_error) {
      return {
        mode: "Fixed Cost",
        amount: "",
        percent: "",
        locations: []
      };
    }
  }

  function saveUiState(state) {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
  }

  function injectStyles() {
    if ($(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #allocationView,
      #allocationView .section-card,
      #allocationView .section-header,
      #allocationView .section-body {
        min-width: 0;
        max-width: 100%;
      }

      #allocationView {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
      }

      #allocationView,
      #allocationView * {
        box-sizing: border-box;
      }

      #allocationView .section-header p,
      #allocationView .section-header h3 {
        overflow-wrap: anywhere;
      }

      #allocationView .allocation-responsive-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important;
        gap: 16px !important;
        width: 100%;
        min-width: 0;
        max-width: 100%;
      }

      #allocationView .allocation-responsive-grid > * {
        min-width: 0;
        max-width: 100%;
      }

      .allocation-controls-card,
      .allocation-db-card {
        margin-top: 16px;
      }

      .allocation-controls-card {
        position: relative;
        overflow: visible;
        border: 1px solid #c6def5;
        background:
          radial-gradient(circle at top right, rgba(23, 163, 184, 0.08), transparent 28%),
          linear-gradient(180deg, #ffffff 0%, #f6fbff 100%);
        box-shadow: 0 18px 36px rgba(16, 68, 118, 0.08);
      }

      .allocation-controls-card::before {
        content: "";
        position: absolute;
        inset: 0 0 auto 0;
        height: 4px;
        background: linear-gradient(90deg, #0f7dc7 0%, #11a7ba 52%, #69c081 100%);
        opacity: 0.95;
      }

      .allocation-controls-card .section-header {
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 18px;
      }

      .allocation-controls-card .section-header h3 {
        margin-bottom: 6px;
      }

      .allocation-controls-card .section-header p {
        max-width: 860px;
        line-height: 1.55;
      }

      .allocation-controls-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 14px;
      }

      .allocation-controls-card .field-card {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        gap: 10px;
        min-width: 0;
        min-height: 152px;
        padding: 18px 18px 16px;
        border: 1px solid #cfe2f5;
        border-radius: 18px;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,251,255,0.96));
        box-shadow: 0 12px 26px rgba(16, 68, 118, 0.06);
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        overflow: visible;
      }

      .allocation-controls-card .field-card:hover {
        transform: translateY(-1px);
        border-color: #a9d0f1;
        box-shadow: 0 16px 30px rgba(16, 68, 118, 0.1);
      }

      .allocation-controls-card .field-card label {
        display: block;
        margin: 0;
        font-size: 0.76rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #1f4a74;
        line-height: 1.25;
        white-space: normal;
      }

      .allocation-controls-card .field-card small {
        display: block;
        margin: 0;
        color: #53718f;
        font-size: 0.82rem;
        line-height: 1.45;
      }

      .allocation-controls-card .field-card .text-input,
      .allocation-controls-card .field-card .select-input,
      .allocation-controls-card .field-card input[type="number"],
      .allocation-controls-card .field-card input[type="text"],
      .allocation-controls-card .field-card select {
        width: 100%;
        min-height: 46px;
        height: 46px;
        padding: 0 14px;
        border-radius: 14px;
        border: 1px solid #b9d4ef;
        background: #ffffff;
        color: #17395d;
        font-size: 0.95rem;
        font-weight: 600;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
      }

      .allocation-controls-card .field-card .text-input:focus,
      .allocation-controls-card .field-card .select-input:focus,
      .allocation-controls-card .field-card input[type="number"]:focus,
      .allocation-controls-card .field-card input[type="text"]:focus,
      .allocation-controls-card .field-card select:focus {
        outline: none;
        border-color: #44a2e6;
        box-shadow: 0 0 0 4px rgba(68, 162, 230, 0.12);
      }

      .allocation-note {
        margin-top: 16px;
        padding: 14px 16px;
        border: 1px dashed #b9d4ef;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(239,247,255,0.95), rgba(250,253,255,0.95));
        color: #496987;
        font-size: 0.88rem;
        line-height: 1.55;
      }

      .allocation-distribution-only.is-hidden {
        display: none;
      }

      .allocation-multi-select {
        position: relative;
      }

      .allocation-multi-summary {
        min-height: 42px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 14px;
        border: 1px solid #b9d4ef;
        border-radius: 14px;
        background: #fdfefe;
        cursor: pointer;
        color: #17395d;
      }

      .allocation-multi-summary::after {
        content: "v";
        font-size: 0.78rem;
        color: #28598e;
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        background: #eef6ff;
        border: 1px solid #c8def5;
        flex-shrink: 0;
      }

      .allocation-multi-details[open] .allocation-multi-summary {
        border-color: #3ea0eb;
        box-shadow: 0 0 0 3px rgba(46, 145, 255, 0.12);
      }

      .allocation-multi-details {
        width: 100%;
        position: relative;
        z-index: 5;
      }

      .allocation-multi-details > summary {
        list-style: none;
      }

      .allocation-multi-details > summary::-webkit-details-marker {
        display: none;
      }

      .allocation-multi-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        left: auto;
        width: clamp(320px, 28vw, 420px);
        min-width: 100%;
        max-width: min(420px, calc(100vw - 48px));
        max-height: 250px;
        overflow: auto;
        z-index: 50;
        border: 1px solid #b9d4ef;
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 22px 42px rgba(18, 66, 114, 0.18);
        padding: 8px;
      }

      .allocation-controls-card .allocation-multi-select {
        position: relative;
        z-index: 5;
      }

      .allocation-controls-card .allocation-multi-summary {
        min-height: 46px;
        border-radius: 14px;
        padding: 10px 14px;
        white-space: normal;
      }

      .allocation-location-option {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 10px;
        border-radius: 12px;
        color: #18385a;
        cursor: pointer;
        white-space: nowrap;
      }

      .allocation-location-option:hover {
        background: #f2f8ff;
      }

      .allocation-location-option input {
        width: 16px;
        height: 16px;
        accent-color: #0f7dc7;
      }

      .allocation-table-wrap {
        overflow: auto;
        width: 100%;
        max-width: 100%;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
        border: 1px solid #d6e6f6;
        border-radius: 18px;
        background: #ffffff;
      }

      .allocation-table {
        width: max-content;
        border-collapse: collapse;
        min-width: 1180px;
      }

      .allocation-table th,
      .allocation-table td {
        padding: 11px 12px;
        border-bottom: 1px solid #e8f0f8;
        text-align: left;
        white-space: nowrap;
      }

      .allocation-table thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #eef6fd;
        color: #21486f;
        text-transform: uppercase;
        font-size: 0.74rem;
        letter-spacing: 0.03em;
      }

      .allocation-table tbody td {
        color: #16395f;
        font-size: 0.9rem;
      }

      .allocation-pill {
        min-width: 74px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 12px;
        border-radius: 999px;
        background: #eaf7f3;
        color: #0d6b50;
        font-weight: 700;
        font-size: 0.82rem;
      }

      .allocation-empty {
        padding: 22px;
        color: #64809a;
        text-align: center;
      }

      @media (max-width: 1600px) {
        .allocation-controls-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 1120px) {
        .allocation-controls-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 760px) {
        .allocation-controls-grid {
          grid-template-columns: 1fr;
        }

        .allocation-controls-card .field-card {
          min-height: auto;
          padding: 16px;
        }

        .allocation-note {
          padding: 12px 14px;
        }

        .allocation-multi-menu {
          left: 0;
          right: auto;
          width: 100%;
          max-width: 100%;
        }

        .allocation-table {
          min-width: 980px;
        }
      }

      @media (max-width: 560px) {
        .allocation-controls-card .field-card {
          padding: 14px;
        }

        .allocation-controls-card .field-card .text-input,
        .allocation-controls-card .field-card .select-input,
        .allocation-controls-card .field-card input[type="number"],
        .allocation-controls-card .field-card input[type="text"],
        .allocation-controls-card .field-card select {
          min-height: 42px;
          height: 42px;
          font-size: 0.9rem;
        }

        .allocation-table {
          min-width: 860px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensurePlannerCostDistributionControl() {
    const yearInput = $("financialYearInput");
    if (!yearInput) {
      return;
    }

    let select = $("plannerCostDistributionInput");
    if (!select) {
      const yearCard = yearInput.closest(".field-card");
      if (!yearCard || !yearCard.parentElement) {
        return;
      }

      const card = document.createElement("div");
      card.className = "field-card";
      card.innerHTML = `
        <label for="plannerCostDistributionInput">Cost Distribution</label>
        <select id="plannerCostDistributionInput" class="select-input">
          <option value="">Select cost distribution</option>
          <option value="Fixed Cost">Fixed Cost</option>
        </select>
        <small>Choose cost distribution type</small>
      `;
      yearCard.parentElement.insertBefore(card, yearCard);
      select = $("plannerCostDistributionInput");
    }

    if (select && !Array.from(select.options).some(function (option) { return option.value === "Fixed Cost"; })) {
      const option = document.createElement("option");
      option.value = "Fixed Cost";
      option.textContent = "Fixed Cost";
      select.appendChild(option);
    }
  }

  function updatePlannerMetricVisibility() {
    const metrics = $("plannerMetrics");
    const costDistribution = cleanText($("plannerCostDistributionInput") && $("plannerCostDistributionInput").value);
    const financialYear = cleanText($("financialYearInput") && $("financialYearInput").value);
    const location = cleanText($("maxHospitalInput") && $("maxHospitalInput").value);
    const shouldShow = costDistribution === "Fixed Cost" && financialYear && location;

    if (metrics) {
      metrics.hidden = !shouldShow;
      metrics.style.display = shouldShow ? "" : "none";
    }
  }

  function findAllocationView() {
    return $("allocationView");
  }

  function findAllocationMatrixCard(view) {
    if (!view) {
      return null;
    }

    const candidates = view.querySelectorAll("section, article, div");
    for (let i = 0; i < candidates.length; i += 1) {
      const node = candidates[i];
      const text = cleanText(node.textContent);
      if (/coding\s*\/\s*item\s*\/\s*owner\s*allocation\s*matrix/i.test(text)) {
        return (
          node.closest(".section-card, .panel-card, .data-card, .card, .subtab, .records, .view-section") ||
          node
        );
      }
    }
    return null;
  }

  function removeLegacyAllocationControls(view) {
    if (!view) {
      return;
    }

    const sections = Array.from(view.querySelectorAll("section, article, div"));
    sections.forEach(function (section) {
      if (!section || section.id === "allocationControlsEnhanced") {
        return;
      }

      const header = section.querySelector("h3, h2, h4");
      const headerText = cleanText(header && header.textContent);
      if (!/^allocation controls$/i.test(headerText)) {
        return;
      }

      section.remove();
    });
  }

  function applyAllocationResponsiveLayout(view) {
    if (!view) {
      return;
    }

    view.style.minWidth = "0";
    view.style.maxWidth = "100%";
    view.style.overflowX = "hidden";
    view.style.width = "100%";

    let ancestor = view.parentElement;
    while (ancestor && ancestor !== document.body) {
      ancestor.style.minWidth = "0";
      ancestor.style.maxWidth = "100%";
      if (!ancestor.style.width) {
        ancestor.style.width = "100%";
      }
      if (!ancestor.style.overflowX) {
        ancestor.style.overflowX = "hidden";
      }
      ancestor = ancestor.parentElement;
    }

    Array.from(view.querySelectorAll(".section-card")).forEach(function (card) {
      card.style.minWidth = "0";
      card.style.maxWidth = "100%";
      card.style.width = "100%";
    });

    const overviewSection = Array.from(view.querySelectorAll(".section-card")).find(function (section) {
      const text = cleanText(section.textContent);
      return /coding groups/i.test(text) && /selected locations/i.test(text) && /visible budget/i.test(text);
    });

    if (overviewSection) {
      const gridCandidate = Array.from(overviewSection.querySelectorAll("div")).find(function (node) {
        const text = cleanText(node.textContent);
        return node.children.length >= 4 && /coding groups/i.test(text) && /visible budget/i.test(text);
      });

      if (gridCandidate) {
        gridCandidate.classList.add("allocation-responsive-grid");
      }
    }

    Array.from(view.querySelectorAll(".section-card, .allocation-controls-card, .allocation-db-card")).forEach(function (section) {
      Array.from(section.children).forEach(function (container) {
        if (!(container instanceof HTMLElement)) {
          return;
        }
        const childElements = Array.from(container.children).filter(function (child) {
          return child instanceof HTMLElement;
        });
        if (childElements.length < 3) {
          return;
        }
        if (container.scrollWidth > container.clientWidth + 24) {
          container.classList.add("allocation-responsive-grid");
        }
      });
    });

    const tableWrap = view.querySelector(".allocation-table-wrap");
    if (tableWrap) {
      tableWrap.style.width = "100%";
      tableWrap.style.maxWidth = "100%";
      tableWrap.style.overflowX = "auto";
    }
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshEnhancements, 80);
  }

  function readControlStateFromUi() {
    const locationInputs = Array.from(document.querySelectorAll(".allocation-location-option input"));
    return {
      mode: cleanText($("allocationEnhancedMode") && $("allocationEnhancedMode").value) || "Fixed Cost",
      amount: cleanText($("allocationEnhancedAmount") && $("allocationEnhancedAmount").value),
      percent: cleanText($("allocationEnhancedPercent") && $("allocationEnhancedPercent").value),
      locations: locationInputs.filter(function (input) { return input.checked; }).map(function (input) { return input.value; })
    };
  }

  function updateLocationSummary(state) {
    const summary = $("allocationLocationSummaryLabel");
    if (!summary) {
      return;
    }

    if (!state.locations.length) {
      summary.textContent = "Select locations";
      return;
    }

    if (state.locations.length === LOCATIONS.length) {
      summary.textContent = "All locations selected";
      return;
    }

    summary.textContent = state.locations.length + " location(s) selected";
  }

  function syncAllocationControlVisibility() {
    const state = readControlStateFromUi();
    const distributionOnly = Array.from(document.querySelectorAll(".allocation-distribution-only"));
    distributionOnly.forEach(function (node) {
      node.classList.toggle("is-hidden", state.mode !== "Distributed");
    });
    updateLocationSummary(state);
    saveUiState(state);
  }

  function groupAllocationRows(records) {
    const grouped = new Map();

    records
      .filter(function (record) {
        return record.costDistribution === "Fixed Cost" || !record.costDistribution;
      })
      .forEach(function (record) {
        const key = [record.coding, record.item, record.owner].join("||");
        if (!grouped.has(key)) {
          grouped.set(key, {
            coding: record.coding,
            item: record.item,
            owner: record.owner,
            totalBudget: 0,
            locationBudgets: {}
          });
        }

        const row = grouped.get(key);
        row.totalBudget += record.totalBudget;
        row.locationBudgets[record.location] = (row.locationBudgets[record.location] || 0) + record.totalBudget;
      });

    return Array.from(grouped.values()).sort(function (left, right) {
      return left.coding.localeCompare(right.coding) || left.item.localeCompare(right.item);
    });
  }

  function buildAllocationPreviewRows(groupedRows, state) {
    const previewRows = [];

    groupedRows.forEach(function (row) {
      const matrixBudgetByLocation = {};

      if (state.mode === "Fixed Cost") {
        LOCATIONS.forEach(function (location) {
          const value = row.locationBudgets[location] || 0;
          matrixBudgetByLocation[location] = value;
          if (value > 0) {
            previewRows.push({
              coding: row.coding,
              item: row.item,
              owner: row.owner,
              mode: "Fixed Cost",
              sourceBudget: row.totalBudget,
              location: location,
              amount: value,
              sharePercent: row.totalBudget > 0 ? (value / row.totalBudget) * 100 : 0
            });
          }
        });
      } else {
        const selectedLocations = state.locations.slice();
        const totalFromAmount = toNumber(state.amount);
        const totalFromPercent = row.totalBudget * (toNumber(state.percent) / 100);
        const distributionTotal = totalFromAmount > 0 ? totalFromAmount : totalFromPercent;
        const selectedCount = selectedLocations.length || 0;
        const perLocation = selectedCount > 0 ? distributionTotal / selectedCount : 0;
        const sharePercent = selectedCount > 0 ? 100 / selectedCount : 0;

        LOCATIONS.forEach(function (location) {
          const value = selectedLocations.includes(location) ? perLocation : 0;
          matrixBudgetByLocation[location] = value;
          if (value > 0) {
            previewRows.push({
              coding: row.coding,
              item: row.item,
              owner: row.owner,
              mode: "Distributed",
              sourceBudget: row.totalBudget,
              location: location,
              amount: value,
              sharePercent: sharePercent
            });
          }
        });
      }

      row.matrixBudgetByLocation = matrixBudgetByLocation;
    });

    localStorage.setItem(ALLOCATION_DB_KEY, JSON.stringify(previewRows));
    return previewRows;
  }

  function buildMatrixTableHtml(rows) {
    if (!rows.length) {
      return '<div class="allocation-empty">No planner rows available yet. Add records in Budget Planner first.</div>';
    }

    return `
      <div class="allocation-table-wrap">
        <table class="allocation-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Coding</th>
              <th>Item</th>
              <th>Owner</th>
              <th>Total Budget</th>
              ${LOCATIONS.map(function (location) { return "<th>" + location + "</th>"; }).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(function (row, index) {
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${row.coding || "-"}</td>
                  <td>${row.item || "-"}</td>
                  <td>${row.owner || "-"}</td>
                  <td>${formatNumber(row.totalBudget)}</td>
                  ${LOCATIONS.map(function (location) {
                    const value = row.matrixBudgetByLocation && row.matrixBudgetByLocation[location] ? row.matrixBudgetByLocation[location] : 0;
                    return "<td>" + (value > 0 ? '<span class="allocation-pill">' + formatNumber(value) + "</span>" : "-") + "</td>";
                  }).join("")}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildAllocationDbHtml(rows) {
    if (!rows.length) {
      return '<div class="allocation-empty">Allocation local database will appear here when rows can be calculated.</div>';
    }

    return `
      <div class="allocation-table-wrap">
        <table class="allocation-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Mode</th>
              <th>Coding</th>
              <th>Item</th>
              <th>Owner</th>
              <th>Location</th>
              <th>Allocated Amount</th>
              <th>Share %</th>
              <th>Source Budget</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(function (row, index) {
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${row.mode}</td>
                  <td>${row.coding || "-"}</td>
                  <td>${row.item || "-"}</td>
                  <td>${row.owner || "-"}</td>
                  <td>${row.location || "-"}</td>
                  <td>${formatNumber(row.amount)}</td>
                  <td>${formatPercent(row.sharePercent)}</td>
                  <td>${formatNumber(row.sourceBudget)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAllocationOutputs() {
    const matrixBody = $("allocationEnhancedMatrixBody");
    const databaseBody = $("allocationEnhancedDbBody");
    if (!matrixBody || !databaseBody) {
      return;
    }

    const groupedRows = groupAllocationRows(readPlannerRecords());
    const state = readControlStateFromUi();
    const previewRows = buildAllocationPreviewRows(groupedRows, state);

    matrixBody.innerHTML = buildMatrixTableHtml(groupedRows);
    databaseBody.innerHTML = buildAllocationDbHtml(previewRows);
  }

  function populateAllocationLocations(locations) {
    const wrap = $("allocationLocationList");
    if (!wrap) {
      return;
    }

    const uiState = readUiState();
    wrap.innerHTML = locations
      .map(function (location) {
        const checked = uiState.locations.includes(location) ? "checked" : "";
        return `
          <label class="allocation-location-option">
            <input type="checkbox" value="${location}" ${checked}>
            <span>${location}</span>
          </label>
        `;
      })
      .join("");

    updateLocationSummary(uiState);
  }

  function bindAllocationControls() {
    const modeInput = $("allocationEnhancedMode");
    const amountInput = $("allocationEnhancedAmount");
    const percentInput = $("allocationEnhancedPercent");
    const locationList = $("allocationLocationList");

    if (modeInput && !modeInput.dataset.bound) {
      modeInput.dataset.bound = "1";
      modeInput.addEventListener("change", function () {
        syncAllocationControlVisibility();
        renderAllocationOutputs();
      });
    }

    if (amountInput && !amountInput.dataset.bound) {
      amountInput.dataset.bound = "1";
      amountInput.addEventListener("input", function () {
        saveUiState(readControlStateFromUi());
        renderAllocationOutputs();
      });
    }

    if (percentInput && !percentInput.dataset.bound) {
      percentInput.dataset.bound = "1";
      percentInput.addEventListener("input", function () {
        saveUiState(readControlStateFromUi());
        renderAllocationOutputs();
      });
    }

    if (locationList && !locationList.dataset.bound) {
      locationList.dataset.bound = "1";
      locationList.addEventListener("change", function () {
        syncAllocationControlVisibility();
        renderAllocationOutputs();
      });
    }
  }

  function ensureAllocationControlsCard() {
    const view = findAllocationView();
    const matrixCard = findAllocationMatrixCard(view);
    if (!view || !matrixCard) {
      return;
    }

    removeLegacyAllocationControls(view);
    applyAllocationResponsiveLayout(view);

    let controlsCard = $("allocationControlsEnhanced");
    if (!controlsCard) {
      controlsCard = document.createElement("section");
      controlsCard.id = "allocationControlsEnhanced";
      controlsCard.className = "section-card allocation-controls-card";
      controlsCard.innerHTML = `
        <div class="section-header">
          <div>
            <h3>Allocation Controls</h3>
            <p>Use planner fixed-cost rows directly, or distribute an entered amount or percentage equally across selected locations.</p>
          </div>
        </div>
        <div class="allocation-controls-grid">
          <div class="field-card">
            <label for="allocationEnhancedMode">Cost Distribution</label>
            <select id="allocationEnhancedMode" class="select-input">
              <option value="Fixed Cost">Fixed Cost</option>
              <option value="Distributed">Distributed</option>
            </select>
            <small>Choose how allocation should behave in the matrix.</small>
          </div>
          <div class="field-card allocation-distribution-only">
            <label for="allocationEnhancedAmount">Distribution Amount</label>
            <input id="allocationEnhancedAmount" class="text-input" type="number" step="0.01" placeholder="Enter amount">
            <small>If entered, this amount is split equally across selected locations.</small>
          </div>
          <div class="field-card allocation-distribution-only">
            <label for="allocationEnhancedPercent">Distribution Percentage</label>
            <input id="allocationEnhancedPercent" class="text-input" type="number" step="0.01" placeholder="Enter percentage">
            <small>If amount is blank, this % of the source budget is split equally.</small>
          </div>
          <div class="field-card allocation-distribution-only allocation-multi-select">
            <label for="allocationLocationPicker">Select Location</label>
            <details id="allocationLocationPicker" class="allocation-multi-details">
              <summary class="allocation-multi-summary">
                <span id="allocationLocationSummaryLabel">Select locations</span>
              </summary>
              <div class="allocation-multi-menu" id="allocationLocationList"></div>
            </details>
            <small>Select one or many locations for distribution mode.</small>
          </div>
        </div>
        <div class="allocation-note">
          Fixed Cost shows the exact location-wise budget entered in Budget Planner. Distributed mode splits the entered amount or percentage equally across the selected locations.
        </div>
      `;
      matrixCard.parentElement.insertBefore(controlsCard, matrixCard);
    }

    let dbCard = $("allocationLocalDatabaseEnhanced");
    if (!dbCard) {
      dbCard = document.createElement("section");
      dbCard.id = "allocationLocalDatabaseEnhanced";
      dbCard.className = "section-card allocation-db-card";
      dbCard.innerHTML = `
        <div class="section-header">
          <div>
            <h3>Allocation Local Database</h3>
            <p>Live allocation rows created from the current controls and Budget Planner data.</p>
          </div>
        </div>
        <div id="allocationEnhancedDbBody"></div>
      `;
      matrixCard.insertAdjacentElement("afterend", dbCard);
    }

    matrixCard.innerHTML = `
      <div class="section-header">
        <div>
          <h3>Coding / Item / Owner Allocation Matrix</h3>
          <p>Location columns show either the original fixed-cost budget from Budget Planner, or the current equal split from distribution mode.</p>
        </div>
      </div>
      <div id="allocationEnhancedMatrixBody"></div>
    `;

    const uiState = readUiState();
    const modeInput = $("allocationEnhancedMode");
    const amountInput = $("allocationEnhancedAmount");
    const percentInput = $("allocationEnhancedPercent");
    if (modeInput) {
      modeInput.value = uiState.mode;
    }
    if (amountInput) {
      amountInput.value = uiState.amount;
    }
    if (percentInput) {
      percentInput.value = uiState.percent;
    }

    populateAllocationLocations(LOCATIONS);
    bindAllocationControls();
    syncAllocationControlVisibility();
    renderAllocationOutputs();
  }

  function refreshEnhancements() {
    injectStyles();
    ensurePlannerCostDistributionControl();
    updatePlannerMetricVisibility();
    ensureAllocationControlsCard();
  }

  function bindGlobalListeners() {
    document.addEventListener("change", function (event) {
      const target = event.target;
      if (!target) {
        return;
      }

      if (
        target.id === "plannerCostDistributionInput" ||
        target.id === "financialYearInput" ||
        target.id === "maxHospitalInput"
      ) {
        updatePlannerMetricVisibility();
      }
    });

    document.addEventListener("click", function (event) {
      const target = event.target;
      if (!target) {
        return;
      }

      const label = cleanText(target.textContent || target.value || "");
      if (/add record|update record|delete|clear form|budget planner|allocation-fixed and % wise|allocation/i.test(label)) {
        window.setTimeout(scheduleRefresh, 120);
      }
    });

    window.addEventListener("storage", scheduleRefresh);
  }

  function startObservers() {
    window.setTimeout(scheduleRefresh, 150);
    window.setTimeout(scheduleRefresh, 600);
    window.setTimeout(scheduleRefresh, 1400);
  }

  function init() {
    refreshEnhancements();
    bindGlobalListeners();
    startObservers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
