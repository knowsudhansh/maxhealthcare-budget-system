const { loadEnvironment } = require("../src/config/environment");
const { loadDbSecret } = require("../src/config/secrets");
const { initializePool, closePool } = require("../src/db/pool");
const { withTransaction } = require("../src/db/transaction");

const DEMO_SEED_MARKER = "TIDB_DEMO_SEED_V2";
const LEGACY_DEMO_MARKER = "Temporary TiDB demo seed";

const APPROVED_DEMO_MAPPINGS = [
  {
    coding: "ITOPEX005",
    item: "Lab, BB, ABG equipment interfacing/Integration",
    subCategoryMapped: "AMC - IT Software",
    categoryIt: "Application",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Unit",
    cate3: "Existing renewal",
    cate4: "No Increment",
    owner1: "Unit",
    owner: "jatin",
    location: "Saket",
    financialYear: "2025-26",
    locFyCurrent: 599999.32,
    locFyLast: 540000,
    locLe: 410000
  },
  {
    coding: "ITOPEX007",
    item: "Sampark",
    subCategoryMapped: "AMC - IT Software",
    categoryIt: "Application",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Sampark",
    cate3: "Existing renewal",
    cate4: "User increased",
    owner1: "Application",
    owner: "jatin",
    location: "Max Smart",
    financialYear: "2025-26",
    locFyCurrent: 450000,
    locFyLast: 420000,
    locLe: 360000
  },
  {
    coding: "ITOPEX008",
    item: "Pentaho Support Renewal",
    subCategoryMapped: "IT Cost - License Subscription",
    categoryIt: "Application",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Existing renewal",
    cate3: "Existing renewal",
    cate4: "General Increase",
    owner1: "Application",
    owner: "Akshant",
    location: "Gurgaon",
    financialYear: "2025-26",
    locFyCurrent: 380000,
    locFyLast: 355000,
    locLe: 300000
  },
  {
    coding: "ITOPEX009",
    item: "CRM License Renewal (Sales force)",
    subCategoryMapped: "IT Cost - License Subscription",
    categoryIt: "Application",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "CRM",
    cate3: "Existing renewal",
    cate4: "User increased",
    owner1: "Application",
    owner: "Akshant",
    location: "Lajpat Nagar",
    financialYear: "2025-26",
    locFyCurrent: 900000,
    locFyLast: 820000,
    locLe: 740000
  },
  {
    coding: "ITOPEX011",
    item: "Amazon PACS back up",
    subCategoryMapped: "IT Cost - License Subscription",
    categoryIt: "IT infra",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Existing renewal",
    cate3: "Existing renewal",
    cate4: "No Increment",
    owner1: "IT Infra",
    owner: "Anil",
    location: "Panchsheel",
    financialYear: "2025-26",
    locFyCurrent: 650000,
    locFyLast: 640000,
    locLe: 520000
  },
  {
    coding: "ITOPEX013",
    item: "CRM enhancements-Service & Digital Implementation",
    subCategoryMapped: "IT Cost - Managed Services & S/w implementation",
    categoryIt: "Application",
    subCategory: "Dropped",
    newCategory: "Dropped",
    appCate: "Dropped",
    cate3: "Dropped",
    cate4: "Dropped",
    owner1: "Application",
    owner: "Anil",
    location: "Patparganj",
    financialYear: "2025-26",
    locFyCurrent: 0,
    locFyLast: 350000,
    locLe: 0
  },
  {
    coding: "ITOPEX014",
    item: "Data, Recovery, Printers, Laptops, IT Room Hygiene, Passive cabling, Spares batteries chargers & Toners, Contigency, Backup tapes etc...",
    subCategoryMapped: "IT Cost - Consumables",
    categoryIt: "Unit Local exp.",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Unit",
    cate3: "Consumable exp.",
    cate4: "Consumable exp.",
    owner1: "Unit",
    owner: "Unit",
    location: "Vaishali",
    financialYear: "2025-26",
    locFyCurrent: 725000,
    locFyLast: 690000,
    locLe: 610000
  },
  {
    coding: "ITOPEX015",
    item: "AMC for Central Desktop Support",
    subCategoryMapped: "AMC - IT Equipment",
    categoryIt: "IT infra",
    subCategory: "renewal and adding new lic.",
    newCategory: "Existing renewal",
    appCate: "Infra AMC",
    cate3: "Existing renewal",
    cate4: "User increased",
    owner1: "IT Infra",
    owner: "Unit",
    location: "Noida",
    financialYear: "2025-26",
    locFyCurrent: 880000,
    locFyLast: 760000,
    locLe: 640000
  },
  {
    coding: "ITOPEX018",
    item: "DMS Support Renewal",
    subCategoryMapped: "AMC - IT Software",
    categoryIt: "Application",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "DMS",
    cate3: "Existing renewal",
    cate4: "General Increase",
    owner1: "Application",
    owner: "Amit",
    location: "Shalimar Bagh",
    financialYear: "2026-27",
    locFyCurrent: 420000,
    locFyLast: 390000,
    locLe: 310000
  },
  {
    coding: "ITOPEX023",
    item: "BB Enhancements",
    subCategoryMapped: "IT Cost - Managed Services & S/w implementation",
    categoryIt: "Application",
    subCategory: "Anticpated enhancement",
    newCategory: "Anticpated enhancement",
    appCate: "BB",
    cate3: "Enhancement/Upgradation",
    cate4: "Anticipated Enhancement",
    owner1: "Application",
    owner: "Amit",
    location: "Mohali",
    financialYear: "2026-27",
    locFyCurrent: 575000,
    locFyLast: 0,
    locLe: 120000
  },
  {
    coding: "ITOPEX024",
    item: "DMS Enhancements",
    subCategoryMapped: "IT Cost - Managed Services & S/w implementation",
    categoryIt: "Application",
    subCategory: "Anticpated enhancement",
    newCategory: "Anticpated enhancement",
    appCate: "DMS",
    cate3: "Enhancement/Upgradation",
    cate4: "Anticipated Enhancement",
    owner1: "Application",
    owner: "Arjun",
    location: "Dehradun",
    financialYear: "2026-27",
    locFyCurrent: 525000,
    locFyLast: 0,
    locLe: 100000
  },
  {
    coding: "ITOPEX029",
    item: "Sify DR",
    subCategoryMapped: "IT Cost - Support",
    categoryIt: "Disaster recovery",
    subCategory: "adding new projects",
    newCategory: "DR Upgradation",
    appCate: "DR",
    cate3: "DR restrcturing",
    cate4: "DR restrcturing",
    owner1: "IT Infra",
    owner: "Anil",
    location: "Bathinda",
    financialYear: "2026-27",
    locFyCurrent: 1200000,
    locFyLast: 980000,
    locLe: 830000
  },
  {
    coding: "ITOPEX032",
    item: "Sonarqube Enterprise Version Upgrade",
    subCategoryMapped: "IT Cost - Support",
    categoryIt: "Application",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Sonarqube",
    cate3: "Enhancement/Upgradation",
    cate4: "General Increase",
    owner1: "Application",
    owner: "Arjun",
    location: "HO",
    financialYear: "2026-27",
    locFyCurrent: 760000,
    locFyLast: 700000,
    locLe: 650000
  },
  {
    coding: "ITOPEX033",
    item: "AMC SSC",
    subCategoryMapped: "AMC - IT Software",
    categoryIt: "Application",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Application AMC",
    cate3: "Existing renewal",
    cate4: "New Location Addition",
    owner1: "Application",
    owner: "Tauqueer",
    location: "BLK",
    financialYear: "2026-27",
    locFyCurrent: 680000,
    locFyLast: 600000,
    locLe: 550000
  },
  {
    coding: "ITOPEX034",
    item: "Connectivity e.g.Sify,Airtel ,Vodafone & ILL",
    subCategoryMapped: "Communication - Connectivity",
    categoryIt: "MPLS/ILL Connectivity",
    subCategory: "adding new projects",
    newCategory: "MPLS-connectivity",
    appCate: "Connectivity",
    cate3: "Connectivity",
    cate4: "No Increment",
    owner1: "IT Infra",
    owner: "Anil",
    location: "Nanawati",
    financialYear: "2026-27",
    locFyCurrent: 1550000,
    locFyLast: 1450000,
    locLe: 1300000
  },
  {
    coding: "ITOPEX035",
    item: "AMC Cow Trolleys",
    subCategoryMapped: "AMC - IT Equipment",
    categoryIt: "Unit Local exp.",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Unit",
    cate3: "Existing renewal",
    cate4: "Existing renewal",
    owner1: "Unit",
    owner: "Unit",
    location: "Nagpur",
    financialYear: "2026-27",
    locFyCurrent: 310000,
    locFyLast: 300000,
    locLe: 260000
  },
  {
    coding: "ITOPEX036",
    item: "HRMS",
    subCategoryMapped: "IT Cost - Consulting",
    categoryIt: "Application",
    subCategory: "HRMS",
    newCategory: "User increased",
    appCate: "HRMS",
    cate3: "Existing Renewal",
    cate4: "User increased",
    owner1: "Application",
    owner: "Tauqueer",
    location: "Lucknow",
    financialYear: "2026-27",
    locFyCurrent: 950000,
    locFyLast: 820000,
    locLe: 780000
  },
  {
    coding: "ITOPEX037",
    item: "NW Switches (including servers)",
    subCategoryMapped: "AMC - IT Equipment",
    categoryIt: "IT infra",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Infra AMC",
    cate3: "Existing renewal",
    cate4: "No Increment",
    owner1: "IT Infra",
    owner: "Anil",
    location: "Dwarka",
    financialYear: "2026-27",
    locFyCurrent: 875000,
    locFyLast: 840000,
    locLe: 760000
  },
  {
    coding: "ITOPEX038",
    item: "RIS PACS(GE/MED SYNAPTIC/MEDIFF)",
    subCategoryMapped: "IT Cost - Managed Services & S/w implementation",
    categoryIt: "Clinical Application",
    subCategory: "Existing renewal",
    newCategory: "Existing renewal",
    appCate: "Application AMC",
    cate3: "Existing renewal",
    cate4: "No Increment",
    owner1: "Clinical",
    owner: "Tauqueer",
    location: "Jaypee Noida",
    financialYear: "2026-27",
    locFyCurrent: 1020000,
    locFyLast: 990000,
    locLe: 910000
  },
  {
    coding: "ITOPEX042",
    item: "IMS",
    subCategoryMapped: "IT Cost - Support",
    categoryIt: "Outsourced IT Manpower (IMS)",
    subCategory: "Support restructuring",
    newCategory: "Existing renewal",
    appCate: "IMS",
    cate3: "Existing Renewal",
    cate4: "Price Increase + New Location Addition",
    owner1: "IT Infra",
    owner: "Anil",
    location: "Saket",
    financialYear: "2026-27",
    locFyCurrent: 1800000,
    locFyLast: 1650000,
    locLe: 1500000
  }
];

