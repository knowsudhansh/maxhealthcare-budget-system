const ROLE_CODES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  FINANCE_ADMIN: "FINANCE_ADMIN",
  BUDGET_ADMIN: "BUDGET_ADMIN",
  LOCATION_FINANCE_USER: "LOCATION_FINANCE_USER",
  BUDGET_SUBMITTER: "BUDGET_SUBMITTER",
  BUDGET_APPROVER: "BUDGET_APPROVER",
  TRANSFER_REQUESTER: "TRANSFER_REQUESTER",
  TRANSFER_APPROVER: "TRANSFER_APPROVER",
  REPORT_VIEWER: "REPORT_VIEWER",
  AUDITOR: "AUDITOR"
});

const PERMISSIONS = Object.freeze([
  ["dashboard.view", "dashboard", "view", "View enterprise dashboards."],
  ["planner.view", "planner", "view", "View Budget Planner records."],
  ["planner.create", "planner", "create", "Create Budget Planner records."],
  ["planner.update", "planner", "update", "Update Budget Planner records."],
  ["planner.delete", "planner", "delete", "Delete Budget Planner records."],
  ["planner.submit", "planner", "submit", "Submit budget records for review."],
  ["planner.approve", "planner", "approve", "Approve budget records."],
  ["allocation.view", "allocation", "view", "View allocation records."],
  ["allocation.manage", "allocation", "manage", "Manage allocations."],
  ["location_summary.view", "location_summary", "view", "View location summaries."],
  ["unit_budget.view", "unit_budget", "view", "View unit budget reports."],
  ["comparison.view", "comparison", "view", "View budget comparisons."],
  ["utilization.view", "utilization", "view", "View utilization reports."],
  ["latest_estimate.view", "latest_estimate", "view", "View Latest Estimate data."],
  ["latest_estimate.manage", "latest_estimate", "manage", "Manage Latest Estimate data."],
  ["latest_estimate.submit", "latest_estimate", "submit", "Submit Latest Estimate workflow."],
  ["latest_estimate.approve", "latest_estimate", "approve", "Approve Latest Estimate workflow."],
  ["next_fy.view", "next_fy", "view", "View Next FY budgets."],
  ["next_fy.create", "next_fy", "create", "Create Next FY budgets."],
  ["next_fy.update", "next_fy", "update", "Update Next FY budgets."],
  ["next_fy.submit", "next_fy", "submit", "Submit Next FY budgets."],
  ["next_fy.approve", "next_fy", "approve", "Approve Next FY budgets."],
  ["transfer.view", "transfer", "view", "View transfer requests."],
  ["transfer.create", "transfer", "create", "Create transfer requests."],
  ["transfer.update", "transfer", "update", "Update transfer requests."],
  ["transfer.submit", "transfer", "submit", "Submit transfer requests."],
  ["transfer.approve", "transfer", "approve", "Approve transfer requests."],
  ["transfer.reject", "transfer", "reject", "Reject transfer requests."],
  ["transfer.post", "transfer", "post", "Post transfer requests."],
  ["transfer.cancel", "transfer", "cancel", "Cancel transfer requests."],
  ["workflow.view", "workflow", "view", "View workflow state and history."],
  ["workflow.submit", "workflow", "submit", "Submit workflow transitions."],
  ["workflow.approve", "workflow", "approve", "Approve workflow transitions."],
  ["workflow.reject", "workflow", "reject", "Reject workflow transitions."],
  ["report.view", "report", "view", "View reports."],
  ["report.export", "report", "export", "Export reports."],
  ["user.view", "user", "view", "View users."],
  ["user.create", "user", "create", "Create users."],
  ["user.update", "user", "update", "Update users."],
  ["user.disable", "user", "disable", "Disable users."],
  ["user.assign_role", "user", "assign_role", "Assign roles to users."],
  ["role.view", "role", "view", "View roles."],
  ["role.create", "role", "create", "Create roles."],
  ["role.update", "role", "update", "Update roles."],
  ["role.assign_permission", "role", "assign_permission", "Assign permissions to roles."],
  ["permission.view", "permission", "view", "View permissions."],
  ["audit.view", "audit", "view", "View audit events."],
  ["security.manage", "security", "manage", "Manage security settings."]
].map(([code, module, action, description]) => ({ code, module, action, description })));

