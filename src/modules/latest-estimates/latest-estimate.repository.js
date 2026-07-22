function mapMatrix(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    matrixCode: row.matrix_code,
    matrixName: row.matrix_name,
    budgetCycleId: Number(row.budget_cycle_id || 0),
    financialYear: row.financial_year,
    versionNumber: Number(row.version_number || 0),
    status: row.status,
    workflowInstanceId: row.workflow_instance_id ? Number(row.workflow_instance_id) : null,
    sourceBudgetVersion: row.source_budget_version || "",
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCell(row) {
  if (!row) return null;
  return {
    id: row.cell_id ? Number(row.cell_id) : row.id ? Number(row.id) : null,
    matrixId: row.matrix_id ? Number(row.matrix_id) : null,
    budgetEntityId: String(row.budget_entity_id || row.budget_id || ""),
    coding: row.coding || "",
    item: row.item || "",
    location: row.location || "",
    financialYear: row.financial_year || "",
    budgetAmount: Number(row.budget_amount || row.loc_fy_current || 0),
    latestEstimateAmount: Number(row.latest_estimate_amount || row.loc_le || 0),
    varianceAmount: Number(row.variance_amount || 0),
    variancePercentage: row.variance_percentage === null || row.variance_percentage === undefined ? null : Number(row.variance_percentage),
    varianceSeverity: row.variance_severity || "ON_BUDGET",
    remarks: row.remarks || "",
    cellVersion: Number(row.cell_version || 0),
    updatedAt: row.updated_at || ""
  };
}

async function insertMatrix(db, payload, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  const [result] = await db.execute(
    `
      INSERT INTO latest_estimate_matrices (
        matrix_code, matrix_name, budget_cycle_id, financial_year, version_number,
        status, workflow_instance_id, source_budget_version, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 1, 'DRAFT', NULL, ?, ?, ?, NOW(), NOW())
    `,
    [payload.matrixCode, payload.matrixName, payload.budgetCycleId || 0, payload.financialYear, payload.sourceBudgetVersion, by, by]
  );
  return findMatrixById(db, result.insertId);
}

async function updateMatrixWorkflow(db, matrixId, workflowId) {
  await db.execute("UPDATE latest_estimate_matrices SET workflow_instance_id = ?, updated_at = NOW() WHERE id = ?", [workflowId, matrixId]);
  return findMatrixById(db, matrixId);
}

async function findMatrixById(db, id) {
  const [rows] = await db.execute("SELECT * FROM latest_estimate_matrices WHERE id = ? LIMIT 1", [id]);
  return mapMatrix(rows && rows[0]);
}

async function listMatrices(db, filters) {
  const values = [];
  const where = [];
  if (filters.financialYear) {
    where.push("financial_year = ?");
    values.push(filters.financialYear);
  }
  if (filters.status) {
    where.push("status = ?");
    values.push(filters.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM latest_estimate_matrices ${whereSql}`, values);
  const [rows] = await db.execute(
    `
      SELECT *
      FROM latest_estimate_matrices
      ${whereSql}
      ORDER BY updated_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    values.concat([filters.pageSize, filters.offset])
  );
  return { total: Number(countRows && countRows[0] ? countRows[0].total : 0), rows: (rows || []).map(mapMatrix) };
}

async function findSaveBatch(db, matrixId, idempotencyKey) {
  if (!idempotencyKey) return null;
  const [rows] = await db.execute(
    "SELECT * FROM latest_estimate_save_batches WHERE matrix_id = ? AND idempotency_key = ? LIMIT 1",
    [matrixId, idempotencyKey]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function insertSaveBatch(db, payload) {
  await db.execute(
    `
      INSERT INTO latest_estimate_save_batches (
        matrix_id, idempotency_key, expected_matrix_version, saved_cell_count, status, request_id, created_at
      )
      VALUES (?, ?, ?, ?, 'COMMITTED', ?, NOW())
    `,
    [payload.matrixId, payload.idempotencyKey, payload.expectedMatrixVersion, payload.savedCellCount, payload.requestId || ""]
  );
}

async function findBudgetBaseline(db, matrix, cell) {
  const [rows] = await db.execute(
    `
      SELECT id, coding, item, location, financial_year, loc_fy_current
      FROM budget_submissions
      WHERE id = ?
        AND financial_year = ?
        AND LOWER(coding) = LOWER(?)
        AND location = ?
      LIMIT 1
    `,
    [cell.budgetEntityId, matrix.financialYear, cell.coding, cell.location]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function findCell(db, matrixId, cell) {
  const [rows] = await db.execute(
    `
      SELECT *
      FROM latest_estimate_cells
      WHERE matrix_id = ?
        AND budget_entity_id = ?
        AND LOWER(coding) = LOWER(?)
        AND location = ?
        AND financial_year = ?
      LIMIT 1
    `,
    [matrixId, cell.budgetEntityId, cell.coding, cell.location, cell.financialYear]
  );
  return mapCell(rows && rows[0]);
}

async function upsertCell(db, payload, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  await db.execute(
    `
      INSERT INTO latest_estimate_cells (
        matrix_id, budget_entity_id, coding, location, financial_year, budget_amount,
        latest_estimate_amount, variance_amount, variance_percentage, variance_severity,
        remarks, cell_version, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        budget_amount = VALUES(budget_amount),
        latest_estimate_amount = VALUES(latest_estimate_amount),
        variance_amount = VALUES(variance_amount),
        variance_percentage = VALUES(variance_percentage),
        variance_severity = VALUES(variance_severity),
        remarks = VALUES(remarks),
        cell_version = cell_version + 1,
        updated_by = VALUES(updated_by),
        updated_at = NOW()
    `,
    [
      payload.matrixId,
      payload.budgetEntityId,
      payload.coding,
      payload.location,
      payload.financialYear,
      payload.budgetAmount,
      payload.latestEstimateAmount,
      payload.varianceAmount,
      payload.variancePercentage,
      payload.varianceSeverity,
      payload.remarks || null,
      by,
      by
    ]
  );
  return findCell(db, payload.matrixId, payload);
}

async function incrementMatrixVersion(db, matrixId, expectedVersion, status, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  const [result] = await db.execute(
    `
      UPDATE latest_estimate_matrices
      SET version_number = version_number + 1,
          status = ?,
          updated_by = ?,
          updated_at = NOW()
      WHERE id = ?
        AND version_number = ?
    `,
    [status, by, matrixId, expectedVersion]
  );
  return result.affectedRows || 0;
}

async function insertVarianceLog(db, payload) {
  await db.execute(
    `
      INSERT INTO variance_logs (
        matrix_id, cell_id, budget_amount, latest_estimate_amount, variance_amount,
        variance_percentage, previous_severity, current_severity, threshold_rule,
        remarks, metadata_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      payload.matrixId,
      payload.cellId || null,
      payload.budgetAmount,
      payload.latestEstimateAmount,
      payload.varianceAmount,
      payload.variancePercentage,
      payload.previousSeverity || null,
      payload.currentSeverity,
      payload.thresholdRule || "",
      payload.remarks || null,
      JSON.stringify(payload.metadata || {})
    ]
  );
}

async function listCells(db, matrix, filters) {
  const values = [matrix.id, matrix.financialYear];
  const where = ["b.financial_year = ?"];
  const extra = [];
  if (filters.coding) {
    where.push("LOWER(b.coding) LIKE LOWER(?)");
    values.push(`%${filters.coding}%`);
  }
  if (filters.location) {
    where.push("b.location = ?");
    values.push(filters.location);
  }
  if (filters.severity) {
    extra.push("COALESCE(c.variance_severity, 'ON_BUDGET') = ?");
    values.push(filters.severity);
  }
  if (filters.hasRemarks) extra.push("COALESCE(c.remarks, '') <> ''");
  if (filters.changedOnly) extra.push("c.id IS NOT NULL");
  const whereSql = where.concat(extra).length ? `WHERE ${where.concat(extra).join(" AND ")}` : "";
  const sortMap = {
    coding: "b.coding",
    location: "b.location",
    budgetAmount: "b.loc_fy_current",
    latestEstimateAmount: "COALESCE(c.latest_estimate_amount, b.loc_le, 0)",
    varianceAmount: "COALESCE(c.variance_amount, 0)",
    variancePercentage: "COALESCE(c.variance_percentage, 0)",
    varianceSeverity: "COALESCE(c.variance_severity, 'ON_BUDGET')",
    updatedAt: "COALESCE(c.updated_at, b.updated_at)"
  };
  const orderBy = sortMap[filters.sortField] || "b.coding";
  const countValues = values.slice(1);
  const [countRows] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM budget_submissions b
      LEFT JOIN latest_estimate_cells c
        ON c.matrix_id = ?
       AND c.budget_entity_id = CAST(b.id AS CHAR)
      ${whereSql}
    `,
    values
  );
  const [rows] = await db.execute(
    `
      SELECT
        b.id AS budget_id,
        b.coding,
        b.item,
        b.location,
        b.financial_year,
        b.loc_fy_current,
        c.id AS cell_id,
        c.matrix_id,
        c.budget_entity_id,
        c.budget_amount,
        c.latest_estimate_amount,
        c.variance_amount,
        c.variance_percentage,
        c.variance_severity,
        c.remarks,
        c.cell_version,
        c.updated_at
      FROM budget_submissions b
      LEFT JOIN latest_estimate_cells c
        ON c.matrix_id = ?
       AND c.budget_entity_id = CAST(b.id AS CHAR)
      ${whereSql}
      ORDER BY ${orderBy} ${filters.sortDirection}, b.id ASC
      LIMIT ? OFFSET ?
    `,
    values.concat([filters.pageSize, filters.offset])
  );
  void countValues;
  return { total: Number(countRows && countRows[0] ? countRows[0].total : 0), rows: (rows || []).map(mapCell) };
}

async function getSummary(db, matrixId) {
  const [rows] = await db.execute(
    `
      SELECT
        COUNT(*) AS changed_cells,
        COALESCE(SUM(budget_amount), 0) AS total_budget,
        COALESCE(SUM(latest_estimate_amount), 0) AS total_le,
        COALESCE(SUM(variance_amount), 0) AS total_variance,
        SUM(CASE WHEN variance_amount > 0 THEN 1 ELSE 0 END) AS increased_cells,
        SUM(CASE WHEN variance_amount < 0 THEN 1 ELSE 0 END) AS reduced_cells,
        SUM(CASE WHEN variance_amount = 0 THEN 1 ELSE 0 END) AS on_budget_cells,
        SUM(CASE WHEN variance_severity IN ('MATERIAL', 'ZERO_BASE_INCREASE') THEN 1 ELSE 0 END) AS material_variance_cells,
        SUM(CASE WHEN variance_severity IN ('MATERIAL', 'ZERO_BASE_INCREASE') AND COALESCE(remarks, '') = '' THEN 1 ELSE 0 END) AS missing_remarks,
        SUM(CASE WHEN variance_percentage IS NULL THEN 1 ELSE 0 END) AS invalid_cells
      FROM latest_estimate_cells
      WHERE matrix_id = ?
    `,
    [matrixId]
  );
  const row = rows && rows[0] ? rows[0] : {};
  const totalBudget = Number(row.total_budget || 0);
  const totalVariance = Number(row.total_variance || 0);
  return {
    totalBudget,
    totalLatestEstimate: Number(row.total_le || 0),
    totalVariance,
    variancePercentage: totalBudget ? Math.round((totalVariance / Math.abs(totalBudget)) * 10000) / 100 : null,
    changedCells: Number(row.changed_cells || 0),
    increasedCells: Number(row.increased_cells || 0),
    reducedCells: Number(row.reduced_cells || 0),
    onBudgetCells: Number(row.on_budget_cells || 0),
    materialVarianceCells: Number(row.material_variance_cells || 0),
    missingRemarks: Number(row.missing_remarks || 0),
    invalidCells: Number(row.invalid_cells || 0)
  };
}

module.exports = {
  findBudgetBaseline,
  findCell,
  findMatrixById,
  findSaveBatch,
  getSummary,
  incrementMatrixVersion,
  insertMatrix,
  insertSaveBatch,
  insertVarianceLog,
  listCells,
  listMatrices,
  mapCell,
  mapMatrix,
  updateMatrixWorkflow,
  upsertCell
};
