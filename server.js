const express = require("express");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { google } = require("googleapis");
const { loadEnvironment } = require("./src/config/environment");
const { loadDbSecret } = require("./src/config/secrets");
const {
  closePool,
  execute: mysqlExecute,
  getPool,
  hasPool,
  initializePool,
  query: mysqlQuery
} = require("./src/db/pool");
const {
  checkDatabaseReady,
  getSafeDatabaseHealth
} = require("./src/db/health");
const { withTransaction } = require("./src/db/transaction");
const { writeAuditEvent } = require("./src/audit/audit-service");
const { ERROR_CODES, AppError, notFoundError, validationError } = require("./src/errors/app-error");
const { requestIdMiddleware } = require("./src/middleware/request-id");
const { requestLogger } = require("./src/middleware/request-logger");
const { errorHandler } = require("./src/middleware/error-handler");
const {
  normalizeBudgetSubmission,
  validateBudgetId
} = require("./src/validation/budget");
const {
  normalizeAmountMap: validateAmountMap,
  normalizePercentMap: validatePercentMap,
  validateAllocatedTotal,
  validateAllocationMatrixPayload,
  validateAllocationRecordPayload
} = require("./src/validation/allocation");

const app = express();
let runtimeConfig = null;
let httpServer = null;
let isShuttingDown = false;

const DATA_DIR = path.join(__dirname, "Server data");
const FILE_PATH = path.join(DATA_DIR, "it-opex-budget-submissions.xlsx");
const SHEET_NAME = "IT Opex Budget";

const GOOGLE_CREDENTIALS_PATH = path.join(
  __dirname,
  "google-service-account.json"
);

const GOOGLE_SHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  "1dsjJRybpZh7j2ZDguTLjCCus13XxDPFpsNjYZuKo810";

const GOOGLE_SHEET_TAB =
  process.env.GOOGLE_SHEET_TAB || "Sheet1";

const COLUMN_ORDER = [
  "Submitted At",
  "Coding",
  "Item",
  "Category_IT",
  "Sub Category",
  "New Category",
  "App Cate.",
  "Cate.3",
  "Cate.4",
  "Owner1",
  "Owner",
  "Cost Center / Department"
];

app.use(express.json({ limit: "10mb" }));
app.use(requestIdMiddleware);
app.use(requestLogger);

function getAllowedOrigins() {
  if (!runtimeConfig) return [];
  return runtimeConfig.allowedOrigins || [];
}

// CORS
app.use((req, res, next) => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;
  const allowWildcard = allowedOrigins.includes("*");
  const allowOrigin =
    allowWildcard || !origin || allowedOrigins.includes(origin);

  if (allowOrigin) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      allowWildcard ? "*" : origin || allowedOrigins[0] || ""
    );
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return allowOrigin ? res.sendStatus(204) : res.sendStatus(403);
  }

  if (!allowOrigin) {
    return res.status(403).json({ message: "CORS origin not allowed." });
  }

  next();
});

app.use(express.static(__dirname));

function sanitize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function mysqlConfigured() {
  return hasPool();
}

function hasGoogleCredentials() {
  const hasEnvGoogleCreds = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
  );

  const hasFileGoogleCreds =
    fs.existsSync(GOOGLE_CREDENTIALS_PATH);

  return hasEnvGoogleCreds || hasFileGoogleCreds;
}

function normalizeSubmission(body) {
  return normalizeBudgetSubmission(body || {});
}

function hasUserData(row) {
  const keys = Object.keys(row).filter(
    (key) => key !== "Submitted At"
  );

  return keys.some((key) => row[key]);
}

function toOrderedArray(row) {
  return COLUMN_ORDER.map((key) => row[key] || "");
}

async function getMysqlPool() {
  return getPool();
}

