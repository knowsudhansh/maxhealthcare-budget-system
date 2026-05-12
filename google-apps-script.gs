const SHEET_ID = "1dsjJRybpZh7j2ZDguTLjCCus13XxDPFpsNjYZuKo810";
const SHEET_NAME = "Sheet1"; // if not found, script falls back to first tab

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

function doPost(e) {
  try {
    const payload = parsePayload(e);

    const sheet = getOrCreateSheet();
    ensureHeader(sheet);

    const row = COLUMN_ORDER.map((key) => sanitize(payload[key]));
    sheet.appendRow(row);

    const totalRows = sheet.getLastRow();
    Logger.log("Saved row to sheet '%s'. Total rows: %s", sheet.getName(), totalRows);

    return ContentService
      .createTextOutput(JSON.stringify({
        status: "ok",
        message: "Saved",
        sheetName: sheet.getName(),
        totalRows
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("doPost error: %s", error);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  const sheet = getOrCreateSheet();
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      message: "Apps Script is running",
      sheetName: sheet.getName(),
      totalRows: sheet.getLastRow()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : null;
  if (!sheet) {
    const sheets = ss.getSheets();
    sheet = sheets.length ? sheets[0] : ss.insertSheet("Sheet1");
  }
  return sheet;
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMN_ORDER);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, COLUMN_ORDER.length).getValues()[0];
  const hasHeader = COLUMN_ORDER.every((name, idx) => String(firstRow[idx] || "").trim() === name);
  if (!hasHeader) {
    sheet.insertRows(1);
    sheet.getRange(1, 1, 1, COLUMN_ORDER.length).setValues([COLUMN_ORDER]);
  }
}

function sanitize(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function parsePayload(e) {
  if (e && e.parameter && Object.keys(e.parameter).length) {
    return e.parameter;
  }

  const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function testWrite() {
  const sheet = getOrCreateSheet();
  ensureHeader(sheet);

  const payload = {
    "Submitted At": new Date().toLocaleString(),
    "Coding": "TEST-CODING",
    "Item": "TEST-ITEM",
    "Category_IT": "TEST-CATEGORY",
    "Sub Category": "TEST-SUB",
    "New Category": "TEST-NEW",
    "App Cate.": "TEST-APP",
    "Cate.3": "TEST-C3",
    "Cate.4": "TEST-C4",
    "Owner1": "TEST-OWNER1",
    "Owner": "TEST-OWNER",
    "Cost Center / Department": "TEST-CC"
  };

  sheet.appendRow(COLUMN_ORDER.map((key) => payload[key]));
  Logger.log("testWrite success. Sheet '%s', total rows: %s", sheet.getName(), sheet.getLastRow());
}
