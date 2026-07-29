const { loadEnvironment } = require("../src/config/environment");
const { loadDbSecret } = require("../src/config/secrets");
const { closePool, initializePool } = require("../src/db/pool");
const { serializeDatabaseError } = require("../src/db/error-diagnostics");
const { seedRbacRegistry } = require("../src/modules/rbac/rbac.service");

async function main() {
  const config = loadEnvironment(process.env);
  const secret = await loadDbSecret(config);
  await initializePool(config, secret);
  const result = await seedRbacRegistry();
  console.log(JSON.stringify({
    seeded: true,
    roles: result.roles,
    permissions: result.permissions,
    rolePermissions: result.rolePermissions
  }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("RBAC seed failed.");
      console.error(JSON.stringify(serializeDatabaseError(error, { stage: "seed-rbac" }), null, 2));
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}

module.exports = {
  main
};
