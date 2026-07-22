const { validationError } = require("../../errors/app-error");
const { parsePositiveInteger } = require("../../validation/common");
const { ENTITY_TYPES, WORKFLOW_TYPES } = require("./workflow.constants");

function cleanString(value, name, { required = false, max = 255 } = {}) {
  const text = String(value === null || value === undefined ? "" : value).trim();
  if (required && !text) throw validationError(`${name} is required.`);
  if (text.length > max) throw validationError(`${name} is too long.`);
  return text;
}

function normalizeEnum(value, allowed, name) {
  const text = cleanString(value, name, { required: true }).toUpperCase();
  if (!allowed.includes(text)) throw validationError(`${name} is invalid.`);
  return text;
}

function normalizeWorkflowCreatePayload(body = {}) {
  return {
    workflowType: normalizeEnum(body.workflowType || body.workflow_type || WORKFLOW_TYPES.BUDGET, Object.values(WORKFLOW_TYPES), "workflowType"),
    entityType: normalizeEnum(body.entityType || body.entity_type || ENTITY_TYPES.BUDGET_SUBMISSION, Object.values(ENTITY_TYPES), "entityType"),
    entityId: cleanString(body.entityId || body.entity_id, "entityId", { required: true, max: 80 }),
    budgetCycleId: body.budgetCycleId || body.budget_cycle_id ? parsePositiveInteger(body.budgetCycleId || body.budget_cycle_id, "budgetCycleId") : 0,
    initialState: cleanString(body.initialState || body.initial_state || "DRAFT", "initialState", { max: 40 }).toUpperCase(),
    idempotencyKey: cleanString(body.idempotencyKey || body.idempotency_key || "", "idempotencyKey", { max: 120 })
  };
}

function normalizeTransitionPayload(body = {}) {
  const hasExpectedVersion = body.expectedVersion !== undefined || body.expected_version !== undefined;
  return {
    action: cleanString(body.action, "action", { required: true, max: 80 }).toUpperCase(),
    expectedVersion: hasExpectedVersion ? parsePositiveInteger(body.expectedVersion || body.expected_version, "expectedVersion") : null,
    remarks: cleanString(body.remarks || "", "remarks", { max: 2000 }),
    reasonCode: cleanString(body.reasonCode || body.reason_code || "", "reasonCode", { max: 80 }),
    idempotencyKey: cleanString(body.idempotencyKey || body.idempotency_key || "", "idempotencyKey", { max: 120 }),
    metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {}
  };
}

function normalizeCyclePayload(body = {}) {
  return {
    cycleCode: cleanString(body.cycleCode || body.cycle_code, "cycleCode", { required: true, max: 80 }),
    cycleName: cleanString(body.cycleName || body.cycle_name, "cycleName", { required: true, max: 180 }),
    financialYear: cleanString(body.financialYear || body.financial_year, "financialYear", { required: true, max: 20 }),
    cycleType: cleanString(body.cycleType || body.cycle_type || WORKFLOW_TYPES.BUDGET, "cycleType", { max: 40 }).toUpperCase(),
    status: cleanString(body.status || "DRAFT", "status", { max: 40 }).toUpperCase(),
    startsAt: cleanString(body.startsAt || body.starts_at || "", "startsAt", { max: 40 }) || null,
    endsAt: cleanString(body.endsAt || body.ends_at || "", "endsAt", { max: 40 }) || null
  };
}

module.exports = {
  cleanString,
  normalizeCyclePayload,
  normalizeTransitionPayload,
  normalizeWorkflowCreatePayload
};
