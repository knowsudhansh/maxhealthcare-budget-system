const express = require("express");
const controller = require("./auth.controller");
const { requireAuthentication } = require("../../middleware/authentication");

function createAuthRouter() {
  const router = express.Router();

  router.post("/auth/login", controller.login);
  router.post("/auth/logout", controller.logout);
  router.get("/auth/me", requireAuthentication, controller.me);
  router.post("/auth/change-password", requireAuthentication, controller.changePassword);

  return router;
}

module.exports = {
  createAuthRouter
};
