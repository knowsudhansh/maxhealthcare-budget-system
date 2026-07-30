const assert = require("assert");
const http = require("http");

const { initializePool, resetPoolForTests, closePool } = require("../src/db/pool");
const {
  collectLocations,
  requireLocationAccess
} = require("../src/middleware/location-authorization");
const {
  addUserAssignment,
  assertAllLocationsAccess,
  assertLocationAccess,
  createLocation,
  filterRequestedLocations,
  removeUserAssignment,
  replaceUserAssignments,
  resolveUserLocationScope,
  updateLocation,
  validateLocationHierarchyChange
} = require("../src/modules/location-access/location-access.service");
const {
  normalizeAssignmentPayload,
  normalizeLocationCode,
  normalizeLocationPayload
} = require("../src/modules/location-access/location-access.validation");
const { LOCATION_ACCESS_TYPE, LOCATION_SCOPE_MODE } = require("../src/modules/location-access/location-access.constants");
const { ROLE_CODES, ROLE_PERMISSION_MATRIX } = require("../src/modules/rbac/rbac.constants");
const { app } = require("../server");

function createMemoryDb() {
  const state = {
    locations: [
      { id: 1, code: "MAX", name: "MAX Healthcare", status: "ACTIVE", parent_location_id: null },
      { id: 2, code: "DELHI-NCR", name: "Delhi NCR", status: "ACTIVE", parent_location_id: 1 },
      { id: 3, code: "SAKET", name: "Saket", status: "ACTIVE", parent_location_id: 2 },
      { id: 4, code: "NOIDA", name: "Noida", status: "ACTIVE", parent_location_id: 2 },
      { id: 5, code: "MOHALI", name: "Mohali", status: "ACTIVE", parent_location_id: 1 },
      { id: 6, code: "DISABLED", name: "Disabled", status: "DISABLED", parent_location_id: 1 }
    ],
    userLocations: [
      { user_id: 10, location_id: 3, access_type: "DIRECT", valid_from: null, valid_until: null, assigned_by: 1 },
      { user_id: 11, location_id: 3, access_type: "DIRECT", valid_from: null, valid_until: null, assigned_by: 1 },
      { user_id: 11, location_id: 5, access_type: "DIRECT", valid_from: null, valid_until: null, assigned_by: 1 },
      { user_id: 12, location_id: 2, access_type: "HIERARCHY", valid_from: null, valid_until: null, assigned_by: 1 },
      { user_id: 13, location_id: 4, access_type: "DIRECT", valid_from: "2099-01-01 00:00:00", valid_until: null, assigned_by: 1 },
      { user_id: 14, location_id: 5, access_type: "DIRECT", valid_from: null, valid_until: "2000-01-01 00:00:00", assigned_by: 1 },
      { user_id: 15, location_id: 6, access_type: "DIRECT", valid_from: null, valid_until: null, assigned_by: 1 }
    ],
    auditEvents: [],
    nextLocationId: 7
  };

  function nowActive(assignment) {
    const now = new Date("2026-07-30T00:00:00Z");
    const validFrom = assignment.valid_from ? new Date(String(assignment.valid_from).replace(" ", "T") + "Z") : null;
    const validUntil = assignment.valid_until ? new Date(String(assignment.valid_until).replace(" ", "T") + "Z") : null;
    return (!validFrom || validFrom <= now) && (!validUntil || validUntil > now);
  }

  async function execute(sql, params = []) {
    const text = String(sql).replace(/\s+/g, " ");
    if (text.includes("SELECT * FROM locations WHERE id")) {
      return [[state.locations.find((location) => location.id === Number(params[0]))].filter(Boolean)];
    }
    if (text.includes("SELECT * FROM locations WHERE code")) {
      return [[state.locations.find((location) => location.code === params[0])].filter(Boolean)];
    }
    if (text.includes("SELECT * FROM locations")) {
      const activeOnly = text.includes("WHERE status =");
      const rows = state.locations.filter((location) => !activeOnly || location.status === params[0]);
      return [rows];
    }
    if (text.includes("FROM user_locations ul INNER JOIN locations")) {
      const userId = Number(params[0]);
      const activeOnly = text.includes("l.status = 'ACTIVE'") && text.includes("ul.valid_from");
      const rows = state.userLocations
        .filter((assignment) => assignment.user_id === userId)
        .filter((assignment) => !activeOnly || nowActive(assignment))
        .map((assignment) => {
          const location = state.locations.find((candidate) => candidate.id === assignment.location_id);
          if (!location || (activeOnly && location.status !== "ACTIVE")) return null;
          return Object.assign({}, assignment, {
            location_code: location.code,
            location_name: location.name,
            location_status: location.status
          });
        })
        .filter(Boolean);
      return [rows];
    }
    if (text.includes("INSERT INTO locations")) {
      const row = {
        id: state.nextLocationId++,
        code: params[0],
        name: params[1],
        status: params[2],
        parent_location_id: params[3] || null
      };
      state.locations.push(row);
      return [{ insertId: row.id, affectedRows: 1 }];
    }
    if (text.includes("UPDATE locations")) {
      const id = Number(params[4]);
      const row = state.locations.find((location) => location.id === id);
      row.code = params[0];
      row.name = params[1];
      row.status = params[2];
      row.parent_location_id = params[3] || null;
      return [{ affectedRows: 1 }];
    }
    if (text.includes("DELETE FROM user_locations WHERE user_id = ? AND location_id")) {
      const before = state.userLocations.length;
      state.userLocations = state.userLocations.filter((assignment) => !(assignment.user_id === Number(params[0]) && assignment.location_id === Number(params[1]) && assignment.access_type === params[2]));
      return [{ affectedRows: before - state.userLocations.length }];
    }
    if (text.includes("DELETE FROM user_locations WHERE user_id")) {
      state.userLocations = state.userLocations.filter((assignment) => assignment.user_id !== Number(params[0]));
      return [{ affectedRows: 1 }];
    }
    if (text.includes("INSERT INTO user_locations")) {
      const existing = state.userLocations.find((assignment) => assignment.user_id === Number(params[0]) && assignment.location_id === Number(params[1]) && assignment.access_type === params[2]);
      if (existing) {
        existing.valid_from = params[3];
        existing.valid_until = params[4];
        existing.assigned_by = params[5];
      } else {
        state.userLocations.push({
          user_id: Number(params[0]),
          location_id: Number(params[1]),
          access_type: params[2],
          valid_from: params[3],
          valid_until: params[4],
          assigned_by: params[5]
        });
      }
      return [{ affectedRows: 1 }];
    }
    if (text.includes("INSERT INTO security_audit_events")) {
      state.auditEvents.push({ eventType: params[1], actorUserId: params[0], metadata: params[5] });
      return [{ affectedRows: 1 }];
    }
    return [[]];
  }

  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute,
    query: async (sql) => execute(sql)
  };

  return {
    state,
    pool: {
      query: async (sql) => {
        if (String(sql).includes("SELECT 1")) return [[{ ok: 1 }]];
        return execute(sql);
      },
      execute,
      getConnection: async () => connection,
      end: async () => {}
    }
  };
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