async function ensureBudgetSubmissionImportColumns() {
  const pool = await getMysqlPool();
  if (!pool) return;

  const [columns] = await pool.query("SHOW COLUMNS FROM budget_submissions");
  const names = new Set((Array.isArray(columns) ? columns : []).map((column) => String(column.Field || "").toLowerCase()));
  const alters = [];
  if (!names.has("sub_category_mapped")) alters.push("ADD COLUMN sub_category_mapped VARCHAR(255) NULL AFTER item");
  if (!names.has("cost_distribution")) alters.push("ADD COLUMN cost_distribution VARCHAR(40) NOT NULL DEFAULT 'Fixed Cost' AFTER location");
  if (!names.has("justification")) alters.push("ADD COLUMN justification TEXT NULL AFTER rest");
  for (const alter of alters) {
    await pool.query(`ALTER TABLE budget_submissions ${alter}`);
  }
}

async function insertBudgetSubmissionDb(row) {
  const pool = await getMysqlPool();

  if (!pool) return null;
  await ensureBudgetSubmissionImportColumns();

  const sql = `
    INSERT INTO budget_submissions (
      submitted_at,
      coding,
      item,
      sub_category_mapped,
      category_it,
      sub_category,
      new_category,
      app_cate,
      cate3,
      cate4,
      owner1,
      owner,
      cost_center_department,
      financial_year,
      location,
      cost_distribution,
      loc_fy_current,
      loc_fy_last,
      loc_le,
      new_amc,
      new_project,
      annualized,
      price_increase,
      new_unit,
      license_increase,
      rest,
      justification
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    row["Submitted At"] || null,
    row["Coding"] || null,
    row["Item"] || null,
    row["Sub Category (Mapped)"] || null,
    row["Category_IT"] || null,
    row["Sub Category"] || null,
    row["New Category"] || null,
    row["App Cate."] || null,
    row["Cate.3"] || null,
    row["Cate.4"] || null,
    row["Owner1"] || null,
    row["Owner"] || null,
    row["Cost Center / Department"] || null,
    row["Financial Year"] || null,
    row["Location"] || null,
    row["Cost Distribution"] || "Fixed Cost",
    row["loc_fy_current"] || 0,
    row["loc_fy_last"] || 0,
    row["loc_le"] || 0,
    row["new_amc"] || 0,
    row["new_project"] || 0,
    row["annualized"] || 0,
    row["price_increase"] || 0,
    row["new_unit"] || 0,
    row["license_increase"] || 0,
    row["rest"] || 0,
    row["Justification"] || null
  ];

  const [result] = await pool.execute(sql, params);

  return result.insertId || null;
}

async function updateBudgetSubmissionDb(id, row) {
  const pool = await getMysqlPool();
  if (!pool) return 0;
  await ensureBudgetSubmissionImportColumns();

  const sql = `
    UPDATE budget_submissions
    SET
      coding = ?,
      item = ?,
      sub_category_mapped = ?,
      category_it = ?,
      sub_category = ?,
      new_category = ?,
      app_cate = ?,
      cate3 = ?,
      cate4 = ?,
      owner1 = ?,
      owner = ?,
      cost_center_department = ?,
      financial_year = ?,
      location = ?,
      cost_distribution = ?,
      loc_fy_current = ?,
      loc_fy_last = ?,
      loc_le = ?,
      new_amc = ?,
      new_project = ?,
      annualized = ?,
      price_increase = ?,
      new_unit = ?,
      license_increase = ?,
      rest = ?,
      justification = ?
    WHERE id = ?
  `;

  const params = [
    row["Coding"] || null,
    row["Item"] || null,
    row["Sub Category (Mapped)"] || null,
    row["Category_IT"] || null,
    row["Sub Category"] || null,
    row["New Category"] || null,
    row["App Cate."] || null,
    row["Cate.3"] || null,
    row["Cate.4"] || null,
    row["Owner1"] || null,
    row["Owner"] || null,
    row["Cost Center / Department"] || null,
    row["Financial Year"] || null,
    row["Location"] || null,
    row["Cost Distribution"] || "Fixed Cost",
    row["loc_fy_current"] || 0,
    row["loc_fy_last"] || 0,
    row["loc_le"] || 0,
    row["new_amc"] || 0,
    row["new_project"] || 0,
    row["annualized"] || 0,
    row["price_increase"] || 0,
    row["new_unit"] || 0,
    row["license_increase"] || 0,
    row["rest"] || 0,
    row["Justification"] || null,
    id
  ];

  const [result] = await pool.execute(sql, params);
  return result.affectedRows || 0;
}

async function deleteBudgetSubmissionDb(id) {
  const pool = await getMysqlPool();
  if (!pool) return 0;
  const [result] = await pool.execute("DELETE FROM budget_submissions WHERE id = ?", [id]);
  return result.affectedRows || 0;
}

function budgetImportKey(row) {
  return [
    sanitize(row["Financial Year"]).toLowerCase(),
    sanitize(row["Coding"]).toLowerCase(),
    sanitize(row["Owner"]).toLowerCase(),
    sanitize(row["Location"]).toLowerCase(),
    sanitize(row["Cost Distribution"] || "Fixed Cost").toLowerCase()
  ].join("||");
}

async function findBudgetSubmissionsByImportKey(row) {
  const pool = await getMysqlPool();
  if (!pool) return [];
  await ensureBudgetSubmissionImportColumns();
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM budget_submissions
      WHERE financial_year = ?
        AND LOWER(coding) = LOWER(?)
        AND LOWER(owner) = LOWER(?)
        AND LOWER(location) = LOWER(?)
        AND LOWER(cost_distribution) = LOWER(?)
      ORDER BY id DESC
    `,
    [
      row["Financial Year"] || "",
      row["Coding"] || "",
      row["Owner"] || "",
      row["Location"] || "",
      row["Cost Distribution"] || "Fixed Cost"
    ]
  );
  return Array.isArray(rows) ? rows : [];
}

