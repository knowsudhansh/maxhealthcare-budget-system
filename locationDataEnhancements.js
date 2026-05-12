(function () {
  const DETAIL_DB_KEY = "it_opex_location_detail_rows_v1";
  const STYLE_ID = "location-data-enhancements-style";
  let pendingSnapshot = null;

  const IDS = {
    costDistribution: ["plannerCostDistributionInput"],
    financialYear: ["financialYearInput"],
    location: ["maxHospitalInput"],
    locationLe: ["locLeInput", "locationLeInput"],
    locationFyCurrent: ["locFyCurrentInput", "locationFyCurrentInput"],
    locationFyLast: ["locFyLastInput", "locationFyLastInput"],
    percentChange: ["locPercentInput", "locationPercentInput"],
    totalBudgetCurrentYear: ["totalBudgetCurrentYearInput"],
    totalBudgetLastYear: ["totalBudgetLastYearInput"],
    sharePercent: ["sharePercentageInput"],
    cumulativePercent: ["cumulativePercentageInput"],
    newAmc: ["newAmcFy26Input", "newAmcFyInput", "newAmcForFyInput"],
    newProject: ["newProjectInput"],
    annualized: ["annualizedInput"],
    priceIncrease: ["priceIncreaseInput"],
    newUnit: ["newUnitInput"],
    licenseIncrease: ["licenseIncreaseInput"],
    rest: ["restInput"],
    total: ["locationDataTotalInput", "plannerLocationTotalInput"],
    totalLocation: ["locationDataTotalLocationInput", "plannerLocationTotalLocationInput"],
    justification: ["locationDataJustificationInput", "justificationInput"]
  };

  let refreshTimer = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function cleanText(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeText(value) {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function toNumber(value) {
    const raw = String(value == null ? "" : value).replace(/,/g, "").replace(/%/g, "").trim();
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

  function getElementByIds(ids) {
    for (let i = 0; i < ids.length; i += 1) {
      const element = $(ids[i]);
      if (element) {
        return element;
      }
    }
    return null;
  }

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function findLooseKey(source, wantedKeys) {
    if (!isPlainObject(source)) {
      return null;
    }
    const keys = Object.keys(source);
    const wanted = wantedKeys.map(normalizeText);
    for (let i = 0; i < keys.length; i += 1) {
      if (wanted.includes(normalizeText(keys[i]))) {
        return keys[i];
      }
    }
    return null;
  }

  function getLooseValue(source, wantedKeys) {
    const key = findLooseKey(source, wantedKeys);
    return key ? source[key] : "";
  }

  function findFieldCardByLabel(pattern, root) {
    const scope = root || document;
    const labels = scope.querySelectorAll("label");
    for (let i = 0; i < labels.length; i += 1) {
      const label = labels[i];
      if (!pattern.test(cleanText(label.textContent))) {
        continue;
      }
      const card = label.closest(".field-card");
      if (!card) {
        continue;
      }
      const field = card.querySelector("input, select, textarea");
      if (field) {
        return field;
      }
    }
    return null;
  }

  function findPlannerField(name) {
    const direct = getElementByIds(IDS[name] || []);
    if (direct) {
      return direct;
    }

    const root = $("plannerView") || document;
    if (name === "total") {
      return findFieldCardByLabel(/\b(total|ho total|.* total)\b/i, root);
    }
    if (name === "totalLocation") {
      return findFieldCardByLabel(/\btotal location\b/i, root);
    }
    if (name === "sharePercent") {
      return findFieldCardByLabel(/% of share/i, root);
    }
    if (name === "cumulativePercent") {
      return findFieldCardByLabel(/cumulative/i, root);
    }
    if (name === "totalBudgetCurrentYear") {
      return findFieldCardByLabel(/total budget fy|total budget of current year/i, root);
    }
    if (name === "totalBudgetLastYear") {
      return findFieldCardByLabel(/total budget.*last year|total budget fy/i, root);
    }

    return null;
  }

  function shouldHidePlannerLocationCard(labelText) {
    const text = cleanText(labelText).toLowerCase();
    if (!text) {
      return false;
    }
    if (text.includes("total budget fy")) {
      return true;
    }
    if (text.includes("% of share")) {
      return true;
    }
    if (text.includes("cumulative %")) {
      return true;
    }
    if (text.includes("justification")) {
      return true;
    }
    if (text.endsWith(" total") && !text.includes("total location")) {
      return true;
    }
    return false;
  }

  function updatePlannerLocationCardVisibility() {
    const plannerView = $("plannerView");
    if (!plannerView) {
      return;
    }

    const cards = plannerView.querySelectorAll(".field-card");
    cards.forEach(function (card) {
      const label = card.querySelector("label");
      if (!label) {
        return;
      }
      const shouldHide = shouldHidePlannerLocationCard(label.textContent);
      card.style.display = shouldHide ? "none" : "";
      card.setAttribute("data-summary-only", shouldHide ? "true" : "false");
    });
  }

  function readFieldValue(name) {
    const field = findPlannerField(name);
    if (!field) {
      return "";
    }
    return "value" in field ? field.value : field.textContent;
  }

  function writeFieldValue(name, value) {
    const field = findPlannerField(name);
    if (!field) {
      return;
    }
    if ("value" in field) {
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      field.textContent = value;
    }
  }

  function writeFieldValueSilently(name, value) {
    const field = findPlannerField(name);
    if (!field) {
      return;
    }
    if ("value" in field) {
      field.value = value;
    } else {
      field.textContent = value;
    }
  }

  function parsePercent(value) {
    return toNumber(value);
  }

  function loadDetailRows() {
    try {
      const raw = localStorage.getItem(DETAIL_DB_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function looksLikeSavedPlannerRow(row) {
    if (!isPlainObject(row)) {
      return false;
    }
    const financialYear = cleanText(getLooseValue(row, ["financialYear", "Financial Year"]));
    const location = cleanText(getLooseValue(row, ["maxHospital", "MAX Hospital", "location", "Location"]));
    return Boolean(financialYear && location);
  }

  function bootstrapRowFromSavedRow(row) {
    const financialYear = cleanText(getLooseValue(row, ["financialYear", "Financial Year"]));
    const location = cleanText(getLooseValue(row, ["maxHospital", "MAX Hospital", "location", "Location"]));
    const locationLe = toNumber(getLooseValue(row, ["locationLe", "Location LE", "locLe"]));
    const locationFyCurrent = toNumber(getLooseValue(row, ["locationFyCurrent", "Location FY Current", "locFyCurrent"]));
    const locationFyLast = toNumber(getLooseValue(row, ["locationFyLast", "Location FY Last", "locFyLast"]));
    const totalBudgetCurrentYear = toNumber(getLooseValue(row, ["totalBudgetCurrentYear", "Total Budget of Current Year"]));
    const totalBudgetLastYear = toNumber(getLooseValue(row, ["totalBudgetLastYear", "Total Budget of Last Year"]));
    const newAmc = toNumber(getLooseValue(row, ["newAmcFy", "newAmcFy26", "newAmcForFy", "New AMC for FY 26", "New AMC for FY"]));
    const newProject = toNumber(getLooseValue(row, ["newProject", "New Project"]));
    const annualized = toNumber(getLooseValue(row, ["annualized", "Annualized"]));
    const priceIncrease = toNumber(getLooseValue(row, ["priceIncrease", "Price increase", "Price Increase"]));
    const newUnit = toNumber(getLooseValue(row, ["newUnit", "New Unit"]));
    const licenseIncrease = toNumber(getLooseValue(row, ["licenseIncrease", "License increase", "License Increase"]));
    const rest = toNumber(getLooseValue(row, ["rest", "Rest"]));
    const total = newAmc + newProject + annualized + priceIncrease + newUnit + licenseIncrease + rest;
    const differenceAmount = locationFyCurrent - locationLe;
    const differencePercentage = locationLe ? (differenceAmount / locationLe) * 100 : 0;
    const sharePercent = parsePercent(getLooseValue(row, ["sharePercent", "% of Share", "share"])) || (totalBudgetCurrentYear ? (locationFyCurrent / totalBudgetCurrentYear) * 100 : 0);
    const totalLocation = toNumber(getLooseValue(row, ["totalLocation", "Total Location"])) || total;
    const leBase = locationLe || 0;

    return {
      id: financialYear + "|" + location,
      savedAt: getLooseValue(row, ["savedAt", "Saved At"]) || new Date().toISOString(),
      costDistribution: cleanText(getLooseValue(row, ["costDistribution", "Cost Distribution"])) || "Fixed Cost",
      financialYear: financialYear,
      previousFinancialYear: getPreviousFinancialYear(financialYear),
      location: location,
      leFy25: locationLe,
      budgetFy26: locationFyCurrent,
      locationLe: locationLe,
      locationFyCurrent: locationFyCurrent,
      locationFyLast: locationFyLast,
      percentChange: parsePercent(getLooseValue(row, ["percentChange", "% Change", "Percentage"])) || differencePercentage,
      differenceAmount: toNumber(getLooseValue(row, ["differenceAmount", "Difference in Amount"])) || differenceAmount,
      differencePercentage: parsePercent(getLooseValue(row, ["differencePercentage", "Difference in Percentage(%)"])) || differencePercentage,
      totalBudgetCurrentYear: totalBudgetCurrentYear,
      totalBudgetLastYear: totalBudgetLastYear,
      sharePercent: sharePercent,
      cumulativePercent: parsePercent(getLooseValue(row, ["cumulativePercent", "Cumulative %"])) || sharePercent,
      newAmc: newAmc,
      newAmcPercent: toNumber(getLooseValue(row, ["newAmcPercent", "New AMC %"])) || (leBase ? (newAmc / leBase) * 100 : 0),
      newProject: newProject,
      newProjectPercent: toNumber(getLooseValue(row, ["newProjectPercent", "New Project %"])) || (leBase ? (newProject / leBase) * 100 : 0),
      annualized: annualized,
      annualizedPercent: toNumber(getLooseValue(row, ["annualizedPercent", "Annualized %", "Anuualized %"])) || (leBase ? (annualized / leBase) * 100 : 0),
      priceIncrease: priceIncrease,
      priceIncreasePercent: toNumber(getLooseValue(row, ["priceIncreasePercent", "Price Increase %"])) || (leBase ? (priceIncrease / leBase) * 100 : 0),
      newUnit: newUnit,
      newUnitPercent: toNumber(getLooseValue(row, ["newUnitPercent", "New Unit%"])) || (leBase ? (newUnit / leBase) * 100 : 0),
      licenseIncrease: licenseIncrease,
      licenseIncreasePercent: toNumber(getLooseValue(row, ["licenseIncreasePercent", "License Increase %"])) || (leBase ? (licenseIncrease / leBase) * 100 : 0),
      rest: rest,
      restPercent: toNumber(getLooseValue(row, ["restPercent", "Rest %"])) || (leBase ? (rest / leBase) * 100 : 0),
      total: toNumber(getLooseValue(row, ["total", "Total"])) || total,
      totalLocation: totalLocation,
      justification: cleanText(getLooseValue(row, ["justification", "Justification"]))
    };
  }

  function bootstrapExistingRows() {
    const existing = loadDetailRows();
    const map = new Map(existing.map(function (row) { return [row.id, row]; }));

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
        walkSavedRows(parsed, map);
      } catch (_error) {
        // Ignore non-JSON localStorage entries.
      }
    }

    const rows = computeCumulative(Array.from(map.values()));
    saveDetailRows(rows);
  }

  function walkSavedRows(node, map) {
    if (Array.isArray(node)) {
      node.forEach(function (item) {
        walkSavedRows(item, map);
      });
      return;
    }

    if (!isPlainObject(node)) {
      return;
    }

    if (looksLikeSavedPlannerRow(node)) {
      const normalized = bootstrapRowFromSavedRow(node);
      if (normalized.financialYear && normalized.location && !map.has(normalized.id)) {
        map.set(normalized.id, normalized);
      }
      return;
    }

    Object.keys(node).forEach(function (key) {
      const value = node[key];
      if (Array.isArray(value) || isPlainObject(value)) {
        walkSavedRows(value, map);
      }
    });
  }

  function saveDetailRows(rows) {
    localStorage.setItem(DETAIL_DB_KEY, JSON.stringify(rows));
  }

  function getPreviousFinancialYear(financialYear) {
    const match = cleanText(financialYear).match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return "";
    }
    const start = Number(match[1]) - 1;
    const endShort = String((Number(match[2]) + 99) % 100).padStart(2, "0");
    return start + "-" + endShort;
  }

  function readPlannerSnapshot() {
    const financialYear = cleanText(readFieldValue("financialYear"));
    const location = cleanText(readFieldValue("location"));
    const locationLe = toNumber(readFieldValue("locationLe"));
    const locationFyCurrent = toNumber(readFieldValue("locationFyCurrent"));
    const locationFyLast = toNumber(readFieldValue("locationFyLast"));
    const totalBudgetCurrentYear = toNumber(readFieldValue("totalBudgetCurrentYear"));
    const totalBudgetLastYear = toNumber(readFieldValue("totalBudgetLastYear"));
    const newAmc = toNumber(readFieldValue("newAmc"));
    const newProject = toNumber(readFieldValue("newProject"));
    const annualized = toNumber(readFieldValue("annualized"));
    const priceIncrease = toNumber(readFieldValue("priceIncrease"));
    const newUnit = toNumber(readFieldValue("newUnit"));
    const licenseIncrease = toNumber(readFieldValue("licenseIncrease"));
    const rest = toNumber(readFieldValue("rest"));
    const total = newAmc + newProject + annualized + priceIncrease + newUnit + licenseIncrease + rest;
    const totalLocationFieldValue = toNumber(readFieldValue("totalLocation"));
    const totalLocation = totalLocationFieldValue || total;
    const differenceAmount = locationFyCurrent - locationLe;
    const differencePercentage = locationLe ? (differenceAmount / locationLe) * 100 : 0;
    const sharePercent = totalBudgetCurrentYear ? (locationFyCurrent / totalBudgetCurrentYear) * 100 : 0;
    const leBase = locationLe || 0;
    const newAmcPercent = leBase ? (newAmc / leBase) * 100 : 0;
    const newProjectPercent = leBase ? (newProject / leBase) * 100 : 0;
    const annualizedPercent = leBase ? (annualized / leBase) * 100 : 0;
    const priceIncreasePercent = leBase ? (priceIncrease / leBase) * 100 : 0;
    const newUnitPercent = leBase ? (newUnit / leBase) * 100 : 0;
    const licenseIncreasePercent = leBase ? (licenseIncrease / leBase) * 100 : 0;
    const restPercent = leBase ? (rest / leBase) * 100 : 0;
    const justification = cleanText(readFieldValue("justification"));

    return {
      id: financialYear + "|" + location,
      savedAt: new Date().toISOString(),
      costDistribution: cleanText(readFieldValue("costDistribution")) || "Fixed Cost",
      financialYear: financialYear,
      previousFinancialYear: getPreviousFinancialYear(financialYear),
      location: location,
      leFy25: locationLe,
      budgetFy26: locationFyCurrent,
      locationLe: locationLe,
      locationFyCurrent: locationFyCurrent,
      locationFyLast: locationFyLast,
      percentChange: differencePercentage,
      differenceAmount: differenceAmount,
      differencePercentage: differencePercentage,
      totalBudgetCurrentYear: totalBudgetCurrentYear,
      totalBudgetLastYear: totalBudgetLastYear,
      sharePercent: sharePercent,
      cumulativePercent: sharePercent,
      newAmc: newAmc,
      newAmcPercent: newAmcPercent,
      newProject: newProject,
      newProjectPercent: newProjectPercent,
      annualized: annualized,
      annualizedPercent: annualizedPercent,
      priceIncrease: priceIncrease,
      priceIncreasePercent: priceIncreasePercent,
      newUnit: newUnit,
      newUnitPercent: newUnitPercent,
      licenseIncrease: licenseIncrease,
      licenseIncreasePercent: licenseIncreasePercent,
      rest: rest,
      restPercent: restPercent,
      total: total,
      totalLocation: totalLocation,
      justification: justification
    };
  }

  function computeCumulative(rows) {
    const grouped = {};
    rows.forEach(function (row) {
      const key = row.financialYear || "all";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(row);
    });

    Object.keys(grouped).forEach(function (key) {
      let running = 0;
      grouped[key]
        .sort(function (left, right) {
          return cleanText(left.location).localeCompare(cleanText(right.location));
        })
        .forEach(function (row) {
          running += Number(row.sharePercent || 0);
          row.cumulativePercent = running;
        });
    });

    return rows;
  }

  function syncPlannerComputedFields() {
    const snapshot = readPlannerSnapshot();
    if (!snapshot.financialYear || !snapshot.location || snapshot.costDistribution !== "Fixed Cost") {
      return;
    }

    const existingRows = loadDetailRows().filter(function (row) {
      return row.id !== snapshot.id;
    });
    const mergedRows = computeCumulative(existingRows.concat([snapshot]));
    const currentRow = mergedRows.find(function (row) {
      return row.id === snapshot.id;
    }) || snapshot;

    writeFieldValueSilently("percentChange", formatPercent(currentRow.percentChange));
    writeFieldValueSilently("sharePercent", formatPercent(currentRow.sharePercent));
    writeFieldValueSilently("cumulativePercent", formatPercent(currentRow.cumulativePercent));
    writeFieldValueSilently("total", formatNumber(currentRow.total));
    writeFieldValueSilently("totalLocation", formatNumber(currentRow.totalLocation));
  }

  function persistPlannerSnapshot(snapshot) {
    const source = snapshot || readPlannerSnapshot();
    const currentSnapshot = source || readPlannerSnapshot();
    const snapshotToSave = currentSnapshot;
    pendingSnapshot = null;
    if (!snapshotToSave.financialYear || !snapshotToSave.location || snapshotToSave.costDistribution !== "Fixed Cost") {
      return;
    }

    const rows = loadDetailRows().filter(function (row) {
      return row.id !== snapshotToSave.id;
    });
    rows.push(snapshotToSave);
    computeCumulative(rows);
    saveDetailRows(rows);
    syncPlannerComputedFields();
    renderLocationSummaryDetails();
  }

  function injectStyles() {
    if ($(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .location-summary-detail-card {
        margin-top: 18px;
      }

      .location-summary-detail-meta {
        color: #5d7690;
        font-size: 0.88rem;
      }

      .location-summary-detail-wrap {
        overflow: auto;
        border: 1px solid #d6e6f6;
        border-radius: 18px;
        background: #fff;
      }

      .location-summary-detail-table {
        width: 100%;
        min-width: 2100px;
        border-collapse: collapse;
      }

      .location-summary-detail-table th,
      .location-summary-detail-table td {
        padding: 11px 12px;
        border-bottom: 1px solid #e9f1f8;
        text-align: left;
        white-space: nowrap;
        font-size: 0.9rem;
        color: #16395f;
      }

      .location-summary-detail-table thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #eef6fd;
        color: #21486f;
        text-transform: uppercase;
        font-size: 0.74rem;
        letter-spacing: 0.03em;
      }

      .location-summary-empty {
        padding: 24px;
        color: #64809a;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  function getSummaryFilters(view) {
    const result = {
      location: "All",
      year: "All"
    };

    if (!view) {
      return result;
    }

    const cards = view.querySelectorAll(".field-card");
    cards.forEach(function (card) {
      const label = cleanText(card.querySelector("label") && card.querySelector("label").textContent);
      const field = card.querySelector("select, input");
      if (!field) {
        return;
      }
      if (/location/i.test(label)) {
        result.location = cleanText(field.value) || "All";
      }
      if (/financial year|year/i.test(label)) {
        result.year = cleanText(field.value) || "All";
      }
    });

    return result;
  }

  function renderLocationSummaryDetails() {
    const view = $("locationSummaryView");
    if (!view) {
      return;
    }

    let card = $("locationSummaryDetailedData");
    if (!card) {
      card = document.createElement("section");
      card.id = "locationSummaryDetailedData";
      card.className = "section-card location-summary-detail-card";
      card.innerHTML = `
        <div class="section-header">
          <div>
            <h3>Location Data Local Database</h3>
            <p>All location data fields moved from Budget Planner, including total-budget values, share, cumulative percentage, totals, and justification.</p>
          </div>
          <div id="locationSummaryDetailMeta" class="location-summary-detail-meta"></div>
        </div>
        <div id="locationSummaryDetailBody"></div>
      `;
      view.appendChild(card);
    }

    const filters = getSummaryFilters(view);
    const meta = $("locationSummaryDetailMeta");
    const body = $("locationSummaryDetailBody");
    if (!body) {
      return;
    }

    let rows = loadDetailRows().slice();
    computeCumulative(rows);
    rows = rows.filter(function (row) {
      const locationMatch = filters.location === "All" || !filters.location || row.location === filters.location;
      const yearMatch = filters.year === "All" || !filters.year || row.financialYear === filters.year;
      return locationMatch && yearMatch;
    });

    if (meta) {
      meta.textContent = rows.length + " row(s) shown";
    }

    if (!rows.length) {
      body.innerHTML = '<div class="location-summary-empty">No location detail data saved yet. Add or update a Budget Planner row with Fixed Cost selected to populate this section.</div>';
      return;
    }

    body.innerHTML = `
      <div class="location-summary-detail-wrap">
        <table class="location-summary-detail-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Saved At</th>
              <th>Financial Year</th>
              <th>Location</th>
              <th>LE FY 25</th>
              <th>Budget FY 26</th>
              <th>Difference in Percentage(%)</th>
              <th>Difference in Amount</th>
              <th>Total Budget of Current Year</th>
              <th>Total Budget of Last Year</th>
              <th>% of Share</th>
              <th>Cumulative %</th>
              <th>New AMC</th>
              <th>New AMC %</th>
              <th>New Project</th>
              <th>New Project %</th>
              <th>Annualized</th>
              <th>Annualized %</th>
              <th>Price Increase</th>
              <th>Price Increase %</th>
              <th>New Unit</th>
              <th>New Unit %</th>
              <th>License Increase</th>
              <th>License Increase %</th>
              <th>Rest</th>
              <th>Rest %</th>
              <th>Total</th>
              <th>Total Location</th>
              <th>Justification</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(function (row, index) {
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${row.savedAt ? new Date(row.savedAt).toLocaleString() : "-"}</td>
                  <td>${row.financialYear || "-"}</td>
                  <td>${row.location || "-"}</td>
                  <td>${formatNumber(row.leFy25)}</td>
                  <td>${formatNumber(row.budgetFy26)}</td>
                  <td>${formatPercent(row.differencePercentage)}</td>
                  <td>${formatNumber(row.differenceAmount)}</td>
                  <td>${formatNumber(row.totalBudgetCurrentYear)}</td>
                  <td>${formatNumber(row.totalBudgetLastYear)}</td>
                  <td>${formatPercent(row.sharePercent)}</td>
                  <td>${formatPercent(row.cumulativePercent)}</td>
                  <td>${formatNumber(row.newAmc)}</td>
                  <td>${formatPercent(row.newAmcPercent)}</td>
                  <td>${formatNumber(row.newProject)}</td>
                  <td>${formatPercent(row.newProjectPercent)}</td>
                  <td>${formatNumber(row.annualized)}</td>
                  <td>${formatPercent(row.annualizedPercent)}</td>
                  <td>${formatNumber(row.priceIncrease)}</td>
                  <td>${formatPercent(row.priceIncreasePercent)}</td>
                  <td>${formatNumber(row.newUnit)}</td>
                  <td>${formatPercent(row.newUnitPercent)}</td>
                  <td>${formatNumber(row.licenseIncrease)}</td>
                  <td>${formatPercent(row.licenseIncreasePercent)}</td>
                  <td>${formatNumber(row.rest)}</td>
                  <td>${formatPercent(row.restPercent)}</td>
                  <td>${formatNumber(row.total)}</td>
                  <td>${formatNumber(row.totalLocation)}</td>
                  <td>${row.justification || "-"}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(function () {
      injectStyles();
      updatePlannerLocationCardVisibility();
      syncPlannerComputedFields();
      renderLocationSummaryDetails();
    }, 80);
  }

  function bindEvents() {
    document.addEventListener("input", function (event) {
      const target = event.target;
      if (!target) {
        return;
      }

      const relevantIds = [
        "plannerCostDistributionInput",
        "financialYearInput",
        "maxHospitalInput",
        "locLeInput",
        "locFyCurrentInput",
        "locFyLastInput",
        "totalBudgetCurrentYearInput",
        "totalBudgetLastYearInput",
        "newAmcFy26Input",
        "newProjectInput",
        "annualizedInput",
        "priceIncreaseInput",
        "newUnitInput",
        "licenseIncreaseInput",
        "restInput",
        "locationDataJustificationInput"
      ];

      if (relevantIds.includes(target.id)) {
        scheduleRefresh();
      }
    });

    document.addEventListener("change", function (event) {
      const target = event.target;
      if (!target) {
        return;
      }

      if (
        [
          "plannerCostDistributionInput",
          "financialYearInput",
          "maxHospitalInput",
          "totalBudgetCurrentYearInput",
          "totalBudgetLastYearInput"
        ].includes(target.id)
      ) {
        scheduleRefresh();
      }

      if (target.closest && target.closest("#locationSummaryView")) {
        scheduleRefresh();
      }
    });

    document.addEventListener("click", function (event) {
      const button = event.target && event.target.closest("button");
      if (!button) {
        return;
      }

      const label = cleanText(button.textContent || button.value || "");
      if (/add record|update record/i.test(label)) {
        pendingSnapshot = readPlannerSnapshot();
        window.setTimeout(function () {
          persistPlannerSnapshot(pendingSnapshot);
        }, 160);
      }
      if (/location summary/i.test(label)) {
        window.setTimeout(renderLocationSummaryDetails, 120);
      }
    }, true);

    window.addEventListener("storage", scheduleRefresh);
  }

  function init() {
    injectStyles();
    bootstrapExistingRows();
    updatePlannerLocationCardVisibility();
    scheduleRefresh();
    bindEvents();
    window.setTimeout(scheduleRefresh, 400);
    window.setTimeout(scheduleRefresh, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
