const {
  parseFinancialNumber,
  parsePositiveInteger,
  sanitizeString,
  validateFinancialYear
} = require("./common");

const MONEY_FIELDS = [
  "loc_fy_current",
  "loc_fy_last",
  "loc_le",
  "new_amc",
  "new_project",
  "annualized",
  "price_increase",
  "new_unit",
  "license_increase",
  "rest"
];

function validateBudgetId(value) {
  return parsePositiveInteger(value, "id");
}

function normalizeBudgetSubmission(body = {}) {
  const row = {
    "Submitted At": body["Submitted At"] || "",
    "Coding": sanitizeString(body["Coding"], 50),
    "Item": sanitizeString(body["Item"], 255),
    "Sub Category (Mapped)": sanitizeString(body["Sub Category (Mapped)"] || body.sub_category_mapped, 255),
    "Category_IT": sanitizeString(body["Category_IT"], 255),
    "Sub Category": sanitizeString(body["Sub Category"], 255),
    "New Category": sanitizeString(body["New Category"], 255),
    "App Cate.": sanitizeString(body["App Cate."], 255),
    "Cate.3": sanitizeString(body["Cate.3"], 255),
    "Cate.4": sanitizeString(body["Cate.4"], 255),
    "Owner1": sanitizeString(body["Owner1"], 100),
    "Owner": sanitizeString(body["Owner"], 100),
    "Cost Center / Department": sanitizeString(body["Cost Center / Department"], 100),
    "Financial Year": body["Financial Year"] ? validateFinancialYear(body["Financial Year"], "Financial Year") : "",
    "Location": sanitizeString(body["Location"], 100),
    "Cost Distribution": sanitizeString(body["Cost Distribution"] || body.cost_distribution || "Fixed Cost", 40),
    "Justification": sanitizeString(body["Justification"] || body.justification, 5000)
  };

  MONEY_FIELDS.forEach((field) => {
    row[field] = parseFinancialNumber(body[field], field, { allowFormatted: true });
  });

  return row;
}

module.exports = {
  normalizeBudgetSubmission,
  validateBudgetId
};