const ROLES = Object.freeze([
  {
    code: ROLE_CODES.SUPER_ADMIN,
    name: "Super Admin",
    description: "Enterprise administrator with all seeded permissions.",
    isSystemRole: true
  },
  {
    code: ROLE_CODES.FINANCE_ADMIN,
    name: "Finance Admin",
    description: "Finance administrator for budget, workflow, transfer, LE, Next FY, and reporting operations.",
    isSystemRole: true
  },
  {
    code: ROLE_CODES.BUDGET_ADMIN,
    name: "Budget Admin",
    description: "Budget operations administrator for planner, allocation, LE, Next FY, transfer, and reports.",
    isSystemRole: true
  },
  {
    code: ROLE_CODES.LOCATION_FINANCE_USER,
    name: "Location Finance User",
    description: "Location finance user. Location scoping is added in Phase 5C.",
    isSystemRole: true
  },
  {
    code: ROLE_CODES.BUDGET_SUBMITTER,
    name: "Budget Submitter",
    description: "Creates, updates, and submits budget records.",
    isSystemRole: true
  },
  {
    code: ROLE_CODES.BUDGET_APPROVER,
    name: "Budget Approver",
    description: "Reviews, approves, and rejects budget workflow items.",
    isSystemRole: true
  },
  {
    code: ROLE_CODES.TRANSFER_REQUESTER,
    name: "Transfer Requester",
    description: "Creates, updates, submits, and cancels transfer requests.",
    isSystemRole: true
  },
  {
    code: ROLE_CODES.TRANSFER_APPROVER,
    name: "Transfer Approver",
    description: "Reviews, approves, rejects, and posts transfer requests.",
    isSystemRole: true
  },
  {
    code: ROLE_CODES.REPORT_VIEWER,
    name: "Report Viewer",
    description: "Views and exports reports.",
    isSystemRole: true
  },
  {
    code: ROLE_CODES.AUDITOR,
    name: "Auditor",
    description: "Read-only auditor for reports, workflow, transfer history, and audit events.",
    isSystemRole: true
  }
]);

const ALL_PERMISSION_CODES = PERMISSIONS.map((permission) => permission.code);

const ROLE_PERMISSION_MATRIX = Object.freeze({
  [ROLE_CODES.SUPER_ADMIN]: ALL_PERMISSION_CODES,
  [ROLE_CODES.FINANCE_ADMIN]: ALL_PERMISSION_CODES.filter((code) => !code.startsWith("security.") && !["user.disable", "role.create", "role.update", "role.assign_permission"].includes(code)),
  [ROLE_CODES.BUDGET_ADMIN]: [
    "dashboard.view", "planner.view", "planner.create", "planner.update", "planner.delete", "planner.submit",
    "allocation.view", "allocation.manage", "latest_estimate.view", "latest_estimate.manage", "latest_estimate.submit",
    "next_fy.view", "next_fy.create", "next_fy.update", "next_fy.submit", "transfer.view", "transfer.create",
    "transfer.update", "transfer.submit", "transfer.cancel", "report.view", "report.export", "workflow.view", "workflow.submit"
  ],
  [ROLE_CODES.LOCATION_FINANCE_USER]: [
    "dashboard.view", "planner.view", "planner.create", "planner.update", "planner.submit", "allocation.view",
    "location_summary.view", "unit_budget.view", "comparison.view", "utilization.view", "latest_estimate.view",
    "next_fy.view", "transfer.view", "report.view", "workflow.view"
  ],
  [ROLE_CODES.BUDGET_SUBMITTER]: ["planner.view", "planner.create", "planner.update", "planner.submit", "workflow.view", "workflow.submit"],
  [ROLE_CODES.BUDGET_APPROVER]: ["planner.view", "planner.approve", "workflow.view", "workflow.approve", "workflow.reject"],
  [ROLE_CODES.TRANSFER_REQUESTER]: ["transfer.view", "transfer.create", "transfer.update", "transfer.submit", "transfer.cancel"],
  [ROLE_CODES.TRANSFER_APPROVER]: ["transfer.view", "transfer.approve", "transfer.reject", "transfer.post"],
  [ROLE_CODES.REPORT_VIEWER]: ["dashboard.view", "report.view", "report.export"],
  [ROLE_CODES.AUDITOR]: ["dashboard.view", "workflow.view", "transfer.view", "report.view", "audit.view"]
});

module.exports = {
  ALL_PERMISSION_CODES,
  PERMISSIONS,
  ROLE_CODES,
  ROLE_PERMISSION_MATRIX,
  ROLES
};