async function getMysqlHealth() {
  return getSafeDatabaseHealth();
}

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getWorkbook() {
  ensureDataDirectory();

  if (fs.existsSync(FILE_PATH)) {
    return XLSX.readFile(FILE_PATH);
  }

  const workbook = XLSX.utils.book_new();

  const worksheet = XLSX.utils.json_to_sheet([]);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    SHEET_NAME
  );

  return workbook;
}

function appendRowAndSaveLocal(row) {
  const workbook = getWorkbook();

  let worksheet = workbook.Sheets[SHEET_NAME];

  if (!worksheet) {
    worksheet = XLSX.utils.json_to_sheet([]);

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      SHEET_NAME
    );
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: ""
  });

  rows.push(row);

  workbook.Sheets[SHEET_NAME] =
    XLSX.utils.json_to_sheet(rows);

  XLSX.writeFile(workbook, FILE_PATH);

  return rows.length;
}

function getGoogleSheetsClient() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  let privateKey = (
    process.env.GOOGLE_PRIVATE_KEY || ""
  ).replace(/\\n/g, "\n");

  if (
    (!email || !privateKey) &&
    fs.existsSync(GOOGLE_CREDENTIALS_PATH)
  ) {
    const credentials = JSON.parse(
      fs.readFileSync(GOOGLE_CREDENTIALS_PATH, "utf8")
    );

    email = credentials.client_email;

    privateKey = credentials.private_key;
  }

  if (!email || !privateKey) {
    throw new Error("Google credentials missing.");
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  });

  return google.sheets({
    version: "v4",
    auth
  });
}

