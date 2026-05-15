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

app.use(express.json({ limit: "1mb" }));

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

    "loc_fy_current": Number(body["loc_fy_current"] || 0),
    "loc_le": Number(body["loc_le"] || 0),

    "new_amc": Number(body["new_amc"] || 0),
    "new_project": Number(body["new_project"] || 0),
    "annualized": Number(body["annualized"] || 0),
    "price_increase": Number(body["price_increase"] || 0),
    "new_unit": Number(body["new_unit"] || 0),
    "license_increase": Number(body["license_increase"] || 0),
    "rest": Number(body["rest"] || 0)
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
async function insertBudgetSubmissionDb(row) {
  const pool = await getMysqlPool();

  if (!pool) return null;

  const sql = `
    INSERT INTO budget_submissions (
      submitted_at,
      coding,
      item,
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
      loc_fy_current,
      loc_le,
      new_amc,
      new_project,
      annualized,
      price_increase,
      new_unit,
      license_increase,
      rest
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    row["Submitted At"] || null,
    row["Coding"] || null,
    row["Item"] || null,
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
    row["loc_fy_current"] || 0,
    row["loc_le"] || 0,
    row["new_amc"] || 0,
    row["new_project"] || 0,
    row["annualized"] || 0,
    row["price_increase"] || 0,
    row["new_unit"] || 0,
    row["license_increase"] || 0,
    row["rest"] || 0
  ];

  const [result] = await pool.execute(sql, params);

  return result.insertId || null;
}

async function updateBudgetSubmissionDb(id, row) {
  const pool = await getMysqlPool();
  if (!pool) return 0;

  const sql = `
    UPDATE budget_submissions
    SET
      coding = ?,
      item = ?,
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
      loc_fy_current = ?,
      loc_le = ?,
      new_amc = ?,
      new_project = ?,
      annualized = ?,
      price_increase = ?,
      new_unit = ?,
      license_increase = ?,
      rest = ?
    WHERE id = ?
  `;

  const params = [
    row["Coding"] || null,
    row["Item"] || null,
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
    row["loc_fy_current"] || 0,
    row["loc_le"] || 0,
    row["new_amc"] || 0,
    row["new_project"] || 0,
    row["annualized"] || 0,
    row["price_increase"] || 0,
    row["new_unit"] || 0,
    row["license_increase"] || 0,
    row["rest"] || 0,
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
  return Array.isArray(rows) ? rows : [];
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
    const totalBudget = Number(body.totalBudget || body.total_budget || body.targetAmount || 0);

    if (!financialYear || !coding || !owner) {
      return res.status(400).json({ message: "Missing financialYear/coding/owner." });
    }

    const mapRows = await getAllocationMapDb();
    const built = buildAmountMap(totalBudget, mapRows);
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
      totalBudget,
      costDistribution,
      JSON.stringify(built.amounts || {}),
      JSON.stringify(built.percents || {})
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