const DEMO_ROWS = APPROVED_DEMO_MAPPINGS;

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function splitDrivers(total) {
  const amount = roundMoney(total);
  if (!amount) {
    return {
      newAmc: 0,
      newProject: 0,
      annualized: 0,
      priceIncrease: 0,
      newUnit: 0,
      licenseIncrease: 0,
      rest: 0
    };
  }

  const newAmc = roundMoney(amount * 0.25);
  const newProject = roundMoney(amount * 0.15);
  const annualized = roundMoney(amount * 0.1);
  const priceIncrease = roundMoney(amount * 0.08);
  const newUnit = roundMoney(amount * 0.12);
  const licenseIncrease = roundMoney(amount * 0.15);
  const rest = roundMoney(amount - newAmc - newProject - annualized - priceIncrease - newUnit - licenseIncrease);

  return {
    newAmc,
    newProject,
    annualized,
    priceIncrease,
    newUnit,
    licenseIncrease,
    rest
  };
}

function rowToRecord(mapping) {
  const drivers = splitDrivers(mapping.locFyCurrent);
  return {
    submittedAt: new Date().toISOString(),
    coding: mapping.coding,
    item: mapping.item,
    subCategoryMapped: mapping.subCategoryMapped,
    categoryIt: mapping.categoryIt,
    subCategory: mapping.subCategory,
    newCategory: mapping.newCategory,
    appCate: mapping.appCate,
    cate3: mapping.cate3,
    cate4: mapping.cate4,
    owner1: mapping.owner1,
    owner: mapping.owner,
    costCenterDepartment: "IT",
    financialYear: mapping.financialYear,
    location: mapping.location,
    costDistribution: "Fixed Cost",
    locFyCurrent: roundMoney(mapping.locFyCurrent),
    locFyLast: roundMoney(mapping.locFyLast),
    locLe: roundMoney(mapping.locLe),
    newAmc: drivers.newAmc,
    newProject: drivers.newProject,
    annualized: drivers.annualized,
    priceIncrease: drivers.priceIncrease,
    newUnit: drivers.newUnit,
    licenseIncrease: drivers.licenseIncrease,
    rest: drivers.rest,
    justification: `${DEMO_SEED_MARKER} - temporary shared demo data`
  };
}

