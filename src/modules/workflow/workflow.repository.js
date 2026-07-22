function mapWorkflow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    workflowType: row.workflow_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    budgetCycleId: Number(row.budget_cycle_id || 0),
    currentState: row.current_state,
    versionNumber: Number(row.version_number || 0),
    isLocked: Boolean(row.is_locked),
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapHistory(row) {
  if (!row) return null;
  let metadata = {};
  try {
    metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
  } catch (_error) {
    metadata = {};
  }
  return {
    id: Number(row.id),
    workflowInstanceId: Number(row.workflow_instance_id),
    fromState: row.from_state || "",
    toState: row.to_state || "",
    action: row.action || "",
    remarks: row.remarks || "",
    reasonCode: row.reason_code || "",
    metadata,
    idempotencyKey: row.idempotency_key || "",
    requestId: row.request_id || "",
    performedBy: row.performed_by || "",
    performedAt: row.performed_at
  };
}

function mapCycle(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    cycleCode: row.cycle_code,
    cycleName: row.cycle_name,
    financialYear: row.financial_year,
    cycleType: row.cycle_type,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findWorkflowById(db, id) {
  const [rows] = await db.execute("SELECT * FROM workflow_instances WHERE id = ? LIMIT 1", [id]);
  return mapWorkflow(rows && rows[0]);
}

async function findWorkflowByEntity(db, { workflowType, entityType, entityId, budgetCycleId = 0 }) {
  const [rows] = await db.execute(
    `
      SELECT *
      FROM workflow_instances
      WHERE workflow_type = ?
        AND entity_type = ?
        AND entity_id = ?
        AND budget_cycle_id = ?
      LIMIT 1
    `,
    [workflowType, entityType, entityId, budgetCycleId || 0]
  );
  return mapWorkflow(rows && rows[0]);
}

async function findWorkflowsByEntities(db, { workflowType, entityType, entityIds }) {
  const ids = (entityIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await db.execute(
    `
      SELECT *
      FROM workflow_instances
      WHERE workflow_type = ?
        AND entity_type = ?
        AND entity_id IN (${placeholders})
    `,
    [workflowType, entityType].concat(ids)
  );
  return (Array.isArray(rows) ? rows : []).map(mapWorkflow);
}

async function createWorkflow(db, payload, actor) {
  const createdBy = actor && actor.displayName ? actor.displayName : "system";
  const [result] = await db.execute(
    `
      INSERT INTO workflow_instances (
        workflow_type,
        entity_type,
        entity_id,
        budget_cycle_id,
        current_state,
        version_number,
        is_locked,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, NOW(), NOW())
    `,
    [
      payload.workflowType,
      payload.entityType,
      payload.entityId,
      payload.budgetCycleId || 0,
      payload.initialState || "DRAFT",
      createdBy,
      createdBy
    ]
  );
  return findWorkflowById(db, result.insertId);
}

async function updateWorkflowState(db, { id, expectedVersion, nextState, isLocked, actor }) {
  const updatedBy = actor && actor.displayName ? actor.displayName : "system";
  const [result] = await db.execute(
    `
      UPDATE workflow_instances
      SET current_state = ?,
          version_number = version_number + 1,
          is_locked = ?,
          updated_by = ?,
          updated_at = NOW()
      WHERE id = ?
        AND version_number = ?
    `,
    [nextState, isLocked ? 1 : 0, updatedBy, id, expectedVersion]
  );
  return result.affectedRows || 0;
}

async function insertHistory(db, payload, actor) {
  const performedBy = actor && actor.displayName ? actor.displayName : "system";
  const [result] = await db.execute(
    `
      INSERT INTO workflow_history (
        workflow_instance_id,
        from_state,
        to_state,
        action,
        remarks,
        reason_code,
        metadata_json,
        idempotency_key,
        request_id,
        performed_by,
        performed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      payload.workflowInstanceId,
      payload.fromState,
      payload.toState,
      payload.action,
      payload.remarks || null,
      payload.reasonCode || null,
      JSON.stringify(payload.metadata || {}),
      payload.idempotencyKey || null,
      payload.requestId || null,
      performedBy
    ]
  );
  return result.insertId;
}

async function findHistoryByIdempotencyKey(db, workflowInstanceId, idempotencyKey) {
  if (!idempotencyKey) return null;
  const [rows] = await db.execute(
    `
      SELECT *
      FROM workflow_history
      WHERE workflow_instance_id = ?
        AND idempotency_key = ?
      LIMIT 1
    `,
    [workflowInstanceId, idempotencyKey]
  );
  return mapHistory(rows && rows[0]);
}

async function listHistory(db, workflowInstanceId) {
  const [rows] = await db.execute(
    `
      SELECT *
      FROM workflow_history
      WHERE workflow_instance_id = ?
      ORDER BY performed_at DESC, id DESC
    `,
    [workflowInstanceId]
  );
  return (Array.isArray(rows) ? rows : []).map(mapHistory);
}

async function findLatestHistoryByWorkflowIds(db, workflowIds) {
  const ids = (workflowIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await db.execute(
    `
      SELECT h.*
      FROM workflow_history h
      INNER JOIN (
        SELECT workflow_instance_id, MAX(id) AS max_id
        FROM workflow_history
        WHERE workflow_instance_id IN (${placeholders})
        GROUP BY workflow_instance_id
      ) latest
        ON latest.workflow_instance_id = h.workflow_instance_id
       AND latest.max_id = h.id
    `,
    ids
  );
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const history = mapHistory(row);
    if (history) map.set(String(history.workflowInstanceId), history);
  });
  return map;
}

async function listApprovalQueue(db, filters) {
  const values = [];
  const where = ["w.workflow_type = 'BUDGET'", "w.entity_type = 'BUDGET_SUBMISSION'"];
  if (filters.state) {
    where.push("w.current_state = ?");
    values.push(filters.state);
  }
  if (filters.financialYear) {
    where.push("b.financial_year = ?");
    values.push(filters.financialYear);
  }
  if (filters.location) {
    where.push("b.location = ?");
    values.push(filters.location);
  }
  if (filters.coding) {
    where.push("LOWER(b.coding) = LOWER(?)");
    values.push(filters.coding);
  }
  if (filters.owner) {
    where.push("b.owner = ?");
    values.push(filters.owner);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [countRows] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM workflow_instances w
      LEFT JOIN budget_submissions b ON b.id = CAST(w.entity_id AS UNSIGNED)
      ${whereSql}
    `,
    values
  );
  const total = Number(countRows && countRows[0] ? countRows[0].total : 0);
  const [rows] = await db.execute(
    `
      SELECT
        w.*,
        b.coding,
        b.item,
        b.location,
        b.financial_year,
        b.owner,
        b.loc_fy_current
      FROM workflow_instances w
      LEFT JOIN budget_submissions b ON b.id = CAST(w.entity_id AS UNSIGNED)
      ${whereSql}
      ORDER BY w.updated_at DESC, w.id DESC
      LIMIT ? OFFSET ?
    `,
    values.concat([filters.pageSize, filters.offset])
  );
  return {
    total,
    rows: (Array.isArray(rows) ? rows : []).map((row) => ({
      workflow: mapWorkflow(row),
      record: {
        id: row.entity_id,
        coding: row.coding || "",
        item: row.item || "",
        location: row.location || "",
        financialYear: row.financial_year || "",
        owner: row.owner || "",
        locFyCurrent: Number(row.loc_fy_current || 0)
      }
    }))
  };
}

async function getWorkflowSummary(db, filters) {
  const values = [];
  const where = [];
  if (filters.financialYear) {
    where.push("b.financial_year = ?");
    values.push(filters.financialYear);
  }
  if (filters.location) {
    where.push("b.location = ?");
    values.push(filters.location);
  }
  if (filters.owner) {
    where.push("b.owner = ?");
    values.push(filters.owner);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await db.execute(
    `
      SELECT
        COALESCE(w.current_state, 'NOT_STARTED') AS state,
        COUNT(*) AS count_value
      FROM budget_submissions b
      LEFT JOIN workflow_instances w
        ON w.workflow_type = 'BUDGET'
       AND w.entity_type = 'BUDGET_SUBMISSION'
       AND w.entity_id = CAST(b.id AS CHAR)
       AND w.budget_cycle_id = 0
      ${whereSql}
      GROUP BY COALESCE(w.current_state, 'NOT_STARTED')
    `,
    values
  );
  const [actionRows] = await db.execute(
    `
      SELECT h.action, COUNT(*) AS count_value
      FROM workflow_history h
      INNER JOIN workflow_instances w ON w.id = h.workflow_instance_id
      LEFT JOIN budget_submissions b ON b.id = CAST(w.entity_id AS UNSIGNED)
      ${whereSql}
      ${whereSql ? "AND" : "WHERE"} h.action IN ('RETURN_TO_DRAFT', 'REJECT')
      GROUP BY h.action
    `,
    values
  );
  return {
    states: (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
      acc[row.state] = Number(row.count_value || 0);
      return acc;
    }, {}),
    actions: (Array.isArray(actionRows) ? actionRows : []).reduce((acc, row) => {
      acc[row.action] = Number(row.count_value || 0);
      return acc;
    }, {})
  };
}

async function listBudgetCycles(db) {
  const [rows] = await db.query("SELECT * FROM budget_cycles ORDER BY financial_year DESC, id DESC");
  return (Array.isArray(rows) ? rows : []).map(mapCycle);
}

async function createBudgetCycle(db, payload) {
  await db.execute(
    `
      INSERT INTO budget_cycles (
        cycle_code,
        cycle_name,
        financial_year,
        cycle_type,
        status,
        starts_at,
        ends_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      payload.cycleCode,
      payload.cycleName,
      payload.financialYear,
      payload.cycleType,
      payload.status,
      payload.startsAt,
      payload.endsAt
    ]
  );
  const [rows] = await db.execute("SELECT * FROM budget_cycles WHERE cycle_code = ? LIMIT 1", [payload.cycleCode]);
  return mapCycle(rows && rows[0]);
}

module.exports = {
  createBudgetCycle,
  createWorkflow,
  findHistoryByIdempotencyKey,
  findLatestHistoryByWorkflowIds,
  findWorkflowByEntity,
  findWorkflowById,
  findWorkflowsByEntities,
  getWorkflowSummary,
  insertHistory,
  listApprovalQueue,
  listBudgetCycles,
  listHistory,
  mapWorkflow,
  updateWorkflowState
};