async function ensureGoogleSheetHeader(sheets) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${GOOGLE_SHEET_TAB}!A1:L1`
  });

  const row =
    existing.data.values &&
    existing.data.values[0]
      ? existing.data.values[0]
      : [];

  if (!row.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${GOOGLE_SHEET_TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [COLUMN_ORDER]
      }
    });
  }
}

async function appendRowToGoogleSheet(row) {
  const sheets = getGoogleSheetsClient();

  await ensureGoogleSheetHeader(sheets);

  const appendResponse =
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${GOOGLE_SHEET_TAB}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [toOrderedArray(row)]
      }
    });

  return appendResponse.data.updates
    ? appendResponse.data.updates.updatedRange
    : "";
}

// SAVE DATA
app.post("/api/budget-submissions", async (req, res, next) => {
  try {
    const row = normalizeSubmission(req.body);

    if (!hasUserData(row)) {
      return res.status(400).json({
        message:
          "Please select at least one value before submitting."
      });
    }

    const googleRange =
      runtimeConfig &&
      runtimeConfig.features.enableGoogleSheetsSync &&
      hasGoogleCredentials()
      ? await appendRowToGoogleSheet(row)
      : "";

    const mysqlInsertId = mysqlConfigured()
      ? await insertBudgetSubmissionDb(row)
      : null;

    const totalRows =
      runtimeConfig && runtimeConfig.features.enableExcelMirror
        ? appendRowAndSaveLocal(row)
        : null;

    return res.status(200).json({
      message: "Saved successfully.",
      googleRange,
      mysqlInsertId,
      totalRows
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/budget-planner/import", async (req, res, next) => {
  try {
    const inputRows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
    if (!inputRows.length) {
      throw validationError("No Budget_Planner rows received.");
    }
    if (!mysqlConfigured()) {
      throw new AppError({
        statusCode: 503,
        publicCode: ERROR_CODES.DATABASE_UNAVAILABLE,
        publicMessage: "Database is unavailable."
      });
    }

    await ensureBudgetSubmissionImportColumns();

    const seen = new Set();
    const result = {
      received: inputRows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (let index = 0; index < inputRows.length; index += 1) {
      const rowNumber = index + 2;
      const row = normalizeSubmission(inputRows[index] || {});
      const missing = [];
      if (!sanitize(row["Financial Year"])) missing.push("Financial Year");
      if (!sanitize(row["Coding"])) missing.push("Coding");
      if (!sanitize(row["Owner"])) missing.push("Owner");
      if (!sanitize(row["Location"])) missing.push("MAX Hospital");
      if (!sanitize(row["Cost Distribution"])) row["Cost Distribution"] = "Fixed Cost";

      if (missing.length) {
        result.skipped += 1;
        result.errors.push({ row: rowNumber, message: `Missing ${missing.join(", ")}` });
        continue;
      }

      const key = budgetImportKey(row);
      if (seen.has(key)) {
        result.skipped += 1;
        result.errors.push({ row: rowNumber, message: "Duplicate row in uploaded Excel for same Financial Year + Coding + Owner + MAX Hospital + Cost Distribution." });
        continue;
      }
      seen.add(key);

      const existingRows = await findBudgetSubmissionsByImportKey(row);
      const existing = existingRows[0] || null;
      if (existing && existing.id) {
        for (const duplicate of existingRows.slice(1)) {
          if (duplicate && duplicate.id) await deleteBudgetSubmissionDb(duplicate.id);
        }
        await updateBudgetSubmissionDb(existing.id, row);
        result.updated += 1;
      } else {
        await insertBudgetSubmissionDb(row);
        result.created += 1;
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

// GET BUDGET DATA
app.get("/api/budget-data", async (req, res) => {
  try {
    const pool = await getMysqlPool();

    const [rows] = await pool.query(`
      SELECT *
      FROM budget_submissions
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

