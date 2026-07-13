const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const { loadEnvironment } = require("../src/config/environment");
const {
  buildPoolConfig,
  closePool,
  initializePool,
  loadSslCa,
  resetPoolForTests,
  resolveCaPath
} = require("../src/db/pool");
const { app } = require("../server");
const {
  APPROVED_DEMO_MAPPINGS,
  DEMO_ROWS,
  DEMO_SEED_MARKER,
  seedDemoRows,
  rowToRecord
} = require("../scripts/seed-tidb-demo");
const { filterCodingValues } = require("../app-utils");

const root = path.join(__dirname, "..");

function listen(appInstance) {
  return new Promise((resolve) => {
    const server = appInstance.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function requestJson(server, requestPath) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: requestPath,
        method: "GET"
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : null });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  const resolvedCa = resolveCaPath("./certs/tidb-ca.pem");
  assert.strictEqual(resolvedCa, path.join(root, "certs", "tidb-ca.pem"));

  assert.throws(
    () =>
      loadEnvironment({
        APP_ENV: "development",
        PORT: "3001",
        DB_HOST: "gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
        DB_PORT: "4000",
        DB_NAME: "budget_app",
        DB_USER: "tidb-user",
        DB_PASSWORD: "tidb-password",
        DB_SSL: "true"
      }),
    /DB_SSL_CA/
  );

  const tidbConfig = loadEnvironment({
    APP_ENV: "development",
    PORT: "3001",
    DB_HOST: "gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
    DB_PORT: "4000",
    DB_NAME: "budget_app",
    DB_USER: "tidb-user",
    DB_PASSWORD: "tidb-password",
    DB_SSL: "true",
    DB_SSL_CA: "./certs/tidb-ca.pem"
  });
  assert.strictEqual(tidbConfig.db.port, 4000);
  assert.strictEqual(tidbConfig.db.ssl, true);
  assert.strictEqual(tidbConfig.db.sslCaPath, "./certs/tidb-ca.pem");

  const fakeFs = {
    readFileSync: (filePath, encoding) => {
      assert.strictEqual(filePath, resolvedCa);
      assert.strictEqual(encoding, "utf8");
      return "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----";
    }
  };
  const poolConfig = buildPoolConfig(tidbConfig, null, { fs: fakeFs });
  assert.strictEqual(poolConfig.host, "gateway01.ap-southeast-1.prod.aws.tidbcloud.com");
  assert.strictEqual(poolConfig.port, 4000);
  assert.strictEqual(poolConfig.ssl.rejectUnauthorized, true);
  assert.match(poolConfig.ssl.ca, /BEGIN CERTIFICATE/);

  assert.throws(
    () => loadSslCa("./certs/missing-tidb-ca.pem", { fs }),
    (error) => error.message === "DB_SSL_CA file could not be read." && !error.message.includes("missing-tidb-ca")
  );

  const migration = fs.readFileSync(path.join(root, "migrations", "008_tidb_demo_schema.sql"), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS budget_submissions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS allocation_records/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS allocation_matrix/);
  assert.ok(!/\bDROP\s+TABLE\b/i.test(migration));
  assert.ok(!/\bTRUNCATE\b/i.test(migration));
  assert.ok(!/\bDELETE\s+FROM\b/i.test(migration));

  const approvedCodes = [
    "ITOPEX005",
    "ITOPEX007",
    "ITOPEX008",
    "ITOPEX009",
    "ITOPEX011",
    "ITOPEX013",
    "ITOPEX014",
    "ITOPEX015",
    "ITOPEX018",
    "ITOPEX023",
    "ITOPEX024",
    "ITOPEX029",
    "ITOPEX032",
    "ITOPEX033",
    "ITOPEX034",
    "ITOPEX035",
    "ITOPEX036",
    "ITOPEX037",
    "ITOPEX038",
    "ITOPEX042"
  ];
  const approvedLocations = new Set([
    "Saket",
    "Max Smart",
    "Gurgaon",
    "Lajpat Nagar",
    "Panchsheel",
    "Patparganj",
    "Vaishali",
    "Noida",
    "Shalimar Bagh",
    "Mohali",
    "Dehradun",
    "Bathinda",
    "HO",
    "BLK",
    "Nanawati",
    "Nagpur",
    "Lucknow",
    "Dwarka",
    "Jaypee Noida"
  ]);
  assert.strictEqual(DEMO_ROWS.length, 20);
  assert.deepStrictEqual(DEMO_ROWS.map((row) => row.coding), approvedCodes);
  assert.strictEqual(APPROVED_DEMO_MAPPINGS, DEMO_ROWS);
  assert.deepStrictEqual(
    filterCodingValues(DEMO_ROWS.map((row) => row.coding), "itopex0"),
    approvedCodes
  );
  assert.deepStrictEqual(filterCodingValues(["itopex005", "ITOPEX005", "ITOPEX007"], "005"), ["ITOPEX005"]);
  assert.ok(!DEMO_ROWS.some((row) => ["ITOPEX001", "ITOPEX002", "ITOPEX003", "ITOPEX004", "ITOPEX006", "ITOPEX010", "ITOPEX012", "ITOPEX016", "ITOPEX017", "ITOPEX019", "ITOPEX020"].includes(row.coding)));
  assert.ok(DEMO_ROWS.every((row) => ["jatin", "Akshant", "Anil", "Unit", "Amit", "Arjun", "Tauqueer"].includes(row.owner)));
  assert.ok(DEMO_ROWS.every((row) => approvedLocations.has(row.location)));

  const byCode = new Map(DEMO_ROWS.map((row) => [row.coding, row]));
  assert.deepStrictEqual(
    {
      item: byCode.get("ITOPEX005").item,
      owner1: byCode.get("ITOPEX005").owner1,
      owner: byCode.get("ITOPEX005").owner
    },
    {
      item: "Lab, BB, ABG equipment interfacing/Integration",
      owner1: "Unit",
      owner: "jatin"
    }
  );
  assert.deepStrictEqual(
    {
      subCategoryMapped: byCode.get("ITOPEX036").subCategoryMapped,
      categoryIt: byCode.get("ITOPEX036").categoryIt,
      appCate: byCode.get("ITOPEX036").appCate,
      owner1: byCode.get("ITOPEX036").owner1,
      owner: byCode.get("ITOPEX036").owner
    },
    {
      subCategoryMapped: "IT Cost - Consulting",
      categoryIt: "Application",
      appCate: "HRMS",
      owner1: "Application",
      owner: "Tauqueer"
    }
  );
  assert.notStrictEqual(byCode.get("ITOPEX005").owner1, byCode.get("ITOPEX005").owner);
  assert.strictEqual(byCode.get("ITOPEX013").locFyCurrent, 0);

  const firstRecord = rowToRecord(DEMO_ROWS[0]);
  assert.strictEqual(typeof firstRecord.locFyCurrent, "number");
  assert.ok(!String(firstRecord.locFyCurrent).includes(","));
  assert.ok(firstRecord.justification.includes(DEMO_SEED_MARKER));
  assert.strictEqual(firstRecord.owner1, "Unit");
  assert.strictEqual(firstRecord.owner, "jatin");
  assert.strictEqual(
    Number((firstRecord.newAmc + firstRecord.newProject + firstRecord.annualized + firstRecord.priceIncrease + firstRecord.newUnit + firstRecord.licenseIncrease + firstRecord.rest).toFixed(2)),
    firstRecord.locFyCurrent
  );

  const calls = [];
  const existingDemoIds = new Map([["ITOPEX005", [{ id: 10 }, { id: 11 }]]]);
  const connection = {
    execute: async (sql, params) => {
      calls.push({ sql, params });
      if (/DELETE FROM budget_submissions\s+WHERE justification = \?/i.test(sql)) {
        assert.deepStrictEqual(params, ["Temporary TiDB demo seed"]);
        return [{ affectedRows: 3 }];
      }
      if (/SELECT id\s+FROM budget_submissions/i.test(sql)) {
        const code = params[0];
        const existing = existingDemoIds.get(code) || [];
        if (!/LIMIT 1/i.test(sql)) {
          existingDemoIds.set(code, existing.slice(0, 1));
          return [existing];
        }
        return [existing.slice(0, 1)];
      }
      if (/DELETE FROM budget_submissions WHERE id = \? AND justification LIKE \?/i.test(sql)) {
        assert.strictEqual(params[0], 11);
        assert.match(params[1], /TIDB_DEMO_SEED_V2/);
        return [{ affectedRows: 1 }];
      }
      if (/UPDATE budget_submissions/i.test(sql)) {
        assert.strictEqual(params[params.length - 2], "ITOPEX005");
        assert.match(params[params.length - 1], /TIDB_DEMO_SEED_V2/);
        return [{ affectedRows: 1 }];
      }
      assert.match(sql, /INSERT INTO budget_submissions/);
      assert.ok(Array.isArray(params));
      assert.ok(params.includes("ITOPEX007"));
      return [{ affectedRows: 1 }];
    }
  };
  const seedResult = await seedDemoRows(connection, DEMO_ROWS.slice(0, 2).map(rowToRecord));
  assert.deepStrictEqual(seedResult, { inserted: 1, updated: 1, skipped: 0, deletedLegacy: 4 });
  assert.strictEqual(calls.some((call) => /INSERT INTO budget_submissions/i.test(call.sql)), true);
  assert.strictEqual(calls.some((call) => /UPDATE budget_submissions/i.test(call.sql)), true);
  assert.strictEqual(
    calls
      .filter((call) => /DELETE FROM budget_submissions/i.test(call.sql))
      .every((call) => /justification/i.test(call.sql)),
    true
  );

  const secondRunCalls = [];
  const rerunConnection = {
    execute: async (sql, params) => {
      secondRunCalls.push({ sql, params });
      if (/DELETE FROM budget_submissions\s+WHERE justification = \?/i.test(sql)) return [{ affectedRows: 0 }];
      if (/SELECT id\s+FROM budget_submissions/i.test(sql)) return [[{ id: 20 }]];
      if (/UPDATE budget_submissions/i.test(sql)) return [{ affectedRows: 1 }];
      throw new Error("Repeated seed execution should update existing marked rows, not insert duplicates.");
    }
  };
  const rerunResult = await seedDemoRows(rerunConnection, DEMO_ROWS.slice(0, 1).map(rowToRecord));
  assert.deepStrictEqual(rerunResult, { inserted: 0, updated: 1, skipped: 0, deletedLegacy: 0 });

  const seedScript = fs.readFileSync(path.join(root, "scripts", "seed-tidb-demo.js"), "utf8");
  assert.match(seedScript, /withTransaction/);
  assert.match(seedScript, /connection\.execute/);
  assert.ok(!/DB_PASSWORD|MYSQL_PASSWORD|tidb-password/i.test(seedScript));
  assert.ok(!/ITOPEX0\d{2}.*\+|padStart|for\s*\(.*20/i.test(seedScript), "Seed script should not generate sequential fake coding values.");
  assert.match(seedScript, /DEMO_SEED_MARKER/);

  const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
  assert.match(serverSource, /app\.put\("\/api\/budget-data\/:id"/);
  assert.match(serverSource, /app\.delete\("\/api\/budget-data\/:id"/);
  assert.match(serverSource, /app\.post\("\/api\/allocation-data"/);

  resetPoolForTests();
  await initializePool(
    {
      db: {
        host: "gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
        port: 4000,
        database: "budget_app",
        user: "tidb-user",
        password: "tidb-password",
        ssl: false,
        connectionLimit: 10,
        connectTimeoutMs: 10000
      }
    },
    null,
    {
      mysql: {
        createPool: () => ({
          query: async () => [[{ ok: 1 }]],
          execute: async () => [[{ ok: 1 }]],
          end: async () => {}
        })
      }
    }
  );

  const server = await listen(app);
  try {
    const health = await requestJson(server, "/api/health");
    assert.strictEqual(health.statusCode, 200);
    const serialized = JSON.stringify(health.body);
    assert.ok(!serialized.includes("tidb-password"));
    assert.ok(!serialized.includes("gateway01.ap-southeast-1.prod.aws.tidbcloud.com"));
    assert.ok(!serialized.includes("tidb-ca.pem"));
  } finally {
    await closeServer(server);
    await closePool();
  }

  console.log("TiDB TLS, schema, seed, and health safety tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
