const { parsePositiveInteger } = require("../../validation/common");
const { AppError, ERROR_CODES } = require("../../errors/app-error");
const { WORKFLOW_ACTIONS } = require("../workflow/workflow.constants");
const {
  normalizeActionPayload,
  normalizeListQuery,
  normalizeTransferCreatePayload
} = require("./transfer.validation");
const service = require("./transfer.service");

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
    actor: service.actorFromRequest(req),
    config: req.app && req.app.locals ? req.app.locals.runtimeConfig : null
  };
}

function moduleEnabled(req) {
  const config = req.app && req.app.locals ? req.app.locals.runtimeConfig : null;
  if (config && config.features && Object.prototype.hasOwnProperty.call(config.features, "transferModuleEnabled")) {
    return Boolean(config.features.transferModuleEnabled);
  }
  return process.env.TRANSFER_MODULE_ENABLED !== "false";
}

function assertEnabled(req) {
  if (!moduleEnabled(req)) {
    throw new AppError({
      statusCode: 404,
      publicCode: ERROR_CODES.RECORD_NOT_FOUND,
      publicMessage: "Transfer module is not available."
    });
  }
}

async function create(req, res, next) {
  try {
    assertEnabled(req);
    return sendSuccess(req, res, await service.createTransfer(normalizeTransferCreatePayload(req.body || {}), runtimeContext(req)), 201);
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    assertEnabled(req);
    return sendSuccess(req, res, await service.listTransfers(normalizeListQuery(req.query || {})));
  } catch (error) {
    return next(error);
  }
}

async function get(req, res, next) {
  try {
    assertEnabled(req);
    return sendSuccess(req, res, await service.getTransfer(parsePositiveInteger(req.params.id, "transferId")));
  } catch (error) {
    return next(error);
  }
}

async function transition(req, res, next, action) {
  try {
    assertEnabled(req);
    return sendSuccess(req, res, await service.transitionTransfer(
      parsePositiveInteger(req.params.id, "transferId"),
      action,
      normalizeActionPayload(req.body || {}),
      runtimeContext(req)
    ));
  } catch (error) {
    return next(error);
  }
}

async function submit(req, res, next) {
  return transition(req, res, next, WORKFLOW_ACTIONS.SUBMIT);
}

async function review(req, res, next) {
  return transition(req, res, next, WORKFLOW_ACTIONS.START_REVIEW);
}

async function approve(req, res, next) {
  return transition(req, res, next, WORKFLOW_ACTIONS.APPROVE);
}

async function returnToDraft(req, res, next) {
  return transition(req, res, next, WORKFLOW_ACTIONS.RETURN_TO_DRAFT);
}

async function reject(req, res, next) {
  return transition(req, res, next, WORKFLOW_ACTIONS.REJECT);
}

async function post(req, res, next) {
  try {
    assertEnabled(req);
    return sendSuccess(req, res, await service.postTransfer(
      parsePositiveInteger(req.params.id, "transferId"),
      normalizeActionPayload(req.body || {}),
      runtimeContext(req)
    ));
  } catch (error) {
    return next(error);
  }
}

async function reverse(req, res, next) {
  try {
    assertEnabled(req);
    return sendSuccess(req, res, await service.reverseTransfer(
      parsePositiveInteger(req.params.id, "transferId"),
      normalizeActionPayload(req.body || {}),
      runtimeContext(req)
    ));
  } catch (error) {
    return next(error);
  }
}

async function history(req, res, next) {
  try {
    assertEnabled(req);
    return sendSuccess(req, res, await service.getTransferHistory(parsePositiveInteger(req.params.id, "transferId")));
  } catch (error) {
    return next(error);
  }
}

async function dashboard(req, res, next) {
  try {
    assertEnabled(req);
    return sendSuccess(req, res, await service.getTransferDashboard());
  } catch (error) {
    return next(error);
  }
}

async function workingBudget(req, res, next) {
  try {
    assertEnabled(req);
    return sendSuccess(req, res, await service.getWorkingBudget(normalizeListQuery(req.query || {})));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  approve,
  create,
  dashboard,
  get,
  history,
  list,
  post,
  reject,
  reverse,
  review,
  submit,
  returnToDraft,
  workingBudget
};
