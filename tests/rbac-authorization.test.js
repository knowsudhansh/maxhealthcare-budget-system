const assert = require("assert");
const http = require("http");

const { initializePool, resetPoolForTests, closePool } = require("../src/db/pool");
const { app } = require("../server");
const {
  PERMISSIONS,
  ROLE_CODES,
  ROLE_PERMISSION_MATRIX,
  ROLES
} = require("../src/modules/rbac/rbac.constants");
const {
  requireAllPermissions,
  requireAnyPermission,
  requirePermission
} = require("../src/middleware/authentication");
const {
  resolveAuthorizationContext,
  seedRbacRegistry
} = require("../src/modules/rbac/rbac.service");
const { serializeCookie } = require("../src/modules/auth/session");

function createMemoryDb() {
  const state = {
    roles: [],
    permissions: [],
    rolePermissions: new Set(),
    users: [{ id: 1, employee_id: "EMP001", email: "u@example.com", display_name: "User One", status: "ACTIVE" }],
    userRoles: []
  };
  let nextRoleId = 1;
  let nextPermissionId = 1;

  async function execute(sql, params = []) {
    const text = String(sql).replace(/\s+/g, " ");
    if (text.includes("INSERT INTO roles")) {
      const existing = state.roles.find((role) => role.code === params[0]);
      if (existing) {
        existing.name = params[1];
        existing.description = params[2];
        existing.is_system_role = params[3];
      } else {
        state.roles.push({ id: nextRoleId++, code: params[0], name: params[1], description: params[2], is_system_role: params[3] });
      }
      return [{ affectedRows: 1 }];
    }
    if (text.includes("INSERT INTO permissions")) {
      const existing = state.permissions.find((permission) => permission.code === params[0]);
      if (existing) {
        existing.module = params[1];
        existing.action = params[2];
        existing.description = params[3];
      } else {
        state.permissions.push({ id: nextPermissionId++, code: params[0], module: params[1], action: params[2], description: params[3] });
      }
      return [{ affectedRows: 1 }];
    }
    if (text.includes("SELECT * FROM roles WHERE code")) {
      return [[state.roles.find((role) => role.code === params[0])].filter(Boolean)];
    }
    if (text.includes("SELECT * FROM roles WHERE id")) {
      return [[state.roles.find((role) => role.id === Number(params[0]))].filter(Boolean)];
    }
    if (text.includes("SELECT * FROM permissions WHERE code IN")) {
      return [state.permissions.filter((permission) => params.includes(permission.code)).sort((a, b) => a.code.localeCompare(b.code))];
    }
    if (text.includes("INSERT INTO role_permissions")) {
      state.rolePermissions.add(`${params[0]}:${params[1]}`);
      return [{ affectedRows: 1 }];
    }
    if (text.includes("SELECT u.id AS user_id")) {
      const user = state.users.find((candidate) => candidate.id === Number(params[0]));
      if (!user) return [[]];
      const rows = [];
      state.userRoles
        .filter((assignment) => assignment.user_id === user.id && assignment.active)
        .forEach((assignment) => {
          const role = state.roles.find((candidate) => candidate.id === assignment.role_id);
          Array.from(state.rolePermissions)
            .map((key) => key.split(":").map(Number))
            .filter(([roleId]) => roleId === role.id)
            .forEach(([, permissionId]) => {
              const permission = state.permissions.find((candidate) => candidate.id === permissionId);
              rows.push({
                user_id: user.id,
                employee_id: user.employee_id,
                email: user.email,
                display_name: user.display_name,
                status: user.status,
                role_code: role.code,
                permission_code: permission.code
              });
            });
        });
      return [rows.length ? rows : [{
        user_id: user.id,
        employee_id: user.employee_id,
        email: user.email,
        display_name: user.display_name,
        status: user.status,
        role_code: null,
        permission_code: null
      }]];
    }
    return [[]];
  }

  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute,
    query: async () => [[]]
  };

  return {
    state,
    pool: {
      query: async (sql) => {
        if (String(sql).includes("SELECT 1")) return [[{ ok: 1 }]];
        return [[]];
      },
      execute,
      getConnection: async () => connection,
      end: async () => {}
    }
  };
}

function invokeMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error || null));
  });
}

function listen(appInstance) {
  return new Promise((resolve) => {
    const server = appInstance.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function request(server, requestPath) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: requestPath, method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function setupPool(fake) {
  resetPoolForTests();
  await initializePool({
    db: {
      host: "localhost",
      port: 3306,
      database: "budget",
      user: "user",
      password: "password",
      ssl: false,
      connectionLimit: 10,
      connectTimeoutMs: 10000
    }
  }, null, { mysql: { createPool: () => fake.pool } });
}

async function run() {
  assert.strictEqual(ROLES.length, 10);
  assert.ok(PERMISSIONS.some((permission) => permission.code === "role.assign_permission"));
  assert.ok(ROLE_PERMISSION_MATRIX[ROLE_CODES.SUPER_ADMIN].includes("security.manage"));

  const fake = createMemoryDb();
  await setupPool(fake);
  const firstSeed = await seedRbacRegistry();
  const secondSeed = await seedRbacRegistry();
  assert.strictEqual(firstSeed.roles, ROLES.length);
  assert.strictEqual(secondSeed.permissions, PERMISSIONS.length);
  assert.strictEqual(fake.state.roles.length, ROLES.length, "Role seed must be idempotent.");
  assert.strictEqual(fake.state.permissions.length, PERMISSIONS.length, "Permission seed must be idempotent.");

  const submitterRole = fake.state.roles.find((role) => role.code === ROLE_CODES.BUDGET_SUBMITTER);
  fake.state.userRoles.push({ user_id: 1, role_id: submitterRole.id, active: true });
  const context = await resolveAuthorizationContext({ id: 1 });
  assert.ok(context.roles.includes(ROLE_CODES.BUDGET_SUBMITTER));
  assert.ok(context.permissions.includes("planner.submit"));
  assert.strictEqual(new Set(context.permissions).size, context.permissions.length);

  assert.strictEqual(await invokeMiddleware(requirePermission("planner.submit"), {
    auth: { user: { id: 1 }, permissions: ["planner.submit"] }
  }), null);
  assert.strictEqual((await invokeMiddleware(requirePermission("planner.delete"), {
    auth: { user: { id: 1 }, permissions: ["planner.submit"] }
  })).publicCode, "FORBIDDEN");
  assert.strictEqual((await invokeMiddleware(requireAnyPermission(["planner.delete", "planner.submit"]), {
    auth: { user: { id: 1 }, permissions: ["planner.submit"] }
  })), null);
  assert.strictEqual((await invokeMiddleware(requireAllPermissions(["planner.view", "planner.submit"]), {
    auth: { user: { id: 1 }, permissions: ["planner.submit"] }
  })).publicCode, "FORBIDDEN");
  assert.throws(() => requirePermission("unknown.permission"), /Unknown permission/);

  const cookie = serializeCookie("max_it_opex_session", "token", { path: "/apps/it-opex", sameSite: "Lax" });
  const clear = serializeCookie("max_it_opex_session", "", { path: "/apps/it-opex", sameSite: "Lax", maxAgeSeconds: 0 });
  assert.ok(cookie.includes("Path=/apps/it-opex"));
  assert.ok(clear.includes("Path=/apps/it-opex"));

  const previousBasePath = process.env.APP_BASE_PATH;
  process.env.APP_BASE_PATH = "/apps/it-opex";
  const server = await listen(app);
  try {
    assert.strictEqual((await request(server, "/apps/it-opex/api/auth/me")).statusCode, 401);
    assert.strictEqual((await request(server, "/apps/it-opex/api/rbac/roles")).statusCode, 401);
    assert.strictEqual((await request(server, "/api/auth/me")).statusCode, 404);
    assert.strictEqual((await request(server, "/apps/it-opex/app-config.js")).statusCode, 200);
    assert.match((await request(server, "/apps/it-opex/app-config.js")).body, /apiBasePath":"\/apps\/it-opex\/api"/);
  } finally {
    await closeServer(server);
    await closePool();
    if (previousBasePath === undefined) delete process.env.APP_BASE_PATH;
    else process.env.APP_BASE_PATH = previousBasePath;
  }

  console.log("Phase 5B RBAC authorization tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
