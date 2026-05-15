(function () {
  const data = window.OpexData || {};
  const ui = window.OpexUI || {};
  const state = data.state || {};
  const h = data.helpers || {};
  const ALLOCATION_DB_KEY = "it_opex_allocation_db_v1";
  const ALLOCATION_MATRIX_EDITS_KEY = "it_opex_allocation_matrix_edits_v1";

  const DRIVER_KEYS = ["newAmc", "newProject", "annualized", "priceIncrease", "newUnit", "licenseIncrease", "rest"];

  function normalizeText(value) {
    return h.normalizeText ? h.normalizeText(value) : String(value || "").trim().toUpperCase();
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function num(value) {
    return h.toNumber ? h.toNumber(value) : Number(value || 0);
  }

  function allocationRoundedValue(value) {
    return Math.round(num(value) * 100) / 100;
  }

  function isAllocationDistributionMode(mode) {
    const normalized = normalizeText(mode);
    return normalized === "distributed" || normalized === "distribution";
  }

  function previousYearFor(year) {
    if (h.previousYear) return h.previousYear(year);
    const match = String(year || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) return "";
    const start = Number(match[1]) - 1;
    const end = String(Number(match[2]) - 1).padStart(2, "0");
    return `${start}-${end}`;
  }

  function createId() {
    return `row_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  function unique(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function getPlannerCodingOptions() {
    const fallback = Array.isArray(data.FALLBACK_OPTIONS && data.FALLBACK_OPTIONS.coding) ? data.FALLBACK_OPTIONS.coding : [];
    const fromRecords = (state.records || []).map((record) => record && record.coding);
    return unique([].concat(fallback, fromRecords));
  }

  function strictItemForCoding(codeValue) {
    const normalizedCode = normalizeText(codeValue);
    if (!normalizedCode) return "";

    // 1) Exact position mapping from fallback coding/item arrays.
    const fallbackCodings = Array.isArray(data.FALLBACK_OPTIONS && data.FALLBACK_OPTIONS.coding)
      ? data.FALLBACK_OPTIONS.coding
      : [];
    const fallbackItems = Array.isArray(data.FALLBACK_OPTIONS && data.FALLBACK_OPTIONS.item)
      ? data.FALLBACK_OPTIONS.item
      : [];
    const fallbackIndex = fallbackCodings.findIndex((coding) => normalizeText(coding) === normalizedCode);
    if (fallbackIndex >= 0 && fallbackItems[fallbackIndex]) return String(fallbackItems[fallbackIndex]).trim();

    // 2) Normalized map.
    const mapItem = data.CODE_ITEM_MAP ? data.CODE_ITEM_MAP[normalizedCode] : "";
    if (mapItem) return String(mapItem).trim();

    return "";
  }

  function findPlannerCodingMatch(query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return "";
    const options = getPlannerCodingOptions();
    const exactMatch = options.find((coding) => normalizeText(coding) === normalizedQuery);
    if (exactMatch) return exactMatch;

    const queryDigits = digitsOnly(query);
    if (queryDigits && queryDigits.length < 3) return "";

    if (queryDigits.length >= 3) {
      const digitMatches = options.filter((coding) => digitsOnly(coding).includes(queryDigits));
      const exactDigitMatch = digitMatches.find((coding) => digitsOnly(coding) === queryDigits);
      if (exactDigitMatch) return exactDigitMatch;
      const suffixDigitMatch = digitMatches.find((coding) => digitsOnly(coding).endsWith(queryDigits));
      if (suffixDigitMatch) return suffixDigitMatch;
      if (digitMatches.length === 1) return digitMatches[0];
    }

    const matches = options.filter((coding) => normalizeText(coding).includes(normalizedQuery));
    if (matches.length === 1) return matches[0];
    return matches.find((coding) => normalizeText(coding).endsWith(normalizedQuery)) || "";
  }

  function compactText(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, "");
  }

  function editDistance(left, right) {
    const a = compactText(left);
    const b = compactText(right);
    if (!a || !b) return Math.max(a.length, b.length);
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      }
      previous = current;
    }
    return previous[b.length];
  }

  function plannerItemCodingPairs() {
    const codingOptions = getPlannerCodingOptions();
    const codingByKey = {};
    codingOptions.forEach((coding) => {
      codingByKey[normalizeText(coding)] = coding;
    });

    const pairs = {};
    function addPair(coding, item) {
      const itemValue = String(item || "").trim();
      const codingKey = normalizeText(coding);
      if (!codingKey || !itemValue) return;
      const displayCoding = codingByKey[codingKey] || String(coding || "").toUpperCase();
      const key = `${codingKey}||${normalizeText(itemValue)}`;
      pairs[key] = { coding: displayCoding, item: itemValue };
    }

    Object.entries(data.CODE_ITEM_MAP || {}).forEach(([coding, item]) => addPair(coding, item));
    (state.records || []).forEach((record) => addPair(record && record.coding, record && record.item));
    return Object.values(pairs);
  }

  function findPlannerCodingByItemMatch(query) {
    const normalizedQuery = normalizeText(query);
    const compactQuery = compactText(query);
    if (!normalizedQuery || compactQuery.length < 4) return "";

    const pairs = plannerItemCodingPairs();
    const exact = pairs.find((pair) => normalizeText(pair.item) === normalizedQuery || compactText(pair.item) === compactQuery);
    if (exact) return exact.coding;

    const containsMatches = pairs.filter((pair) => {
      const normalizedItem = normalizeText(pair.item);
      const compactItem = compactText(pair.item);
      return normalizedItem.includes(normalizedQuery) || compactItem.includes(compactQuery);
    });
    if (containsMatches.length === 1) return containsMatches[0].coding;

    const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 2);
    const tokenMatches = queryTokens.length
      ? pairs.filter((pair) => queryTokens.every((token) => normalizeText(pair.item).includes(token)))
      : [];
    if (tokenMatches.length === 1) return tokenMatches[0].coding;

    if (compactQuery.length < 8) return "";
    const scored = pairs
      .map((pair) => ({ pair, score: editDistance(pair.item, query) }))
      .sort((left, right) => left.score - right.score);
    const best = scored[0];
    const next = scored[1];
    const threshold = compactQuery.length <= 12 ? 2 : 3;
    if (best && best.score <= threshold && (!next || next.score > best.score)) return best.pair.coding;
    return "";
  }

  function persist() {
    if (h.saveRecords) h.saveRecords(state.records || []);
  }

  function loadAllocationDb() {
    try {
      const raw = localStorage.getItem(ALLOCATION_DB_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function loadAllocationMatrixEdits() {
    try {
      const raw = localStorage.getItem(ALLOCATION_MATRIX_EDITS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed;
    } catch (_error) {
      return {};
    }
  }

  function saveAllocationDb() {
    try {
      localStorage.setItem(ALLOCATION_DB_KEY, JSON.stringify(state.allocationDb || []));
    } catch (_error) {
      // Ignore local storage errors.
    }
  }

  function saveAllocationMatrixEdits() {
    try {
      localStorage.setItem(ALLOCATION_MATRIX_EDITS_KEY, JSON.stringify(state.allocationMatrixEdits || {}));
    } catch (_error) {
      // Ignore local storage errors.
    }
  }

  function clearAllocationModalState() {
    state.allocationEditModal = null;
    state.allocationEditDraft = null;
    state.allocationEditDraftRowKey = "";
    state.allocationEditBase = null;
  }

  function resetForm() {
    state.form = h.defaultForm ? h.defaultForm() : {};
    state.editId = null;
  }

  function recalculateRecords(records) {
    const next = (records || []).map((record) => ({ ...record }));
    const totalsByYear = {};
    const runningByYear = {};

    next.forEach((record) => {
      record.locTotal = DRIVER_KEYS.reduce((sum, key) => sum + num(record[key]), 0);
      record.locPercent = num(record.locLe) ? ((num(record.locFyCurrent) - num(record.locLe)) / num(record.locLe)) * 100 : 0;
      const year = record.financialYear || "";
      totalsByYear[year] = (totalsByYear[year] || 0) + num(record.locFyCurrent);
    });

    next.forEach((record) => {
      const year = record.financialYear || "";
      const yearTotal = totalsByYear[year] || 0;
      const share = yearTotal ? (num(record.locFyCurrent) / yearTotal) * 100 : 0;
      runningByYear[year] = (runningByYear[year] || 0) + share;
      record.sharePercent = share;
      record.cumulativePercent = runningByYear[year];
    });

    return next.map((record) => (h.normalizeRecord ? h.normalizeRecord(record) : record));
  }

  function applyCodingProfile(codeValue) {
    const normalizedCode = normalizeText(codeValue);
    if (!normalizedCode) return;

    const profile = (data.CODE_PROFILE_MAP && data.CODE_PROFILE_MAP[normalizedCode]) || {};
    const item = data.CODE_ITEM_MAP ? data.CODE_ITEM_MAP[normalizedCode] : "";

    if (item) state.form.item = item;

    ["subCategoryMapped", "categoryIt", "subCategory", "newCategory", "appCate", "cate3", "cate4"].forEach((key) => {
      if (profile[key]) state.form[key] = profile[key];
    });

    const learnedProfiles = h.buildCodingProfiles ? h.buildCodingProfiles(state.records || []) : {};
    const learned = learnedProfiles[normalizedCode] || {};
    ["item", "subCategoryMapped", "categoryIt", "subCategory", "newCategory", "appCate", "cate3", "cate4"].forEach((key) => {
      if (!state.form[key] && learned[key]) state.form[key] = learned[key];
    });
  }

  function applyCodingProfileToAllocation(codeValue) {
    const normalizedCode = normalizeText(codeValue);
    if (!normalizedCode) return;
    if (!state.allocationControls) state.allocationControls = {};

    const profile = (data.CODE_PROFILE_MAP && data.CODE_PROFILE_MAP[normalizedCode]) || {};
    const item = strictItemForCoding(codeValue);
    if (item) state.allocationControls.item = item;

    [
      "subCategoryMapped",
      "categoryIt",
      "subCategory",
      "newCategory",
      "appCate",
      "cate3",
      "cate4",
      "costCenterDepartment"
    ].forEach((key) => {
      if (profile[key]) state.allocationControls[key] = profile[key];
    });

    const learnedProfiles = h.buildCodingProfiles ? h.buildCodingProfiles(state.records || []) : {};
    const learned = learnedProfiles[normalizedCode] || {};
    [
      "item",
      "subCategoryMapped",
      "categoryIt",
      "subCategory",
      "newCategory",
      "appCate",
      "cate3",
      "cate4",
      "costCenterDepartment"
    ].forEach((key) => {
      if (!state.allocationControls[key] && learned[key]) state.allocationControls[key] = learned[key];
    });
  }

  function isPlannerProjectEntry(form) {
    const values = [form && form.newCategory, form && form.cate3, form && form.cate4, form && form.subCategory];
    return values.some((value) => normalizeText(value).includes("new project"));
  }

  function findPreviousPlannerRecord(form) {
    const codingKey = normalizeText(form && form.coding);
    const locationKey = normalizeText(form && form.location);
    const previousYear = previousYearFor(form && form.financialYear);
    if (!codingKey || !locationKey || !previousYear) return null;

    const records = Array.isArray(state.records) ? state.records : [];
    const exactMatches = records.filter(
      (record) =>
        normalizeText(record.coding) === codingKey &&
        normalizeText(record.location) === locationKey &&
        String(record.financialYear || "") === String(previousYear)
    );
    if (!exactMatches.length) return null;

    return exactMatches
      .slice()
      .sort((left, right) => new Date(right.savedAt || 0).getTime() - new Date(left.savedAt || 0).getTime())[0];
  }

  function syncPlannerHistoricalValues(changedKey) {
    const form = { ...(state.form || {}) };
    const dependencyKeys = new Set(["coding", "financialYear", "location", "newCategory", "cate3", "cate4", "subCategory"]);
    if (!dependencyKeys.has(changedKey)) return;

    const hasPlannerContext = form.coding && form.financialYear && form.location;
    if (!hasPlannerContext) {
      form.locFyLast = "";
      form.locLe = "";
      state.form = form;
      return;
    }

    if (isPlannerProjectEntry(form)) {
      form.locFyLast = "";
      form.locLe = "";
      form.locPercent = "0.00";
      state.form = form;
      return;
    }

    const previousRecord = findPreviousPlannerRecord(form);
    if (!previousRecord) {
      form.locFyLast = "";
      form.locLe = "";
      form.locPercent = "0.00";
      state.form = form;
      return;
    }

    form.locFyLast =
      previousRecord.locFyCurrent !== undefined && previousRecord.locFyCurrent !== null && previousRecord.locFyCurrent !== ""
        ? String(previousRecord.locFyCurrent)
        : "";
    form.locLe =
      previousRecord.locLe !== undefined && previousRecord.locLe !== null && previousRecord.locLe !== ""
        ? String(previousRecord.locLe)
        : form.locFyLast;

    state.form = form;
  }

  function recordFromForm() {
    const base = { ...(state.form || {}) };
    base.id = state.editId || base.id || createId();
    base.locTotal = DRIVER_KEYS.reduce((sum, key) => sum + num(base[key]), 0);
    base.locPercent = num(base.locLe) ? ((num(base.locFyCurrent) - num(base.locLe)) / num(base.locLe)) * 100 : 0;
    base.sharePercent = num(base.totalBudgetCurrentYear) ? (num(base.locFyCurrent) / num(base.totalBudgetCurrentYear)) * 100 : 0;
    if (!base.cumulativePercent) base.cumulativePercent = base.sharePercent;
    return h.normalizeRecord ? h.normalizeRecord(base) : base;
  }

 function saveCurrentRecord() {
  const record = recordFromForm();
  if (!record.coding && !record.item && !record.location) return;

  fetch("https://maxhealthcare-budget-system-production.up.railway.app/api/budget-submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(record)
  })
  .then(res => res.json())
  .then(data => {
    console.log("Saved to Railway DB:", data);
  })
  .catch(err => {
    console.error("Railway save failed:", err);
  });

  const existingIndex = (state.records || []).findIndex((row) => row.id === record.id);

  if (existingIndex >= 0) {
    state.records.splice(existingIndex, 1, record);
  } else {
    state.records.push(record);
  }

  state.records = recalculateRecords(state.records);

  persist();
  resetForm();
  state.activeView = "plannerView";
}

  function editRecord(id) {
    const record = (state.records || []).find((row) => row.id === id);
    if (!record) return;
    state.form = h.defaultForm ? h.defaultForm(record) : { ...record };
    state.editId = id;
    state.activeView = "plannerView";
  }

  function deleteRecord(id) {
    state.records = (state.records || []).filter((row) => row.id !== id);
    state.records = recalculateRecords(state.records);
    persist();
  }

  function downloadReport() {
    if (typeof XLSX === "undefined") return;
    const records = Array.isArray(state.records) ? state.records : [];
    const workbook = XLSX.utils.book_new();

    function appendSheet(name, rows) {
      const safe = Array.isArray(rows) && rows.length ? rows : [{ Message: "No data available for this sheet." }];
      const sheet = XLSX.utils.json_to_sheet(safe);
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    }

    function ownerValue(record) {
      return record.owner || record.owner1 || "";
    }

    function categoryValue(record) {
      return record.categoryIt || record.subCategoryMapped || record.appCate || "";
    }

    // Planner tab data.
    const plannerRows = records.map((record) => ({
      financialYear: record.financialYear || "",
      location: record.location || "",
      coding: record.coding || "",
      item: record.item || "",
      owner: ownerValue(record),
      categoryIt: categoryValue(record),
      currentFY: num(record.locFyCurrent),
      fyLastYear: num(record.locFyLast),
      le: num(record.locLe),
      percentChangeVsLastYear: num(record.locFyLast) ? ((num(record.locFyCurrent) - num(record.locFyLast)) / num(record.locFyLast)) * 100 : 0,
      newAmc: num(record.newAmc),
      newProject: num(record.newProject),
      annualized: num(record.annualized),
      priceIncrease: num(record.priceIncrease),
      newUnit: num(record.newUnit),
      licenseIncrease: num(record.licenseIncrease),
      rest: num(record.rest),
      total: num(record.locTotal)
    }));
    appendSheet("Planner Data", plannerRows);

    // Dashboard tab filtered data.
    const dashboardFilters = state.dashboardFilters || {};
    const dashboardRows = records.filter((record) => {
      const locationFilter = String(dashboardFilters.location || "").trim();
      const categoryFilter = String(dashboardFilters.category || "").trim();
      const yearFilter = String(dashboardFilters.financialYear || dashboardFilters.year || "").trim();
      const ownerFilter = String(dashboardFilters.owner || "").trim();
      const codingFilter = String(dashboardFilters.coding || "").trim();

      if (locationFilter && locationFilter !== "All" && String(record.location || "") !== locationFilter) return false;
      if (categoryFilter && categoryFilter !== "All" && categoryValue(record) !== categoryFilter) return false;
      if (yearFilter && yearFilter !== "All" && String(record.financialYear || "") !== yearFilter) return false;
      if (ownerFilter && ownerFilter !== "All" && ownerValue(record) !== ownerFilter) return false;
      if (codingFilter && codingFilter !== "All" && normalizeText(record.coding) !== normalizeText(codingFilter)) return false;
      return true;
    });
    appendSheet(
      "Dashboard Data",
      dashboardRows.map((record) => ({
        financialYear: record.financialYear || "",
        location: record.location || "",
        coding: record.coding || "",
        item: record.item || "",
        owner: ownerValue(record),
        categoryIt: categoryValue(record),
        currentFY: num(record.locFyCurrent),
        le: num(record.locLe),
        fyLastYear: num(record.locFyLast)
      }))
    );

    // Location Summary tab data.
    const summaryFilters = state.summaryFilters || {};
    const summaryRows = h.summaryRows ? h.summaryRows(records, {
      location: summaryFilters.location && summaryFilters.location !== "All" ? summaryFilters.location : "",
      financialYear: summaryFilters.financialYear && summaryFilters.financialYear !== "All" ? summaryFilters.financialYear : ""
    }) : [];
    appendSheet(
      "Location Summary",
      (summaryRows || []).map((row) => ({
        financialYear: row.financialYear || "",
        location: row.location || "",
        budgetCurrentYear: num(row.budgetFy26),
        budgetLastYear: num(row.totalBudgetLastYear),
        le: num(row.leFy25),
        differenceAmount: num(row.differenceAmount),
        differencePercent: num(row.differencePercent),
        total: num(row.total)
      }))
    );

    // Unit Wise Budget tab data.
    const unitRows = h.unitRows ? h.unitRows(records) : [];
    appendSheet(
      "Unit Wise Budget",
      (unitRows || []).map((row) => ({
        location: row.location || "",
        lyExpense: num(row.lyExpense),
        currentBudget: num(row.currentBudget),
        budgetIncrease: num(row.budgetIncrease),
        budgetIncreasePercent: num(row.budgetIncreasePercent),
        sharePercent: num(row.sharePercent),
        newExpansion: num(row.newExpansion)
      }))
    );

    // Allocation tab: merged fixed + distributed matrix with per-location amounts.
    const allocationCombinedRows = ui.getAllocationCombinedRowsForReport ? ui.getAllocationCombinedRowsForReport() : [];
    appendSheet("Allocation Combined", allocationCombinedRows);

    // Utilization tab data.
    const utilizationRows = h.utilizationRows ? h.utilizationRows(records) : [];
    appendSheet(
      "Utilization",
      (utilizationRows || []).map((row) => ({
        location: row.location || "",
        planned: num(row.planned),
        used: num(row.used),
        remaining: num(row.remaining),
        utilizationPercent: num(row.utilization)
      }))
    );

    // Comparison tab data based on selected comparison filters.
    const comparisonFilters = state.comparisonFilters || {};
    const comparisonRows = records.filter((record) => {
      if (comparisonFilters.financialYear && String(record.financialYear || "") !== String(comparisonFilters.financialYear)) return false;
      if (comparisonFilters.coding && normalizeText(record.coding) !== normalizeText(comparisonFilters.coding)) return false;
      if (comparisonFilters.location1 && comparisonFilters.location2) {
        const n1 = normalizeText(comparisonFilters.location1);
        const n2 = normalizeText(comparisonFilters.location2);
        const loc = normalizeText(record.location);
        if (loc !== n1 && loc !== n2) return false;
      }
      return true;
    });
    appendSheet(
      "Comparison Data",
      comparisonRows.map((record) => ({
        financialYear: record.financialYear || "",
        location: record.location || "",
        coding: record.coding || "",
        item: record.item || "",
        owner: ownerValue(record),
        currentFY: num(record.locFyCurrent),
        fyLastYear: num(record.locFyLast),
        le: num(record.locLe),
        fixedOrDistributed: record.__allocationType || "Fixed Cost"
      }))
    );

    XLSX.writeFile(workbook, "it-opex-budget-full-report.xlsx");
  }

  function setPlannerField(key, value) {
    if (key === "coding") {
      const matchedCoding = findPlannerCodingMatch(value);
      const resolvedCoding = matchedCoding || value;
      state.form.coding = resolvedCoding;
      applyCodingProfile(resolvedCoding);
      syncPlannerHistoricalValues("coding");
      return;
    }

    state.form[key] = value;
    if (key === "item") {
      const matchedCoding = findPlannerCodingByItemMatch(value);
      if (matchedCoding && normalizeText(matchedCoding) !== normalizeText(state.form.coding)) {
        state.form.coding = matchedCoding;
        applyCodingProfile(matchedCoding);
        syncPlannerHistoricalValues("coding");
        return;
      }
    }
    syncPlannerHistoricalValues(key);
  }

  function setDashboardFilter(key, value) {
    state.dashboardFilters[key] = value || "All";
  }

  function setSummaryFilter(key, value) {
    state.summaryFilters[key] = value || "All";
  }

  function setComparisonFilter(key, value) {
    state.comparisonFilters[key] = value || "";
  }

  function setAllocationControl(key, value) {
    if (key === "mode") value = "Distribution";
    if (key === "coding") {
      const codingValue = String(value || "").trim();
      state.allocationControls.coding = codingValue;
      state.allocationControls.codings = codingValue ? [codingValue] : [];
      return;
    }
    state.allocationControls[key] = value;
    if (key === "mode" && !isAllocationDistributionMode(value)) {
      state.allocationControls.coding = "";
      state.allocationControls.codings = [];
      state.allocationControls.owner = "";
    }
  }

  function resolveAllocationCodings(controls) {
    const selected = Array.isArray(controls && controls.codings) ? controls.codings.filter(Boolean) : [];
    const typed = String((controls && controls.coding) || "").trim() || String((controls && controls.codingSearch) || "").trim();
    const options = unique(
      []
        .concat(getPlannerCodingOptions ? getPlannerCodingOptions() : [])
        .concat((state.records || []).map((record) => record && record.coding))
    );
    const resolvedTyped = typed ? findPlannerCodingMatch(typed) || options.find((coding) => normalizeText(coding) === normalizeText(typed)) || typed : "";
    return unique([].concat(selected, resolvedTyped ? [resolvedTyped] : []));
  }

  function liveFieldValue(id, fallback) {
    const field = document.getElementById(id);
    if (field && "value" in field) return field.value;
    return fallback;
  }

  function syncPlannerFormFromDom() {
    if (!state.form) state.form = {};
    Array.from(document.querySelectorAll("[id^='planner-']")).forEach((field) => {
      if (!field || !field.id || !("value" in field)) return;
      const key = field.id.replace("planner-", "");
      state.form[key] = field.value;
    });

    const codingInput = document.getElementById("planner-coding");
    const codingValue = codingInput && "value" in codingInput ? codingInput.value : state.form.coding;
    const matchedCoding = findPlannerCodingMatch(codingValue);
    if (matchedCoding) {
      state.form.coding = matchedCoding;
      applyCodingProfile(matchedCoding);
    }

    const itemInput = document.getElementById("planner-item");
    const itemValue = itemInput && "value" in itemInput ? itemInput.value : state.form.item;
    if (itemValue) {
      state.form.item = itemValue;
      const matchedItemCoding = findPlannerCodingByItemMatch(itemValue);
      if (matchedItemCoding) {
        state.form.coding = matchedItemCoding;
        applyCodingProfile(matchedItemCoding);
      }
    }
  }

  function render() {
    if (ui.renderAll) ui.renderAll();
  }

  function updatePlannerLiveCalculations() {
    const leInput = document.getElementById("planner-locLe");
    const fyInput = document.getElementById("planner-locFyCurrent");
    const percentInput = document.getElementById("planner-locPercent");
    if (!leInput || !fyInput || !percentInput) return;

    const leValue = num(leInput.value);
    const fyValue = num(fyInput.value);
    const livePercent = leValue ? ((fyValue - leValue) / leValue) * 100 : 0;

    state.form.locLe = leInput.value;
    state.form.locFyCurrent = fyInput.value;
    percentInput.value = Number.isFinite(livePercent) ? livePercent.toFixed(2) : "0.00";
    state.form.locPercent = percentInput.value;
  }

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      state.activeView = viewButton.getAttribute("data-view");
      render();
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.getAttribute("data-action");
    const id = actionButton.getAttribute("data-id");

    if (action === "save-record") {
      syncPlannerFormFromDom();
      if (ui.preparePlannerSave) ui.preparePlannerSave();
      saveCurrentRecord();
      render();
      return;
    }
    if (action === "clear-form") {
      resetForm();
      render();
      return;
    }
    if (action === "edit-record" && id) {
      editRecord(id);
      render();
      return;
    }
    if (action === "delete-record" && id) {
      deleteRecord(id);
      render();
      return;
    }
    if (action === "download-report") {
      downloadReport();
      return;
    }
    if (action === "dashboard-export") {
      if (ui.exportDashboardPdf) ui.exportDashboardPdf();
      return;
    }
    if (action === "allocation-matrix-export") {
      if (ui.exportAllocationMatrixWorkbook) ui.exportAllocationMatrixWorkbook();
      return;
    }
    if (action === "planner-saved-export") {
      if (ui.exportPlannerSavedRecordsWorkbook) ui.exportPlannerSavedRecordsWorkbook();
      return;
    }
    if (action === "allocation-row-edit") {
      const rowKey = String(actionButton.getAttribute("data-row-key") || "");
      if (!rowKey) return;
      const allocationType = String(actionButton.getAttribute("data-allocation-type") || "");
      if (normalizeText(allocationType) !== "distributed") {
        state.allocationSubmitMessage = "Fixed Cost rows are read-only in the Allocation Matrix. Only Distributed rows can be edited.";
        render();
        return;
      }
      state.allocationEditModal = {
        rowKey,
        coding: String(actionButton.getAttribute("data-coding") || ""),
        item: String(actionButton.getAttribute("data-item") || ""),
        owner: String(actionButton.getAttribute("data-owner") || "")
      };
      state.allocationEditDraft = null;
      state.allocationEditDraftRowKey = "";
      state.allocationEditBase = null;
      render();
      return;
    }
    if (action === "allocation-row-delete") {
      const rowKey = String(actionButton.getAttribute("data-row-key") || "");
      const coding = String(actionButton.getAttribute("data-coding") || "");
      const item = String(actionButton.getAttribute("data-item") || "");
      const owner = String(actionButton.getAttribute("data-owner") || "");
      const financialYear = String(actionButton.getAttribute("data-year") || "");
      const allocationType = String(actionButton.getAttribute("data-allocation-type") || "");
      const codingKey = normalizeText(coding);
      const ownerKey = normalizeText(owner);
      const isDistributedRow = normalizeText(allocationType) === "distributed";

      if (!isDistributedRow) {
        state.allocationSubmitMessage =
          "Fixed Cost rows come from Budget Planner records. Delete them from Saved Records in Budget Planner if needed.";
        render();
        return;
      }

      state.allocationDb = (state.allocationDb || []).filter(
        (entry) =>
          !(
            normalizeText(entry.coding) === codingKey &&
            normalizeText(entry.owner) === ownerKey &&
            String(entry.financialYear || entry.year || "") === financialYear
          )
      );
      saveAllocationDb();

      if (!state.allocationMatrixEdits || typeof state.allocationMatrixEdits !== "object") {
        state.allocationMatrixEdits = {};
      }
      Object.keys(state.allocationMatrixEdits).forEach((key) => {
        if (String(key).startsWith(`${rowKey}||`)) delete state.allocationMatrixEdits[key];
      });
      saveAllocationMatrixEdits();

      if (state.allocationEditModal && state.allocationEditModal.rowKey === rowKey) {
        clearAllocationModalState();
      }

      state.allocationSubmitMessage = `Removed Distributed allocation for ${coding || item || "selected row"} (${financialYear || "all years"}).`;
      render();
      return;
    }
    if (action === "allocation-modal-close" || action === "allocation-modal-cancel") {
      clearAllocationModalState();
      render();
      return;
    }
    if (action === "allocation-modal-save") {
      const modal = state.allocationEditModal || {};
      const rowKey = String(modal.rowKey || "");
      if (!rowKey) return;

      const draft = state.allocationEditDraft || {};
      const base = state.allocationEditBase || {};
      if (!state.allocationMatrixEdits || typeof state.allocationMatrixEdits !== "object") {
        state.allocationMatrixEdits = {};
      }

      Object.keys(state.allocationMatrixEdits).forEach((key) => {
        if (String(key).startsWith(`${rowKey}||`)) delete state.allocationMatrixEdits[key];
      });

      Object.keys(base).forEach((location) => {
        const baseValue = Math.max(0, num(base[location]));
        const draftValue = Math.max(
          0,
          Number.isFinite(Number(draft[location])) ? Number(draft[location]) : baseValue
        );
        if (allocationRoundedValue(draftValue) !== allocationRoundedValue(baseValue)) {
          const editKey = `${rowKey}||${normalizeText(location)}`;
          state.allocationMatrixEdits[editKey] = allocationRoundedValue(draftValue);
        }
      });
      saveAllocationMatrixEdits();
      clearAllocationModalState();
      render();
      return;
    }
    if (action === "allocation-submit") {
      const controls = state.allocationControls || {};
      const mode = String(controls.mode || "Fixed Cost");
      const liveControls = Object.assign({}, controls, {
        coding: liveFieldValue("allocation-coding", controls.coding || controls.codingSearch || ""),
        item: liveFieldValue("allocation-item", controls.item || ""),
        owner: liveFieldValue("allocation-owner", controls.owner || ""),
        financialYear: liveFieldValue("allocation-financialYear", controls.financialYear || ""),
        amount: liveFieldValue("allocation-amount", controls.amount || "")
      });
      const codings = resolveAllocationCodings(liveControls);
      const owner = String(liveControls.owner || "").trim();
      const financialYear = String(liveControls.financialYear || "").trim();
      if (isAllocationDistributionMode(mode) && codings.length && owner && financialYear) {
        const primaryCoding = codings[0] || "";
        state.allocationControls.coding = primaryCoding;
        state.allocationControls.codings = primaryCoding ? [primaryCoding] : [];
        state.allocationControls.codingSearch = "";
        state.allocationControls.item = String(liveControls.item || "");
        state.allocationControls.owner = owner;
        state.allocationControls.financialYear = financialYear;
        state.allocationControls.amount = liveControls.amount;
        const records = Array.isArray(state.records) ? state.records : [];
        const codingTotals = {};
        records.forEach((record) => {
          if (normalizeText(record.owner) !== normalizeText(owner)) return;
          if (String(record.financialYear || "") !== financialYear) return;
          const key = normalizeText(record.coding);
          if (!key) return;
          codingTotals[key] = (codingTotals[key] || 0) + num(record.locFyCurrent);
        });

        const normalizedCodings = codings.map((coding) => ({
          key: normalizeText(coding),
          code: coding
        }));
        const selectedBaseTotal = normalizedCodings.reduce((sum, item) => sum + num(codingTotals[item.key] || 0), 0);
        const amountInput = num(liveControls.amount);
        const batchTotal = amountInput > 0 ? amountInput : selectedBaseTotal;
        const equalShare = normalizedCodings.length ? 1 / normalizedCodings.length : 0;

        const dbMap = {};
        (state.allocationDb || []).forEach((entry) => {
          const entryYear = String(entry.financialYear || entry.year || "");
          const key = `${normalizeText(entry.coding)}||${normalizeText(entry.owner)}||${entryYear}`;
          if (key) dbMap[key] = entry;
        });

        normalizedCodings.forEach((item) => {
          if (!item.key) return;
          const codingBase = num(codingTotals[item.key] || 0);
          const share = selectedBaseTotal > 0 ? codingBase / selectedBaseTotal : equalShare;
          const targetAmount = batchTotal * share;
          delete dbMap[`${item.key}||${normalizeText(owner)}||`];
          dbMap[`${item.key}||${normalizeText(owner)}||${financialYear}`] = {
            id: `alloc_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
            coding: item.code,
            owner,
            financialYear,
            mode: "Distributed",
            amountInput: amountInput > 0 ? amountInput : "",
            targetAmount,
            savedAt: new Date().toISOString()
          };
        });

        state.allocationDb = Object.values(dbMap);
        saveAllocationDb();
        state.allocationSubmitMessage = `Saved distribution for ${codings.join(", ")} | ${owner} | ${financialYear}. Distributed amount: ${batchTotal.toLocaleString(
          "en-IN",
          { maximumFractionDigits: 2 }
        )}.`;
      } else {
        state.allocationSubmitMessage = `Submit blocked: coding=${codings.length ? codings.join(", ") : "missing"}, owner=${owner || "missing"}, year=${
          financialYear || "missing"
        }.`;
      }
      render();
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const id = target.id || "";
    const value = "value" in target ? target.value : "";

    if (id.startsWith("dashboard-")) {
      const key = id.replace("dashboard-", "");
      if (key === "coding") {
        const matchedCoding = findPlannerCodingMatch(value);
        setDashboardFilter(key, matchedCoding || value);
      } else {
        setDashboardFilter(key, value);
      }
      render();
      return;
    }

    if (id.startsWith("summary-")) {
      setSummaryFilter(id.replace("summary-", ""), value);
      render();
      return;
    }

    if (id.startsWith("comparison-")) {
      const key = id.replace("comparison-", "");
      if (key === "coding") {
        const matchedCoding = findPlannerCodingMatch(value);
        setComparisonFilter(key, matchedCoding || value);
      } else {
        setComparisonFilter(key, value);
      }
      render();
      return;
    }

    if (id.startsWith("planner-")) {
      const key = id.replace("planner-", "");
      const previousValue = state.form ? state.form[key] : "";
      setPlannerField(key, value);
      if (target.classList.contains("combo-input") && String(previousValue ?? "") === String(state.form[key] ?? "")) {
        return;
      }
      render();
      return;
    }

    if (id.startsWith("plannerSaved-")) {
      const key = id.replace("plannerSaved-", "");
      const nextValue = value && value !== "All" ? value : "All";
      state.plannerSavedFilters = Object.assign({}, state.plannerSavedFilters || {}, { [key]: nextValue });
      render();
      return;
    }

    if (id === "allocation-mode") {
      setAllocationControl("mode", value);
      render();
      return;
    }

    if (id === "allocation-owner") {
      setAllocationControl("owner", value);
      render();
      return;
    }

    if (id === "allocation-owner1") {
      setAllocationControl("owner1", value);
      render();
      return;
    }

    if (id === "allocation-costCenterDepartment") {
      setAllocationControl("costCenterDepartment", value);
      render();
      return;
    }

    if (id === "allocation-subCategoryMapped") {
      setAllocationControl("subCategoryMapped", value);
      render();
      return;
    }
    if (id === "allocation-categoryIt") {
      setAllocationControl("categoryIt", value);
      render();
      return;
    }
    if (id === "allocation-subCategory") {
      setAllocationControl("subCategory", value);
      render();
      return;
    }
    if (id === "allocation-newCategory") {
      setAllocationControl("newCategory", value);
      render();
      return;
    }
    if (id === "allocation-appCate") {
      setAllocationControl("appCate", value);
      render();
      return;
    }
    if (id === "allocation-cate3") {
      setAllocationControl("cate3", value);
      render();
      return;
    }
    if (id === "allocation-cate4") {
      setAllocationControl("cate4", value);
      render();
      return;
    }

    if (id === "allocation-coding") {
      const matchedCoding = findPlannerCodingMatch(value);
      const nextCoding = matchedCoding || value;
      setAllocationControl("coding", nextCoding);
      applyCodingProfileToAllocation(nextCoding);
      const mappedItem = strictItemForCoding(nextCoding);
      setAllocationControl("item", mappedItem || state.allocationControls.item || "");
      render();
      return;
    }

    if (id === "allocation-item") {
      setAllocationControl("item", value);
      const matchedCoding = findPlannerCodingByItemMatch(value);
      if (matchedCoding) {
        setAllocationControl("coding", matchedCoding);
        state.allocationControls.codings = matchedCoding ? [matchedCoding] : [];
        state.allocationControls.codingSearch = "";
        applyCodingProfileToAllocation(matchedCoding);
      }
      render();
      return;
    }

    if (id === "allocation-financialYear") {
      setAllocationControl("financialYear", value);
      render();
      return;
    }

    if (id === "allocation-amount") {
      setAllocationControl("amount", value);
      render();
      return;
    }

    if (id === "allocation-matrix-location") {
      const next = value && value !== "All" ? value : "";
      state.allocationMatrixFilters = Object.assign({}, state.allocationMatrixFilters || {}, { location: next });
      render();
      return;
    }
    if (id === "allocation-matrix-coding") {
      const next = value && value !== "All" ? value : "";
      state.allocationMatrixFilters = Object.assign({}, state.allocationMatrixFilters || {}, { coding: next });
      render();
      return;
    }
    if (id === "allocation-matrix-financialYear") {
      const next = value && value !== "All" ? value : "";
      state.allocationMatrixFilters = Object.assign({}, state.allocationMatrixFilters || {}, { financialYear: next });
      render();
      return;
    }
    if (id === "allocation-matrix-owner") {
      const next = value && value !== "All" ? value : "";
      state.allocationMatrixFilters = Object.assign({}, state.allocationMatrixFilters || {}, { owner: next });
      render();
      return;
    }

    if (target.classList.contains("allocation-location") && target instanceof HTMLInputElement) {
      const current = new Set(state.allocationControls.locations || []);
      if (target.checked) current.add(target.value);
      else current.delete(target.value);
      state.allocationControls.locations = Array.from(current);
      render();
      return;
    }

    if (target.classList.contains("allocation-coding") && target instanceof HTMLInputElement) {
      const current = new Set(state.allocationControls.codings || []);
      if (target.checked) current.add(target.value);
      else current.delete(target.value);
      state.allocationControls.codings = Array.from(current);
      state.allocationControls.codingSearch = "";
      render();
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains("allocation-modal-input") && "value" in target) {
      const location = String(target.getAttribute("data-location") || "");
      if (!location) return;
      if (!state.allocationEditDraft || typeof state.allocationEditDraft !== "object") {
        state.allocationEditDraft = {};
      }
      state.allocationEditDraft[location] = target.value;

      const baseValue = Math.max(0, num(state.allocationEditBase ? state.allocationEditBase[location] : 0));
      const typedValue = Number(target.value);
      const nextValue = Number.isFinite(typedValue) ? Math.max(0, typedValue) : 0;
      const changed = allocationRoundedValue(nextValue) !== allocationRoundedValue(baseValue);
      target.classList.toggle("is-edited", changed);
      const field = target.closest(".allocation-modal-field");
      if (field) field.classList.toggle("allocation-cell-edited", changed);
      return;
    }

    if (target.classList.contains("allocation-matrix-input") && "value" in target) {
      const rowKey = String(target.getAttribute("data-row-key") || "");
      const location = String(target.getAttribute("data-location") || "");
      if (!rowKey || !location) return;

      if (!state.allocationMatrixEdits || typeof state.allocationMatrixEdits !== "object") {
        state.allocationMatrixEdits = {};
      }

      const editKey = `${rowKey}||${normalizeText(location)}`;
      const baseValue = num(target.getAttribute("data-base-value"));
      const typedValue = Number(target.value);
      const nextValue = Number.isFinite(typedValue) ? Math.max(0, typedValue) : 0;
      const changed = allocationRoundedValue(nextValue) !== allocationRoundedValue(baseValue);

      if (changed) state.allocationMatrixEdits[editKey] = allocationRoundedValue(nextValue);
      else delete state.allocationMatrixEdits[editKey];
      saveAllocationMatrixEdits();

      const cell = target.closest("td");
      target.classList.toggle("is-edited", changed);
      if (cell) cell.classList.toggle("allocation-cell-edited", changed);

      const row = target.closest("tr");
      if (row) {
        const inputs = Array.from(row.querySelectorAll(".allocation-matrix-input"));
        const rowTotal = inputs.reduce((sum, input) => {
          const value = Number(input.value);
          return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
        }, 0);
        const totalCell = row.querySelector("[data-role='allocation-row-total']");
        if (totalCell) {
          totalCell.textContent = rowTotal.toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
          });
        }
      }
      return;
    }

    if (target.id === "allocation-amount" && "value" in target) {
      setAllocationControl("amount", target.value);
      return;
    }

    if (target.id === "allocation-coding" && target.classList.contains("combo-input") && "value" in target) {
      const matchedCoding = findPlannerCodingMatch(target.value);
      const nextCoding = matchedCoding || target.value;
      const previousCoding = state.allocationControls && state.allocationControls.coding ? state.allocationControls.coding : "";
      state.allocationControls.coding = nextCoding;
      state.allocationControls.codings = nextCoding ? [nextCoding] : [];
      if (matchedCoding) {
        applyCodingProfileToAllocation(nextCoding);
        const mappedItem = strictItemForCoding(nextCoding);
        state.allocationControls.item = mappedItem || state.allocationControls.item || "";
      }

      if (matchedCoding) {
        // Commit the resolved coding into the input (Planner-style behavior).
        target.value = matchedCoding;
      }

      if (normalizeText(previousCoding) !== normalizeText(nextCoding) || matchedCoding) {
        render();
        // After rerender, keep the user's cursor in the coding box.
        window.requestAnimationFrame(() => {
          const codingInput = document.getElementById("allocation-coding");
          if (codingInput && "focus" in codingInput) {
            codingInput.focus();
            if ("value" in codingInput && typeof codingInput.setSelectionRange === "function") {
              const end = String(codingInput.value || "").length;
              codingInput.setSelectionRange(end, end);
            }
          }
        });
      }
      return;
    }

    if (target.id.startsWith("planner-") && target.classList.contains("combo-input") && "value" in target) {
      const key = target.id.replace("planner-", "");
      state.form[key] = target.value;

      if (key === "coding") {
        const matchedCoding = findPlannerCodingMatch(target.value);
        if (matchedCoding && String(matchedCoding) !== String(state.form.coding || "")) {
          state.form.coding = matchedCoding;
          applyCodingProfile(matchedCoding);
          syncPlannerHistoricalValues("coding");
          render();
        }
      } else if (key === "item") {
        const matchedCoding = findPlannerCodingByItemMatch(target.value);
        if (matchedCoding && normalizeText(matchedCoding) !== normalizeText(state.form.coding)) {
          state.form.coding = matchedCoding;
          applyCodingProfile(matchedCoding);
          syncPlannerHistoricalValues("coding");
          render();
        }
      }
      return;
    }

    const livePlannerIds = new Set([
      "planner-locLe",
      "planner-locFyCurrent",
      "planner-locFyLast",
      "planner-newAmc",
      "planner-newProject",
      "planner-annualized",
      "planner-priceIncrease",
      "planner-newUnit",
      "planner-licenseIncrease",
      "planner-rest",
      "planner-justification"
    ]);

    if (livePlannerIds.has(target.id)) {
      const key = target.id.replace("planner-", "");
      if ("value" in target) state.form[key] = target.value;
      updatePlannerLiveCalculations();
    }
  });

  if (!state.dashboardFilters) state.dashboardFilters = { location: "All", category: "All", year: "All", owner: "All" };
  if (!state.summaryFilters) state.summaryFilters = { location: "All", year: "All" };
  if (!state.comparisonFilters) state.comparisonFilters = { location1: "", location2: "", coding: "", financialYear: "" };
  if (!state.allocationControls) {
    state.allocationControls = {
      mode: "Distribution",
      coding: "",
      codings: [],
      owner: "",
      financialYear: "",
      amount: "",
      percent: "",
      codingSearch: "",
      locations: []
    };
  } else if (!Array.isArray(state.allocationControls.codings)) {
    state.allocationControls.codings = state.allocationControls.coding ? [state.allocationControls.coding] : [];
  }
  state.allocationControls.mode = "Distribution";
  if (typeof state.allocationControls.codingSearch !== "string") state.allocationControls.codingSearch = "";
  if (!state.allocationControls.owner) state.allocationControls.owner = "";
  if (typeof state.allocationControls.financialYear !== "string") state.allocationControls.financialYear = "";
  if (!Array.isArray(state.allocationDb)) {
    state.allocationDb = loadAllocationDb();
  }
  if (!state.allocationMatrixEdits || typeof state.allocationMatrixEdits !== "object") {
    state.allocationMatrixEdits = loadAllocationMatrixEdits();
  }
  if (!state.form) state.form = h.defaultForm ? h.defaultForm() : {};
  if (!state.activeView) state.activeView = "dashboardView";
