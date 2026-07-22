const express = require("express");
const controller = require("./latest-estimate.controller");

function createLatestEstimateRouter() {
  const router = express.Router();

  router.post("/latest-estimates/matrices", controller.createMatrix);
  router.get("/latest-estimates/matrices", controller.listMatrices);
  router.get("/latest-estimates/matrices/:matrixId", controller.getMatrix);
  router.get("/latest-estimates/matrices/:matrixId/cells", controller.getCells);
  router.post("/latest-estimates/matrices/:matrixId/cells/bulk-save", controller.bulkSave);
  router.get("/latest-estimates/matrices/:matrixId/summary", controller.summary);
  router.get("/latest-estimates/matrices/:matrixId/variance", controller.variance);
  router.get("/latest-estimates/matrices/:matrixId/export-data", controller.exportData);
  router.post("/latest-estimates/matrices/:matrixId/workflow/transitions", controller.transition);

  return router;
}

module.exports = {
  createLatestEstimateRouter
};