async function main() {
  const config = loadEnvironment(process.env);
  const secret = await loadDbSecret(config);
  await initializePool(config, secret);

  try {
    const result = await withTransaction((connection) => seedDemoRows(connection));

    console.log(`Demo seed inserted: ${result.inserted}`);
    console.log(`Demo seed updated: ${result.updated}`);
    console.log(`Demo seed skipped: ${result.skipped}`);
    console.log(`Legacy demo rows removed: ${result.deletedLegacy}`);
  } finally {
    await closePool();
  }
}

async function removeLegacyDemoRows(connection) {
  const [result] = await connection.execute(
    `
      DELETE FROM budget_submissions
      WHERE justification = ?
    `,
    [LEGACY_DEMO_MARKER]
  );
  return Number(result && result.affectedRows ? result.affectedRows : 0);
}

async function removeDuplicateDemoRows(connection, rows) {
  let deleted = 0;
  for (const row of rows) {
    const [existingRows] = await connection.execute(
      `
        SELECT id
        FROM budget_submissions
        WHERE coding = ?
          AND justification LIKE ?
        ORDER BY id ASC
      `,
      [row.coding, `%${DEMO_SEED_MARKER}%`]
    );

    const matches = Array.isArray(existingRows) ? existingRows : [];
    const duplicates = matches.slice(1).map((match) => Number(match.id)).filter(Number.isInteger);
    for (const id of duplicates) {
      const [deleteResult] = await connection.execute(
        "DELETE FROM budget_submissions WHERE id = ? AND justification LIKE ?",
        [id, `%${DEMO_SEED_MARKER}%`]
      );
      deleted += Number(deleteResult && deleteResult.affectedRows ? deleteResult.affectedRows : 0);
    }
  }
  return deleted;
}