async function loadLiveBudgetData() {
  try {

    const response = await fetch(
      "https://maxhealthcare-budget-system-production.up.railway.app/api/budget-data"
    );

    const rows = await response.json();

    const remoteRecords = (Array.isArray(rows) ? rows : []).map(row => ({
  id: row.id || "",
  coding: row.coding || "",
  item: row.item || "",
  categoryIt: row.category_it || "",
  subCategory: row.sub_category || "",
  newCategory: row.new_category || "",
  appCate: row.app_cate || "",
  cate3: row.cate3 || "",
  cate4: row.cate4 || "",
  owner1: row.owner1 || "",
  owner: row.owner || "",
  location: row.location || "",
  financialYear: row.financial_year || "",
  locFyCurrent: Number(row.loc_fy_current || 0),
  locLe: Number(row.loc_le || 0),
  newAmc: Number(row.new_amc || 0),
  newProject: Number(row.new_project || 0),
  annualized: Number(row.annualized || 0),
  priceIncrease: Number(row.price_increase || 0),
  newUnit: Number(row.new_unit || 0),
  licenseIncrease: Number(row.license_increase || 0),
  rest: Number(row.rest || 0)
}));

    const localRecords = Array.isArray(state.records) ? state.records : [];
    const mergedMap = {};
    const recordKey = (record) => {
      const idPart = String(record && record.id ? record.id : "").trim();
      if (idPart) return `id::${idPart}`;
      return [
        normalizeText(record && record.coding),
        normalizeText(record && record.item),
        normalizeText(record && record.owner),
        normalizeText(record && record.location),
        String((record && record.financialYear) || "").trim(),
        allocationRoundedValue(record && record.locFyCurrent),
        allocationRoundedValue(record && record.locLe)
      ].join("||");
    };

    remoteRecords.forEach((record) => {
      mergedMap[recordKey(record)] = record;
    });
    // Keep local unsynced/manual records on top of remote payload so refresh does not wipe planner work.
    localRecords.forEach((record) => {
      mergedMap[recordKey(record)] = record;
    });

    state.records = recalculateRecords(Object.values(mergedMap));
    persist();

    render();

    console.log("Live DB connected ✅");

  } catch (error) {

    console.error("API Load Error:", error);

  }
}

loadLiveBudgetData();
})();
