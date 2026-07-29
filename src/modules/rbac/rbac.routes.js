const express = require("express");
const controller = require("./rbac.controller");
const {
  requireAuthentication,
  requirePermission
} = require("../../middleware/authentication");

function createRbacRouter() {
  const router = express.Router();

  router.use("/rbac", requireAuthentication);
  router.get("/rbac/roles", requirePermission("role.view"), controller.roles);
  router.post("/rbac/roles", requirePermission("role.create"), controller.createRole);
  router.get("/rbac/roles/:roleId", requirePermission("role.view"), controller.role);
  router.get("/rbac/roles/:roleId/permissions", requirePermission("role.view"), controller.rolePermissions);
  router.put("/rbac/roles/:roleId/permissions", requirePermission("role.assign_permission"), controller.updateRolePermissions);
  router.get("/rbac/permissions", requirePermission("permission.view"), controller.permissions);
  router.get("/rbac/users/:userId/roles", requirePermission("user.view"), controller.userRoles);
  router.put("/rbac/users/:userId/roles", requirePermission("user.assign_role"), controller.updateUserRoles);
  router.post("/rbac/seed", requirePermission("security.manage"), controller.seed);

  return router;
}

module.exports = {
  createRbacRouter
};
