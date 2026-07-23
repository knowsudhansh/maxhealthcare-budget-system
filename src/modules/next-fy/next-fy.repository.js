function mapBudget(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    budgetCode: row.budget_code || "",
    budgetName: row.budget_name || "",
    budgetCycleId: Number(row.budget_cycle_id || 0),
    sourceStrategy: row.source_strategy || "",
    sourceEntityId: row.source_entity_id || "",
    sourceVersion: Number(row.source_version || 0),
    sourceFinancialYear: row.source_financial_year || "",
    targetFinancialYear: row.target_financial_year || "",
    workflowInstanceId: row.workflow_instance_id ? Number(row.workflow_instance_id) : null,
    status: row.status || "",
    versionNumber: Number(row.version_number || 0),
    totalSourceAmount: Number(row.total_source_amount || 0),
    totalGeneratedAmount: Number(row.total_generated_amount || 0),
    totalManualAdjustment: Number(row.total_manual_adjustment || 0),
    totalFinalAmount: Number(row.total_final_amount || 0),
    generationRemarks: row.generation_remarks || "",
    generatedAt: row.generated_at || "",
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapLine(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    nextFyBudgetId: Number(row.next_fy_budget_id),
    sourceType: row.source_type || "",
    sourceEntityId: row.source_entity_id || "",
    sourceLineId: row.source_line_id || "",
    sourceVersion: Number(row.source_version || 0),
    sourceFinancialYear: row.source_financial_year || "",
    targetFinancialYear: row.target_financial_year || "",
    coding: row.coding || "",
    item: row.item || "",
    description: row.description || "",
    category: row.category || "",
    location: row.location || "",
    owner: row.owner || "",
    owner1: row.owner1 || "",
    sourceAmount: Number(row.source_amount || 0),
    growthPercentage: Number(row.growth_percentage || 0),
    growthAmount: Number(row.growth_amount || 0),
    fixedAdjustmentAmount: Number(row.fixed_adjustment_amount || 0),
    generatedAmount: Number(row.generated_amount || 0),
    manualAdjustmentAmount: Number(row.manual_adjustment_amount || 0),
    finalBudgetAmount: Number(row.final_budget_amount || 0),
    adjustmentReason: row.adjustment_reason || "",
    assumptionRuleId: row.assumption_rule_id ? Number(row.assumption_rule_id) : null,
    lineVersion: Number(row.line_version || 0),
    validationStatus: row.validation_status || "",
    updatedAt: row.updated_at || ""
  };
}

function mapRule(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    nextFyBudgetId: Number(row.next_fy_budget_id || 0),
    ruleName: row.rule_name || "",
    ruleType: row.rule_type || "",
    priority: Number(row.priority || 0),
    location: row.location || "",
    coding: row.coding || "",
    category: row.category || "",
    owner: row.owner || "",
    growthPercentage: Number(row.growth_percentage || 0),
    fixedAdjustmentAmount: Number(row.fixed_adjustment_amount || 0),
    minimumAmount: row.minimum_amount === null || row.minimum_amount === undefined ? null : Number(row.minimum_amount),
    maximumAmount: row.maximum_amount === null || row.maximum_amount === undefined ? null : Number(row.maximum_amount),
    isActive: Boolean(row.is_active),
    remarks: row.remarks || ""
  };
}

async function insertBudget(db, payload, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  const [result] = await db.execute(
    `
      INSERT INTO next_fy_budgets (
        budget_code, budget_name, budget_cycle_id, source_strategy, source_entity_id,
        source_version, source_financial_year, target_financial_year, workflow_instance_id,
        status, version_number, generation_remarks, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'GENERATED', 1, ?, ?, ?, NOW(), NOW())
    `,
    [
      payload.budgetCode,
      payload.budgetName,
      payload.budgetCycleId || 0,
      payload.sourceStrategy,
      payload.sourceEntityId || null,
      payload.sourceVersion || 1,
      payload.sourceFinancialYear,
      payload.targetFinancialYear,
      payload.generationRemarks || null,
      by,
      by
    ]
  );
  return findBudgetById(db, result.insertId);
}

