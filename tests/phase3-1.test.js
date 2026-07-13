const assert = require("assert");
const http = require("http");

const { loadEnvironment } = require("../src/config/environment");
const {
  clearSecretCacheForTests,
  loadDbSecret,
  normalizeDbSecret
} = require("../src/config/secrets");
const {
  closePool,
  getPoolConfigFingerprint,
  initializePool,
  resetPoolForTests
} = require("../src/db/pool");
const { checkDatabaseReady } = require("../src/db/health");
const { app } = require("../server");

function expectThrows(name, fn, pattern) {
  assert.throws(fn, pattern, name);
}

function baseEnv(overrides = {}) {
  return {
    APP_ENV: "development",
    PORT: "3001",
    DB_HOST: "localhost",
    DB_PORT: "3306",
    DB_NAME: "budget_app",
    DB_USER: "budget_user",
    DB_PASSWORD: "secret",
    DB_SSL: "false",
    ...overrides
  };
}

async function requestJson(server, path) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "GET"
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: body ? JSON.parse(body) : null
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function listen(appInstance) {
  return new Promise((resolve) => {
    const server = appInstance.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function run() {
  expectThrows("missing APP_ENV rejected", () => loadEnvironment(baseEnv({ APP_ENV: "" })), /APP_ENV/);

  const devConfig = loadEnvironment(baseEnv());
  assert.strictEqual(devConfig.appEnv, "development");
  assert.strictEqual(devConfig.db.ssl, false);
  assert.strictEqual(devConfig.db.host, "localhost");

  expectThrows(
    "production localhost DB rejected",
    () =>
      loadEnvironment(
        baseEnv({
          APP_ENV: "production",
          ALLOWED_ORIGINS: "https://budget.example.com",
          DB_SSL: "true"
        })
      ),
    /localhost DB host/
  );

  expectThrows(
    "production wildcard CORS rejected",
    () =>
      loadEnvironment(
        baseEnv({
          APP_ENV: "production",
          ALLOWED_ORIGINS: "*",
          DB_HOST: "db.example.com",
          DB_SSL: "true"
        })
      ),
    /wildcard/
  );

  expectThrows(
    "production DB_SSL=false rejected",
    () =>
      loadEnvironment(
        baseEnv({
          APP_ENV: "production",
          ALLOWED_ORIGINS: "https://budget.example.com",
          DB_HOST: "db.example.com",
          DB_SSL: "false"
        })
      ),
    /DB_SSL=true/
  );

  expectThrows(
    "production uat secret rejected",
    () =>
      loadEnvironment(
        baseEnv({
          APP_ENV: "production",
          ALLOWED_ORIGINS: "https://budget.example.com",
          AWS_REGION: "ap-south-1",
          DB_SECRET_ARN: "arn:aws:secretsmanager:ap-south-1:111:secret:budget-uat-db",
          DB_HOST: "",
          DB_NAME: "",
          DB_USER: "",
          DB_PASSWORD: "",
          DB_SSL: "true"
        })
      ),
    /UAT\/test\/development/
  );

  expectThrows(
    "uat prod secret rejected",
    () =>
      loadEnvironment(
        baseEnv({
          APP_ENV: "uat",
          ALLOWED_ORIGINS: "https://uat-budget.example.com",
          AWS_REGION: "ap-south-1",
          DB_SECRET_ARN: "arn:aws:secretsmanager:ap-south-1:111:secret:budget-prod-db",
          DB_HOST: "",
          DB_NAME: "",
          DB_USER: "",
          DB_PASSWORD: "",
          DB_SSL: "true"
        })
      ),
    /Production secret/
  );

  const uatConfig = loadEnvironment(
    baseEnv({
      APP_ENV: "uat",
      ALLOWED_ORIGINS: "https://uat-budget.example.com",
      AWS_REGION: "ap-south-1",
      DB_SECRET_ARN: "arn:aws:secretsmanager:ap-south-1:111:secret:budget-uat-db",
      DB_HOST: "",
      DB_NAME: "",
      DB_USER: "",
      DB_PASSWORD: "",
      DB_SSL: "true"
    })
  );
  assert.strictEqual(uatConfig.appEnv, "uat");

  const prodConfig = loadEnvironment(
    baseEnv({
      APP_ENV: "production",
      ALLOWED_ORIGINS: "https://budget.example.com",
      AWS_REGION: "ap-south-1",
      DB_SECRET_ARN: "arn:aws:secretsmanager:ap-south-1:111:secret:budget-production-db",
      DB_HOST: "",
      DB_NAME: "",
      DB_USER: "",
      DB_PASSWORD: "",
      DB_SSL: "true"
    })
  );
  assert.strictEqual(prodConfig.appEnv, "production");

  assert.deepStrictEqual(
    normalizeDbSecret({
      host: "db.example.com",
      port: 3306,
      dbname: "budget",
      username: "budget_user",
      password: "secret"
    }),
    {
      host: "db.example.com",
      port: 3306,
      database: "budget",
      user: "budget_user",
      password: "secret",
      ssl: undefined
    }
  );

  assert.strictEqual(
    normalizeDbSecret({
      host: "db.example.com",
      database: "budget",
      user: "budget_user",
      password: "secret"
    }).database,
    "budget"
  );

  expectThrows("secret missing host rejected", () => normalizeDbSecret({ password: "x" }), /host/);
  expectThrows(
    "secret missing password rejected",
    () =>
      normalizeDbSecret({
        host: "db.example.com",
        database: "budget",
        user: "budget_user"
      }),
    /password/
  );
  expectThrows(
    "secret invalid port rejected",
    () =>
      normalizeDbSecret({
        host: "db.example.com",
        port: "bad",
        database: "budget",
        user: "budget_user",
        password: "secret"
      }),
    /port/
  );

  clearSecretCacheForTests();
  const secretConfig = loadEnvironment(
    baseEnv({
      AWS_REGION: "ap-south-1",
      DB_SECRET_ARN: "arn:aws:secretsmanager:ap-south-1:111:secret:budget-dev-db"
    })
  );
  let sendCount = 0;
  const loadedSecret = await loadDbSecret(secretConfig, {
    client: {
      send: async () => {
        sendCount += 1;
        return {
          SecretString: JSON.stringify({
            host: "db.example.com",
            database: "budget",
            user: "budget_user",
            password: "secret"
          })
        };
      }
    },
    GetSecretValueCommand: class {
      constructor(input) {
        this.input = input;
      }
    }
  });
  assert.strictEqual(loadedSecret.host, "db.example.com");
  await loadDbSecret(secretConfig, {
    client: {
      send: async () => {
        throw new Error("cache miss");
      }
    }
  });
  assert.strictEqual(sendCount, 1);

  resetPoolForTests();
  let queryCount = 0;
  let endCount = 0;
  const fakePool = {
    query: async (sql) => {
      assert.strictEqual(sql, "SELECT 1");
      queryCount += 1;
      return [[{ 1: 1 }]];
    },
    execute: async () => [[{ ok: true }]],
    end: async () => {
      endCount += 1;
    }
  };
  const fakeMysql = {
    createPool: () => fakePool
  };
  const firstPool = await initializePool(devConfig, null, { mysql: fakeMysql });
  const secondPool = await initializePool(devConfig, null, { mysql: fakeMysql });
  assert.strictEqual(firstPool, secondPool);
  assert.strictEqual(queryCount, 1);
  assert.ok(getPoolConfigFingerprint().includes("budget_app"));
  assert.strictEqual(await checkDatabaseReady(), true);
  await closePool();
  assert.strictEqual(endCount, 1);

  resetPoolForTests();
  const failingMysql = {
    createPool: () => ({
      query: async () => {
        throw new Error("connection refused");
      },
      end: async () => {
        endCount += 1;
      }
    })
  };
  await assert.rejects(
    () => initializePool(devConfig, null, { mysql: failingMysql }),
    /connection refused/
  );

  assert.strictEqual(await checkDatabaseReady({ query: async () => [] }), true);
  assert.strictEqual(
    await checkDatabaseReady({
      query: async () => {
        throw new Error("down");
      }
    }),
    false
  );

  resetPoolForTests();
  const server = await listen(app);
  try {
    const live = await requestJson(server, "/health/live");
    assert.strictEqual(live.statusCode, 200);
    assert.deepStrictEqual(live.body, { status: "alive" });

    const ready = await requestJson(server, "/health/ready");
    assert.strictEqual(ready.statusCode, 503);
    assert.deepStrictEqual(ready.body, {
      status: "not-ready",
      database: "unavailable"
    });
    assert.ok(!JSON.stringify(ready.body).includes("secret"));
  } finally {
    await closeServer(server);
  }

  console.log("Phase 3.1 environment, secrets, pool, and health tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