function auth(userId, permissions = []) {
  return {
    user: { id: userId },
    roles: permissions.includes("location.access_all") ? [ROLE_CODES.SUPER_ADMIN] : [],
    permissions
  };
}

function invokeMiddleware(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (error) => resolve(error || null)));
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

async function run() {
  assert.strictEqual(normalizeLocationCode("  max saket  "), "MAX-SAKET");
  assert.throws(() => normalizeLocationCode(""), /Location code/);
  assert.throws(() => normalizeLocationPayload({ code: "A", name: "A", unknown: true }), /Unknown fields/);
  assert.throws(() => normalizeAssignmentPayload({ locationId: 1, accessType: "GLOBAL" }), /GLOBAL/);
  assert.ok(ROLE_PERMISSION_MATRIX[ROLE_CODES.SUPER_ADMIN].includes("location.access_all"));
  assert.ok(ROLE_PERMISSION_MATRIX[ROLE_CODES.FINANCE_ADMIN].includes("location.access_all"));

  const fake = createMemoryDb();
  await setupPool(fake);

  const direct = await resolveUserLocationScope(10, auth(10));
  assert.strictEqual(direct.mode, LOCATION_SCOPE_MODE.RESTRICTED);
  assert.deepStrictEqual(direct.effectiveLocationCodes, ["SAKET"]);

  const multiple = await resolveUserLocationScope(11, auth(11));
  assert.deepStrictEqual(new Set(multiple.effectiveLocationCodes), new Set(["SAKET", "MOHALI"]));

  const hierarchy = await resolveUserLocationScope(12, auth(12));
  assert.ok(hierarchy.effectiveLocationCodes.includes("SAKET"));
  assert.ok(hierarchy.effectiveLocationCodes.includes("NOIDA"));
  assert.ok(!hierarchy.effectiveLocationCodes.includes("MOHALI"));

  assert.strictEqual((await resolveUserLocationScope(13, auth(13))).mode, LOCATION_SCOPE_MODE.NONE, "Future assignment ignored.");
  assert.strictEqual((await resolveUserLocationScope(14, auth(14))).mode, LOCATION_SCOPE_MODE.NONE, "Expired assignment ignored.");
  assert.strictEqual((await resolveUserLocationScope(15, auth(15))).mode, LOCATION_SCOPE_MODE.NONE, "Disabled location ignored.");
  assert.strictEqual((await resolveUserLocationScope(16, auth(16))).mode, LOCATION_SCOPE_MODE.NONE, "No assignments do not imply global.");

  const globalScope = await resolveUserLocationScope(16, auth(16, ["location.access_all"]));
  assert.strictEqual(globalScope.mode, LOCATION_SCOPE_MODE.GLOBAL);
  assert.ok(globalScope.effectiveLocationCodes.includes("MOHALI"));

  const directAuth = auth(10);
  directAuth.locationScope = direct;
  await assertLocationAccess(directAuth, "SAKET");
  await assertLocationAccess(directAuth, "saket");
  await assert.rejects(() => assertLocationAccess(directAuth, "NOIDA"), /requested location/);
  await assert.rejects(() => assertAllLocationsAccess(directAuth, ["SAKET", "NOIDA"]), /requested location/);
  assert.deepStrictEqual(await filterRequestedLocations(directAuth, ["SAKET", "NOIDA", "UNKNOWN"]), ["SAKET"]);

  const hierarchyAuth = auth(12);
  hierarchyAuth.locationScope = hierarchy;
  await assertLocationAccess(hierarchyAuth, "NOIDA");

  await assert.rejects(() => validateLocationHierarchyChange(2, 3), /cycle/);
  await assert.rejects(() => validateLocationHierarchyChange(3, 3), /own parent/);

  const created = await createLocation({ code: "TEST-LOC", name: "Test Location", status: "ACTIVE", parentLocationId: 1 }, { auth: auth(1, ["location.access_all"]) });
  assert.strictEqual(created.code, "TEST-LOC");
  await assert.rejects(() => createLocation({ code: "TEST-LOC", name: "Duplicate", status: "ACTIVE" }, { auth: auth(1, ["location.access_all"]) }), /already exists/);
  const updated = await updateLocation(created.id, { name: "Test Location Updated" }, { auth: auth(1, ["location.access_all"]) });
  assert.strictEqual(updated.name, "Test Location Updated");

  const restrictedAdmin = auth(10, ["location.assign"]);
  restrictedAdmin.locationScope = direct;
  await addUserAssignment(20, { locationId: 3, accessType: LOCATION_ACCESS_TYPE.DIRECT, validFrom: null, validUntil: null }, { auth: restrictedAdmin });
  await assert.rejects(() => addUserAssignment(20, { locationId: 5, accessType: LOCATION_ACCESS_TYPE.DIRECT, validFrom: null, validUntil: null }, { auth: restrictedAdmin }), /requested location|outside your scope/);
  await replaceUserAssignments(21, [{ locationId: 3, accessType: LOCATION_ACCESS_TYPE.DIRECT, validFrom: null, validUntil: null }], { auth: restrictedAdmin });
  assert.ok(fake.state.userLocations.some((assignment) => assignment.user_id === 21 && assignment.assigned_by === 10), "assigned_by comes from session actor.");
  const beforeRemove = fake.state.auditEvents.length;
  await removeUserAssignment(21, "21:3:DIRECT", { auth: restrictedAdmin });
  assert.ok(fake.state.auditEvents.length > beforeRemove, "Assignment removal audited.");

  const req = {
    params: { locationId: "SAKET" },
    query: { locations: ["NOIDA"] },
    body: { source: { location: "MOHALI" } }
  };
  assert.deepStrictEqual(collectLocations(req, { params: ["locationId"], query: ["locations"], body: ["source.location"] }), ["SAKET", "NOIDA", "MOHALI"]);
  assert.strictEqual((await invokeMiddleware(requireLocationAccess({ params: ["locationId"] }), {
    auth: directAuth,
    params: { locationId: "SAKET" },
    query: {},
    body: {}
  })), null);
  assert.strictEqual((await invokeMiddleware(requireLocationAccess({ params: ["locationId"] }), {
    auth: directAuth,
    params: { locationId: "NOIDA" },
    query: {},
    body: {}
  })).publicCode, "LOCATION_ACCESS_DENIED");
  assert.strictEqual((await invokeMiddleware(requireLocationAccess({ params: ["locationId"] }), {
    params: { locationId: "SAKET" },
    query: {},
    body: {}
  })).publicCode, "AUTHENTICATION_REQUIRED");

  const previousBasePath = process.env.APP_BASE_PATH;
  process.env.APP_BASE_PATH = "/apps/it-opex";
  const server = await listen(app);
  try {
    assert.strictEqual((await request(server, "/apps/it-opex/api/locations")).statusCode, 401);
    assert.strictEqual((await request(server, "/apps/it-opex/api/location-access/me")).statusCode, 401);
    assert.strictEqual((await request(server, "/api/locations")).statusCode, 404);
    assert.match((await request(server, "/apps/it-opex/app-config.js")).body, /apiBasePath":"\/apps\/it-opex\/api"/);
  } finally {
    await closeServer(server);
    await closePool();
    if (previousBasePath === undefined) delete process.env.APP_BASE_PATH;
    else process.env.APP_BASE_PATH = previousBasePath;
  }

  console.log("Phase 5C location access tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