async function updateBudgetWorkflow(db, budgetId, workflowId) {
  await db.execute("UPDATE next_fy_budgets SET workflow_instance_id = ?, updated_at = NOW() WHERE id = ?", [workflowId, budgetId]);
  return findBudgetById(db, budgetId);
}

async function findBudgetById(db, id) {
  const [rows] = await db.execute("SELECT * FROM next_fy_budgets WHERE id = ? LIMIT 1", [id]);
  return mapBudget(rows && rows[0]);
}

async function listBudgets(db, filters) {
  const values = [];
  const where = [];
  if (filters.targetFinancialYear) {
    where.push("target_financial_year = ?");
    values.push(filters.targetFinancialYear);
  }
  if (filters.status) {
    where.push("status = ?");
    values.push(filters.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM next_fy_budgets ${whereSql}`, values);
  const [rows] = await db.execute(
    `
      SELECT *
      FROM next_fy_budgets
      ${whereSql}
      ORDER BY updated_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    values.concat([filters.pageSize, filters.offset])
  );
  return { total: Number(countRows && countRows[0] ? countRows[0].total : 0), rows: (rows || []).map(mapBudget) };
}

async function insertOrUpdateRule(db, budgetId, payload, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  if (payload.id) {
    await db.execute(
      `
        UPDATE planning_assumption_rules
        SET rule_name = ?, rule_type = ?, priority = ?, location = ?, coding = ?,
            category = ?, owner = ?, growth_percentage = ?, fixed_adjustment_amount = ?,
            minimum_amount = ?, maximum_amount = ?, is_active = ?, remarks = ?,
            updated_by = ?, updated_at = NOW()
        WHERE id = ? AND next_fy_budget_id = ?
      `,
      [
        payload.ruleName,
        payload.ruleType,
        payload.priority,
        payload.location || null,
        payload.coding || null,
        payload.category || null,
        payload.owner || null,
        payload.growthPercentage,
        payload.fixedAdjustmentAmount,
        payload.minimumAmount,
        payload.maximumAmount,
        payload.isActive ? 1 : 0,
        payload.remarks || null,
        by,
        payload.id,
        budgetId
      ]
    );
    return findRuleById(db, budgetId, payload.id);
  }
  const [result] = await db.execute(
    `
      INSERT INTO planning_assumption_rules (
        next_fy_budget_id, rule_name, rule_type, priority, location, coding,
        category, owner, growth_percentage, fixed_adjustment_amount, minimum_amount,
        maximum_amount, is_active, remarks, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      budgetId,
      payload.ruleName,
      payload.ruleType,
      payload.priority,
      payload.location || null,
      payload.coding || null,
      payload.category || null,
      payload.owner || null,
      payload.growthPercentage,
      payload.fixedAdjustmentAmount,
      payload.minimumAmount,
      payload.maximumAmount,
      payload.isActive ? 1 : 0,
      payload.remarks || null,
      by,
      by
    ]
  );
  return findRuleById(db, budgetId, result.insertId);
}

async function findRuleById(db, budgetId, id) {
  const [rows] = await db.execute("SELECT * FROM planning_assumption_rules WHERE next_fy_budget_id = ? AND id = ? LIMIT 1", [budgetId, id]);
  return mapRule(rows && rows[0]);
}

async function listRules(db, budgetId) {
  const [rows] = await db.execute(
    "SELECT * FROM planning_assumption_rules WHERE next_fy_budget_id = ? ORDER BY priority ASC, id ASC",
    [budgetId]
  );
  return (rows || []).map(mapRule);
}

async function findGenerationBatch(db, budgetId, idempotencyKey) {
  if (!idempotencyKey) return null;
  const [rows] = await db.execute(
    "SELECT * FROM next_fy_generation_batches WHERE next_fy_budget_id = ? AND idempotency_key = ? LIMIT 1",
    [budgetId, idempotencyKey]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function insertGenerationBatch(db, payload) {
  await db.execute(
    `
      INSERT INTO next_fy_generation_batches (
        next_fy_budget_id, idempotency_key, expected_version, source_record_count,
        generated_line_count, total_source_amount, total_generated_amount, status,
        request_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      payload.nextFyBudgetId,
      payload.idempotencyKey,
      payload.expectedVersion,
      payload.sourceRecordCount,
      payload.generatedLineCount,
      payload.totalSourceAmount,
      payload.totalGeneratedAmount,
      payload.status,
      payload.requestId || ""
    ]
  );
}

async function loadApprovedLeSourceLines(db, matrixId) {
  const [rows] = await db.execute(
    `
      SELECT
        c.id AS source_line_id,
        m.id AS source_entity_id,
        m.version_number AS source_version,
        m.financial_year AS source_financial_year,
        b.coding,
        b.item,
        b.sub_category_mapped,
        b.category_it,
        b.location,
        b.owner,
        b.owner1,
        c.latest_estimate_amount AS source_amount
      FROM latest_estimate_matrices m
      INNER JOIN latest_estimate_cells c ON c.matrix_id = m.id
      LEFT JOIN budget_submissions b ON b.id = CAST(c.budget_entity_id AS UNSIGNED)
      WHERE m.id = ?
        AND m.status = 'APPROVED'
    `,
    [matrixId]
  );
  return (rows || []).map((row) => ({
    sourceType: "APPROVED_LE",
    sourceEntityId: String(row.source_entity_id || matrixId),
    sourceLineId: String(row.source_line_id || ""),
    sourceVersion: Number(row.source_version || 1),
    sourceFinancialYear: row.source_financial_year || "",
    coding: row.coding || "",
    item: row.item || "",
    description: row.sub_category_mapped || "",
    category: row.category_it || "",
    location: row.location || "",
    owner: row.owner || "",
    owner1: row.owner1 || "",
    sourceAmount: Number(row.source_amount || 0)
  }));
}

async function loadEligibleBudgetSourceLines(db, financialYear) {
  const [rows] = await db.execute(
    `
      SELECT
        b.id,
        b.coding,
        b.item,
        b.sub_category_mapped,
        b.category_it,
        b.location,
        b.owner,
        b.owner1,
        b.financial_year,
        b.loc_fy_current,
        COALESCE(w.current_state, 'LEGACY') AS workflow_state,
        COALESCE(w.version_number, 1) AS workflow_version
      FROM budget_submissions b
      LEFT JOIN workflow_instances w
        ON w.workflow_type = 'BUDGET'
       AND w.entity_type = 'BUDGET_SUBMISSION'
       AND w.entity_id = CAST(b.id AS CHAR)
       AND w.budget_cycle_id = 0
      WHERE b.financial_year = ?
        AND COALESCE(w.current_state, 'LEGACY') IN ('APPROVED', 'LOCKED')
    `,
    [financialYear]
  );
  return (rows || []).map((row) => ({
    sourceType: "CURRENT_BUDGET",
    sourceEntityId: String(row.id || ""),
    sourceLineId: String(row.id || ""),
    sourceVersion: Number(row.workflow_version || 1),
    sourceFinancialYear: row.financial_year || financialYear,
    coding: row.coding || "",
    item: row.item || "",
    description: row.sub_category_mapped || "",
    category: row.category_it || "",
    location: row.location || "",
    owner: row.owner || "",
    owner1: row.owner1 || "",
    sourceAmount: Number(row.loc_fy_current || 0)
  }));
}

async function replaceGeneratedLines(db, budgetId, lines, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  await db.execute("DELETE FROM next_fy_budget_lines WHERE next_fy_budget_id = ?", [budgetId]);
  for (const line of lines) {
    await db.execute(
      `
        INSERT INTO next_fy_budget_lines (
          next_fy_budget_id, source_type, source_entity_id, source_line_id, source_version,
          source_financial_year, target_financial_year, coding, item, description, category,
          location, owner, owner1, source_amount, growth_percentage, growth_amount,
          fixed_adjustment_amount, generated_amount, manual_adjustment_amount, final_budget_amount,
          adjustment_reason, assumption_rule_id, line_version, validation_status,
          created_by, updated_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NOW(), NOW())
      `,
      [
        budgetId,
        line.sourceType,
        line.sourceEntityId,
        line.sourceLineId,
        line.sourceVersion,
        line.sourceFinancialYear,
        line.targetFinancialYear,
        line.coding,
        line.item,
        line.description,
        line.category,
        line.location,
        line.owner,
        line.owner1,
        line.sourceAmount,
        line.growthPercentage,
        line.growthAmount,
        line.fixedAdjustmentAmount,
        line.generatedAmount,
        line.manualAdjustmentAmount,
        line.finalBudgetAmount,
        line.adjustmentReason || null,
        line.assumptionRuleId || null,
        line.validationStatus || "VALID",
        by,
        by
      ]
    );
  }
}

async function incrementBudgetVersionAndTotals(db, budgetId, expectedVersion, totals, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  const [result] = await db.execute(
    `
      UPDATE next_fy_budgets
      SET version_number = version_number + 1,
          total_source_amount = ?,
          total_generated_amount = ?,
          total_manual_adjustment = ?,
          total_final_amount = ?,
          generated_at = COALESCE(generated_at, NOW()),
          updated_by = ?,
          updated_at = NOW()
      WHERE id = ?
        AND version_number = ?
    `,
    [
      totals.totalSourceAmount,
      totals.totalGeneratedAmount,
      totals.totalManualAdjustment,
      totals.totalFinalAmount,
      by,
      budgetId,
      expectedVersion
    ]
  );
  return result.affectedRows || 0;
}

async function listLines(db, budgetId, filters) {
  const values = [budgetId];
  const where = ["next_fy_budget_id = ?"];
  if (filters.coding) {
    where.push("LOWER(coding) LIKE LOWER(?)");
    values.push(`%${filters.coding}%`);
  }
  if (filters.location) {
    where.push("location = ?");
    values.push(filters.location);
  }
  if (filters.category) {
    where.push("category = ?");
    values.push(filters.category);
  }
  if (filters.owner) {
    where.push("owner = ?");
    values.push(filters.owner);
  }
  if (filters.sourceType) {
    where.push("source_type = ?");
    values.push(filters.sourceType);
  }
  const sortMap = {
    coding: "coding",
    location: "location",
    owner: "owner",
    owner1: "owner1",
    category: "category",
    sourceAmount: "source_amount",
    finalBudgetAmount: "final_budget_amount",
    updatedAt: "updated_at"
  };
  const orderBy = sortMap[filters.sortField] || "coding";
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM next_fy_budget_lines ${whereSql}`, values);
  const [rows] = await db.execute(
    `
      SELECT *
      FROM next_fy_budget_lines
      ${whereSql}
      ORDER BY ${orderBy} ${filters.sortDirection}, id ASC
      LIMIT ? OFFSET ?
    `,
    values.concat([filters.pageSize, filters.offset])
  );
  return { total: Number(countRows && countRows[0] ? countRows[0].total : 0), rows: (rows || []).map(mapLine) };
}

async function findLineById(db, budgetId, lineId) {
  const [rows] = await db.execute("SELECT * FROM next_fy_budget_lines WHERE next_fy_budget_id = ? AND id = ? LIMIT 1", [budgetId, lineId]);
  return mapLine(rows && rows[0]);
}

async function updateLineAdjustment(db, budgetId, line, nextValues, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  const [result] = await db.execute(
    `
      UPDATE next_fy_budget_lines
      SET manual_adjustment_amount = ?,
          final_budget_amount = ?,
          adjustment_reason = ?,
          line_version = line_version + 1,
          validation_status = ?,
          updated_by = ?,
          updated_at = NOW()
      WHERE id = ?
        AND next_fy_budget_id = ?
        AND line_version = ?
    `,
    [
      nextValues.manualAdjustmentAmount,
      nextValues.finalBudgetAmount,
      nextValues.adjustmentReason || null,
      nextValues.validationStatus || "VALID",
      by,
      line.id,
      budgetId,
      line.lineVersion
    ]
  );
  return result.affectedRows || 0;
}

async function insertAdjustmentHistory(db, payload, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  await db.execute(
    `
      INSERT INTO next_fy_adjustment_history (
        next_fy_budget_id, line_id, previous_manual_adjustment, new_manual_adjustment,
        previous_final_amount, new_final_amount, difference_amount, adjustment_type,
        adjustment_reason, request_id, performed_by, performed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      payload.nextFyBudgetId,
      payload.lineId,
      payload.previousManualAdjustment,
      payload.newManualAdjustment,
      payload.previousFinalAmount,
      payload.newFinalAmount,
      payload.differenceAmount,
      payload.adjustmentType,
      payload.adjustmentReason || null,
      payload.requestId || "",
      by
    ]
  );
}

