const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const { normalizeBasePath } = require("../src/config/environment");
const {
  buildApiUrl,
  buildAppUrl,
  normalizeBasePath: normalizeFrontendBasePath
} = require("../app-utils");
const {
  closePool,
  initializePool,
  resetPoolForTests
} = require("../src/db/pool");
const { app } = require("../server");

const rootDir = path.join(__dirname, "..");

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

function request(server, requestPath) {
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
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function setupFakePool() {
  resetPoolForTests();
  await initializePool(
    {
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
    },
    null,
    {
      mysql: {
        createPool: () => ({
          query: async (sql) => {
            if (String(sql).includes("budget_submissions")) {
              return [[{ id: 1, coding: "ITOPEX001" }]];
            }
            return [[{ ok: 1 }]];
          },
          execute: async () => [[{ ok: 1 }]],
          end: async () => {}
        })
      }
    }
  );
}

async function run() {
  assert.strictEqual(normalizeBasePath(""), "");
  assert.strictEqual(normalizeBasePath("/"), "");
  assert.strictEqual(normalizeBasePath("budget-app"), "/budget-app");
  assert.strictEqual(normalizeBasePath("/budget-app"), "/budget-app");
  assert.strictEqual(normalizeBasePath("/budget-app/"), "/budget-app");
  assert.throws(() => normalizeBasePath("/budget-app?x=1"), /malformed/);
  assert.throws(() => normalizeBasePath("/budget-app#x"), /malformed/);
  assert.throws(() => normalizeBasePath("https://example.com/budget-app"), /malformed/);
  assert.throws(() => normalizeBasePath("\\budget-app"), /malformed/);
  assert.throws(() => normalizeBasePath("/../budget-app"), /traversal/);
  assert.strictEqual(normalizeFrontendBasePath("/budget-app/"), "/budget-app");

  const previousBasePath = process.env.APP_BASE_PATH;

  process.env.APP_BASE_PATH = "";
  await setupFakePool();
  let server = await listen(app);
  try {
    assert.strictEqual((await request(server, "/health/live")).statusCode, 200);
    assert.strictEqual((await request(server, "/health/ready")).statusCode, 200);
    assert.strictEqual((await request(server, "/api/budget-data")).statusCode, 200);
    assert.match((await request(server, "/")).body, /IT OPEX Budget Dashboard/);
  } finally {
    await closeServer(server);
    await closePool();
  }

  process.env.APP_BASE_PATH = "/budget-app";
  await setupFakePool();
  server = await listen(app);
  try {
    const redirect = await request(server, "/budget-app?keep=1");
    assert.strictEqual(redirect.statusCode, 308);
    assert.strictEqual(redirect.headers.location, "/budget-app/?keep=1");

    const index = await request(server, "/budget-app/");
    assert.strictEqual(index.statusCode, 200);
    assert.match(index.body, /IT OPEX Budget Dashboard/);

    const css = await request(server, "/budget-app/styles.css");
    assert.strictEqual(css.statusCode, 200);
    assert.match(css.body, /:root|body|app-shell/);

    const config = await request(server, "/budget-app/app-config.js");
    assert.strictEqual(config.statusCode, 200);
    assert.match(config.body, /basePath":"\/budget-app"/);
    ["DB_PASSWORD", "MYSQL_PASSWORD", "DB_SECRET_ARN", "AWS_SECRET", "token", "credentials"].forEach((secretWord) => {
      assert.ok(!config.body.includes(secretWord), `app-config.js leaked ${secretWord}`);
    });

    const api = await request(server, "/budget-app/api/budget-data?from=test");
    assert.strictEqual(api.statusCode, 200);
    assert.match(api.body, /ITOPEX001/);

    assert.strictEqual((await request(server, "/budget-app/health/live")).statusCode, 200);
    assert.strictEqual((await request(server, "/budget-app/health/ready")).statusCode, 200);
    assert.strictEqual((await request(server, "/health/live")).statusCode, 200);
    assert.strictEqual((await request(server, "/health/ready")).statusCode, 200);
    assert.notStrictEqual((await request(server, "/budget-application")).statusCode, 200);
  } finally {
    await closeServer(server);
    await closePool();
    if (previousBasePath === undefined) delete process.env.APP_BASE_PATH;
    else process.env.APP_BASE_PATH = previousBasePath;
  }

  const indexHtml = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  assert.ok(indexHtml.indexOf("./app-config.js") < indexHtml.indexOf("./app-utils.js"));
  assert.ok(!/href=["']\/(?!\/)/.test(indexHtml), "index.html should not use root-relative local hrefs");
  assert.ok(!/src=["']\/(?!\/)/.test(indexHtml), "index.html should not use root-relative local srcs");

  const appJs = fs.readFileSync(path.join(rootDir, "app.js"), "utf8");
  assert.ok(!/fetch\(\s*["'`]\/api\//.test(appJs), "fetch calls must not hardcode root-relative /api URLs");
  assert.strictEqual(buildApiUrl("budget-data"), "/api/budget-data");
  globalThis.APP_CONFIG = { basePath: "/budget-app" };
  assert.strictEqual(buildAppUrl("styles.css"), "/budget-app/styles.css");
  assert.strictEqual(buildApiUrl("budget-data"), "/budget-app/api/budget-data");
  delete globalThis.APP_CONFIG;

  console.log("Base-path routing and frontend URL tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
