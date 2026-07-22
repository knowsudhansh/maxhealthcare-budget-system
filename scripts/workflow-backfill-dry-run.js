const { loadEnvironment } = require("../src/config/environment");
const { loadDbSecret } = require("../src/config/secrets");
const { initializePool, closePool, getPool } = require("../src/db/pool");
const { ENTITY_TYPES, WORKFLOW_TYPES } = require("../src/modules/workflow/workflow.constants");
const { createWorkflowInstance } = require("../src/modules/workflow/workflow.service");

function shouldApply() {
  return process.argv.includes("--apply") && process.env.WORKFLOW_BACKFILL_APPLY === "true";
}

async function main() {
  const apply = shouldApply();
  const config = loadEnvironment(process.env);
  const secret = await loadDbSecret(config);
  await initializePool(config, secret);
  const pool = getPool();

  const [rows] = await pool.query(`
    SELECT b.id
    FROM budget_submissions b
    LEFT JOIN workflow_instances w
      ON w.workflow_type = 'BUDGET'
     AND w.entity_type = 'BUDGET_SUBMISSION'
     AND w.entity_id = CAST(b.id AS CHAR)
     AND w.budget_cycle_id = 0
    WHERE w.id IS NULL
    ORDER BY b.id ASC
  `);

  const ids = (Array.isArray(rows) ? rows : []).map((row) => String(row.id));
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      eligibleBudgetSubmissionRows: ids.length
    })
  );

  if (!apply) {
    await closePool();
    return;
  }

  let created = 0;
  for (const id of ids) {
    const result = await createWorkflowInstance(
      {
        workflowType: WORKFLOW_TYPES.BUDGET,
        entityType: ENTITY_TYPES.BUDGET_SUBMISSION,
        entityId: id,
        budgetCycleId: 0,
        initialState: "DRAFT",
        idempotencyKey: `workflow-backfill-budget-${id}`
      },
      {
        requestId: "workflow-backfill",
        actor: { actorType: "SYSTEM", actorId: null, displayName: "workflow-backfill" }
      }
    );
    if (result.created) created += 1;
  }

  console.log(JSON.stringify({ mode: "apply", created }));
  await closePool();
}

main().catch(async (error) => {
  console.error(error && error.code ? error.code : "WORKFLOW_BACKFILL_FAILED");
  await closePool();
  process.exit(1);
});
