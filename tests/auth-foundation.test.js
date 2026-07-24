const assert = require("assert");
const fs = require("fs");
const http = require("http");

const { loadEnvironment } = require("../src/config/environment");
const { hashPassword, validatePasswordPolicy, verifyPassword } = require("../src/modules/auth/password");
const {
  createSessionToken,
  hashSessionToken,
  parseCookies,
  serializeCookie
} = require("../src/modules/auth/session");
const { normalizeBootstrapAdminPayload, normalizeLoginPayload } = require("../src/modules/auth/auth.validation");
const { app } = require("../server");

function assertThrows(name, fn, pattern) {
  assert.throws(fn, pattern, name);
}

async function requestJson(server, path, options = {}) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: options.method || "GET",
        headers: Object.assign({ "Content-Type": "application/json" }, options.headers || {})
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
            body: body ? JSON.parse(body) : null
          });
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
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
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function run() {
  const migration = fs.readFileSync("migrations/013_authentication_rbac_foundation.sql", "utf8");
  [
    "CREATE TABLE IF NOT EXISTS users",
    "CREATE TABLE IF NOT EXISTS roles",
    "CREATE TABLE IF NOT EXISTS permissions",
    "CREATE TABLE IF NOT EXISTS user_sessions",
    "CREATE TABLE IF NOT EXISTS login_attempts",
    "CREATE TABLE IF NOT EXISTS security_audit_events"
  ].forEach((fragment) => assert.ok(migration.includes(fragment), `${fragment} missing`));
  assert.ok(!/plaintext/i.test(migration));
  assert.ok(!/DROP TABLE users;/i.test(migration.split("-- Rollback guidance")[0]));

  const password = "Valid!Password123";
  const hash = await hashPassword(password, { cost: 4 });
  assert.notStrictEqual(hash, password);
  assert.ok(await verifyPassword(password, hash));
  assert.strictEqual(await verifyPassword("Wrong!Password123", hash), false);

  assert.deepStrictEqual(validatePasswordPolicy(password, { employeeId: "E999", email: "u@example.com" }, { minLength: 12 }), []);
  assert.ok(validatePasswordPolicy("password", {}, { minLength: 12 }).length > 0);
  assert.ok(validatePasswordPolicy("Employee999!", { employeeId: "employee" }, { minLength: 12 }).length > 0);

  const token = createSessionToken();
  assert.ok(token.length >= 32);
  const tokenHash = hashSessionToken(token, "test-auth-session-secret-with-32-characters");
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.notStrictEqual(tokenHash, token);

  const cookie = serializeCookie("max_it_opex_session", token, {
    secure: true,
    sameSite: "Lax",
    maxAgeSeconds: 60
  });
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  assert.ok(cookie.includes("SameSite=Lax"));
  assert.strictEqual(parseCookies(cookie).max_it_opex_session, token);

  assert.deepStrictEqual(normalizeLoginPayload({ employeeId: "EMP001", password: "x" }), {
    identifier: "emp001",
    password: "x"
  });
  assert.deepStrictEqual(normalizeBootstrapAdminPayload({
    employeeId: "EMP001",
    email: "Admin@Example.com",
    displayName: "Admin User",
    password
  }), {
    employeeId: "EMP001",
    email: "admin@example.com",
    displayName: "Admin User",
    password
  });

  assertThrows(
    "production auth secret required",
    () => loadEnvironment({
      APP_ENV: "production",
      ALLOWED_ORIGINS: "https://budget.example.com",
      DB_HOST: "db.example.com",
      DB_NAME: "budget_app",
      DB_USER: "budget_user",
      DB_PASSWORD: "secret",
      DB_SSL: "true",
      DB_SSL_CA: "./certs/test-ca.pem"
    }),
    /AUTH_SESSION_SECRET/
  );

  const prodConfig = loadEnvironment({
    APP_ENV: "production",
    ALLOWED_ORIGINS: "https://budget.example.com",
    DB_HOST: "db.example.com",
    DB_NAME: "budget_app",
    DB_USER: "budget_user",
    DB_PASSWORD: "secret",
    DB_SSL: "true",
    DB_SSL_CA: "./certs/test-ca.pem",
    AUTH_SESSION_SECRET: "test-auth-session-secret-with-32-characters",
    AUTH_COOKIE_SECURE: "true"
  });
  assert.strictEqual(prodConfig.auth.cookieSecure, true);
  assert.strictEqual(prodConfig.auth.passwordMinLength, 12);

  const server = await listen(app);
  try {
    const me = await requestJson(server, "/api/auth/me");
    assert.strictEqual(me.statusCode, 401);
    assert.strictEqual(me.body.error.code, "AUTHENTICATION_REQUIRED");
    assert.ok(me.body.error.requestId);
  } finally {
    await closeServer(server);
  }

  const bootstrapScript = fs.readFileSync("scripts/auth-bootstrap-admin.js", "utf8");
  assert.ok(bootstrapScript.includes("AUTH_BOOTSTRAP_PASSWORD"));
  assert.ok(!bootstrapScript.includes("admin/admin"));
  assert.ok(!bootstrapScript.includes("console.log(inputPayload.password"));

  console.log("Phase 5A authentication foundation tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
