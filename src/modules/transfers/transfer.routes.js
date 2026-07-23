const express = require("express");
const controller = require("./transfer.controller");

function createTransferRouter() {
  const router = express.Router();

  router.post("/transfers", controller.create);
  router.get("/transfers", controller.list);
  router.get("/transfers/dashboard", controller.dashboard);
  router.get("/transfers/working-budget", controller.workingBudget);
  router.get("/transfers/:id", controller.get);
  router.post("/transfers/:id/submit", controller.submit);
  router.post("/transfers/:id/review", controller.review);
  router.post("/transfers/:id/approve", controller.approve);
  router.post("/transfers/:id/return", controller.returnToDraft);
  router.post("/transfers/:id/reject", controller.reject);
  router.post("/transfers/:id/post", controller.post);
  router.post("/transfers/:id/reverse", controller.reverse);
  router.get("/transfers/:id/history", controller.history);

  return router;
}

module.exports = {
  createTransferRouter
};