async function updateDemoRow(connection, id, row) {
  await connection.execute(
    `
      UPDATE budget_submissions
      SET
        submitted_at = ?,
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
        AND coding = ?
        AND justification LIKE ?
    `,
    [
      row.submittedAt,
      row.item,
      row.subCategoryMapped,
      row.categoryIt,
      row.subCategory,
      row.newCategory,
      row.appCate,
      row.cate3,
      row.cate4,
      row.owner1,
      row.owner,
      row.costCenterDepartment,
      row.financialYear,
      row.location,
      row.costDistribution,
      row.locFyCurrent,
      row.locFyLast,
      row.locLe,
      row.newAmc,
      row.newProject,
      row.annualized,
      row.priceIncrease,
      row.newUnit,
      row.licenseIncrease,
      row.rest,
      row.justification,
      id,
      row.coding,
      `%${DEMO_SEED_MARKER}%`
    ]
  );
}

async function insertDemoRow(connection, row) {
  await connection.execute(
    `
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
    `,
    [
      row.submittedAt,
      row.coding,
      row.item,
      row.subCategoryMapped,
      row.categoryIt,
      row.subCategory,
      row.newCategory,
      row.appCate,
      row.cate3,
      row.cate4,
      row.owner1,
      row.owner,
      row.costCenterDepartment,
      row.financialYear,
      row.location,
      row.costDistribution,
      row.locFyCurrent,
      row.locFyLast,
      row.locLe,
      row.newAmc,
      row.newProject,
      row.annualized,
      row.priceIncrease,
      row.newUnit,
      row.licenseIncrease,
      row.rest,
      row.justification
    ]
  );
}

async function seedDemoRows(connection, rows = DEMO_ROWS.map(rowToRecord)) {
  let inserted = 0;
  let updated = 0;
  const skipped = 0;

  const deletedLegacy = await removeLegacyDemoRows(connection);
  const deletedDuplicateV2 = await removeDuplicateDemoRows(connection, rows);

  for (const row of rows) {
    const [existingRows] = await connection.execute(
      `
        SELECT id
        FROM budget_submissions
        WHERE coding = ?
          AND justification LIKE ?
        ORDER BY id ASC
        LIMIT 1
      `,
      [row.coding, `%${DEMO_SEED_MARKER}%`]
    );

    const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;
    if (existing && existing.id) {
      await updateDemoRow(connection, Number(existing.id), row);
      updated += 1;
    } else {
      await insertDemoRow(connection, row);
      inserted += 1;
    }
  }

  return {
    inserted,
    updated,
    skipped,
    deletedLegacy: deletedLegacy + deletedDuplicateV2
  };
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(`Demo seed failed: ${error.code || "ERROR"}`);
    await closePool();
    process.exit(1);
  });
}

module.exports = {
  APPROVED_DEMO_MAPPINGS,
  DEMO_ROWS,
  DEMO_SEED_MARKER,
  LEGACY_DEMO_MARKER,
  rowToRecord,
  seedDemoRows,
  splitDrivers
};
