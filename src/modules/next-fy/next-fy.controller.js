const { parsePositiveInteger } = require("../../validation/common");
const { normalizeTransitionPayload } = require("../workflow/workflow.validation");
const {
  normalizeAdjustmentPayload,
  normalizeAssumptionPayload,
  normalizeCreateBudgetPayload,
  normalizeGeneratePayload,
  normalizeListQuery
} = require("./next-fy.validation");
const {
  actorFromRequest,
  bulkAdjustLines,
  createNextFyBudget,
  generateNextFyBudget,
  getLines,
  getNextFyBudget,
  getNextFySummary,
  listNextFyBudgets,
  previewGeneration,
  saveAssumptionRule,
  transitionNextFyWorkflow
} = require("./next-fy.service");

function sendSuccess(req, res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    requestId: req.requestId || ""
  });
}

function runtimeContext(req) {
  return {
    requestId: req.requestId,
    actor: actorFromRequest(req),
    config: req.app && req.app.locals ? req.app.locals.runtimeConfig : null
  };
}

async function createBudget(req, res, next) {
  try {
    return sendSuccess(req, res, await createNextFyBudget(normalizeCreateBudgetPayload(req.body || {}), runtimeContext(req)), 201);
  } catch (error) {
    return next(error);
  }
}

async function listBudgets(req, res, next) {
  try {
    return sendSuccess(req, res, await listNextFyBudgets(normalizeListQuery(req.query || {})));
  } catch (error) {
    return next(error);
  }
}

async function getBudget(req, res, next) {
  try {
    return sendSuccess(req, res, await getNextFyBudget(parsePositiveInteger(req.params.budgetId, "budgetId")));
  } catch (error) {
    return next(error);
  }
}

async function saveAssumption(req, res, next) {
  try {
    return sendSuccess(req, res, await saveAssumptionRule(
      parsePositiveInteger(req.params.budgetId, "budgetId"),
      normalizeAssumptionPayload(req.body || {}),
      runtimeContext(req)
    ));
  } catch (error) {
    return next(error);
  }
}

async function preview(req, res, next) {
  try {
    return sendSuccess(req, res, await previewGeneration(parsePositiveInteger(req.params.budgetId, "budgetId"), runtimeContext(req)));
  } catch (error) {
    return next(error);
  }
}

async function generate(req, res, next) {
  try {
    return sendSuccess(req, res, await generateNextFyBudget(
      parsePositiveInteger(req.params.budgetId, "budgetId"),
      normalizeGeneratePayload(req.body || {}),
      runtimeContext(req)
    ));
  } catch (error) {
    return next(error);
  }
}

async function lines(req, res, next) {
  try {
    return sendSuccess(req, res, await getLines(parsePositiveInteger(req.params.budgetId, "budgetId"), normalizeListQuery(req.query || {})));
  } catch (error) {
    return next(error);
  }
}

async function adjust(req, res, next) {
  try {
    const maxLines = Number(req.app && req.app.locals && req.app.locals.runtimeConfig && req.app.locals.runtimeConfig.features
      ? req.app.locals.runtimeConfig.features.nextFyMaxBulkLines
      : process.env.NEXT_FY_MAX_BULK_LINES || 500);
    return sendSuccess(req, res, await bulkAdjustLines(
      parsePositiveInteger(req.params.budgetId, "budgetId"),
      normalizeAdjustmentPayload(req.body || {}, maxLines),
      runtimeContext(req)
    ));
  } catch (error) {
    return next(error);
  }
}

async function summary(req, res, next) {
  try {
    return sendSuccess(req, res, await getNextFySummary(parsePositiveInteger(req.params.budgetId, "budgetId")));
  } catch (error) {
    return next(error);
  }
}

async function comparison(req, res, next) {
  return lines(req, res, next);
}

async function exportData(req, res, next) {
  return lines(req, res, next);
}

async function transition(req, res, next) {
  try {
    return sendSuccess(req, res, await transitionNextFyWorkflow(
      parsePositiveInteger(req.params.budgetId, "budgetId"),
      normalizeTransitionPayload(req.body || {}),
      runtimeContext(req)
    ));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  adjust,
  comparison,
  createBudget,
  exportData,
  generate,
  getBudget,
  lines,
  listBudgets,
  preview,
  saveAssumption,
  summary,
  transition
};
