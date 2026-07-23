function mapRequest(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    transferNumber: row.transfer_number || "",
    transferType: row.transfer_type || "",
    reason: row.reason || "",
    priority: row.priority || "",
    requestedBy: row.requested_by || "",
    requestedDate: row.requested_date || "",
    workflowInstanceId: row.workflow_instance_id ? Number(row.workflow_instance_id) : null,
    status: row.status || "",
    versionNumber: Number(row.version_number || 0),
    financialYear: row.financial_year || "",
    remarks: row.remarks || "",
    totalTransferAmount: Number(row.total_transfer_amount || 0),
    postedAt: row.posted_at || "",
    reversedAt: row.reversed_at || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapLine(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    transferRequestId: Number(row.transfer_request_id),
    sourceBudgetLineId: Number(row.source_budget_line_id),
    destinationBudgetLineId: Number(row.destination_budget_line_id),
    sourceCoding: row.source_coding || "",
    destinationCoding: row.destination_coding || "",
    sourceDepartment: row.source_department || "",
    destinationDepartment: row.destination_department || "",
    sourceLocation: row.source_location || "",
    destinationLocation: row.destination_location || "",
    sourceOwner: row.source_owner || "",
    destinationOwner: row.destination_owner || "",
    sourceCategory: row.source_category || "",
    destinationCategory: row.destination_category || "",
    transferAmount: Number(row.transfer_amount || 0),
    currency: row.currency || "INR",
    transferType: row.transfer_type || "",
    remarks: row.remarks || "",
    lineVersion: Number(row.line_version || 0)
  };
}

function mapPosting(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    transferRequestId: Number(row.transfer_request_id),
    transferLineId: Number(row.transfer_line_id),
    postingType: row.posting_type || "",
    budgetLineId: Number(row.budget_line_id),
    amount: Number(row.amount || 0),
    currency: row.currency || "INR",
    financialYear: row.financial_year || "",
    postingStatus: row.posting_status || "",
    reversalOfPostingId: row.reversal_of_posting_id ? Number(row.reversal_of_posting_id) : null
  };
}

