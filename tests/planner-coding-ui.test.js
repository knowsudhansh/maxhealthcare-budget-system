const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { filterCodingValues, normalizeCodingKey, uniqueCodingValues } = require("../app-utils");

["itopex009", "ITOPEX009", "Itopex009", " itoPex009 "].forEach((value) => {
  assert.strictEqual(normalizeCodingKey(value), "ITOPEX009");
});

assert.deepStrictEqual(uniqueCodingValues(["itopex009", "ITOPEX009", "ITOPEX010"]), ["ITOPEX009", "ITOPEX010"]);

assert.deepStrictEqual(filterCodingValues(["ITOPEX009"], "itopex"), ["ITOPEX009"]);
assert.deepStrictEqual(filterCodingValues(["itopex009"], "ITOPEX"), ["itopex009"]);
assert.deepStrictEqual(filterCodingValues(["ITOPEX009"], "009"), ["ITOPEX009"]);
assert.deepStrictEqual(filterCodingValues(["ITOPEX009"], "  itoPex009  "), ["ITOPEX009"]);

const canonicalOptions = uniqueCodingValues(["ITOPEX009", "itopex009"]);
assert.strictEqual(canonicalOptions.length, 1);
assert.strictEqual(canonicalOptions[0], "ITOPEX009");

const appUi = fs.readFileSync(path.join(__dirname, "..", "app-ui.js"), "utf8");
const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

assert.ok(appUi.includes("data-combo-clear"), "Planning combo clear button markup is missing.");
assert.ok(appUi.includes("aria-label=\"Clear"), "Clear buttons must have accessible labels.");
assert.ok(appUi.includes("filterCombo(combo, \"\")"), "Clear button must restore the full option list.");
assert.ok(appJs.includes("PLANNER_CODING_MAPPED_FIELDS"), "Planner coding dependency list is missing.");
assert.ok(appJs.includes("clearPlannerMappedFields()"), "Planner clear behavior must clear mapped fields.");

console.log("Planner coding normalization and clear-button tests passed.");