app.put("/api/budget-data/:id", async (req, res, next) => {
  try {
    const id = validateBudgetId(req.params.id);
    const row = normalizeSubmission(req.body || {});
    const affectedRows = await updateBudgetSubmissionDb(id, row);
    if (!affectedRows) {
      throw notFoundError("Record not found.");
    }
    return res.status(200).json({ message: "Updated successfully.", affectedRows });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/budget-data/:id", async (req, res, next) => {
  try {
    const id = validateBudgetId(req.params.id);
    const affectedRows = await deleteBudgetSubmissionDb(id);
    if (!affectedRows) {
      throw notFoundError("Record not found.");
    }
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return next(error);
  }
});

// GET ALLOCATION DATA
app.get("/api/allocation-data", async (req, res) => {
  try {
    const pool = await getMysqlPool();

    const [rows] = await pool.query(`
      SELECT *
      FROM allocation_records
      ORDER BY updated_at DESC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

async function upsertAllocationRecordDb(payload) {
  const validated = validateAllocationRecordPayload(payload);

  const sql = `
    INSERT INTO allocation_records (
      coding,
      item,
      owner,
      financial_year,
      mode,
      amount_input,
      percent_input,
      target_amount,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      item = VALUES(item),
      mode = VALUES(mode),
      amount_input = VALUES(amount_input),
      percent_input = VALUES(percent_input),
      target_amount = VALUES(target_amount),
      updated_at = NOW()
  `;

  return withTransaction(async (connection) => {
    const params = [
      validated.coding,
      validated.item,
      validated.owner,
      validated.financialYear,
      validated.mode,
      validated.amountInput,
      validated.percentInput,
      validated.targetAmount
    ];
    await connection.execute(sql, params);

    if (validated.targetAmount > 0) {
      const mapRows = await getAllocationMapDb(connection);
      const built = buildAmountMap(validated.targetAmount, mapRows);
      validateAllocatedTotal(sumAmountMap(built.amounts), validated.targetAmount);
      await upsertAllocationMatrixWithConnection(connection, {
        financialYear: validated.financialYear,
        coding: validated.coding,
        item: validated.item,
        owner: validated.owner,
        costDistribution: "Distributed",
        totalBudget: validated.targetAmount,
        locationAmounts: built.amounts,
        locationPercents: built.percents
      });
    }

    const [rows] = await connection.execute(
      "SELECT * FROM allocation_records WHERE coding = ? AND owner = ? AND financial_year = ? LIMIT 1",
      [validated.coding, validated.owner, validated.financialYear]
    );

    const saved = rows && rows[0] ? rows[0] : null;
    await writeAuditEvent(
      connection,
      {
        entityType: "allocation_records",
        entityId: saved && saved.id ? saved.id : `${validated.coding}|${validated.owner}|${validated.financialYear}`,
        action: "UPSERT",
        newData: saved || validated,
        requestId: payload.requestId || ""
      },
      { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
    );
    return saved;
  }, { requestId: payload.requestId || "" });
}

async function deleteAllocationRecordDb(id) {
  const pool = await getMysqlPool();
  if (!pool) return 0;
  const [result] = await pool.execute("DELETE FROM allocation_records WHERE id = ?", [id]);
  return result.affectedRows || 0;
}

async function deleteAllocationRecordByKeyDb(payload) {
  const pool = await getMysqlPool();
  if (!pool) return 0;
  const coding = sanitize(payload.coding);
  const owner = sanitize(payload.owner);
  const financialYear = sanitize(payload.financialYear || payload.financial_year || payload.year);
  if (!coding || !owner || !financialYear) return 0;
  const [result] = await pool.execute(
    "DELETE FROM allocation_records WHERE coding = ? AND owner = ? AND financial_year = ?",
    [coding, owner, financialYear]
  );
  return result.affectedRows || 0;
}

app.post("/api/allocation-data", async (req, res, next) => {
  try {
    const saved = await upsertAllocationRecordDb(Object.assign({}, req.body || {}, { requestId: req.requestId }));
    return res.status(200).json(saved);
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/allocation-data/by-key", async (req, res, next) => {
  try {
    const affectedRows = await deleteAllocationRecordByKeyDb(req.query || {});
    if (!affectedRows) throw notFoundError("Record not found.");
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/allocation-data/:id", async (req, res, next) => {
  try {
    const id = validateBudgetId(req.params.id);
    const affectedRows = await deleteAllocationRecordDb(id);
    if (!affectedRows) throw notFoundError("Record not found.");
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/allocation-map", async (req, res) => {
  try {
    const pool = await getMysqlPool();
    if (!pool) return res.json([]);
    const [rows] = await pool.query(`
      SELECT location, percent
      FROM allocation_location_map
      ORDER BY location ASC
    `);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

async function getAllocationMapDb(executor) {
  const db = executor || (await getMysqlPool());
  if (!db) return [];
  const [rows] = await db.query("SELECT location, percent FROM allocation_location_map ORDER BY location ASC");
  const cleaned = Array.isArray(rows) ? rows.filter((row) => row && row.location) : [];
  if (cleaned.length) return cleaned;

  // Fallback map so localhost works even before the map is seeded in MySQL.
  return [
    { location: "Saket", percent: 13.87 },
    { location: "Max Smart", percent: 5.67 },
    { location: "Gurgaon", percent: 3.59 },
    { location: "Lajpat Nagar", percent: 0.36 },
    { location: "Panchsheel", percent: 1.42 },
    { location: "Patparganj", percent: 8.03 },
    { location: "Vaishali", percent: 7.56 },
    { location: "Noida", percent: 0.47 },
    { location: "Shalimar Bagh", percent: 6.44 },
    { location: "Mohali", percent: 4.53 },
    { location: "Dehradun", percent: 3.5 },
    { location: "Bathinda", percent: 1.91 },
    { location: "HO", percent: 3.4 },
    { location: "BLK", percent: 11.28 },
    { location: "Nanawati", percent: 6.19 },
    { location: "Nagpur", percent: 4.72 },
    { location: "Lucknow", percent: 5.2 },
    { location: "Dwarka", percent: 5.2 },
    { location: "Jaypee Noida", percent: 6.67 }
  ];
}

function buildAmountMap(totalBudget, locationMapRows) {
  const total = Number(totalBudget || 0);
  const locations = (locationMapRows || []).filter((row) => row && row.location);
  const weightTotal = locations.reduce((sum, row) => sum + Number(row.percent || 0), 0);
  const amounts = {};
  const percents = {};
  locations.forEach((row) => {
    const pct = Number(row.percent || 0);
    percents[row.location] = pct;
    amounts[row.location] = weightTotal ? (total * pct) / weightTotal : 0;
  });
  return { amounts, percents };
}

function sumAmountMap(value) {
  return Object.keys(value || {}).reduce((sum, key) => sum + Number(value[key] || 0), 0);
}

async function upsertAllocationMatrixWithConnection(connection, payload) {
  const resolvedAmounts = validateAmountMap(payload.locationAmounts || {});
  const resolvedPercents = validatePercentMap(payload.locationPercents || {});
  const resolvedTotalBudget = Number(payload.totalBudget || 0);

  const sql = `
    INSERT INTO allocation_matrix (
      financial_year,
      coding,
      item,
      owner,
      total_budget,
      cost_distribution,
      location_amounts_json,
      location_percents_json,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      item = VALUES(item),
      total_budget = VALUES(total_budget),
      cost_distribution = VALUES(cost_distribution),
      location_amounts_json = VALUES(location_amounts_json),
      location_percents_json = VALUES(location_percents_json),
      updated_at = NOW()
  `;

  await connection.execute(sql, [
    payload.financialYear,
    payload.coding,
    payload.item || "",
    payload.owner,
    resolvedTotalBudget,
    payload.costDistribution || "Distributed",
    JSON.stringify(resolvedAmounts || {}),
    JSON.stringify(resolvedPercents || {})
  ]);

  const [rows] = await connection.execute(
    "SELECT * FROM allocation_matrix WHERE financial_year = ? AND coding = ? AND owner = ? AND cost_distribution = ? LIMIT 1",
    [payload.financialYear, payload.coding, payload.owner, payload.costDistribution || "Distributed"]
  );

  return rows && rows[0] ? rows[0] : null;
}

app.get("/api/allocation-matrix", async (req, res) => {
  try {
    const pool = await getMysqlPool();
    if (!pool) return res.json([]);
    const [rows] = await pool.query(`
      SELECT *
      FROM allocation_matrix
      ORDER BY updated_at DESC
    `);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/allocation-matrix", async (req, res, next) => {
  try {
    const validated = validateAllocationMatrixPayload(req.body || {});

    const saved = await withTransaction(async (connection) => {
      const mapRows = await getAllocationMapDb(connection);
      const built = buildAmountMap(validated.totalBudget, mapRows);
      const hasExplicitAmounts = validated.explicitAmounts !== null;
      const resolvedAmounts = hasExplicitAmounts ? validated.explicitAmounts : built.amounts;
      const resolvedPercents = validated.explicitPercents || built.percents;
      const resolvedTotalBudget = hasExplicitAmounts
        ? sumAmountMap(resolvedAmounts)
        : validated.totalBudget;

      validateAllocatedTotal(sumAmountMap(resolvedAmounts), resolvedTotalBudget);

      const row = await upsertAllocationMatrixWithConnection(connection, {
        financialYear: validated.financialYear,
        coding: validated.coding,
        item: validated.item,
        owner: validated.owner,
        costDistribution: validated.costDistribution,
        totalBudget: resolvedTotalBudget,
        locationAmounts: resolvedAmounts,
        locationPercents: resolvedPercents
      });

      await connection.execute(
        `
          UPDATE allocation_records
          SET target_amount = ?, updated_at = NOW()
          WHERE coding = ? AND owner = ? AND financial_year = ?
        `,
        [resolvedTotalBudget, validated.coding, validated.owner, validated.financialYear]
      );

      await writeAuditEvent(
        connection,
        {
          entityType: "allocation_matrix",
          entityId: row && row.id ? row.id : `${validated.coding}|${validated.owner}|${validated.financialYear}`,
          action: "UPSERT",
          newData: row,
          requestId: req.requestId || ""
        },
        { enabled: process.env.ENABLE_AUDIT_LOGS === "true" }
      );

      return row;
    }, { requestId: req.requestId });

    return res.status(200).json(saved || { message: "Saved." });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/allocation-matrix/by-key", async (req, res, next) => {
  try {
    const pool = await getMysqlPool();
    if (!pool) {
      throw new AppError({
        statusCode: 503,
        publicCode: ERROR_CODES.DATABASE_UNAVAILABLE,
        publicMessage: "Database is unavailable."
      });
    }
    const financialYear = sanitize(req.query.financialYear || req.query.financial_year || req.query.year);
    const coding = sanitize(req.query.coding);
    const owner = sanitize(req.query.owner);
    const costDistribution = sanitize(req.query.costDistribution || req.query.cost_distribution || "Distributed") || "Distributed";
    if (!financialYear || !coding || !owner) {
      throw validationError("Missing financialYear/coding/owner.");
    }
    const [result] = await pool.execute(
      "DELETE FROM allocation_matrix WHERE financial_year = ? AND coding = ? AND owner = ? AND cost_distribution = ?",
      [financialYear, coding, owner, costDistribution]
    );
    const affectedRows = result.affectedRows || 0;
    if (!affectedRows) throw notFoundError("Record not found.");
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return next(error);
  }
});

app.delete("/api/allocation-matrix/:id", async (req, res, next) => {
  try {
    const pool = await getMysqlPool();
    if (!pool) {
      throw new AppError({
        statusCode: 503,
        publicCode: ERROR_CODES.DATABASE_UNAVAILABLE,
        publicMessage: "Database is unavailable."
      });
    }
    const id = validateBudgetId(req.params.id);
    const [result] = await pool.execute("DELETE FROM allocation_matrix WHERE id = ?", [id]);
    const affectedRows = result.affectedRows || 0;
    if (!affectedRows) throw notFoundError("Record not found.");
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return next(error);
  }
});

// HEALTH CHECK
app.get("/api/health", async (req, res) => {
  try {
    const mysqlHealth = await getMysqlHealth();

    return res.status(200).json({
      message: "Server is running",
      mysql: mysqlHealth
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
});

app.get("/health/live", (req, res) => {
  return res.status(200).json({ status: "alive" });
});

app.get("/health/ready", async (req, res) => {
  const ready = await checkDatabaseReady();
  if (!ready) {
    return res.status(503).json({
      status: "not-ready",
      database: "unavailable"
    });
  }

  return res.status(200).json({
    status: "ready",
    database: "connected"
  });
});

app.use(errorHandler);

async function startServer() {
  runtimeConfig = loadEnvironment(process.env);
  const dbSecret = await loadDbSecret(runtimeConfig);
  await initializePool(runtimeConfig, dbSecret);
  ensureDataDirectory();

  httpServer = app.listen(runtimeConfig.port, "0.0.0.0", () => {
    console.log(`IT Opex app running at http://localhost:${runtimeConfig.port}`);
    console.log("MySQL pool initialized.");
  });

  return httpServer;
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully.`);

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    process.exit(1);
  }, 10000);

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    await closePool();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExit);
    console.error("Shutdown failed.");
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error && error.code ? error.code : "STARTUP_FAILED");
    console.error("Server startup failed.");
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  shutdown
};
