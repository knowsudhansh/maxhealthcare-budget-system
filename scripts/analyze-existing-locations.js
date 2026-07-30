const { loadEnvironment } = require("../src/config/environment");
const { loadDbSecret } = require("../src/config/secrets");
const { closePool, getPool, initializePool } = require("../src/db/pool");
const { serializeDatabaseError } = require("../src/db/error-diagnostics");
const { normalizeLocationCode } = require("../src/modules/location-access/location-access.validation");

async function tableExists(pool, tableName) {
  const [rows] = await pool.execute("SHOW TABLES LIKE ?", [tableName]);
  return Boolean(rows && rows.length);
}

async function countBudgetLocations(pool) {
  if (!await tableExists(pool, "budget_submissions")) return [];
  const [rows] = await pool.query(
    `
      SELECT COALESCE(location, '') AS location, COUNT(*) AS count
      FROM budget_submissions
      GROUP BY COALESCE(location, '')
      ORDER BY location
    `
  );
  return rows || [];
}

async function existingLocationCodes(pool) {
  if (!await tableExists(pool, "locations")) return new Set();
  const [rows] = await pool.query("SELECT code FROM locations");
  return new Set((rows || []).map((row) => row.code));
}

function summarize(rows, masterCodes) {
  const byNormalized = new Map();
  const values = rows.map((row) => {
    const raw = String(row.location || "");
    const normalizedCode = raw.trim() ? normalizeLocationCode(raw) : "";
    if (normalizedCode) {
      if (!byNormalized.has(normalizedCode)) byNormalized.set(normalizedCode, []);
      byNormalized.get(normalizedCode).push(raw);
    }
    return {
      location: raw || "(blank)",
      count: Number(row.count || 0),
      normalizedCode: normalizedCode || "",
      mappedToLocationMaster: normalizedCode ? masterCodes.has(normalizedCode) : false
    };
  });
  return {
    distinctLocations: values.length,
    blankValues: values.filter((row) => !row.normalizedCode).reduce((sum, row) => sum + row.count, 0),
    duplicateNormalizedValues: Array.from(byNormalized.entries())
      .filter(([, originals]) => new Set(originals).size > 1)
      .map(([normalizedCode, originals]) => ({ normalizedCode, originals: Array.from(new Set(originals)).sort() })),
    locations: values
  };
}

async function main() {
  const config = loadEnvironment(process.env);
  const secret = await loadDbSecret(config);
  await initializePool(config, secret);
  const pool = getPool();
  const rows = await countBudgetLocations(pool);
  const masterCodes = await existingLocationCodes(pool);
  console.log(JSON.stringify(summarize(rows, masterCodes), null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Location analysis failed.");
      console.error(JSON.stringify(serializeDatabaseError(error, { stage: "location-analyze-existing" }), null, 2));
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}

module.exports = {
  summarize
};
