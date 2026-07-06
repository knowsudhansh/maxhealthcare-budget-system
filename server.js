const express = require("express");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const mysql = require("mysql2/promise");
require("dotenv").config();
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 3000;

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

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || "",
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE || "",
  user: process.env.MYSQL_USER || "",
  password: process.env.MYSQL_PASSWORD || "",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let mysqlPool;

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

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.static(__dirname));

function sanitize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function mysqlConfigured() {
  return Boolean(
    MYSQL_CONFIG.host &&
      MYSQL_CONFIG.database &&
      MYSQL_CONFIG.user
  );
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
  return {
    "Submitted At": body["Submitted At"] || "",

    "Coding": body["Coding"] || "",
    "Item": body["Item"] || "",

    "Sub Category (Mapped)": body["Sub Category (Mapped)"] || body["sub_category_mapped"] || "",
    "Category_IT": body["Category_IT"] || "",
    "Sub Category": body["Sub Category"] || "",
    "New Category": body["New Category"] || "",
    "App Cate.": body["App Cate."] || "",
    "Cate.3": body["Cate.3"] || "",
    "Cate.4": body["Cate.4"] || "",

    "Owner1": body["Owner1"] || "",
    "Owner": body["Owner"] || "",

    "Cost Center / Department":
      body["Cost Center / Department"] || "",

    "Financial Year": body["Financial Year"] || "",
    "Location": body["Location"] || "",
    "Cost Distribution": body["Cost Distribution"] || body["cost_distribution"] || "Fixed Cost",

    "loc_fy_current": Number(body["loc_fy_current"] || 0),
    "loc_fy_last": Number(body["loc_fy_last"] || 0),
    "loc_le": Number(body["loc_le"] || 0),

    "new_amc": Number(body["new_amc"] || 0),
    "new_project": Number(body["new_project"] || 0),
    "annualized": Number(body["annualized"] || 0),
    "price_increase": Number(body["price_increase"] || 0),
    "new_unit": Number(body["new_unit"] || 0),
    "license_increase": Number(body["license_increase"] || 0),
    "rest": Number(body["rest"] || 0),
    "Justification": body["Justification"] || body["justification"] || ""
  };
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
  if (!mysqlConfigured()) return null;

  if (mysqlPool) return mysqlPool;

  mysqlPool = mysql.createPool(MYSQL_CONFIG);

  return mysqlPool;
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
  if (!mysqlConfigured()) {
    return {
      configured: false,
      connected: false,
      database: MYSQL_CONFIG.database || ""
    };
  }

  try {
    const pool = await getMysqlPool();

    await pool.query("SELECT 1");

    return {
      configured: true,
      connected: true,
      database: MYSQL_CONFIG.database
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      database: MYSQL_CONFIG.database,
      error: error.message
    };
  }
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
app.post("/api/budget-submissions", async (req, res) => {
  try {
    const row = normalizeSubmission(req.body);

    if (!hasUserData(row)) {
      return res.status(400).json({
        message:
          "Please select at least one value before submitting."
      });
    }

    const googleRange = hasGoogleCredentials()
      ? await appendRowToGoogleSheet(row)
      : "";

    const mysqlInsertId = mysqlConfigured()
      ? await insertBudgetSubmissionDb(row)
      : null;

    const totalRows = appendRowAndSaveLocal(row);

    return res.status(200).json({
      message: "Saved successfully.",
      googleRange,
      mysqlInsertId,
      totalRows
    });
  } catch (error) {
    return res.status(500).json({
      message: `Save failed: ${error.message}`
    });
  }
});

app.post("/api/budget-planner/import", async (req, res) => {
  try {
    const inputRows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
    if (!inputRows.length) {
      return res.status(400).json({ message: "No Budget_Planner rows received." });
    }
    if (!mysqlConfigured()) {
      return res.status(500).json({ message: "MySQL is not configured. Excel import needs the online DB connection." });
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
    return res.status(500).json({ message: `Import failed: ${error.message}` });
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

app.put("/api/budget-data/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const row = normalizeSubmission(req.body || {});
    const affectedRows = await updateBudgetSubmissionDb(id, row);
    if (!affectedRows) {
      return res.status(404).json({ message: "Record not found." });
    }
    return res.status(200).json({ message: "Updated successfully.", affectedRows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete("/api/budget-data/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const affectedRows = await deleteBudgetSubmissionDb(id);
    if (!affectedRows) {
      return res.status(404).json({ message: "Record not found." });
    }
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
  const pool = await getMysqlPool();
  if (!pool) return null;

  const coding = sanitize(payload.coding || payload.Coding);
  const owner = sanitize(payload.owner || payload.Owner);
  const financialYear = sanitize(payload.financialYear || payload["Financial Year"] || payload.year);
  const item = sanitize(payload.item || payload.Item);
  const mode = sanitize(payload.mode || payload.Mode || "Distributed") || "Distributed";
  const amountInput = payload.amountInput === "" || payload.amountInput == null ? null : Number(payload.amountInput || 0);
  const percentInput = payload.percentInput === "" || payload.percentInput == null ? null : Number(payload.percentInput || 0);
  const targetAmount = Number(payload.targetAmount || 0);

  if (!coding || !owner || !financialYear) return null;

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

  const params = [coding, item, owner, financialYear, mode, amountInput, percentInput, targetAmount];
  await pool.execute(sql, params);

  const [rows] = await pool.execute(
    "SELECT * FROM allocation_records WHERE coding = ? AND owner = ? AND financial_year = ? LIMIT 1",
    [coding, owner, financialYear]
  );
  return rows && rows[0] ? rows[0] : null;
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

app.post("/api/allocation-data", async (req, res) => {
  try {
    const saved = await upsertAllocationRecordDb(req.body || {});
    if (!saved) {
      return res.status(400).json({ message: "Missing coding/owner/financialYear." });
    }
    return res.status(200).json(saved);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete("/api/allocation-data/by-key", async (req, res) => {
  try {
    const affectedRows = await deleteAllocationRecordByKeyDb(req.query || {});
    if (!affectedRows) return res.status(404).json({ message: "Record not found." });
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete("/api/allocation-data/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id." });
    }
    const affectedRows = await deleteAllocationRecordDb(id);
    if (!affectedRows) return res.status(404).json({ message: "Record not found." });
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

async function getAllocationMapDb() {
  const pool = await getMysqlPool();
  if (!pool) return [];
  const [rows] = await pool.query("SELECT location, percent FROM allocation_location_map ORDER BY location ASC");
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

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function hasObjectKeys(value) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function cleanAmountMap(value) {
  const cleaned = {};
  if (!isPlainObject(value)) return cleaned;
  Object.keys(value).forEach((location) => {
    if (!location) return;
    const amount = Number(value[location] || 0);
    cleaned[location] = Number.isFinite(amount) && amount > 0 ? amount : 0;
  });
  return cleaned;
}

function sumAmountMap(value) {
  return Object.keys(value || {}).reduce((sum, key) => sum + Number(value[key] || 0), 0);
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

app.post("/api/allocation-matrix", async (req, res) => {
  try {
    const pool = await getMysqlPool();
    if (!pool) return res.status(500).json({ message: "MySQL not configured." });

    const body = req.body || {};
    const financialYear = sanitize(body.financialYear || body.financial_year || body["Financial Year"]);
    const coding = sanitize(body.coding || body.Coding);
    const item = sanitize(body.item || body.Item);
    const owner = sanitize(body.owner || body.Owner);
    const costDistribution = sanitize(body.costDistribution || body.cost_distribution || body.mode || "Distributed") || "Distributed";
    const totalBudgetInput = Number(body.totalBudget || body.total_budget || body.targetAmount || 0);

    if (!financialYear || !coding || !owner) {
      return res.status(400).json({ message: "Missing financialYear/coding/owner." });
    }

    const mapRows = await getAllocationMapDb();
    const built = buildAmountMap(totalBudgetInput, mapRows);

    // If the client sends explicit per-location amounts (editing), store them as-is.
    const rawAmounts = body.locationAmounts || body.location_amounts || body.location_amounts_json || null;
    const rawPercents = body.locationPercents || body.location_percents || body.location_percents_json || null;
    const explicitAmountsRaw = (() => {
      if (!rawAmounts) return null;
      try {
        if (typeof rawAmounts === "string") return JSON.parse(rawAmounts);
        if (typeof rawAmounts === "object") return rawAmounts;
        return null;
      } catch (_e) {
        return null;
      }
    })();
    const explicitPercentsRaw = (() => {
      if (!rawPercents) return null;
      try {
        if (typeof rawPercents === "string") return JSON.parse(rawPercents);
        if (typeof rawPercents === "object") return rawPercents;
        return null;
      } catch (_e) {
        return null;
      }
    })();

    const explicitAmountsCandidate = hasObjectKeys(explicitAmountsRaw) ? cleanAmountMap(explicitAmountsRaw) : null;
    const explicitAmounts =
      explicitAmountsCandidate && sumAmountMap(explicitAmountsCandidate) > 0
        ? explicitAmountsCandidate
        : null;
    const explicitPercents = hasObjectKeys(explicitPercentsRaw) ? explicitPercentsRaw : null;
    const resolvedAmounts = explicitAmounts || (built.amounts || {});
    const resolvedPercents = explicitPercents || (built.percents || {});
    const resolvedTotalBudget =
      explicitAmounts
        ? sumAmountMap(resolvedAmounts)
        : totalBudgetInput;
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

    await pool.execute(sql, [
      financialYear,
      coding,
      item,
      owner,
      resolvedTotalBudget,
      costDistribution,
      JSON.stringify(resolvedAmounts || {}),
      JSON.stringify(resolvedPercents || {})
    ]);

    const [rows] = await pool.execute(
      "SELECT * FROM allocation_matrix WHERE financial_year = ? AND coding = ? AND owner = ? AND cost_distribution = ? LIMIT 1",
      [financialYear, coding, owner, costDistribution]
    );
    return res.status(200).json(rows && rows[0] ? rows[0] : { message: "Saved." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete("/api/allocation-matrix/by-key", async (req, res) => {
  try {
    const pool = await getMysqlPool();
    if (!pool) return res.status(500).json({ message: "MySQL not configured." });
    const financialYear = sanitize(req.query.financialYear || req.query.financial_year || req.query.year);
    const coding = sanitize(req.query.coding);
    const owner = sanitize(req.query.owner);
    const costDistribution = sanitize(req.query.costDistribution || req.query.cost_distribution || "Distributed") || "Distributed";
    if (!financialYear || !coding || !owner) {
      return res.status(400).json({ message: "Missing financialYear/coding/owner." });
    }
    const [result] = await pool.execute(
      "DELETE FROM allocation_matrix WHERE financial_year = ? AND coding = ? AND owner = ? AND cost_distribution = ?",
      [financialYear, coding, owner, costDistribution]
    );
    const affectedRows = result.affectedRows || 0;
    if (!affectedRows) return res.status(404).json({ message: "Record not found." });
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.delete("/api/allocation-matrix/:id", async (req, res) => {
  try {
    const pool = await getMysqlPool();
    if (!pool) return res.status(500).json({ message: "MySQL not configured." });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: "Invalid id." });
    const [result] = await pool.execute("DELETE FROM allocation_matrix WHERE id = ?", [id]);
    const affectedRows = result.affectedRows || 0;
    if (!affectedRows) return res.status(404).json({ message: "Record not found." });
    return res.status(200).json({ message: "Deleted successfully.", affectedRows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

app.listen(PORT,  "0.0.0.0", () => {
  ensureDataDirectory();

  console.log(
    `IT Opex app running at http://localhost:${PORT}`
  );

  if (mysqlConfigured()) {
    console.log(
      `MySQL connected: ${MYSQL_CONFIG.database}`
    );
  } else {
    console.log("MySQL not configured.");
  }
});
