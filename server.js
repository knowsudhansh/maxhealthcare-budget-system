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
const GOOGLE_CREDENTIALS_PATH = path.join(__dirname, "google-service-account.json");

// Shared Google Sheet provided by user.
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || "1dsjJRybpZh7j2ZDguTLjCCus13XxDPFpsNjYZuKo810";
const GOOGLE_SHEET_TAB = process.env.GOOGLE_SHEET_TAB || "Sheet1";
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || "",
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE || "",
  user: process.env.MYSQL_USER || "",
  password: process.env.MYSQL_PASSWORD || "",
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
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

// Allow local frontend dev servers to call this API.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

function sanitize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasGoogleCredentials() {
  const hasEnvGoogleCreds = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  );
  const hasFileGoogleCreds = fs.existsSync(GOOGLE_CREDENTIALS_PATH);
  return hasEnvGoogleCreds || hasFileGoogleCreds;
}

function mysqlConfigured() {
  return Boolean(MYSQL_CONFIG.host && MYSQL_CONFIG.database && MYSQL_CONFIG.user);
}

function normalizeSubmission(body = {}) {
  return {
    "Submitted At": sanitize(body["Submitted At"]) || new Date().toLocaleString(),
    "Coding": sanitize(body["Coding"]),
    "Item": sanitize(body["Item"]),
    "Category_IT": sanitize(body["Category_IT"]),
    "Sub Category": sanitize(body["Sub Category"]),
    "New Category": sanitize(body["New Category"]),
    "App Cate.": sanitize(body["App Cate."]),
    "Cate.3": sanitize(body["Cate.3"]),
    "Cate.4": sanitize(body["Cate.4"]),
    "Owner1": sanitize(body["Owner1"]),
    "Owner": sanitize(body["Owner"]),
    "Cost Center / Department": sanitize(body["Cost Center / Department"])
  };
}

function hasUserData(row) {
  const keys = Object.keys(row).filter((key) => key !== "Submitted At");
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
      cost_center_department
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    row["Cost Center / Department"] || null
  ];

  const [result] = await pool.execute(sql, params);
  return result.insertId || null;
}

async function getMysqlHealth() {
  if (!mysqlConfigured()) {
    return { configured: false, connected: false, database: MYSQL_CONFIG.database || "" };
  }

  try {
    const pool = await getMysqlPool();
    await pool.query("SELECT 1");
    return { configured: true, connected: true, database: MYSQL_CONFIG.database };
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
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  return workbook;
}

function appendRowAndSaveLocal(row) {
  const workbook = getWorkbook();
  let worksheet = workbook.Sheets[SHEET_NAME];

  if (!worksheet) {
    worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  rows.push(row);
  workbook.Sheets[SHEET_NAME] = XLSX.utils.json_to_sheet(rows);

  if (!workbook.SheetNames.includes(SHEET_NAME)) {
    workbook.SheetNames.push(SHEET_NAME);
  }

  XLSX.writeFile(workbook, FILE_PATH);
  return rows.length;
}

function getGoogleSheetsClient() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if ((!email || !privateKey) && fs.existsSync(GOOGLE_CREDENTIALS_PATH)) {
    const credentials = JSON.parse(fs.readFileSync(GOOGLE_CREDENTIALS_PATH, "utf8"));
    email = credentials.client_email;
    privateKey = credentials.private_key;
  }

  if (!email || !privateKey) {
    throw new Error(
      "Google credentials missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY or add google-service-account.json."
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return google.sheets({ version: "v4", auth });
}

async function ensureGoogleSheetHeader(sheets) {
  const headerRange = `${GOOGLE_SHEET_TAB}!A1:${String.fromCharCode(64 + COLUMN_ORDER.length)}1`;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: headerRange
  });

  const row = existing.data.values && existing.data.values[0] ? existing.data.values[0] : [];
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

  const appendResponse = await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${GOOGLE_SHEET_TAB}!A:${String.fromCharCode(64 + COLUMN_ORDER.length)}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [toOrderedArray(row)]
    }
  });

  return appendResponse.data.updates ? appendResponse.data.updates.updatedRange : "";
}

app.fetch("https://maxhealthcare-budget-system-production.up.railway.app/api/budget-submissions", async (req, res) => {
  try {
    const row = normalizeSubmission(req.body);
    if (!hasUserData(row)) {
      return res.status(400).json({
        message: "Please select or enter at least one dropdown value before submitting."
      });
    }

    const googleRange = hasGoogleCredentials() ? await appendRowToGoogleSheet(row) : "";
    const mysqlInsertId = mysqlConfigured() ? await insertBudgetSubmissionDb(row) : null;
    const totalRows = appendRowAndSaveLocal(row);

    return res.status(200).json({
      message: "Saved successfully.",
      sheetId: GOOGLE_SHEET_ID,
      googleRange,
      mysqlInsertId,
      file: path.basename(FILE_PATH),
      totalRows,
      mysqlConfigured: mysqlConfigured(),
      googleConfigured: hasGoogleCredentials()
    });
  } catch (error) {
    return res.status(500).json({
      message: `Save failed: ${error.message}`
    });
  }
});

app.get("/api/health", (req, res) => {
  getMysqlHealth()
    .then((mysqlHealth) => {
      return res.status(200).json({
        message: "Server is running",
        filePath: FILE_PATH,
        sheetId: GOOGLE_SHEET_ID,
        sheetTab: GOOGLE_SHEET_TAB,
        googleConfigured: hasGoogleCredentials(),
        mysql: mysqlHealth
      });
    })
    .catch((error) => {
      return res.status(500).json({
        message: `Health check failed: ${error.message}`
      });
    });
});

app.all("/api/budget-submissions", (req, res) => {
  return res.status(405).json({
    message: "Method not allowed. Use POST /api/budget-submissions."
  });
});

app.use(express.static(__dirname));


// SAVE data API
app.fetch("https://maxhealthcare-budget-system-production.up.railway.app/api/budget-submissions", (req, res) => {

  const {
    coding,
    item,
    category_it,
    owner
  } = req.body;

  const sql = `
    INSERT INTO budget_submissions
    (submitted_at, coding, item, category_it, owner)
    VALUES (NOW(), ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [coding, item, category_it, owner],
    (err, result) => {
      if (err) {
        console.log(err);
        res.send(err);
      } else {
        res.json({
          message: "Data Saved ✅",
          id: result.insertId
        });
      }
    }
  );
});

// GET all data API
app.get("/api/budget-submissions", (req, res) => {

  const sql = `
    SELECT *
    FROM budget_submissions
    ORDER BY id DESC
  `;

  db.query(sql, (err, result) => {

    if (err) {
      res.send(err);
    } else {
      res.json(result);
    }

  });

});
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
app.listen(PORT, () => {
  ensureDataDirectory();
  console.log(`IT Opex app running at http://localhost:${PORT}`);
  if (mysqlConfigured()) {
    console.log(
      `MySQL configured for ${MYSQL_CONFIG.user}@${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`
    );
  } else {
    console.log("MySQL not configured. Server will continue with local file storage and optional Google Sheets.");
  }
});