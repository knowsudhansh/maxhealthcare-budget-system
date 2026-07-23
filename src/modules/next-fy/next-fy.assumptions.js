const { ASSUMPTION_RULE_TYPES } = require("./next-fy.constants");
const { NEXT_FY_ERROR_CODES, nextFyError } = require("./next-fy.errors");

const SPECIFICITY = Object.freeze({
  [ASSUMPTION_RULE_TYPES.MANUAL_OVERRIDE]: 100,
  [ASSUMPTION_RULE_TYPES.CODING_LOCATION_GROWTH]: 90,
  [ASSUMPTION_RULE_TYPES.CATEGORY_LOCATION_GROWTH]: 80,
  [ASSUMPTION_RULE_TYPES.CODING_GROWTH]: 70,
  [ASSUMPTION_RULE_TYPES.LOCATION_GROWTH]: 60,
  [ASSUMPTION_RULE_TYPES.OWNER_GROWTH]: 50,
  [ASSUMPTION_RULE_TYPES.CATEGORY_GROWTH]: 40,
  [ASSUMPTION_RULE_TYPES.GLOBAL_GROWTH]: 10,
  [ASSUMPTION_RULE_TYPES.FIXED_AMOUNT]: 5
});

function key(value) {
  return String(value || "").trim().toUpperCase();
}

function ruleMatches(rule, line) {
  if (!rule || rule.isActive === false || Number(rule.isActive) === 0) return false;
  const type = String(rule.ruleType || rule.rule_type || "").toUpperCase();
  if (type === ASSUMPTION_RULE_TYPES.GLOBAL_GROWTH || type === ASSUMPTION_RULE_TYPES.FIXED_AMOUNT) return true;
  if (type.includes("CODING") && key(rule.coding) !== key(line.coding)) return false;
  if (type.includes("LOCATION") && key(rule.location) !== key(line.location)) return false;
  if (type.includes("CATEGORY") && key(rule.category) !== key(line.category)) return false;
  if (type.includes("OWNER") && key(rule.owner) !== key(line.owner)) return false;
  return true;
}

function normalizeRule(rule) {
  return {
    id: rule.id ? Number(rule.id) : null,
    ruleName: rule.ruleName || rule.rule_name || "",
    ruleType: String(rule.ruleType || rule.rule_type || ASSUMPTION_RULE_TYPES.GLOBAL_GROWTH).toUpperCase(),
    priority: Number.isInteger(Number(rule.priority)) ? Number(rule.priority) : 100,
    location: rule.location || "",
    coding: rule.coding || "",
    category: rule.category || "",
    owner: rule.owner || "",
    growthPercentage: Number(rule.growthPercentage ?? rule.growth_percentage ?? 0),
    fixedAdjustmentAmount: Number(rule.fixedAdjustmentAmount ?? rule.fixed_adjustment_amount ?? 0),
    isActive: rule.isActive ?? rule.is_active ?? true
  };
}

function chooseAssumptionRule(rules, line) {
  const matched = (rules || []).map(normalizeRule).filter((rule) => ruleMatches(rule, line));
  if (!matched.length) {
    return {
      rule: null,
      ambiguous: false,
      growthPercentage: 0,
      fixedAdjustmentAmount: 0,
      matchCount: 0
    };
  }

  matched.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (SPECIFICITY[b.ruleType] || 0) - (SPECIFICITY[a.ruleType] || 0);
  });
  const top = matched[0];
  const topSpecificity = SPECIFICITY[top.ruleType] || 0;
  const conflicts = matched.filter((rule) => (
    rule.id !== top.id &&
    rule.priority === top.priority &&
    (SPECIFICITY[rule.ruleType] || 0) === topSpecificity &&
    (Number(rule.growthPercentage) !== Number(top.growthPercentage) ||
      Number(rule.fixedAdjustmentAmount) !== Number(top.fixedAdjustmentAmount))
  ));
  if (conflicts.length) {
    return {
      rule: top,
      ambiguous: true,
      conflicts,
      growthPercentage: top.growthPercentage,
      fixedAdjustmentAmount: top.fixedAdjustmentAmount,
      matchCount: matched.length
    };
  }
  return {
    rule: top,
    ambiguous: false,
    growthPercentage: top.growthPercentage,
    fixedAdjustmentAmount: top.fixedAdjustmentAmount,
    matchCount: matched.length
  };
}

function assertNoAmbiguousRules(results) {
  const ambiguous = (results || []).filter((result) => result && result.assumption && result.assumption.ambiguous);
  if (ambiguous.length) {
    throw nextFyError(422, NEXT_FY_ERROR_CODES.NEXT_FY_AMBIGUOUS_ASSUMPTION_RULE, "Ambiguous Next FY assumption rules must be resolved before generation.", {
      ambiguousLineCount: ambiguous.length
    });
  }
}

module.exports = {
  SPECIFICITY,
  assertNoAmbiguousRules,
  chooseAssumptionRule,
  normalizeRule,
  ruleMatches
};
