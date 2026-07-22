const { parsePositiveInteger } = require("../../validation/common");
const { normalizeTransitionPayload } = require("../workflow/workflow.validation");
const {
  normalizeBulkSavePayload,
  normalizeListQuery,
  normalizeMatrixCreatePayload
} = require("./latest-estimate.validation");
const {
  actorFromRequest,
  bulkSaveCells,
  createLatestEstimateMatrix,
  getLatestEstimateCells,
  getLatestEstimateMatrix,
  getLatestEstimateSummary,
  listLatestEstimateMatrices,
  transitionLatestEstimateWorkflow
} = require("./latest-estimate.service");

function sendSuccess(req, res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    requestId: req.requestId || ""
  });
}

async function createMatrix(req, res, next) {
  try {
    const result = await createLatestEstimateMatrix(normalizeMatrixCreatePayload(req.body || {}), {
      requestId: req.requestId,
      actor: actorFromRequest(req)
    });
    return sendSuccess(req, res, result, 201);
  } catch (error) {
    return next(error);
  }
}

async function listMatrices(req, res, next) {
  try {
    return sendSuccess(req, res, await listLatestEstimateMatrices(normalizeListQuery(req.query || {})));
  } catch (error) {
    return next(error);
  }
}

async function getMatrix(req, res, next) {
  try {
    return sendSuccess(req, res, await getLatestEstimateMatrix(parsePositiveInteger(req.params.matrixId, "matrixId")));
  } catch (error) {
    return next(error);
  }
}

async function getCells(req, res, next) {
  try {
    return sendSuccess(
      req,
      res,
      await getLatestEstimateCells(parsePositiveInteger(req.params.matrixId, "matrixId"), normalizeListQuery(req.query || {}))
    );
  } catch (error) {
    return next(error);
  }
}

async function bulkSave(req, res, next) {
  try {
    return sendSuccess(
      req,
      res,
      await bulkSaveCells(parsePositiveInteger(req.params.matrixId, "matrixId"), normalizeBulkSavePayload(req.body || {}), {
        requestId: req.requestId,
        actor: actorFromRequest(req)
      })
    );
  } catch (error) {
    return next(error);
  }
}

async function summary(req, res, next) {
  try {
    return sendSuccess(req, res, await getLatestEstimateSummary(parsePositiveInteger(req.params.matrixId, "matrixId")));
  } catch (error) {
    return next(error);
  }
}

async function variance(req, res, next) {
  return getCells(req, res, next);
}

async function exportData(req, res, next) {
  return getCells(req, res, next);
}

async function transition(req, res, next) {
  try {
    return sendSuccess(
      req,
      res,
      await transitionLatestEstimateWorkflow(
        parsePositiveInteger(req.params.matrixId, "matrixId"),
        normalizeTransitionPayload(req.body || {}),
        { requestId: req.requestId, actor: actorFromRequest(req) }
      )
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  bulkSave,
  createMatrix,
  exportData,
  getCells,
  getMatrix,
  listMatrices,
  summary,
  transition,
  variance
};