async function insertTransferRequest(db, payload, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  const total = payload.lines.reduce((sum, line) => sum + Number(line.transferAmount || 0), 0);
  const [result] = await db.execute(
    `
      INSERT INTO budget_transfer_requests (
        transfer_number, transfer_type, reason, priority, requested_by, requested_date,
        workflow_instance_id, status, version_number, financial_year, remarks,
        total_transfer_amount, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, NOW(), NULL, 'DRAFT', 1, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [payload.transferNumber, payload.transferType, payload.reason, payload.priority, by, payload.financialYear, payload.remarks || null, total, by, by]
  );
  return findTransferById(db, result.insertId);
}

async function updateTransferWorkflow(db, transferId, workflowId) {
  await db.execute("UPDATE budget_transfer_requests SET workflow_instance_id = ?, updated_at = NOW() WHERE id = ?", [workflowId, transferId]);
  return findTransferById(db, transferId);
}

async function insertTransferLine(db, transferId, line, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  await db.execute(
    `
      INSERT INTO budget_transfer_lines (
        transfer_request_id, source_budget_line_id, destination_budget_line_id,
        source_coding, destination_coding, source_department, destination_department,
        source_location, destination_location, source_owner, destination_owner,
        source_category, destination_category, transfer_amount, currency, transfer_type,
        remarks, line_version, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NOW(), NOW())
    `,
    [
      transferId,
      line.sourceBudgetLineId,
      line.destinationBudgetLineId,
      line.sourceCoding || null,
      line.destinationCoding || null,
      line.sourceDepartment || null,
      line.destinationDepartment || null,
      line.sourceLocation || null,
      line.destinationLocation || null,
      line.sourceOwner || null,
      line.destinationOwner || null,
      line.sourceCategory || null,
      line.destinationCategory || null,
      line.transferAmount,
      line.currency || "INR",
      line.transferType,
      line.remarks || null,
      by,
      by
    ]
  );
}

async function findTransferById(db, id) {
  const [rows] = await db.execute("SELECT * FROM budget_transfer_requests WHERE id = ? LIMIT 1", [id]);
  return mapRequest(rows && rows[0]);
}

async function findTransferByNumber(db, transferNumber) {
  if (!transferNumber) return null;
  const [rows] = await db.execute("SELECT * FROM budget_transfer_requests WHERE transfer_number = ? LIMIT 1", [transferNumber]);
  return mapRequest(rows && rows[0]);
}

async function listTransfers(db, filters) {
  const values = [];
  const where = [];
  if (filters.status) {
    where.push("status = ?");
    values.push(filters.status);
  }
  if (filters.transferType) {
    where.push("transfer_type = ?");
    values.push(filters.transferType);
  }
  if (filters.financialYear) {
    where.push("financial_year = ?");
    values.push(filters.financialYear);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM budget_transfer_requests ${whereSql}`, values);
  const [rows] = await db.execute(
    `
      SELECT *
      FROM budget_transfer_requests
      ${whereSql}
      ORDER BY updated_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    values.concat([filters.pageSize, filters.offset])
  );
  return { total: Number(countRows && countRows[0] ? countRows[0].total : 0), rows: (rows || []).map(mapRequest) };
}

async function listTransferLines(db, transferId) {
  const [rows] = await db.execute("SELECT * FROM budget_transfer_lines WHERE transfer_request_id = ? ORDER BY id ASC", [transferId]);
  return (rows || []).map(mapLine);
}

async function findApprovedBudgetLine(db, id) {
  const [rows] = await db.execute(
    `
      SELECT
        b.id, b.coding, b.item, b.category_it, b.owner, b.owner1, b.location,
        b.cost_center_department, b.financial_year, b.loc_fy_current,
        COALESCE(w.current_state, 'LEGACY') AS workflow_state
      FROM budget_submissions b
      LEFT JOIN workflow_instances w
        ON w.workflow_type = 'BUDGET'
       AND w.entity_type = 'BUDGET_SUBMISSION'
       AND w.entity_id = CAST(b.id AS CHAR)
       AND w.budget_cycle_id = 0
      WHERE b.id = ?
      LIMIT 1
    `,
    [id]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function getPostingTotals(db, budgetLineId, financialYear) {
  const [rows] = await db.execute(
    `
      SELECT
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS incoming,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS outgoing
      FROM budget_transfer_postings
      WHERE budget_line_id = ?
        AND financial_year = ?
        AND posting_status = 'POSTED'
    `,
    [budgetLineId, financialYear]
  );
  const row = rows && rows[0] ? rows[0] : {};
  return { incomingTransfers: Number(row.incoming || 0), outgoingTransfers: Number(row.outgoing || 0) };
}

async function insertPosting(db, posting, actor, requestId) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  const [result] = await db.execute(
    `
      INSERT INTO budget_transfer_postings (
        transfer_request_id, transfer_line_id, posting_type, budget_line_id,
        amount, currency, financial_year, posting_status, reversal_of_posting_id,
        request_id, posted_by, posted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, ?, NOW())
    `,
    [
      posting.transferRequestId,
      posting.transferLineId,
      posting.postingType,
      posting.budgetLineId,
      posting.amount,
      posting.currency || "INR",
      posting.financialYear,
      posting.reversalOfPostingId || null,
      requestId || "",
      by
    ]
  );
  return result.insertId;
}

async function listPostings(db, transferId) {
  const [rows] = await db.execute("SELECT * FROM budget_transfer_postings WHERE transfer_request_id = ? ORDER BY id ASC", [transferId]);
  return (rows || []).map(mapPosting);
}

async function upsertWorkingBalance(db, balance, transferId) {
  await db.execute(
    `
      INSERT INTO working_budget_balances (
        budget_line_id, financial_year, original_budget, incoming_transfers,
        outgoing_transfers, working_budget, available_balance, transferred_amount,
        remaining_budget, last_transfer_request_id, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        original_budget = VALUES(original_budget),
        incoming_transfers = VALUES(incoming_transfers),
        outgoing_transfers = VALUES(outgoing_transfers),
        working_budget = VALUES(working_budget),
        available_balance = VALUES(available_balance),
        transferred_amount = VALUES(transferred_amount),
        remaining_budget = VALUES(remaining_budget),
        last_transfer_request_id = VALUES(last_transfer_request_id),
        updated_at = NOW()
    `,
    [
      balance.budgetLineId,
      balance.financialYear,
      balance.originalBudget,
      balance.incomingTransfers,
      balance.outgoingTransfers,
      balance.workingBudget,
      balance.availableBalance,
      balance.transferredAmount,
      balance.remainingBudget,
      transferId || null
    ]
  );
}

async function updateTransferStatus(db, transferId, expectedVersion, status, actor, fields = {}) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  const postedSql = fields.postedAt ? ", posted_at = NOW()" : "";
  const reversedSql = fields.reversedAt ? ", reversed_at = NOW()" : "";
  const [result] = await db.execute(
    `
      UPDATE budget_transfer_requests
      SET status = ?,
          version_number = version_number + 1,
          updated_by = ?,
          updated_at = NOW()
          ${postedSql}
          ${reversedSql}
      WHERE id = ?
        AND version_number = ?
    `,
    [status, by, transferId, expectedVersion]
  );
  return result.affectedRows || 0;
}

async function updateTransferStatusUnchecked(db, transferId, status, actor, fields = {}) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  const postedSql = fields.postedAt ? ", posted_at = NOW()" : "";
  const reversedSql = fields.reversedAt ? ", reversed_at = NOW()" : "";
  await db.execute(
    `
      UPDATE budget_transfer_requests
      SET status = ?,
          updated_by = ?,
          updated_at = NOW()
          ${postedSql}
          ${reversedSql}
      WHERE id = ?
    `,
    [status, by, transferId]
  );
  return findTransferById(db, transferId);
}

async function insertTransferHistory(db, payload, actor) {
  const by = actor && actor.displayName ? actor.displayName : "system";
  await db.execute(
    `
      INSERT INTO budget_transfer_history (
        transfer_request_id, from_status, to_status, action, remarks,
        metadata_json, request_id, performed_by, performed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      payload.transferRequestId,
      payload.fromStatus || null,
      payload.toStatus || null,
      payload.action,
      payload.remarks || null,
      JSON.stringify(payload.metadata || {}),
      payload.requestId || "",
      by
    ]
  );
}

async function listTransferHistory(db, transferId) {
  const [rows] = await db.execute(
    "SELECT * FROM budget_transfer_history WHERE transfer_request_id = ? ORDER BY performed_at DESC, id DESC",
    [transferId]
  );
  return rows || [];
}

async function getDashboard(db) {
  const [rows] = await db.execute(
    `
      SELECT
        COUNT(*) AS total_transfers,
        SUM(CASE WHEN status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED') THEN 1 ELSE 0 END) AS pending_approval,
        SUM(CASE WHEN status = 'POSTED' THEN 1 ELSE 0 END) AS posted_transfers,
        SUM(CASE WHEN status = 'REVERSED' THEN 1 ELSE 0 END) AS reversed_transfers,
        COALESCE(SUM(total_transfer_amount), 0) AS transferred_amount
      FROM budget_transfer_requests
    `
  );
  return rows && rows[0] ? rows[0] : {};
}

async function listWorkingBudget(db, filters) {
  const values = [];
  const where = [];
  if (filters.financialYear) {
    where.push("w.financial_year = ?");
    values.push(filters.financialYear);
  }
  if (filters.location) {
    where.push("b.location = ?");
    values.push(filters.location);
  }
  if (filters.coding) {
    where.push("LOWER(b.coding) LIKE LOWER(?)");
    values.push(`%${filters.coding}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await db.execute(
    `
      SELECT w.*, b.coding, b.item, b.location, b.owner, b.category_it
      FROM working_budget_balances w
      LEFT JOIN budget_submissions b ON b.id = w.budget_line_id
      ${whereSql}
      ORDER BY w.updated_at DESC
      LIMIT ? OFFSET ?
    `,
    values.concat([filters.pageSize, filters.offset])
  );
  return rows || [];
}

module.exports = {
  findApprovedBudgetLine,
  findTransferById,
  findTransferByNumber,
  getDashboard,
  getPostingTotals,
  insertPosting,
  insertTransferHistory,
  insertTransferLine,
  insertTransferRequest,
  listPostings,
  listTransferHistory,
  listTransferLines,
  listTransfers,
  listWorkingBudget,
  mapLine,
  mapPosting,
  mapRequest,
  updateTransferStatus,
  updateTransferStatusUnchecked,
  updateTransferWorkflow,
  upsertWorkingBalance
};
