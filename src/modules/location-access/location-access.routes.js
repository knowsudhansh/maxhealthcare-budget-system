const express = require("express");
const controller = require("./location-access.controller");
const {
  requireAuthentication,
  requirePermission
} = require("../../middleware/authentication");

function createLocationAccessRouter() {
  const router = express.Router();

  router.use("/locations", requireAuthentication);
  router.use("/location-access", requireAuthentication);

  router.get("/locations", requirePermission("location.view"), controller.locations);
  router.get("/locations/tree", requirePermission("location.view"), controller.tree);
  router.get("/locations/:locationId", requirePermission("location.view"), controller.location);
  router.post("/locations", requirePermission("location.create"), controller.create);
  router.patch("/locations/:locationId", requirePermission("location.update"), controller.update);

  router.get("/location-access/me", controller.myScope);
  router.get("/location-access/users/:userId", requirePermission("location.view_assignments"), controller.userAssignments);
  router.put("/location-access/users/:userId", requirePermission("location.assign"), controller.replaceAssignments);
  router.post("/location-access/users/:userId/assignments", requirePermission("location.assign"), controller.addAssignment);
  router.delete("/location-access/users/:userId/assignments/:assignmentId", requirePermission("location.assign"), controller.removeAssignment);

  return router;
}

module.exports = {
  createLocationAccessRouter
};
