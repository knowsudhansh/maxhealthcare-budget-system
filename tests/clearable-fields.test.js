const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { shouldShowClearButton } = require("../app-utils");

const appUi = fs.readFileSync(path.join(__dirname, "..", "app-ui.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

assert.strictEqual(shouldShowClearButton({ value: "" }), false);
assert.strictEqual(shouldShowClearButton({ value: null }), false);
assert.strictEqual(shouldShowClearButton({ value: undefined }), false);
assert.strictEqual(shouldShowClearButton({ value: "All" }), true);
assert.strictEqual(shouldShowClearButton({ value: "ALL" }), true);
assert.strictEqual(shouldShowClearButton({ value: "all" }), true);
assert.strictEqual(shouldShowClearButton({ value: "*" }), true);
assert.strictEqual(shouldShowClearButton({ value: "Saket" }), true);
assert.strictEqual(shouldShowClearButton({ value: "ITOPEX007" }), true);
assert.strictEqual(shouldShowClearButton({ value: "Select location", placeholderValue: "Select location" }), false);

function includesAll(source, values, message) {
  values.forEach((value) => {
    assert.ok(source.includes(value), `${message}: missing ${value}`);
  });
}

includesAll(
  appUi,
  [
    "data-combo-clear",
    "data-select-clear",
    "select-clear-wrap",
    "select-clear-control",
    "state.pendingComboOpen",
    "filterCombo(combo, \"\")"
  ],
  "Shared clearable field UI"
);

includesAll(
  appUi,
  [
    "function shouldShowClear",
    "function isAllValue",
    "isAllValue(matrixLocationRaw)",
    "isAllValue(filters.location)",
    "!isAllValue(codingFilter)"
  ],
  "Explicit All state handling"
);

includesAll(
  appUi,
  [
    "dashboard-location",
    "dashboard-category",
    "dashboard-coding",
    "dashboard-financialYear",
    "dashboard-owner",
    "plannerSaved-financialYear",
    "plannerSaved-location",
    "plannerSaved-coding",
    "plannerSaved-item",
    "plannerSaved-owner",
    "summary-location",
    "summary-financialYear",
    "unitBudget-location",
    "unitBudget-financialYear",
    "allocation-matrix-location",
    "allocation-matrix-coding",
    "allocation-matrix-financialYear",
    "allocation-matrix-owner",
    "allocation-coding",
    "allocation-item",
    "allocation-owner",
    "allocation-financialYear",
    "comparison-location1",
    "comparison-location2",
    "comparison-coding",
    "comparison-financialYear"
  ],
  "Expected active clearable fields"
);

includesAll(
  appJs,
  [
    "setDashboardFilter(key, value)",
    "setSummaryFilter(id.replace(\"summary-\", \"\"), value)",
    "setComparisonFilter(key, value)",
    "plannerSavedFilters",
    "allocationMatrixFilters",
    "setUnitBudgetFilter",
    "ALLOCATION_CODING_MAPPED_FIELDS",
    "ALLOCATION_ITEM_MAPPED_FIELDS",
    "clearAllocationMappedFields"
  ],
  "State reset handlers"
);

assert.ok(appUi.includes('selectCard("allocation-mode", "Cost Distribution", "Distribution", ["Distribution"], "Select mode", false)'), "Allocation Cost Distribution must remain required.");
assert.ok(!appUi.includes('value === "All"'), "Generic clear visibility must not treat All as an empty/default value.");
assert.ok(appUi.includes('["All"]'), "Native select helper should support explicit All options separately from placeholders.");
assert.ok(appJs.includes("state.dashboardFilters[key] = value || \"\""), "Dashboard clear must reset to empty, not back to All.");
assert.ok(styles.includes(".combo-clear:focus"), "Clear button focus style is missing.");
assert.ok(styles.includes(".select-clear-wrap"), "Native select clear wrapper style is missing.");

console.log("Global clearable-field tests passed.");