async function getSummary(db, budgetId) {
  const [rows] = await db.execute(
    `
      SELECT
        COUNT(*) AS total_lines,
        COALESCE(SUM(source_amount), 0) AS total_source,
        COALESCE(SUM(generated_amount), 0) AS total_generated,
        COALESCE(SUM(manual_adjustment_amount), 0) AS total_manual_adjustment,
        COALESCE(SUM(final_budget_amount), 0) AS total_final,
        SUM(CASE WHEN final_budget_amount > source_amount THEN 1 ELSE 0 END) AS lines_increased,
        SUM(CASE WHEN final_budget_amount < source_amount THEN 1 ELSE 0 END) AS lines_decreased,
        SUM(CASE WHEN final_budget_amount = source_amount THEN 1 ELSE 0 END) AS unchanged_lines,
        SUM(CASE WHEN source_amount = 0 AND final_budget_amount <> 0 THEN 1 ELSE 0 END) AS new_zero_base_lines,
        SUM(CASE WHEN manual_adjustment_amount <> 0 THEN 1 ELSE 0 END) AS adjusted_lines,
        SUM(CASE WHEN validation_status = 'REASON_REQUIRED' THEN 1 ELSE 0 END) AS lines_missing_required_reasons,
        SUM(CASE WHEN validation_status = 'INVALID' THEN 1 ELSE 0 END) AS invalid_lines
      FROM next_fy_budget_lines
      WHERE next_fy_budget_id = ?
    `,
    [budgetId]
  );
  const row = rows && rows[0] ? rows[0] : {};
  return {
    totalLines: Number(row.total_lines || 0),
    totalSourceAmount: Number(row.total_source || 0),
    totalGeneratedAmount: Number(row.total_generated || 0),
    totalManualAdjustment: Number(row.total_manual_adjustment || 0),
    totalFinalAmount: Number(row.total_final || 0),
    linesIncreased: Number(row.lines_increased || 0),
    linesDecreased: Number(row.lines_decreased || 0),
    unchangedLines: Number(row.unchanged_lines || 0),
    newZeroBaseLines: Number(row.new_zero_base_lines || 0),
    adjustedLines: Number(row.adjusted_lines || 0),
    linesMissingRequiredReasons: Number(row.lines_missing_required_reasons || 0),
    invalidLines: Number(row.invalid_lines || 0)
  };
}

module.exports = {
  findBudgetById,
  findGenerationBatch,
  findLineById,
  getSummary,
  incrementBudgetVersionAndTotals,
  insertAdjustmentHistory,
  insertBudget,
  insertGenerationBatch,
  insertOrUpdateRule,
  listBudgets,
  listLines,
  listRules,
  loadApprovedLeSourceLines,
  loadEligibleBudgetSourceLines,
  mapBudget,
  mapLine,
  mapRule,
  replaceGeneratedLines,
  updateBudgetWorkflow,
  updateLineAdjustment
};
