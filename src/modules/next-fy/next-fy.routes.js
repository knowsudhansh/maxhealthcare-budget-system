const express = require("express");
const controller = require("./next-fy.controller");

function createNextFyRouter() {
  const router = express.Router();

  router.post("/next-fy/budgets", controller.createBudget);
  router.get("/next-fy/budgets", controller.listBudgets);
  router.get("/next-fy/budgets/:budgetId", controller.getBudget);
  router.post("/next-fy/budgets/:budgetId/assumptions", controller.saveAssumption);
  router.get("/next-fy/budgets/:budgetId/preview", controller.preview);
  router.post("/next-fy/budgets/:budgetId/generate", controller.generate);
  router.get("/next-fy/budgets/:budgetId/lines", controller.lines);
  router.post("/next-fy/budgets/:budgetId/lines/bulk-adjust", controller.adjust);
  router.get("/next-fy/budgets/:budgetId/summary", controller.summary);
  router.get("/next-fy/budgets/:budgetId/comparison", controller.comparison);
  router.get("/next-fy/budgets/:budgetId/export-data", controller.exportData);
  router.post("/next-fy/budgets/:budgetId/workflow/transitions", controller.transition);

  return router;
}

module.exports = {
  createNextFyRouter
};
