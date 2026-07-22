const express = require("express");
const controller = require("./workflow.controller");

function createWorkflowRouter() {
  const router = express.Router();

  router.get("/budget-cycles", controller.listBudgetCycles);
  router.post("/budget-cycles", controller.createBudgetCycle);

  router.get("/workflows/queue", controller.queue);
  router.get("/workflows/summary", controller.summary);
  router.post("/workflows", controller.createWorkflow);
  router.get("/workflows/entity/:entityType/:entityId", controller.getWorkflowByEntity);
  router.get("/workflows/:workflowId/actions", controller.getWorkflowActions);
  router.get("/workflows/:workflowId", controller.getWorkflow);
  router.post("/workflows/:workflowId/transitions", controller.transition);
  router.get("/workflows/:workflowId/history", controller.history);

  return router;
}

module.exports = {
  createWorkflowRouter
};
