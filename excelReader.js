(function (global) {
  const SHEET_ALIASES = {
    unitBudget: [
      "unit wise budget-main",
      "unit wise budget main",
      "unit budget",
      "unit wise budget"
    ],
    itOpex: [
      "it opex fy 25-26",
      "it opex fy25-26",
      "it opex",
      "it opex fy 2025-26"
    ],
    allocation: [
      "allocation-fixed and % wise",
      "allocation-fixed and %wise",
      "allocation fixed and % wise",
      "allocation",
      "allocation-fixed and percentage wise"
    ],
    utilization: [
      "opex budget utilization",
      "budget utilization",
      "utilization"
    ]
  };

  const FIELD_ALIASES = {
    location: ["location", "max hospital", "hospital", "site", "unit name", "entity"],
    unit: ["unit", "unit name", "department", "cost center", "unit wise"],
    year: ["year", "financial year", "fy", "f y"],
    category: ["category", "category it", "category_it", "app cate", "app category"],
    subCategory: ["sub category", "subcategory", "sub category (mapped)", "sub category mapped"],
    vendor: ["vendor", "partner", "supplier", "service provider", "owner"],
    budget: ["budget", "current budget", "budget fy 25-26", "budget fy 26", "budget +(current year) (rs l)", "budget current year (rs l)"],
    currentBudget: ["current budget", "budget", "budget fy 25-26", "budget fy 26", "budget +(current year) (rs l)"],
    expense: ["expense", "actual", "actual expense", "total expense", "last year expense", "ly unit expense (rs l)", "ly expense", "le fy 25"],
    lastYearExpense: ["last year expense", "ly unit expense (rs l)", "ly expense", "expense", "le fy 25"],
    fixedAllocation: ["fixed allocation", "allocation fixed", "allocated budget", "fixed budget"],
    allocationPercent: ["allocation %", "allocation percent", "% allocation", "allocation share %", "% of share"],
    usedBudget: ["used budget", "utilized budget", "spent", "actual spent", "used"],
    remainingBudget: ["remaining budget", "balance", "available balance", "remaining"],
    utilizationPercent: ["utilization %", "utilization percent", "used %"],
    coding: ["coding", "code"],
    item: ["item", "description", "service item"],
    owner: ["owner", "manager", "budget owner"]
  };

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toNumber(value) {
    const raw = String(value == null ? "" : value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim();
    if (!raw) {
      return 0;
    }
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }

  function safeString(value) {
    return String(value == null ? "" : value).trim();
  }

  function readWorkbook(arrayBuffer) {
    return XLSX.read(arrayBuffer, { type: "array", cellDates: true, dense: true });
  }

  function findSheetName(workbook, aliases) {
    const names = workbook.SheetNames || [];
    const normalized = aliases.map(normalizeText);

    for (const name of names) {
      const normalizedName = normalizeText(name);
      if (normalized.includes(normalizedName)) {
        return name;
      }
    }

    for (const name of names) {
      const normalizedName = normalizeText(name);
      if (normalized.some((alias) => normalizedName.includes(alias) || alias.includes(normalizedName))) {
        return name;
      }
    }

    return null;
  }

  function sheetToRows(workbook, sheetName) {
    if (!sheetName || !workbook.Sheets[sheetName]) {
      return [];
    }
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
      raw: false
    });
  }

  function pickValue(row, aliases) {
    const entries = Object.entries(row || {});
    const normalizedAliases = aliases.map(normalizeText);

    for (const [key, value] of entries) {
      const normalizedKey = normalizeText(key);
      if (normalizedAliases.includes(normalizedKey)) {
        return value;
      }
    }

    for (const [key, value] of entries) {
      const normalizedKey = normalizeText(key);
      if (normalizedAliases.some((alias) => normalizedKey.includes(alias))) {
        return value;
      }
    }

    return "";
  }

  function normalizeUnitBudgetRow(row) {
    const unit = safeString(pickValue(row, FIELD_ALIASES.unit)) || safeString(pickValue(row, FIELD_ALIASES.location));
    const location = safeString(pickValue(row, FIELD_ALIASES.location)) || unit;
    const year = safeString(pickValue(row, FIELD_ALIASES.year));
    const lastYearExpense = toNumber(pickValue(row, FIELD_ALIASES.lastYearExpense));
    const currentBudget = toNumber(pickValue(row, FIELD_ALIASES.currentBudget));
    const explicitDifference = toNumber(pickValue(row, ["budget difference", "difference", "budget diff"]));
    const budgetDifference = explicitDifference || (currentBudget - lastYearExpense);
    const explicitGrowth = toNumber(pickValue(row, ["growth %", "growth percent", "budget growth %", "growth"]));
    const growthPercent = explicitGrowth || (lastYearExpense ? ((currentBudget - lastYearExpense) / lastYearExpense) * 100 : 0);

    return {
      unit,
      location,
      year,
      lastYearExpense,
      currentBudget,
      budgetDifference,
      growthPercent,
      raw: row
    };
  }

  function normalizeItOpexRow(row) {
    const budget = toNumber(pickValue(row, FIELD_ALIASES.budget));
    const expense = toNumber(pickValue(row, FIELD_ALIASES.expense));

    return {
      location: safeString(pickValue(row, FIELD_ALIASES.location)),
      category: safeString(pickValue(row, FIELD_ALIASES.category)) || safeString(pickValue(row, FIELD_ALIASES.subCategory)),
      vendor: safeString(pickValue(row, FIELD_ALIASES.vendor)),
      unit: safeString(pickValue(row, FIELD_ALIASES.unit)),
      year: safeString(pickValue(row, FIELD_ALIASES.year)),
      budget,
      expense,
      coding: safeString(pickValue(row, FIELD_ALIASES.coding)),
      item: safeString(pickValue(row, FIELD_ALIASES.item)),
      owner: safeString(pickValue(row, FIELD_ALIASES.owner)),
      raw: row
    };
  }

  function normalizeAllocationRow(row) {
    const budget = toNumber(pickValue(row, FIELD_ALIASES.budget));
    const fixedAllocation = toNumber(pickValue(row, FIELD_ALIASES.fixedAllocation)) || budget;
    const explicitPercent = toNumber(pickValue(row, FIELD_ALIASES.allocationPercent));
    const allocationPercent = explicitPercent || (budget ? (fixedAllocation / budget) * 100 : 0);

    return {
      location: safeString(pickValue(row, FIELD_ALIASES.location)),
      category: safeString(pickValue(row, FIELD_ALIASES.category)) || safeString(pickValue(row, FIELD_ALIASES.subCategory)),
      year: safeString(pickValue(row, FIELD_ALIASES.year)),
      fixedAllocation,
      allocationPercent,
      budget,
      raw: row
    };
  }

  function normalizeUtilizationRow(row) {
    const budget = toNumber(pickValue(row, FIELD_ALIASES.budget));
    const usedBudget = toNumber(pickValue(row, FIELD_ALIASES.usedBudget));
    const explicitRemaining = toNumber(pickValue(row, FIELD_ALIASES.remainingBudget));
    const remainingBudget = explicitRemaining || Math.max(budget - usedBudget, 0);
    const explicitPercent = toNumber(pickValue(row, FIELD_ALIASES.utilizationPercent));
    const utilizationPercent = explicitPercent || (budget ? (usedBudget / budget) * 100 : 0);

    return {
      location: safeString(pickValue(row, FIELD_ALIASES.location)),
      unit: safeString(pickValue(row, FIELD_ALIASES.unit)) || safeString(pickValue(row, FIELD_ALIASES.location)),
      year: safeString(pickValue(row, FIELD_ALIASES.year)),
      budget,
      usedBudget,
      remainingBudget,
      utilizationPercent,
      overBudget: usedBudget > budget && budget > 0,
      raw: row
    };
  }

  function collectDimension(rows, key) {
    return Array.from(
      new Set(
        rows
          .map((row) => safeString(row[key]))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }

  function buildSheetSummary(sheetMap, datasets) {
    return [
      {
        sheet: "Unit wise budget-Main",
        mappedSheet: sheetMap.unitBudget || "Missing",
        rows: datasets.unitBudgetRows.length,
        purpose: "Expense, budget, growth, unit totals"
      },
      {
        sheet: "IT OPEX FY 25-26",
        mappedSheet: sheetMap.itOpex || "Missing",
        rows: datasets.itOpexRows.length,
        purpose: "Main source for budget analytics"
      },
      {
        sheet: "Allocation-Fixed and % wise",
        mappedSheet: sheetMap.allocation || "Missing",
        rows: datasets.allocationRows.length,
        purpose: "Allocation %, fixed allocation"
      },
      {
        sheet: "Opex Budget Utilization",
        mappedSheet: sheetMap.utilization || "Missing",
        rows: datasets.utilizationRows.length,
        purpose: "Used, remaining and utilization alerts"
      }
    ];
  }

  async function readFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    return parseWorkbook(readWorkbook(arrayBuffer), file.name);
  }

  function parseWorkbook(workbook, sourceName) {
    const sheetMap = {
      unitBudget: findSheetName(workbook, SHEET_ALIASES.unitBudget),
      itOpex: findSheetName(workbook, SHEET_ALIASES.itOpex),
      allocation: findSheetName(workbook, SHEET_ALIASES.allocation),
      utilization: findSheetName(workbook, SHEET_ALIASES.utilization)
    };

    const unitBudgetRows = sheetToRows(workbook, sheetMap.unitBudget).map(normalizeUnitBudgetRow);
    const itOpexRows = sheetToRows(workbook, sheetMap.itOpex).map(normalizeItOpexRow);
    const allocationRows = sheetToRows(workbook, sheetMap.allocation).map(normalizeAllocationRow);
    const utilizationRows = sheetToRows(workbook, sheetMap.utilization).map(normalizeUtilizationRow);

    const dimensions = {
      locations: collectDimension(
        [...unitBudgetRows, ...itOpexRows, ...allocationRows, ...utilizationRows],
        "location"
      ),
      categories: collectDimension([...itOpexRows, ...allocationRows], "category"),
      years: collectDimension(
        [...unitBudgetRows, ...itOpexRows, ...allocationRows, ...utilizationRows],
        "year"
      ),
      units: collectDimension([...unitBudgetRows, ...itOpexRows, ...utilizationRows], "unit")
    };

    const datasets = {
      sourceName: sourceName || "Workbook",
      sheetMap,
      unitBudgetRows,
      itOpexRows,
      allocationRows,
      utilizationRows
    };

    datasets.sheetSummary = buildSheetSummary(sheetMap, datasets);
    datasets.dimensions = dimensions;
    datasets.generatedAt = new Date().toISOString();

    return datasets;
  }

  global.ExcelBudgetReader = {
    readFile,
    readWorkbook,
    parseWorkbook,
    normalizeText,
    toNumber
  };
})(window);
