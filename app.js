(function () {
  if (typeof window !== "undefined") {
    if (window.__OPEX_APP_INITIALIZED__) return;
    window.__OPEX_APP_INITIALIZED__ = true;
  }

  const data = window.OpexData || {};
  const ui = window.OpexUI || {};
  const state = data.state || {};
  const h = data.helpers || {};
  const utils = window.OpexUtils || {};
  const ALLOCATION_DB_KEY = "it_opex_allocation_db_v1";
  const ALLOCATION_MATRIX_OVERRIDES_KEY = "it_opex_allocation_matrix_overrides_v1";
  const AppUrls = utils.AppUrls || {};
  const apiUrl = typeof AppUrls.api === "function" ? AppUrls.api : (path) => `api/${String(path || "").replace(/^\/+/, "")}`;
  const withButtonActionLock =
    typeof utils.withButtonActionLock === "function"
      ? utils.withButtonActionLock
      : async (_button, asyncAction) => (typeof asyncAction === "function" ? asyncAction() : undefined);
  try {
    console.log("APP_BASE_PATH:", typeof AppUrls.basePath === "function" ? AppUrls.basePath() : "");
  } catch (_e) {}
  const LIVE_SYNC_INTERVAL_MS = 15000;
  const refreshLifecycle = {
    timerId: null,
    visibilityBound: false,
    inFlight: {
      budget: null,
      allocationDb: null,
      allocationMatrix: null
    }
  };
  const pointerRenderGate = {
    active: false,
    target: null,
    deferred: false,
    releaseScheduled: false
  };

  const DRIVER_KEYS = ["newAmc", "newProject", "annualized", "priceIncrease", "newUnit", "licenseIncrease", "rest"];
  const ALLOCATION_DISTRIBUTION_MAP = {
    Saket: 13.87,
    "Max Smart": 5.67,
    Gurgaon: 3.59,
    "Lajpat Nagar": 0.36,
    Panchsheel: 1.42,
    Patparganj: 8.03,
    Vaishali: 7.56,
    Noida: 0.47,
    "Shalimar Bagh": 6.44,
    Mohali: 4.53,
    Dehradun: 3.5,
    Bathinda: 1.91,
    HO: 3.4,
    BLK: 11.28,
    Nanawati: 6.19,
    Nagpur: 4.72,
    Lucknow: 5.2,
    Dwarka: 5.2,
    "Jaypee Noida": 6.67
  };

  function normalizeText(value) {
    return h.normalizeText ? h.normalizeText(value) : String(value || "").trim().toUpperCase();
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function num(value) {
    if (utils.parseFinancialAmount) return utils.parseFinancialAmount(value);
    return h.toNumber ? h.toNumber(value) : Number(value || 0);
  }

  function fmt(value) {
    return utils.formatFinancialAmount
      ? utils.formatFinancialAmount(value, { maximumFractionDigits: 2 })
      : num(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  function workflowConfig() {
    const config = typeof window !== "undefined" ? window.APP_CONFIG || {} : {};
    return {
      foundationEnabled: config.workflowFoundationEnabled !== false,
      actionsEnabled: config.workflowActionsEnabled !== false,
      lockEnforcementEnabled: config.workflowLockEnforcementEnabled === true,
      approvalQueueEnabled: config.workflowApprovalQueueEnabled !== false
    };
  }

  function parseWorkflowActions(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function workflowIdempotencyKey(prefix, id, action) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${String(id || "record")}-${String(action || "action")}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function workflowNextState(record, action) {
    const actions = parseWorkflowActions(record && record.workflowAvailableActions);
    const found = actions.find((item) => String(item.action || "") === String(action || ""));
    return found ? found.nextState || "" : "";
  }

  function ensureLeState() {
    if (!state.latestEstimate || typeof state.latestEstimate !== "object") {
      state.latestEstimate = {
        matrices: [],
        activeMatrixId: "",
        cells: [],
        summary: null,
        filters: { page: 1, pageSize: 25 },
        edits: {},
        message: ""
      };
    }
    if (!state.latestEstimate.filters) state.latestEstimate.filters = { page: 1, pageSize: 25 };
    if (!state.latestEstimate.edits) state.latestEstimate.edits = {};
    return state.latestEstimate;
  }

  function leIdempotencyKey(prefix) {
    return workflowIdempotencyKey(prefix, "le", "save");
  }

  function leCellKey(input) {
    return [input.budgetEntityId || "", input.coding || "", input.location || "", input.financialYear || ""].join("||");
  }

  function ensureNextFyState() {
    if (!state.nextFy || typeof state.nextFy !== "object") {
      state.nextFy = {
        budgets: [],
        activeBudgetId: "",
        lines: [],
        summary: null,
        preview: null,
        filters: { page: 1, pageSize: 25 },
        setup: { sourceStrategy: "CURRENT_BUDGET" },
        assumptionDraft: { ruleType: "GLOBAL_GROWTH", priority: 100, growthPercentage: 0, fixedAdjustmentAmount: 0 },
        edits: {},
        message: ""
      };
    }
    if (!state.nextFy.filters) state.nextFy.filters = { page: 1, pageSize: 25 };
    if (!state.nextFy.setup) state.nextFy.setup = { sourceStrategy: "CURRENT_BUDGET" };
    if (!state.nextFy.assumptionDraft) state.nextFy.assumptionDraft = { ruleType: "GLOBAL_GROWTH", priority: 100, growthPercentage: 0, fixedAdjustmentAmount: 0 };
    if (!state.nextFy.edits) state.nextFy.edits = {};
    return state.nextFy;
  }

  function nextFyIdempotencyKey(prefix) {
    return workflowIdempotencyKey(prefix, "nextfy", "action");
  }

  function applyFinancialFormats(sheet, moneyKeys) {
    if (!sheet || !sheet["!ref"] || typeof XLSX === "undefined") return;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const keys = new Set(moneyKeys || []);
    const financialFormat = utils.EXCEL_FINANCIAL_FORMAT || "#,##,##0.##";
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const headerCell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
      const header = headerCell ? String(headerCell.v || "") : "";
      if (!keys.has(header)) continue;
      for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (cell && typeof cell.v === "number") cell.z = financialFormat;
      }
    }
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

  function uniqueCodingValues(values) {
    if (utils.uniqueCodingValues) return utils.uniqueCodingValues(values);
    const byKey = new Map();
    (values || []).forEach((value) => {
      const candidate = String(value || "").trim();
      const key = candidate.toUpperCase();
      if (!key) return;
      if (!byKey.has(key) || candidate === key) byKey.set(key, candidate);
    });
    return Array.from(byKey.values());
  }

  function normalizeCodingKey(value) {
    return utils.normalizeCodingKey ? utils.normalizeCodingKey(value) : String(value || "").trim().toUpperCase();
  }

  function getKnownLocations() {
    const fromData = Array.isArray(data.ALL_LOCATIONS)
      ? data.ALL_LOCATIONS
      : Array.isArray(data.LOCATIONS)
      ? data.LOCATIONS
      : [];
    const fromRecords = (state.records || []).map((record) => record && record.location);
    const fromMatrix = (state.allocationMatrixRows || []).flatMap((row) => {
      const amounts = row && row.locationAmounts && typeof row.locationAmounts === "object" ? Object.keys(row.locationAmounts) : [];
      const percents = row && row.locationPercents && typeof row.locationPercents === "object" ? Object.keys(row.locationPercents) : [];
      return amounts.concat(percents);
    });
    return unique([].concat(fromData, Object.keys(ALLOCATION_DISTRIBUTION_MAP), fromRecords, fromMatrix));
  }

  function parseJsonObject(value) {
    if (!value) return {};
    if (typeof value === "object") return value || {};
    if (typeof value !== "string") return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function normalizeAmountMap(map) {
    const cleaned = {};
    Object.keys(map || {}).forEach((location) => {
      if (!location) return;
      cleaned[location] = Math.max(0, num(map[location]));
    });
    return cleaned;
  }

  function sumAmountMap(map) {
    return Object.keys(map || {}).reduce((sum, key) => sum + num(map[key]), 0);
  }

  function queryString(params) {
    const search = new URLSearchParams();
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value == null || value === "") return;
      search.set(key, String(value));
    });
    return search.toString();
  }

  function pointerRenderHoldTarget(target) {
    if (!target || !target.closest) return null;
    return target.closest("[data-action], [data-view], button, .combo-toggle, .combo-clear, .select-clear, .combo-option, .multi-combo-option");
  }

  function beginPointerRenderGate(event) {
    pointerRenderGate.active = true;
    pointerRenderGate.target = pointerRenderHoldTarget(event.target);
    pointerRenderGate.deferred = false;
    pointerRenderGate.releaseScheduled = false;
  }

  function shouldDeferRenderForPointer() {
    return Boolean(pointerRenderGate.active && pointerRenderGate.target && pointerRenderGate.target.isConnected);
  }

  function releasePointerRenderGate() {
    const shouldRender = pointerRenderGate.deferred;
    pointerRenderGate.active = false;
    pointerRenderGate.target = null;
    pointerRenderGate.deferred = false;
    pointerRenderGate.releaseScheduled = false;
    if (shouldRender) render();
  }

  document.addEventListener("pointerdown", beginPointerRenderGate, true);

  function schedulePointerRenderGateRelease() {
    if (!pointerRenderGate.active || pointerRenderGate.releaseScheduled) return;
    pointerRenderGate.releaseScheduled = true;
    requestAnimationFrame(() => {
      if (pointerRenderGate.active && pointerRenderGate.releaseScheduled) {
        releasePointerRenderGate();
      }
    });
  }

  function singleFlightRefresh(key, task) {
    if (refreshLifecycle.inFlight[key]) return refreshLifecycle.inFlight[key];
    refreshLifecycle.inFlight[key] = Promise.resolve()
      .then(task)
      .finally(() => {
        refreshLifecycle.inFlight[key] = null;
      });
    return refreshLifecycle.inFlight[key];
  }

  function buildDistributedLocationAmounts(totalBudget) {
    const total = Math.max(0, num(totalBudget));
    const weightedLocations = getKnownLocations().filter(
      (location) =>
        Object.prototype.hasOwnProperty.call(ALLOCATION_DISTRIBUTION_MAP, location) &&
        num(ALLOCATION_DISTRIBUTION_MAP[location]) > 0
    );
    const weightTotal = weightedLocations.reduce((sum, location) => sum + num(ALLOCATION_DISTRIBUTION_MAP[location]), 0);
    const amounts = {};
    const percents = {};
    weightedLocations.forEach((location) => {
      const pct = num(ALLOCATION_DISTRIBUTION_MAP[location]);
      percents[location] = pct;
      amounts[location] = weightTotal ? (total * pct) / weightTotal : 0;
    });
    return { amounts, percents };
  }

  function getPlannerCodingOptions() {
    const fallback = Array.isArray(data.FALLBACK_OPTIONS && data.FALLBACK_OPTIONS.coding) ? data.FALLBACK_OPTIONS.coding : [];
    const fromMaps = Object.keys(data.CODE_ITEM_MAP || {}).concat(Object.keys(data.CODE_PROFILE_MAP || {}));
    const fromRecords = (state.records || []).map((record) => record && record.coding);
    return uniqueCodingValues([].concat(fallback, fromMaps, fromRecords));
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
    const normalizedQuery = normalizeCodingKey(query);
    if (!normalizedQuery) return "";
    const options = getPlannerCodingOptions();
    const exactMatch = options.find((coding) => normalizeCodingKey(coding) === normalizedQuery);
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

    const matches = options.filter((coding) => normalizeCodingKey(coding).includes(normalizedQuery));
    if (matches.length === 1) return matches[0];
    return matches.find((coding) => normalizeCodingKey(coding).endsWith(normalizedQuery)) || "";
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


  function saveAllocationDb() {
    try {
      localStorage.setItem(ALLOCATION_DB_KEY, JSON.stringify(state.allocationDb || []));
    } catch (_error) {
      // Ignore local storage errors.
    }
  }

  function allocationMatrixOverrideKey(input) {
    const row = input || {};
    return [
      String(row.financialYear || row.financial_year || ""),
      normalizeText(row.coding || ""),
      normalizeText(row.owner || ""),
      normalizeText(row.costDistribution || row.cost_distribution || "Distributed")
    ].join("||");
  }

  function loadAllocationMatrixOverrides() {
    try {
      const raw = localStorage.getItem(ALLOCATION_MATRIX_OVERRIDES_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function saveAllocationMatrixOverrides() {
    try {
      localStorage.setItem(ALLOCATION_MATRIX_OVERRIDES_KEY, JSON.stringify(state.allocationMatrixOverrides || {}));
    } catch (_error) {
      // Ignore local storage errors.
    }
  }

  function upsertAllocationMatrixOverride(row) {
    if (!state.allocationMatrixOverrides || typeof state.allocationMatrixOverrides !== "object") {
      state.allocationMatrixOverrides = loadAllocationMatrixOverrides();
    }
    const key = allocationMatrixOverrideKey(row);
    if (!key) return;
    state.allocationMatrixOverrides[key] = {
      financialYear: String(row.financialYear || ""),
      coding: String(row.coding || ""),
      item: String(row.item || ""),
      owner: String(row.owner || ""),
      costDistribution: String(row.costDistribution || "Distributed"),
      totalBudget: num(row.totalBudget || 0),
      locationAmounts: normalizeAmountMap(row.locationAmounts || {}),
      locationPercents: parseJsonObject(row.locationPercents || {}),
      editedLocations: Array.isArray(row.editedLocations) ? row.editedLocations : []
    };
    saveAllocationMatrixOverrides();
  }

  function removeAllocationMatrixOverride(row) {
    if (!state.allocationMatrixOverrides || typeof state.allocationMatrixOverrides !== "object") {
      state.allocationMatrixOverrides = loadAllocationMatrixOverrides();
    }
    const key = allocationMatrixOverrideKey(row);
    if (key && Object.prototype.hasOwnProperty.call(state.allocationMatrixOverrides, key)) {
      delete state.allocationMatrixOverrides[key];
      saveAllocationMatrixOverrides();
    }
  }

  function applyAllocationMatrixOverrides(rows) {
    const overrides = state.allocationMatrixOverrides || {};
    if (!overrides || !Object.keys(overrides).length) return rows;
    return (rows || []).map((row) => {
      const key = allocationMatrixOverrideKey(row);
      const override = overrides[key];
      if (!override) return row;
      const overrideAmounts = normalizeAmountMap(override.locationAmounts || {});
      if (!sumAmountMap(overrideAmounts)) return row;
      return Object.assign({}, row, {
        item: override.item || row.item || "",
        totalBudget: sumAmountMap(overrideAmounts),
        locationAmounts: overrideAmounts,
        locationPercents: parseJsonObject(override.locationPercents || row.locationPercents || {}),
        editedLocations: Array.isArray(override.editedLocations) ? override.editedLocations : []
      });
    });
  }

  function mergeAllocationMatrixRows(baseRows, overlayRows) {
    const merged = [];
    const indexByKey = {};
    (Array.isArray(baseRows) ? baseRows : []).forEach((row) => {
      const key = allocationMatrixOverrideKey(row);
      if (!key) return;
      indexByKey[key] = merged.length;
      merged.push(row);
    });
    (Array.isArray(overlayRows) ? overlayRows : []).forEach((row) => {
      const key = allocationMatrixOverrideKey(row);
      if (!key) return;
      const normalized = {
        id: String(row.id || ""),
        financialYear: String(row.financialYear || ""),
        coding: String(row.coding || ""),
        item: String(row.item || ""),
        owner: String(row.owner || ""),
        costDistribution: String(row.costDistribution || "Distributed"),
        totalBudget: num(row.totalBudget || 0),
        locationAmounts: normalizeAmountMap(row.locationAmounts || {}),
        locationPercents: parseJsonObject(row.locationPercents || {}),
        editedLocations: Array.isArray(row.editedLocations) ? row.editedLocations : []
      };
      if (Object.prototype.hasOwnProperty.call(indexByKey, key)) {
        const existingIndex = indexByKey[key];
        merged[existingIndex] = Object.assign({}, merged[existingIndex], normalized, {
          id: normalized.id || merged[existingIndex].id || ""
        });
      } else {
        indexByKey[key] = merged.length;
        merged.push(normalized);
      }
    });
    return merged;
  }

  function upsertLocalAllocationMatrixRow(row) {
    const normalized = {
      id: String(row.id || ""),
      financialYear: String(row.financialYear || ""),
      coding: String(row.coding || ""),
      item: String(row.item || ""),
      owner: String(row.owner || ""),
      costDistribution: String(row.costDistribution || "Distributed"),
      totalBudget: num(row.totalBudget || 0),
      locationAmounts: normalizeAmountMap(row.locationAmounts || {}),
      locationPercents: parseJsonObject(row.locationPercents || {}),
      editedLocations: Array.isArray(row.editedLocations) ? row.editedLocations : []
    };
    const rows = Array.isArray(state.allocationMatrixLocalRows) ? state.allocationMatrixLocalRows.slice() : [];
    const key = allocationMatrixOverrideKey(normalized);
    const index = rows.findIndex((existing) => allocationMatrixOverrideKey(existing) === key);
    if (index >= 0) rows[index] = Object.assign({}, rows[index], normalized);
    else rows.unshift(normalized);
    state.allocationMatrixLocalRows = rows;
    state.allocationMatrixRows = mergeAllocationMatrixRows(state.allocationMatrixServerRows || state.allocationMatrixRows || [], rows);
  }

  function removeLocalAllocationMatrixRow(row) {
    const key = allocationMatrixOverrideKey(row);
    const matrixId = String(row && row.id ? row.id : row && row.matrixId ? row.matrixId : "");
    function keepRow(existing) {
      if (matrixId && String(existing.id || "") === matrixId) return false;
      return allocationMatrixOverrideKey(existing) !== key;
    }
    state.allocationMatrixLocalRows = (Array.isArray(state.allocationMatrixLocalRows) ? state.allocationMatrixLocalRows : []).filter(keepRow);
    state.allocationMatrixServerRows = (Array.isArray(state.allocationMatrixServerRows) ? state.allocationMatrixServerRows : []).filter(keepRow);
    state.allocationMatrixRows = (Array.isArray(state.allocationMatrixRows) ? state.allocationMatrixRows : []).filter(keepRow);
  }

  function findMatchingAllocationEntries(row) {
    const rowYear = String(row && row.financialYear || row && row.year || "");
    const rowCoding = normalizeText(row && row.coding);
    const rowOwner = normalizeText(row && row.owner);
    if (!rowYear || !rowCoding || !rowOwner) return [];
    return (Array.isArray(state.allocationDb) ? state.allocationDb : []).filter(
      (entry) =>
        String(entry.financialYear || entry.year || "") === rowYear &&
        normalizeText(entry.coding) === rowCoding &&
        normalizeText(entry.owner) === rowOwner
    );
  }

  function removeAllocationDbEntries(entries) {
    const ids = new Set((entries || []).map((entry) => String(entry && entry.id || "")).filter(Boolean));
    const keys = new Set(
      (entries || []).map((entry) =>
        [String(entry.financialYear || entry.year || ""), normalizeText(entry.coding), normalizeText(entry.owner)].join("||")
      )
    );
    state.allocationDb = (Array.isArray(state.allocationDb) ? state.allocationDb : []).filter((entry) => {
      const id = String(entry && entry.id || "");
      const key = [String(entry.financialYear || entry.year || ""), normalizeText(entry.coding), normalizeText(entry.owner)].join("||");
      return !(ids.has(id) || keys.has(key));
    });
    saveAllocationDb();
  }

  async function loadAllocationDbFromServer() {
    return singleFlightRefresh("allocationDb", async () => {
      try {
      const response = await fetch(apiUrl("allocation-data"));
      if (!response.ok) throw new Error(`Allocation load failed (${response.status})`);
      const rows = await response.json();
      state.allocationDb = (Array.isArray(rows) ? rows : []).map((row) => ({
        id: String(row.id || ""),
        coding: row.coding || "",
        owner: row.owner || "",
        financialYear: row.financial_year || row.financialYear || "",
        mode: row.mode || "Distributed",
        amountInput: row.amount_input == null ? "" : row.amount_input,
        percentInput: row.percent_input == null ? "" : row.percent_input,
        targetAmount: Number(row.target_amount || 0),
        savedAt: row.updated_at || row.savedAt || ""
      }));
      saveAllocationDb();
      } catch (error) {
      console.error("Allocation DB sync failed:", error);
      }
    });
  }

  async function upsertAllocationDbToServer(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) return;
    await Promise.all(
      list.map(async (entry) => {
        const payload = {
          coding: entry.coding || "",
          owner: entry.owner || "",
          financialYear: entry.financialYear || "",
          mode: entry.mode || "Distributed",
          amountInput: entry.amountInput === "" ? null : entry.amountInput,
          percentInput: entry.percentInput === "" ? null : entry.percentInput,
          targetAmount: Number(entry.targetAmount || 0),
          item: entry.item || ""
        };
        try {
          const response = await fetch(apiUrl("allocation-data"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!response.ok) {
            const msg = await response.text();
            throw new Error(`Allocation upsert failed (${response.status}): ${msg}`);
          }
        } catch (error) {
          console.error("Allocation upsert failed:", error);
        }
      })
    );
  }

  async function loadAllocationMatrixFromServer() {
    return singleFlightRefresh("allocationMatrix", async () => {
      try {
      const response = await fetch(apiUrl("allocation-matrix"));
      if (!response.ok) throw new Error(`Allocation matrix load failed (${response.status})`);
      const rows = await response.json();
      const mappedRows = (Array.isArray(rows) ? rows : []).map((row) => {
        const locationAmounts = (() => {
          try {
            const value = row.location_amounts_json || row.locationAmounts || null;
            const parsed = normalizeAmountMap(parseJsonObject(value));
            if (Object.keys(parsed).length) return parsed;

            // Wide-table fallback (allocation_matrix_wide).
            const wide = {
              Saket: row.amt_saket,
              "Max Smart": row.amt_max_smart,
              Gurgaon: row.amt_gurgaon,
              "Lajpat Nagar": row.amt_lajpat_nagar,
              Panchsheel: row.amt_panchsheel,
              Patparganj: row.amt_patparganj,
              Vaishali: row.amt_vaishali,
              Noida: row.amt_noida,
              "Shalimar Bagh": row.amt_shalimar_bagh,
              Mohali: row.amt_mohali,
              Dehradun: row.amt_dehradun,
              Bathinda: row.amt_bathinda,
              HO: row.amt_ho,
              BLK: row.amt_blk,
              Nanawati: row.amt_nanawati,
              Nagpur: row.amt_nagpur,
              Lucknow: row.amt_lucknow,
              Dwarka: row.amt_dwarka,
              "Jaypee Noida": row.amt_jaypee_noida
            };
            const hasAny = Object.keys(wide).some((k) => Number(wide[k] || 0) !== 0);
            if (!hasAny) return {};
            const cleaned = {};
            Object.keys(wide).forEach((k) => {
              cleaned[k] = Number(wide[k] || 0);
            });
            return cleaned;
          } catch (_e) {
            return {};
          }
        })();
        const locationPercents = (() => {
          try {
            const value = row.location_percents_json || row.locationPercents || null;
            return parseJsonObject(value);
          } catch (_e) {
            return {};
          }
        })();
        const dbTotal = Number(row.total_budget || row.totalBudget || 0);
        const amountTotal = sumAmountMap(locationAmounts);
        return {
          id: String(row.id || ""),
          financialYear: row.financial_year || row.financialYear || "",
          coding: row.coding || "",
          item: row.item || "",
          owner: row.owner || "",
          costDistribution: row.cost_distribution || row.costDistribution || row.mode || "Distributed",
          totalBudget: dbTotal > 0 || !amountTotal ? dbTotal : amountTotal,
          locationAmounts,
          locationPercents
        };
      });
      const rowsWithOverrides = applyAllocationMatrixOverrides(mappedRows);
      state.allocationMatrixServerRows = rowsWithOverrides;
      state.allocationMatrixRows = mergeAllocationMatrixRows(rowsWithOverrides, state.allocationMatrixLocalRows || []);
      render();
      } catch (error) {
      console.error("Allocation matrix sync failed:", error);
      }
    });
  }

  async function saveAllocationMatrixRowToServer(payload) {
    const response = await fetch(apiUrl("allocation-matrix"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
    if (!response.ok) {
      const msg = await response.text();
      throw new Error(`Allocation matrix save failed (${response.status}): ${msg}`);
    }
    return response.json();
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

  const PLANNER_CODING_MAPPED_FIELDS = [
    "item",
    "subCategoryMapped",
    "categoryIt",
    "subCategory",
    "newCategory",
    "appCate",
    "cate3",
    "cate4"
  ];

  function clearPlannerMappedFields() {
    if (!state.form) state.form = {};
    PLANNER_CODING_MAPPED_FIELDS.forEach((key) => {
      state.form[key] = "";
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

  const ALLOCATION_CODING_MAPPED_FIELDS = [
    "item",
    "subCategoryMapped",
    "categoryIt",
    "subCategory",
    "newCategory",
    "appCate",
    "cate3",
    "cate4",
    "costCenterDepartment"
  ];

  const ALLOCATION_ITEM_MAPPED_FIELDS = [
    "item",
    "subCategoryMapped",
    "categoryIt",
    "subCategory",
    "newCategory",
    "appCate",
    "cate3",
    "cate4"
  ];

  function clearAllocationMappedFields(fields) {
    if (!state.allocationControls) state.allocationControls = {};
    (fields || []).forEach((key) => {
      state.allocationControls[key] = "";
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

  function findCurrentPlannerRecord(form) {
    const codingKey = normalizeText(form && form.coding);
    const locationKey = normalizeText(form && form.location);
    const yearKey = String(form && form.financialYear || "");
    if (!codingKey || !locationKey || !yearKey) return null;

    const ownerKey = normalizeText(form && form.owner);
    const records = Array.isArray(state.records) ? state.records : [];
    const matches = records.filter((record) => {
      if (normalizeText(record.coding) !== codingKey) return false;
      if (normalizeText(record.location) !== locationKey) return false;
      if (String(record.financialYear || "") !== yearKey) return false;
      if (ownerKey && normalizeText(record.owner) !== ownerKey) return false;
      return true;
    });
    if (!matches.length) return null;
    return matches.slice().sort((l, r) => new Date(r.savedAt || 0).getTime() - new Date(l.savedAt || 0).getTime())[0];
  }

  function syncPlannerExpenseContext() {
    const form = { ...(state.form || {}) };
    if (form.entryType !== "Expense") return;
    if (!(form.coding && form.financialYear && form.location)) return;

    const currentRecord = findCurrentPlannerRecord(form);
    if (!currentRecord) {
      // No budget row exists for this FY/location/coding yet; keep user in expense mode but don't create duplicates silently.
      state.editId = "";
      return;
    }

    state.editId = currentRecord.id || state.editId;
    form.locFyCurrent =
      currentRecord.locFyCurrent !== undefined && currentRecord.locFyCurrent !== null && currentRecord.locFyCurrent !== ""
        ? String(currentRecord.locFyCurrent)
        : "";
    form.locLe =
      currentRecord.locLe !== undefined && currentRecord.locLe !== null && currentRecord.locLe !== ""
        ? String(currentRecord.locLe)
        : (form.locLe || "");

    state.form = form;
    // Re-sync last year budget, but do not auto-fill LE from previous year.
    syncPlannerHistoricalValues("financialYear");
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
      if (form.entryType !== "Expense") form.locLe = "";
      form.locPercent = "0.00";
      state.form = form;
      return;
    }

    form.locFyLast =
      previousRecord.locFyCurrent !== undefined && previousRecord.locFyCurrent !== null && previousRecord.locFyCurrent !== ""
        ? String(previousRecord.locFyCurrent)
        : "";
    if (form.entryType !== "Expense") {
      form.locLe =
        previousRecord.locLe !== undefined && previousRecord.locLe !== null && previousRecord.locLe !== ""
          ? String(previousRecord.locLe)
          : form.locFyLast;
    }

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

  function payloadFromRecord(record) {
    return {
      "Submitted At": new Date().toISOString(),
      Coding: record.coding || "",
      Item: record.item || "",
      "Sub Category (Mapped)": record.subCategoryMapped || "",
      Category_IT: record.categoryIt || "",
      "Sub Category": record.subCategory || "",
      "New Category": record.newCategory || "",
      "App Cate.": record.appCate || "",
      "Cate.3": record.cate3 || "",
      "Cate.4": record.cate4 || "",
      Owner1: record.owner1 || "",
      Owner: record.owner || "",
      "Cost Center / Department": record.costCenter || "",
      "Financial Year": record.financialYear || "",
      Location: record.location || "",
      "Cost Distribution": record.costDistribution || "Fixed Cost",
      loc_fy_current: Number(record.locFyCurrent || 0),
      loc_le: Number(record.locLe || 0),
      loc_fy_last: Number(record.locFyLast || 0),
      new_amc: Number(record.newAmc || 0),
      new_project: Number(record.newProject || 0),
      annualized: Number(record.annualized || 0),
      price_increase: Number(record.priceIncrease || 0),
      new_unit: Number(record.newUnit || 0),
      license_increase: Number(record.licenseIncrease || 0),
      rest: Number(record.rest || 0),
      Justification: record.justification || ""
    };
  }

  const BUDGET_PLANNER_IMPORT_COLUMNS = [
    "Financial Year",
    "Coding",
    "Item",
    "Sub Category (Mapped)",
    "Category_IT",
    "Sub Category",
    "New Category",
    "App Cate.",
    "Cate.3",
    "Cate.4",
    "Owner1",
    "Owner",
    "Cost Center / Department",
    "MAX Hospital",
    "Cost Distribution",
    "Location LE",
    "Location FY Current",
    "Location FY Last",
    "New AMC",
    "New Project",
    "Annualized",
    "Price Increase",
    "New Unit",
    "License Increase",
    "Rest",
    "Justification"
  ];

  const BUDGET_PLANNER_REQUIRED_COLUMNS = [
    "Financial Year",
    "Coding",
    "Owner",
    "MAX Hospital",
    "Cost Distribution",
    "Location FY Current"
  ];

  function budgetPlannerImportKey(row) {
    return [
      normalizeText(row["Financial Year"]),
      normalizeText(row.Coding),
      normalizeText(row.Owner),
      normalizeText(row["MAX Hospital"]),
      normalizeText(row["Cost Distribution"] || "Fixed Cost")
    ].join("||");
  }

  function mapBudgetPlannerImportRow(row) {
    return {
      "Submitted At": new Date().toISOString(),
      Coding: row.Coding || "",
      Item: row.Item || "",
      "Sub Category (Mapped)": row["Sub Category (Mapped)"] || "",
      Category_IT: row.Category_IT || "",
      "Sub Category": row["Sub Category"] || "",
      "New Category": row["New Category"] || "",
      "App Cate.": row["App Cate."] || "",
      "Cate.3": row["Cate.3"] || "",
      "Cate.4": row["Cate.4"] || "",
      Owner1: row.Owner1 || "",
      Owner: row.Owner || "",
      "Cost Center / Department": row["Cost Center / Department"] || "",
      "Financial Year": row["Financial Year"] || "",
      Location: row["MAX Hospital"] || row.Location || "",
      "Cost Distribution": row["Cost Distribution"] || "Fixed Cost",
      loc_le: num(row["Location LE"]),
      loc_fy_current: num(row["Location FY Current"]),
      loc_fy_last: num(row["Location FY Last"]),
      new_amc: num(row["New AMC"]),
      new_project: num(row["New Project"]),
      annualized: num(row.Annualized),
      price_increase: num(row["Price Increase"]),
      new_unit: num(row["New Unit"]),
      license_increase: num(row["License Increase"]),
      rest: num(row.Rest),
      Justification: row.Justification || ""
    };
  }

  function readBudgetPlannerImportFile(file) {
    return new Promise((resolve, reject) => {
      if (typeof XLSX === "undefined") {
        reject(new Error("Excel library is not loaded. Please refresh the page and try again."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the selected Excel file."));
      reader.onload = () => {
        try {
          const workbook = XLSX.read(new Uint8Array(reader.result), { type: "array" });
          const sheetName = workbook.SheetNames.find((name) => normalizeText(name) === "budget_planner") || workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) throw new Error("No worksheet found in Excel file.");
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
          if (!rows.length) throw new Error("Budget_Planner sheet has no data rows.");

          const headers = Object.keys(rows[0] || {});
          const missingColumns = BUDGET_PLANNER_REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
          if (missingColumns.length) {
            throw new Error(`Missing required column(s): ${missingColumns.join(", ")}`);
          }

          const seen = new Set();
          const errors = [];
          const mappedRows = [];
          rows.forEach((row, index) => {
            const rowNumber = index + 2;
            const hasAnyValue = BUDGET_PLANNER_IMPORT_COLUMNS.some((column) => String(row[column] || "").trim());
            if (!hasAnyValue) return;

            const missing = BUDGET_PLANNER_REQUIRED_COLUMNS.filter((column) => !String(row[column] || "").trim());
            if (missing.length) {
              errors.push(`Row ${rowNumber}: missing ${missing.join(", ")}`);
              return;
            }

            const key = budgetPlannerImportKey(row);
            if (seen.has(key)) {
              errors.push(`Row ${rowNumber}: duplicate Financial Year + Coding + Owner + MAX Hospital + Cost Distribution in this file`);
              return;
            }
            seen.add(key);
            mappedRows.push(mapBudgetPlannerImportRow(row));
          });

          if (errors.length) {
            throw new Error(errors.slice(0, 8).join("\n"));
          }
          if (!mappedRows.length) throw new Error("No valid Budget_Planner rows found.");
          resolve({ rows: mappedRows, sheetName });
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  async function importBudgetPlannerFile(file) {
    state.plannerImportMessage = "Reading Budget_Planner Excel...";
    render();
    try {
      const parsed = await readBudgetPlannerImportFile(file);
      const proceed = window.confirm(
        `Import ${parsed.rows.length} Budget_Planner row(s) from "${parsed.sheetName}"?\n\nExisting matching rows will be updated. New rows will be created.`
      );
      if (!proceed) {
        state.plannerImportMessage = "Import cancelled.";
        render();
        return;
      }

      state.plannerImportMessage = `Uploading ${parsed.rows.length} Budget_Planner row(s)...`;
      render();
      const response = await fetch(apiUrl("budget-planner/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed.rows })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || `Import failed (${response.status})`);
      }
      await loadLiveBudgetData(false);
      const errorText = Array.isArray(result.errors) && result.errors.length ? ` ${result.errors.length} row(s) skipped.` : "";
      state.plannerImportMessage = `Import complete: ${result.created || 0} created, ${result.updated || 0} updated.${errorText}`;
      render();
    } catch (error) {
      console.error("Budget planner import failed:", error);
      state.plannerImportMessage = `Import failed: ${error.message}`;
      render();
    }
  }

  async function saveCurrentRecord() {
    const record = recordFromForm();
    if (!record.coding && !record.item && !record.location) return;

    const payload = payloadFromRecord(record);
    const numericId = Number(record.id || state.editId);
    const canUpdate = Number.isFinite(numericId) && numericId > 0;

    if (record.entryType === "Expense" && !canUpdate) {
      alert("Expense entry needs an existing Budget Taken row for the same Financial Year + MAX Hospital + Coding. Please add the budget first.");
      return;
    }

    const url = canUpdate ? apiUrl(`budget-data/${numericId}`) : apiUrl("budget-submissions");
    const method = canUpdate ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`${method} failed (${response.status}): ${message}`);
      }

      await loadLiveBudgetData(false);
      resetForm();
      state.activeView = "plannerView";
      render();
    } catch (error) {
      console.error("Save to Railway failed:", error);
      // Fallback: keep user work locally so it is not lost.
      const existingIndex = (state.records || []).findIndex((row) => String(row.id) === String(record.id));
      if (existingIndex >= 0) state.records.splice(existingIndex, 1, record);
      else state.records.unshift(record);
      state.records = recalculateRecords(state.records);
      persist();
      resetForm();
      state.activeView = "plannerView";
      render();
    }
  }

function editRecord(id) {

  const record = (state.records || []).find(
    (row) => String(row.id) === String(id)
  );

  if (!record) {
    console.log("Edit record not found:", id);
    return;
  }

  state.form = {
    ...record
  };

  state.editId = record.id;

  state.activeView = "plannerView";

  console.log("Editing record:", record);
}

  async function deleteRecord(id) {
    const numericId = Number(id);
    const canDeleteRemote = Number.isFinite(numericId) && numericId > 0;

    if (canDeleteRemote) {
      try {
        const response = await fetch(apiUrl(`budget-data/${numericId}`), {
          method: "DELETE"
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(`DELETE failed (${response.status}): ${message}`);
        }
        await loadLiveBudgetData(false);
        return;
      } catch (error) {
        console.error("Remote delete failed:", error);
      }
    }

    state.records = (state.records || []).filter((row) => String(row.id) !== String(id));
    state.records = recalculateRecords(state.records);
    persist();
  }

  async function openWorkflowHistory(recordId) {
    const record = (state.records || []).find((row) => String(row.id) === String(recordId));
    const workflowId = record && record.workflowId ? String(record.workflowId) : "";
    state.workflowHistoryModal = {
      recordId: String(recordId || ""),
      title: `Workflow History | ${record && record.coding ? record.coding : "Budget Record"}`,
      rows: [],
      error: workflowId ? "" : "No workflow instance exists for this legacy record yet."
    };

    if (!workflowId) {
      render();
      return;
    }

    const response = await fetch(apiUrl(`workflows/${workflowId}/history`));
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Workflow history failed (${response.status}): ${message}`);
    }
    const payload = await response.json();
    const rows = payload && Array.isArray(payload.data) ? payload.data : [];
    state.workflowHistoryModal = Object.assign({}, state.workflowHistoryModal, {
      rows,
      error: ""
    });
    render();
  }

  async function refreshWorkflowPanels() {
    const config = workflowConfig();
    if (!config.foundationEnabled) return;

    if (config.approvalQueueEnabled) {
      try {
        const queueResponse = await fetch(apiUrl("workflows/queue?workflowType=BUDGET&pageSize=10"));
        if (queueResponse.ok) {
          const payload = await queueResponse.json();
          state.workflowApprovalQueue = payload && payload.data ? payload.data : { rows: [], total: 0, page: 1, pageSize: 10 };
        }
      } catch (error) {
        console.error("Workflow queue refresh failed:", error);
        state.workflowApprovalQueue = { rows: [], total: 0, page: 1, pageSize: 10, error: "Approval queue is not available." };
      }
    }

    try {
      const summaryResponse = await fetch(apiUrl("workflows/summary"));
      if (summaryResponse.ok) {
        const payload = await summaryResponse.json();
        state.workflowSummary = payload && payload.data ? payload.data : { states: {}, actions: {} };
      }
    } catch (error) {
      console.error("Workflow summary refresh failed:", error);
      state.workflowSummary = { states: {}, actions: {}, error: "Workflow summary is not available." };
    }
  }

  async function loadLeMatrices() {
    const le = ensureLeState();
    if (workflowConfig().foundationEnabled === false) return;
    const response = await fetch(apiUrl("latest-estimates/matrices?pageSize=50"));
    if (!response.ok) throw new Error(`LE matrices failed (${response.status})`);
    const payload = await response.json();
    le.matrices = payload && payload.data && Array.isArray(payload.data.rows) ? payload.data.rows : [];
    if (!le.activeMatrixId && le.matrices.length) le.activeMatrixId = String(le.matrices[0].id || "");
  }

  async function loadLeCells() {
    const le = ensureLeState();
    if (!le.activeMatrixId) {
      le.cells = [];
      le.summary = null;
      return;
    }
    const filters = le.filters || {};
    const params = queryString({
      page: filters.page || 1,
      pageSize: filters.pageSize || 25,
      coding: filters.coding || "",
      location: filters.location && filters.location !== "All" ? filters.location : "",
      severity: filters.severity && filters.severity !== "All" ? filters.severity : "",
      changedOnly: filters.changedOnly ? "true" : "",
      hasRemarks: filters.hasRemarks ? "true" : ""
    });
    const response = await fetch(apiUrl(`latest-estimates/matrices/${encodeURIComponent(le.activeMatrixId)}/cells?${params}`));
    if (!response.ok) throw new Error(`LE cells failed (${response.status})`);
    const payload = await response.json();
    le.cells = payload && payload.data && Array.isArray(payload.data.rows) ? payload.data.rows : [];
  }

  async function loadLeSummary() {
    const le = ensureLeState();
    if (!le.activeMatrixId) return;
    const response = await fetch(apiUrl(`latest-estimates/matrices/${encodeURIComponent(le.activeMatrixId)}/summary`));
    if (!response.ok) throw new Error(`LE summary failed (${response.status})`);
    const payload = await response.json();
    le.summary = payload && payload.data ? payload.data : null;
  }

  async function refreshLatestEstimate() {
    const le = ensureLeState();
    try {
      await loadLeMatrices();
      await loadLeCells();
      await loadLeSummary();
      le.message = le.message || "";
    } catch (error) {
      console.error("Latest Estimate refresh failed:", error);
      le.message = "Latest Estimate data is not available. Verify migration 010 and database connectivity.";
    }
  }

  async function createLeMatrix() {
    const le = ensureLeState();
    const year = le.filters && le.filters.financialYear ? le.filters.financialYear : "";
    if (!year) {
      le.message = "Select Financial Year before creating an LE matrix.";
      render();
      return;
    }
    const response = await fetch(apiUrl("latest-estimates/matrices"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        financialYear: year,
        matrixName: `Latest Estimate ${year}`,
        matrixCode: `LE-${year}-${Date.now()}`
      })
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Create LE matrix failed (${response.status}): ${message}`);
    }
    const payload = await response.json();
    le.activeMatrixId = payload && payload.data && payload.data.matrix ? String(payload.data.matrix.id || "") : le.activeMatrixId;
    le.edits = {};
    le.message = "Latest Estimate matrix created.";
    await refreshLatestEstimate();
    render();
  }

  async function saveLeCells() {
    const le = ensureLeState();
    const matrix = (le.matrices || []).find((item) => String(item.id) === String(le.activeMatrixId));
    const edits = le.edits || {};
    const cells = Object.keys(edits).map((key) => {
      const draft = edits[key] || {};
      return {
        budgetEntityId: draft.budgetEntityId,
        coding: draft.coding,
        location: draft.location,
        financialYear: draft.financialYear,
        latestEstimateAmount: draft.latestEstimateAmount,
        expectedCellVersion: draft.expectedCellVersion || null,
        remarks: draft.remarks || ""
      };
    });
    if (!matrix || !cells.length) return;
    const response = await fetch(apiUrl(`latest-estimates/matrices/${encodeURIComponent(String(matrix.id))}/cells/bulk-save`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedMatrixVersion: matrix.versionNumber,
        idempotencyKey: leIdempotencyKey("le-bulk-save"),
        cells
      })
    });
    if (!response.ok) {
      let message = "Latest Estimate save failed.";
      try {
        const payload = await response.json();
        message = payload && payload.error && payload.error.message ? payload.error.message : message;
      } catch (_error) {}
      le.message = message;
      render();
      return;
    }
    le.edits = {};
    le.message = `Saved ${cells.length} changed LE cell(s).`;
    await refreshLatestEstimate();
    render();
  }

  async function loadNextFyBudgets() {
    const nextFy = ensureNextFyState();
    const params = new URLSearchParams();
    if (nextFy.filters.targetFinancialYear) params.set("targetFinancialYear", nextFy.filters.targetFinancialYear);
    const response = await fetch(apiUrl(`next-fy/budgets${params.toString() ? `?${params.toString()}` : ""}`));
    if (!response.ok) throw new Error("Next FY budgets could not be loaded.");
    const payload = await response.json();
    nextFy.budgets = payload && payload.data && Array.isArray(payload.data.rows) ? payload.data.rows : [];
    if (!nextFy.activeBudgetId && nextFy.budgets[0]) nextFy.activeBudgetId = String(nextFy.budgets[0].id);
  }

  async function loadNextFyLines() {
    const nextFy = ensureNextFyState();
    if (!nextFy.activeBudgetId) {
      nextFy.lines = [];
      return;
    }
    const params = new URLSearchParams();
    Object.entries(nextFy.filters || {}).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) params.set(key, value);
    });
    const response = await fetch(apiUrl(`next-fy/budgets/${encodeURIComponent(nextFy.activeBudgetId)}/lines?${params.toString()}`));
    if (!response.ok) throw new Error("Next FY lines could not be loaded.");
    const payload = await response.json();
    nextFy.lines = payload && payload.data && Array.isArray(payload.data.rows) ? payload.data.rows : [];
  }

  async function loadNextFySummary() {
    const nextFy = ensureNextFyState();
    if (!nextFy.activeBudgetId) {
      nextFy.summary = null;
      return;
    }
    const response = await fetch(apiUrl(`next-fy/budgets/${encodeURIComponent(nextFy.activeBudgetId)}/summary`));
    if (!response.ok) throw new Error("Next FY summary could not be loaded.");
    const payload = await response.json();
    nextFy.summary = payload && payload.data ? payload.data : null;
  }

  async function refreshNextFy() {
    const nextFy = ensureNextFyState();
    try {
      await loadNextFyBudgets();
      await Promise.all([loadNextFyLines(), loadNextFySummary()]);
    } catch (error) {
      nextFy.message = "Next FY data could not be loaded.";
      throw error;
    }
  }

  async function createNextFyBudget() {
    const nextFy = ensureNextFyState();
    const setup = nextFy.setup || {};
    const targetYear = setup.targetFinancialYear || "";
    const response = await fetch(apiUrl("next-fy/budgets"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budgetName: setup.budgetName || `Next FY Budget ${targetYear}`,
        budgetCode: `NEXTFY-${targetYear || "YEAR"}-${Date.now()}`,
        sourceStrategy: setup.sourceStrategy || "CURRENT_BUDGET",
        sourceEntityId: setup.sourceEntityId || "",
        sourceFinancialYear: setup.sourceFinancialYear || "",
        targetFinancialYear: targetYear,
        generationRemarks: setup.generationRemarks || "Created from Next FY setup.",
        idempotencyKey: nextFyIdempotencyKey("nextfy-create")
      })
    });
    if (!response.ok) throw new Error("Next FY budget could not be created.");
    const payload = await response.json();
    nextFy.activeBudgetId = payload && payload.data && payload.data.budget ? String(payload.data.budget.id) : nextFy.activeBudgetId;
    nextFy.message = "Next FY budget created.";
    await refreshNextFy();
    render();
  }

  async function saveNextFyAssumption() {
    const nextFy = ensureNextFyState();
    if (!nextFy.activeBudgetId) return;
    const response = await fetch(apiUrl(`next-fy/budgets/${encodeURIComponent(nextFy.activeBudgetId)}/assumptions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextFy.assumptionDraft || {})
    });
    if (!response.ok) throw new Error("Next FY assumption could not be saved.");
    nextFy.message = "Assumption saved.";
    render();
  }

  async function previewNextFyGeneration() {
    const nextFy = ensureNextFyState();
    if (!nextFy.activeBudgetId) return;
    const response = await fetch(apiUrl(`next-fy/budgets/${encodeURIComponent(nextFy.activeBudgetId)}/preview`));
    if (!response.ok) throw new Error("Next FY preview could not be generated.");
    const payload = await response.json();
    nextFy.preview = payload && payload.data ? payload.data : null;
    nextFy.message = "Generation preview refreshed.";
    render();
  }

  async function generateNextFyBudget() {
    const nextFy = ensureNextFyState();
    const budget = (nextFy.budgets || []).find((item) => String(item.id) === String(nextFy.activeBudgetId));
    if (!budget) return;
    const response = await fetch(apiUrl(`next-fy/budgets/${encodeURIComponent(nextFy.activeBudgetId)}/generate`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: budget.versionNumber,
        idempotencyKey: nextFyIdempotencyKey("nextfy-generate"),
        generationRemarks: (nextFy.setup && nextFy.setup.generationRemarks) || "Generated from configured assumptions."
      })
    });
    if (!response.ok) throw new Error("Next FY generation failed.");
    nextFy.edits = {};
    nextFy.message = "Next FY lines generated.";
    await refreshNextFy();
    render();
  }

  async function saveNextFyAdjustments() {
    const nextFy = ensureNextFyState();
    const budget = (nextFy.budgets || []).find((item) => String(item.id) === String(nextFy.activeBudgetId));
    const changes = Object.keys(nextFy.edits || {}).map((lineId) => {
      const draft = nextFy.edits[lineId] || {};
      return {
        lineId,
        expectedLineVersion: draft.expectedLineVersion,
        manualAdjustmentAmount: draft.manualAdjustmentAmount,
        adjustmentReason: draft.adjustmentReason || ""
      };
    });
    if (!budget || !changes.length) return;
    const response = await fetch(apiUrl(`next-fy/budgets/${encodeURIComponent(nextFy.activeBudgetId)}/lines/bulk-adjust`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: budget.versionNumber,
        idempotencyKey: nextFyIdempotencyKey("nextfy-adjust"),
        lines: changes
      })
    });
    if (!response.ok) throw new Error("Next FY adjustments could not be saved.");
    nextFy.edits = {};
    nextFy.message = `Saved ${changes.length} Next FY adjustment(s).`;
    await refreshNextFy();
    render();
  }

  async function reloadPlannerWorkflowData() {
    await loadLiveBudgetData(false);
    await refreshWorkflowPanels();
  }

  async function startWorkflowForRecord(recordId) {
    const record = (state.records || []).find((row) => String(row.id) === String(recordId));
    if (!record) throw new Error("Budget record is not available.");

    const response = await fetch(apiUrl("workflows"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowType: "BUDGET",
        entityType: "BUDGET_SUBMISSION",
        entityId: String(record.id),
        initialState: "DRAFT",
        idempotencyKey: workflowIdempotencyKey("workflow-start", record.id, "CREATE")
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Start workflow failed (${response.status}): ${message}`);
    }

    await reloadPlannerWorkflowData();
    render();
  }

  function openWorkflowTransitionModal(recordId, action) {
    const record = (state.records || []).find((row) => String(row.id) === String(recordId));
    if (!record || !record.workflowId) return;
    const actions = parseWorkflowActions(record.workflowAvailableActions);
    const actionMeta = actions.find((item) => String(item.action || "") === String(action || ""));
    if (!actionMeta) return;

    state.workflowTransitionModal = {
      recordId: String(record.id),
      workflowId: String(record.workflowId),
      action: String(actionMeta.action || action),
      actionLabel: actionMeta.label || action,
      currentState: record.workflowStatus || "",
      nextState: actionMeta.nextState || workflowNextState(record, action),
      expectedVersion: Number(record.workflowVersion || 0),
      remarksRequired: Boolean(actionMeta.remarksRequired),
      warning: actionMeta.warning || "",
      remarks: "",
      error: ""
    };
    render();
  }

  async function confirmWorkflowTransition() {
    const modal = state.workflowTransitionModal || {};
    if (!modal.workflowId || !modal.action) return;
    const remarksInput = document.getElementById("workflow-transition-remarks");
    const remarks = remarksInput && "value" in remarksInput ? remarksInput.value : modal.remarks || "";

    if (modal.remarksRequired && !String(remarks || "").trim()) {
      state.workflowTransitionModal = Object.assign({}, modal, {
        remarks,
        error: "Remarks are required for this workflow action."
      });
      render();
      return;
    }

    const response = await fetch(apiUrl(`workflows/${modal.workflowId}/transitions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: modal.action,
        expectedVersion: modal.expectedVersion,
        remarks,
        idempotencyKey: workflowIdempotencyKey("workflow-transition", modal.workflowId, modal.action)
      })
    });

    if (!response.ok) {
      let message = "Workflow transition failed. Refresh and retry.";
      try {
        const payload = await response.json();
        message = payload && payload.error && payload.error.message ? payload.error.message : message;
      } catch (_error) {}
      state.workflowTransitionModal = Object.assign({}, modal, { remarks, error: message });
      await loadLiveBudgetData(false);
      render();
      return;
    }

    state.workflowTransitionModal = null;
    await reloadPlannerWorkflowData();
    render();
  }

  function downloadReport() {
    if (typeof XLSX === "undefined") return;
    const records = Array.isArray(state.records) ? state.records : [];
    const workbook = XLSX.utils.book_new();

    function appendSheet(name, rows) {
      const safe = Array.isArray(rows) && rows.length ? rows : [{ Message: "No data available for this sheet." }];
      const sheet = XLSX.utils.json_to_sheet(safe);
      applyFinancialFormats(sheet, [
        "currentFY",
        "fyLastYear",
        "le",
        "newAmc",
        "newProject",
        "annualized",
        "priceIncrease",
        "newUnit",
        "licenseIncrease",
        "rest",
        "total",
        "budgetCurrentYear",
        "budgetLastYear",
        "differenceAmount",
        "lyExpense",
        "currentBudget",
        "budgetIncrease",
        "newExpansion",
        "planned",
        "used",
        "remaining"
      ]);
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
      if (
        comparisonFilters.financialYear &&
        comparisonFilters.financialYear !== "All" &&
        String(record.financialYear || "") !== String(comparisonFilters.financialYear)
      )
        return false;
      if (comparisonFilters.coding && comparisonFilters.coding !== "All" && normalizeText(record.coding) !== normalizeText(comparisonFilters.coding))
        return false;
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
      if (!String(value || "").trim()) {
        state.form.coding = "";
        clearPlannerMappedFields();
        syncPlannerHistoricalValues("coding");
        return;
      }
      const matchedCoding = findPlannerCodingMatch(value);
      const resolvedCoding = matchedCoding || value;
      state.form.coding = resolvedCoding;
      applyCodingProfile(resolvedCoding);
      syncPlannerHistoricalValues("coding");
      return;
    }

    state.form[key] = value;
    if (key === "entryType") {
      if (!state.form.entryType) state.form.entryType = "Budget Taken";
      if (state.form.entryType !== "Expense") {
        // Leaving expense mode stops editing an existing row unless user explicitly edits.
        state.editId = "";
      } else {
        syncPlannerExpenseContext();
      }
      syncPlannerHistoricalValues(key);
      return;
    }
    if (key === "item") {
      if (!String(value || "").trim()) {
        state.form.item = "";
        state.form.coding = "";
        clearPlannerMappedFields();
        syncPlannerHistoricalValues("coding");
        return;
      }
      const matchedCoding = findPlannerCodingByItemMatch(value);
      if (matchedCoding && normalizeText(matchedCoding) !== normalizeText(state.form.coding)) {
        state.form.coding = matchedCoding;
        applyCodingProfile(matchedCoding);
        syncPlannerHistoricalValues("coding");
        return;
      }
    }
    syncPlannerHistoricalValues(key);
    if (state.form && state.form.entryType === "Expense" && (key === "coding" || key === "financialYear" || key === "location" || key === "owner")) {
      syncPlannerExpenseContext();
    }
  }

  function setDashboardFilter(key, value) {
    state.dashboardFilters[key] = value || "";
  }

  function setSummaryFilter(key, value) {
    state.summaryFilters[key] = value || "";
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

  let renderQueued = false;

function render() {
  if (renderQueued) return;
  if (shouldDeferRenderForPointer()) {
    pointerRenderGate.deferred = true;
    return;
  }

  renderQueued = true;

  requestAnimationFrame(() => {
    try {
      if (ui.renderAll) {
        ui.renderAll();
      }
    } catch (err) {
      console.error("Render Error:", err);
    }

    renderQueued = false;
  });
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
      event.preventDefault();
      state.activeView = viewButton.getAttribute("data-view");
      render();
      if (state.activeView === "latestEstimateView") {
        refreshLatestEstimate().then(() => render()).catch((error) => console.error("Latest Estimate tab load failed:", error));
      }
      if (state.activeView === "nextFyView") {
        refreshNextFy().then(() => render()).catch((error) => console.error("Next FY tab load failed:", error));
      }
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    event.preventDefault();

    const action = actionButton.getAttribute("data-action");
    const id = actionButton.getAttribute("data-id");

    if (action === "save-record") {
      withButtonActionLock(actionButton, async () => {
        syncPlannerFormFromDom();
        if (ui.preparePlannerSave) ui.preparePlannerSave();
        await saveCurrentRecord();
      }).catch((error) => console.error("Save action failed:", error));
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
      withButtonActionLock(actionButton, async () => {
        await deleteRecord(id);
        render();
      }).catch((error) => console.error("Delete action failed:", error));
      return;
    }
    if (action === "workflow-history" && id) {
      withButtonActionLock(actionButton, async () => {
        await openWorkflowHistory(id);
      }).catch((error) => {
        console.error("Workflow history failed:", error);
        state.workflowHistoryModal = {
          recordId: id,
          title: "Workflow History",
          rows: [],
          error: "Workflow history is not available for this record."
        };
        render();
      });
      return;
    }
    if (action === "workflow-history-close") {
      state.workflowHistoryModal = null;
      render();
      return;
    }
    if (action === "workflow-start" && id) {
      withButtonActionLock(actionButton, async () => {
        await startWorkflowForRecord(id);
      }).catch((error) => {
        console.error("Start workflow failed:", error);
        alert("Workflow could not be started. Refresh and try again.");
      });
      return;
    }
    if (action === "workflow-transition-open" && id) {
      openWorkflowTransitionModal(id, actionButton.getAttribute("data-workflow-action"));
      return;
    }
    if (action === "workflow-transition-cancel" || action === "workflow-transition-close") {
      state.workflowTransitionModal = null;
      render();
      return;
    }
    if (action === "workflow-transition-confirm") {
      withButtonActionLock(actionButton, async () => {
        await confirmWorkflowTransition();
      }).catch((error) => {
        console.error("Workflow transition failed:", error);
        state.workflowTransitionModal = Object.assign({}, state.workflowTransitionModal || {}, {
          error: "Workflow transition failed. Refresh and try again."
        });
        render();
      });
      return;
    }
    if (action === "workflow-panels-refresh") {
      withButtonActionLock(actionButton, async () => {
        await refreshWorkflowPanels();
        render();
      }).catch((error) => console.error("Workflow panel refresh failed:", error));
      return;
    }
    if (action === "le-create-matrix") {
      withButtonActionLock(actionButton, async () => createLeMatrix()).catch((error) => {
        console.error("Create LE matrix failed:", error);
        ensureLeState().message = "Latest Estimate matrix could not be created.";
        render();
      });
      return;
    }
    if (action === "le-refresh") {
      withButtonActionLock(actionButton, async () => {
        await refreshLatestEstimate();
        render();
      }).catch((error) => console.error("Latest Estimate refresh failed:", error));
      return;
    }
    if (action === "le-save-cells") {
      withButtonActionLock(actionButton, async () => saveLeCells()).catch((error) => {
        console.error("Save LE cells failed:", error);
        ensureLeState().message = "Latest Estimate changed cells could not be saved.";
        render();
      });
      return;
    }
    if (action === "le-revert-cell") {
      const le = ensureLeState();
      const key = actionButton.getAttribute("data-le-key");
      if (key && le.edits) delete le.edits[key];
      render();
      return;
    }
    if (action === "nextfy-create-budget") {
      withButtonActionLock(actionButton, async () => createNextFyBudget()).catch((error) => {
        console.error("Create Next FY budget failed:", error);
        ensureNextFyState().message = "Next FY budget could not be created.";
        render();
      });
      return;
    }
    if (action === "nextfy-refresh") {
      withButtonActionLock(actionButton, async () => {
        await refreshNextFy();
        render();
      }).catch((error) => console.error("Next FY refresh failed:", error));
      return;
    }
    if (action === "nextfy-save-assumption") {
      withButtonActionLock(actionButton, async () => saveNextFyAssumption()).catch((error) => {
        console.error("Save Next FY assumption failed:", error);
        ensureNextFyState().message = "Next FY assumption could not be saved.";
        render();
      });
      return;
    }
    if (action === "nextfy-preview") {
      withButtonActionLock(actionButton, async () => previewNextFyGeneration()).catch((error) => {
        console.error("Preview Next FY failed:", error);
        ensureNextFyState().message = "Next FY preview could not be generated.";
        render();
      });
      return;
    }
    if (action === "nextfy-generate") {
      withButtonActionLock(actionButton, async () => generateNextFyBudget()).catch((error) => {
        console.error("Generate Next FY failed:", error);
        ensureNextFyState().message = "Next FY generation failed.";
        render();
      });
      return;
    }
    if (action === "nextfy-save-adjustments") {
      withButtonActionLock(actionButton, async () => saveNextFyAdjustments()).catch((error) => {
        console.error("Save Next FY adjustments failed:", error);
        ensureNextFyState().message = "Next FY adjustments could not be saved.";
        render();
      });
      return;
    }
    if (action === "nextfy-revert-line") {
      const nextFy = ensureNextFyState();
      const lineId = actionButton.getAttribute("data-nextfy-line-id");
      if (lineId && nextFy.edits) delete nextFy.edits[lineId];
      render();
      return;
    }
    if (action === "download-report") {
      withButtonActionLock(actionButton, async () => downloadReport()).catch((error) => console.error("Report download failed:", error));
      return;
    }
    if (action === "dashboard-export") {
      withButtonActionLock(actionButton, async () => {
        if (ui.exportDashboardPdf) ui.exportDashboardPdf();
      }).catch((error) => console.error("Dashboard export failed:", error));
      return;
    }
    if (action === "allocation-matrix-export") {
      withButtonActionLock(actionButton, async () => {
        if (ui.exportAllocationMatrixWorkbook) ui.exportAllocationMatrixWorkbook();
      }).catch((error) => console.error("Allocation export failed:", error));
      return;
    }
    if (action === "planner-saved-export") {
      withButtonActionLock(actionButton, async () => {
        if (ui.exportPlannerSavedRecordsWorkbook) ui.exportPlannerSavedRecordsWorkbook();
      }).catch((error) => console.error("Saved records export failed:", error));
      return;
    }
    if (action === "planner-budget-import") {
      const input = document.getElementById("planner-budget-upload");
      if (input && typeof input.click === "function") input.click();
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
        matrixId: String(actionButton.getAttribute("data-matrix-id") || ""),
        financialYear: String(actionButton.getAttribute("data-year") || ""),
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
      const matrixId = String(actionButton.getAttribute("data-matrix-id") || "");
      const coding = String(actionButton.getAttribute("data-coding") || "");
      const item = String(actionButton.getAttribute("data-item") || "");
      const owner = String(actionButton.getAttribute("data-owner") || "");
      const financialYear = String(actionButton.getAttribute("data-year") || "");
      const allocationType = String(actionButton.getAttribute("data-allocation-type") || "");
      const isDistributedRow = normalizeText(allocationType) === "distributed";
      const deleteRowRef = {
        id: matrixId,
        matrixId,
        financialYear,
        coding,
        item,
        owner,
        costDistribution: "Distributed"
      };

      if (!isDistributedRow) {
        state.allocationSubmitMessage =
          "Fixed Cost rows come from Budget Planner records. Delete them from Saved Records in Budget Planner if needed.";
        render();
        return;
      }

      const allocationEntriesToDelete = findMatchingAllocationEntries(deleteRowRef);

      const deleteTasks = [];
      const numericMatrixId = Number(matrixId);
      if (Number.isFinite(numericMatrixId) && numericMatrixId > 0) {
        deleteTasks.push(
          fetch(apiUrl(`allocation-matrix/${encodeURIComponent(String(matrixId))}`), { method: "DELETE" })
            .then(async (res) => {
              if (!res.ok) throw new Error(await res.text());
            })
        );
      } else {
        const matrixDeleteQuery = queryString({
          financialYear,
          coding,
          owner,
          costDistribution: "Distributed"
        });
        deleteTasks.push(
          fetch(apiUrl(`allocation-matrix/by-key?${matrixDeleteQuery}`), { method: "DELETE" })
            .then(async (res) => {
              if (!res.ok && res.status !== 404) throw new Error(await res.text());
            })
        );
      }
      let hasNumericAllocationDelete = false;
      allocationEntriesToDelete.forEach((entry) => {
        const allocationId = Number(entry && entry.id);
        if (!Number.isFinite(allocationId) || allocationId <= 0) return;
        hasNumericAllocationDelete = true;
        deleteTasks.push(
          fetch(apiUrl(`allocation-data/${encodeURIComponent(String(entry.id))}`), { method: "DELETE" })
            .then(async (res) => {
              if (!res.ok) throw new Error(await res.text());
            })
        );
      });
      if (!hasNumericAllocationDelete) {
        const allocationDeleteQuery = queryString({
          financialYear,
          coding,
          owner
        });
        deleteTasks.push(
          fetch(apiUrl(`allocation-data/by-key?${allocationDeleteQuery}`), { method: "DELETE" })
            .then(async (res) => {
              if (!res.ok && res.status !== 404) throw new Error(await res.text());
            })
        );
      }

      withButtonActionLock(actionButton, async () => {
        removeAllocationMatrixOverride(deleteRowRef);
        removeLocalAllocationMatrixRow(deleteRowRef);
        removeAllocationDbEntries(allocationEntriesToDelete);

        if (deleteTasks.length) {
          await Promise.all(deleteTasks);
          await Promise.all([loadAllocationDbFromServer(), loadAllocationMatrixFromServer()]);
        }

        if (state.allocationEditModal && state.allocationEditModal.rowKey === rowKey) {
          clearAllocationModalState();
        }

        state.allocationSubmitMessage = `Removed Distributed allocation for ${coding || item || "selected row"} (${financialYear || "all years"}).`;
        render();
      }).catch((error) => {
        console.error("Allocation delete failed:", error);
        state.allocationSubmitMessage = "Delete failed. Check server connection / id.";
        render();
      });
      return;
    }
    if (action === "allocation-modal-close" || action === "allocation-modal-cancel") {
      clearAllocationModalState();
      render();
      return;
    }
    if (action === "allocation-modal-save") {
      withButtonActionLock(actionButton, async () => {
      const modal = state.allocationEditModal || {};
      const rowKey = String(modal.rowKey || "");
      if (!rowKey) return;

      const draft = state.allocationEditDraft || {};
      const matchingMatrixRow = (state.allocationMatrixRows || []).find((row) => {
        const sameId = modal.matrixId && String(row.id || "") === String(modal.matrixId || "");
        const sameKeys =
          String(row.financialYear || "") === String(modal.financialYear || "") &&
          normalizeText(row.coding) === normalizeText(modal.coding) &&
          normalizeText(row.owner) === normalizeText(modal.owner);
        return sameId || sameKeys;
      });
      const matchingAllocationEntry = (state.allocationDb || []).find(
        (entry) =>
          String(entry.financialYear || entry.year || "") === String(modal.financialYear || "") &&
          normalizeText(entry.coding) === normalizeText(modal.coding) &&
          normalizeText(entry.owner) === normalizeText(modal.owner)
      );
      const base = normalizeAmountMap(
        Object.assign(
          {},
          state.allocationEditBase || {},
          matchingMatrixRow && matchingMatrixRow.locationAmounts ? matchingMatrixRow.locationAmounts : {}
        )
      );
      const locationAmounts = {};
      const editedLocations = [];
      const locations = unique([].concat(getKnownLocations(), Object.keys(base), Object.keys(draft)));
      let totalBudget = locations.reduce((sum, location) => {
        const baseValue = Math.max(0, num(base[location]));
        const hasDraftValue = Object.prototype.hasOwnProperty.call(draft, location);
        const parsedDraftValue = num(draft[location]);
        const draftValue = Math.max(0, hasDraftValue && Number.isFinite(parsedDraftValue) ? parsedDraftValue : baseValue);
        locationAmounts[location] = draftValue;
        if (hasDraftValue && allocationRoundedValue(draftValue) !== allocationRoundedValue(baseValue)) {
          editedLocations.push(location);
        }
        return sum + draftValue;
      }, 0);

      const baseTotal = sumAmountMap(base);
      if (totalBudget <= 0 && baseTotal > 0 && !Object.keys(draft).length) {
        Object.keys(base).forEach((location) => {
          locationAmounts[location] = base[location];
        });
        totalBudget = baseTotal;
      }
      if (totalBudget <= 0 && matchingMatrixRow && num(matchingMatrixRow.totalBudget) > 0) {
        const rebuilt = buildDistributedLocationAmounts(matchingMatrixRow.totalBudget);
        Object.keys(rebuilt.amounts).forEach((location) => {
          locationAmounts[location] = rebuilt.amounts[location];
        });
        totalBudget = sumAmountMap(locationAmounts);
      }
      if (totalBudget <= 0 && matchingAllocationEntry && num(matchingAllocationEntry.targetAmount) > 0) {
        const rebuilt = buildDistributedLocationAmounts(matchingAllocationEntry.targetAmount);
        Object.keys(rebuilt.amounts).forEach((location) => {
          locationAmounts[location] = rebuilt.amounts[location];
        });
        totalBudget = sumAmountMap(locationAmounts);
      }
      const distributionMap = buildDistributedLocationAmounts(totalBudget);
      const optimisticRow = {
        id: String(modal.matrixId || (matchingMatrixRow && matchingMatrixRow.id) || ""),
        financialYear: String(modal.financialYear || ""),
        coding: String(modal.coding || ""),
        item: String(modal.item || ""),
        owner: String(modal.owner || ""),
        totalBudget,
        costDistribution: "Distributed",
        locationAmounts,
        locationPercents: distributionMap.percents,
        editedLocations
      };
      upsertAllocationMatrixOverride(optimisticRow);
      upsertLocalAllocationMatrixRow(optimisticRow);

      // Editing should only change the edited location(s). Store explicit per-location amounts (no redistribution).
      await saveAllocationMatrixRowToServer({
        financialYear: String(modal.financialYear || ""),
        coding: String(modal.coding || ""),
        item: String(modal.item || ""),
        owner: String(modal.owner || ""),
        totalBudget,
        costDistribution: "Distributed",
        locationAmounts,
        locationPercents: distributionMap.percents
      });
      await loadAllocationMatrixFromServer();
      clearAllocationModalState();
      render();
      }).catch((error) => {
        console.error("Allocation matrix update failed:", error);
        state.allocationSubmitMessage = "Allocation update failed. Check server connection.";
        render();
      });
      return;
    }
    if (action === "allocation-submit") {
      withButtonActionLock(actionButton, async () => {
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
        const matrixSaveTasks = [];
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
          const distributionMap = buildDistributedLocationAmounts(targetAmount);
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

          // Persist one full allocation-matrix row per coding/owner/year to Railway.
          upsertAllocationMatrixOverride({
            financialYear,
            coding: item.code,
            item: state.allocationControls.item || "",
            owner,
            totalBudget: targetAmount,
            costDistribution: "Distributed",
            locationAmounts: distributionMap.amounts,
            locationPercents: distributionMap.percents
          });
          upsertLocalAllocationMatrixRow({
            financialYear,
            coding: item.code,
            item: state.allocationControls.item || "",
            owner,
            totalBudget: targetAmount,
            costDistribution: "Distributed",
            locationAmounts: distributionMap.amounts,
            locationPercents: distributionMap.percents
          });
          matrixSaveTasks.push(
            saveAllocationMatrixRowToServer({
              financialYear,
              coding: item.code,
              item: state.allocationControls.item || "",
              owner,
              totalBudget: targetAmount,
              costDistribution: "Distributed",
              locationAmounts: distributionMap.amounts,
              locationPercents: distributionMap.percents
            })
          );
        });

        state.allocationDb = Object.values(dbMap);
        saveAllocationDb();
        await Promise.all(matrixSaveTasks);
        await upsertAllocationDbToServer(state.allocationDb);
        await Promise.all([loadAllocationDbFromServer(), loadAllocationMatrixFromServer()]);
        state.allocationSubmitMessage = `Saved distribution for ${codings.join(", ")} | ${owner} | ${financialYear}. Distributed amount: ${fmt(
          batchTotal
        )}.`;
      } else {
        state.allocationSubmitMessage = `Submit blocked: coding=${codings.length ? codings.join(", ") : "missing"}, owner=${owner || "missing"}, year=${
          financialYear || "missing"
        }.`;
      }
      render();
      }).catch((error) => {
        console.error("Allocation submit failed:", error);
        state.allocationSubmitMessage = "Allocation submit failed. Check server connection.";
        render();
      });
    }
  });

  document.addEventListener("click", releasePointerRenderGate);
  document.addEventListener("pointerup", schedulePointerRenderGateRelease, true);
  document.addEventListener("pointercancel", releasePointerRenderGate);
  window.addEventListener("blur", releasePointerRenderGate);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releasePointerRenderGate();
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const id = target.id || "";
    const value = "value" in target ? target.value : "";

    if (id === "planner-budget-upload" && target instanceof HTMLInputElement) {
      const file = target.files && target.files[0];
      target.value = "";
      if (file) importBudgetPlannerFile(file);
      return;
    }

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
      const nextValue = value || "";
      state.plannerSavedFilters = Object.assign({}, state.plannerSavedFilters || {}, { [key]: nextValue });
      render();
      return;
    }

    if (id.startsWith("le-")) {
      const le = ensureLeState();
      const key = id.replace("le-", "");
      if (key === "matrix") {
        le.activeMatrixId = String(value || "").split("|")[0] || "";
        le.edits = {};
        refreshLatestEstimate().then(() => render()).catch((error) => console.error("Latest Estimate matrix switch failed:", error));
        return;
      }
      if (key === "changedOnly" || key === "hasRemarks") {
        le.filters[key] = value === "true";
      } else {
        le.filters[key] = value || "";
      }
      le.filters.page = 1;
      refreshLatestEstimate().then(() => render()).catch((error) => console.error("Latest Estimate filter failed:", error));
      return;
    }

    if (target.classList && target.classList.contains("le-cell-input")) {
      const le = ensureLeState();
      const key = target.getAttribute("data-le-key") || "";
      const field = target.getAttribute("data-le-field") || "";
      if (!key || !field) return;
      const draft = Object.assign({}, le.edits[key] || {});
      draft.budgetEntityId = target.getAttribute("data-budget-id") || draft.budgetEntityId || "";
      draft.coding = target.getAttribute("data-coding") || draft.coding || "";
      draft.location = target.getAttribute("data-location") || draft.location || "";
      draft.financialYear = target.getAttribute("data-year") || draft.financialYear || "";
      draft.expectedCellVersion = target.getAttribute("data-cell-version") || draft.expectedCellVersion || null;
      draft[field] = value;
      le.edits[key] = draft;
      return;
    }

    if (id.startsWith("nextfy-")) {
      const nextFy = ensureNextFyState();
      const key = id.replace("nextfy-", "");
      if (key === "budget") {
        nextFy.activeBudgetId = String(value || "").split("|")[0] || "";
        nextFy.edits = {};
        refreshNextFy().then(() => render()).catch((error) => console.error("Next FY budget switch failed:", error));
        return;
      }
      if (key.startsWith("filter")) {
        const filterKey = key.replace("filter", "");
        const normalizedFilterKey = filterKey.charAt(0).toLowerCase() + filterKey.slice(1);
        nextFy.filters[normalizedFilterKey] = value || "";
        nextFy.filters.page = 1;
        refreshNextFy().then(() => render()).catch((error) => console.error("Next FY filter failed:", error));
        return;
      }
      const setupKeys = new Set(["budgetName", "sourceStrategy", "sourceEntityId", "sourceFinancialYear", "targetFinancialYear", "generationRemarks"]);
      const ruleMap = {
        ruleName: "ruleName",
        ruleType: "ruleType",
        priority: "priority",
        ruleLocation: "location",
        ruleCoding: "coding",
        ruleCategory: "category",
        ruleOwner: "owner",
        growthPercentage: "growthPercentage",
        fixedAdjustmentAmount: "fixedAdjustmentAmount",
        ruleRemarks: "remarks"
      };
      if (setupKeys.has(key)) {
        nextFy.setup[key] = value || "";
        return;
      }
      if (ruleMap[key]) {
        nextFy.assumptionDraft[ruleMap[key]] = value;
        return;
      }
    }

    if (target.classList && target.classList.contains("nextfy-line-input")) {
      const nextFy = ensureNextFyState();
      const lineId = target.getAttribute("data-nextfy-line-id") || "";
      const field = target.getAttribute("data-nextfy-field") || "";
      if (!lineId || !field) return;
      const draft = Object.assign({}, nextFy.edits[lineId] || {});
      draft.expectedLineVersion = target.getAttribute("data-nextfy-line-version") || draft.expectedLineVersion || "";
      draft[field] = value;
      nextFy.edits[lineId] = draft;
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
      if (!String(value || "").trim()) {
        setAllocationControl("coding", "");
        clearAllocationMappedFields(ALLOCATION_CODING_MAPPED_FIELDS);
        render();
        return;
      }
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
      if (!String(value || "").trim()) {
        clearAllocationMappedFields(ALLOCATION_ITEM_MAPPED_FIELDS);
        render();
        return;
      }
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

    if (id.startsWith("unitBudget-")) {
      const key = id.replace("unitBudget-", "");
      if (ui.setUnitBudgetFilter) ui.setUnitBudgetFilter(key, value);
      return;
    }

    if (id === "allocation-amount") {
      setAllocationControl("amount", value);
      render();
      return;
    }

    if (id === "allocation-matrix-location") {
      const next = value || "";
      state.allocationMatrixFilters = Object.assign({}, state.allocationMatrixFilters || {}, { location: next });
      render();
      return;
    }
    if (id === "allocation-matrix-coding") {
      const next = value || "";
      state.allocationMatrixFilters = Object.assign({}, state.allocationMatrixFilters || {}, { coding: next });
      render();
      return;
    }
    if (id === "allocation-matrix-financialYear") {
      const next = value || "";
      state.allocationMatrixFilters = Object.assign({}, state.allocationMatrixFilters || {}, { financialYear: next });
      render();
      return;
    }
    if (id === "allocation-matrix-owner") {
      const next = value || "";
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
      const typedValue = num(target.value);
      const nextValue = Number.isFinite(typedValue) ? Math.max(0, typedValue) : 0;
      const changed = allocationRoundedValue(nextValue) !== allocationRoundedValue(baseValue);
      target.classList.toggle("is-edited", changed);
      const field = target.closest(".allocation-modal-field");
      if (field) field.classList.toggle("allocation-cell-edited", changed);
      return;
    }

    // Allocation Matrix inline edits are disabled; Railway is the source of truth.

    if (target.id === "allocation-amount" && "value" in target) {
      setAllocationControl("amount", target.value);
      return;
    }

    if (target.id === "allocation-coding" && target.classList.contains("combo-input") && "value" in target) {
      if (!String(target.value || "").trim()) {
        state.allocationControls.coding = "";
        state.allocationControls.codings = [];
        clearAllocationMappedFields(ALLOCATION_CODING_MAPPED_FIELDS);
        render();
        return;
      }
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

    if (target.id === "allocation-item" && target.classList.contains("combo-input") && "value" in target && !String(target.value || "").trim()) {
      clearAllocationMappedFields(ALLOCATION_ITEM_MAPPED_FIELDS);
      render();
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
  if (!state.allocationMatrixOverrides || typeof state.allocationMatrixOverrides !== "object") {
    state.allocationMatrixOverrides = loadAllocationMatrixOverrides();
  }
  // Railway remains the source of truth; local rows are only temporary optimistic overlays.
  if (!state.form) state.form = h.defaultForm ? h.defaultForm() : {};
  if (!state.activeView) state.activeView = "dashboardView";
async function loadLiveBudgetData(logStatus) {
  return singleFlightRefresh("budget", async () => {
  try {

    const response = await fetch(apiUrl("budget-data"));
    if (!response.ok) throw new Error(`Load failed (${response.status})`);

    const rows = await response.json();

    const remoteRecords = (Array.isArray(rows) ? rows : []).map(row => ({
      id: String(row.id || ""),
      coding: row.coding || row.Coding || "",
      item: row.item || row.Item || "",
      subCategoryMapped: row.sub_category_mapped || row["Sub Category (Mapped)"] || "",
      categoryIt: row.category_it || row.Category_IT || "",
      subCategory: row.sub_category || row["Sub Category"] || "",
      newCategory: row.new_category || row["New Category"] || "",
      appCate: row.app_cate || row["App Cate."] || "",
      cate3: row.cate3 || row["Cate.3"] || "",
      cate4: row.cate4 || row["Cate.4"] || "",
      owner1: row.owner1 || row.Owner1 || "",
      owner: row.owner || row.Owner || "",
      costCenter: row.cost_center_department || row["Cost Center / Department"] || "",
      location: row.location || row.Location || "",
      financialYear: row.financial_year || row["Financial Year"] || "",
      costDistribution: row.cost_distribution || row["Cost Distribution"] || "Fixed Cost",
      locFyCurrent: Number(row.loc_fy_current || row["loc_fy_current"] || 0),
      locLe: Number(row.loc_le || row["loc_le"] || 0),
      locFyLast: Number(row.loc_fy_last || row["loc_fy_last"] || 0),
      newAmc: Number(row.new_amc || row["new_amc"] || 0),
      newProject: Number(row.new_project || row["new_project"] || 0),
      annualized: Number(row.annualized || row["annualized"] || 0),
      priceIncrease: Number(row.price_increase || row["price_increase"] || 0),
      newUnit: Number(row.new_unit || row["new_unit"] || 0),
      licenseIncrease: Number(row.license_increase || row["license_increase"] || 0),
      rest: Number(row.rest || 0),
      justification: row.justification || row.Justification || "",
      workflowId: row.workflow_id ? String(row.workflow_id) : "",
      workflowStatus: row.workflow_status || "NOT_STARTED",
      workflowVersion: row.workflow_version || "",
      workflowLocked: Boolean(Number(row.workflow_is_locked || 0)),
      workflowAvailableActions: parseWorkflowActions(row.workflow_available_actions),
      workflowLastAction: row.workflow_last_action || "",
      workflowLastTransitionAt: row.workflow_last_transition_at || ""
    }));

    state.records = recalculateRecords(remoteRecords);
    persist();
    render();
    if (!logStatus) return;
console.log("Live DB connected ✅");

  } catch (error) {

    console.error("API Load Error:", error);

  }
  });
}

  function refreshAllData(logStatus) {
    return Promise.all([
      loadLiveBudgetData(Boolean(logStatus)),
      loadAllocationDbFromServer(),
      loadAllocationMatrixFromServer()
    ]).then(() => refreshWorkflowPanels());
  }

  function startRefreshLifecycle() {
    if (refreshLifecycle.timerId) return;
    refreshAllData(true).finally(() => render());
    refreshLifecycle.timerId = window.setInterval(() => {
      if (document.hidden) return;
      refreshAllData(false);
    }, LIVE_SYNC_INTERVAL_MS);
    if (!refreshLifecycle.visibilityBound) {
      refreshLifecycle.visibilityBound = true;
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshAllData(false);
      });
    }
  }

  startRefreshLifecycle();
  render();

window.addEventListener("error", (e) => {
  console.error("Global JS Error:", e.error);
});
})();
