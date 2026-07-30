const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const dockerfile = read("Dockerfile");
const dockerignore = read(".dockerignore");
const compose = read("compose.yaml");

assert.match(
  dockerfile,
  /FROM node:22\.21\.1-bookworm-slim AS dependencies/
);
assert.match(dockerfile, /npm ci --omit=dev/);
assert.match(
  dockerfile,
  /FROM node:22\.21\.1-bookworm-slim AS runtime/
);
assert.match(dockerfile, /USER node/);
assert.match(dockerfile, /HEALTHCHECK[\s\S]+\/health\/ready/);
assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
assert.match(dockerfile, /mkdir -p "\/app\/Server data"/);

[
  ".env",
  ".env.backup",
  ".env.local",
  ".env.*.local",
  ".env.docker",
  "key.env.txt",
  "google-service-account.json",
  "*.pem",
  "*.key",
  "certs/*.pem",
  "certs/*.crt",
  "certs/*.cer",
  "node_modules",
  "server data/",
  "Server data/",
  "*.log"
].forEach((pattern) => {
  assert.ok(
    dockerignore.includes(pattern),
    `.dockerignore should exclude ${pattern}`
  );
});

assert.match(compose, /dockerfile: Dockerfile/);
assert.match(compose, /3001:3000/);
assert.match(compose, /ENABLE_EXCEL_MIRROR: "false"/);
assert.match(compose, /ENABLE_GOOGLE_SHEETS_SYNC: "false"/);
assert.match(compose, /APP_BASE_PATH: \$\{APP_BASE_PATH:-\}/);
assert.match(compose, /budget-app-data:\/app\/Server data/);
assert.ok(!compose.includes("DB_PASSWORD="));
assert.ok(!compose.includes("MYSQL_PASSWORD="));

console.log("Docker containerization checks passed.");
