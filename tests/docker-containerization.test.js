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

assert.match(dockerfile, /FROM node:22-alpine AS dependencies/);
assert.match(dockerfile, /npm ci --omit=dev/);
assert.match(dockerfile, /FROM node:22-alpine AS runtime/);
assert.match(dockerfile, /USER node/);
assert.match(dockerfile, /HEALTHCHECK[\s\S]+\/health\/ready/);
assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
assert.match(dockerfile, /mkdir -p "\/app\/Server data"/);

[
  ".env",
  ".env.local",
  ".env.*.local",
  "key.env.txt",
  "google-service-account.json",
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
assert.match(compose, /budget-app-data:\/app\/Server data/);
assert.ok(!compose.includes("DB_PASSWORD="));
assert.ok(!compose.includes("MYSQL_PASSWORD="));

console.log("Docker containerization checks passed.");
