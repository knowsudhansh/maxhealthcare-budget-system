const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
  buildApiUrl,
  withButtonActionLock
} = require("../app-utils");

const root = path.join(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const appUi = fs.readFileSync(path.join(root, "app-ui.js"), "utf8");
const appUtils = fs.readFileSync(path.join(root, "app-utils.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

function countMatches(source, pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

async function testButtonActionLock() {
  const button = {
    disabled: false,
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    }
  };

  let calls = 0;
  let releaseFirst;
  const first = withButtonActionLock(button, async () => {
    calls += 1;
    await new Promise((resolve) => {
      releaseFirst = resolve;
    });
  });
  const duplicate = withButtonActionLock(button, async () => {
    calls += 1;
  });

  assert.strictEqual(button.disabled, true);
  assert.strictEqual(button.attributes["aria-busy"], "true");
  await duplicate;
  assert.strictEqual(calls, 1);
  releaseFirst();
  await first;
  assert.strictEqual(button.disabled, false);
  assert.strictEqual(button.attributes["aria-busy"], undefined);

  await assert.rejects(
    withButtonActionLock(button, async () => {
      throw new Error("expected failure");
    }),
    /expected failure/
  );
  assert.strictEqual(button.disabled, false);
}

async function run() {
  assert.ok(appJs.includes("window.__OPEX_APP_INITIALIZED__"), "App initialization guard is missing.");
  assert.ok(appUi.includes("window.__OPEX_UI_INITIALIZED__"), "UI initialization guard is missing.");
  assert.ok(appJs.includes("function startRefreshLifecycle()"), "Refresh lifecycle owner is missing.");
  assert.ok(appJs.includes("function singleFlightRefresh"), "Single-flight refresh guard is missing.");
  assert.ok(appJs.includes("document.hidden"), "Polling should pause while the document is hidden.");
  assert.strictEqual(countMatches(appJs, /setInterval\(/g), 1, "App should have one polling interval owner.");
  assert.ok(appJs.includes("refreshLifecycle.timerId"), "Refresh timer must be tracked.");
  assert.ok(appJs.includes("visibilityBound"), "Visibility listener must be registered once.");

  assert.ok(appUtils.includes("function withButtonActionLock"), "Shared button action lock is missing.");
  assert.ok(appJs.includes("withButtonActionLock(actionButton"), "Action buttons should use the shared lock.");
  ["save-record", "delete-record", "allocation-row-delete", "allocation-modal-save", "allocation-submit"].forEach((action) => {
    assert.ok(appJs.includes(`action === "${action}"`), `Missing action handler: ${action}`);
  });

  assert.ok(!/fetch\(\s*["'`]\/api\//.test(appJs), "App must not hardcode root-relative /api fetches.");
  assert.ok(indexHtml.indexOf("./app-config.js") < indexHtml.indexOf("./app-utils.js"), "Runtime app config must load before URL helpers.");
  assert.ok(!/href=["']\/(?!\/)/.test(indexHtml), "Local assets should not use root-relative hrefs.");
  assert.ok(!/src=["']\/(?!\/)/.test(indexHtml), "Local assets should not use root-relative srcs.");

  assert.strictEqual(buildApiUrl("budget-data"), "/api/budget-data");
  globalThis.APP_CONFIG = { basePath: "/budget-app" };
  assert.strictEqual(buildApiUrl("budget-data"), "/budget-app/api/budget-data");
  delete globalThis.APP_CONFIG;

  assert.ok(appJs.includes("loadLiveBudgetData(Boolean(logStatus))"), "Initial budget refresh should go through the lifecycle.");
  assert.ok(appJs.includes("loadAllocationDbFromServer()"), "Allocation control refresh is missing.");
  assert.ok(appJs.includes("loadAllocationMatrixFromServer()"), "Allocation matrix refresh is missing.");
  assert.ok(appJs.includes("await Promise.all(matrixSaveTasks)"), "Allocation submit should await matrix writes before releasing the button.");
  assert.ok(appJs.includes("await upsertAllocationDbToServer(state.allocationDb)"), "Allocation submit should await control writes.");

  assert.ok(indexHtml.includes('button type="button"'), "Static navigation buttons must be non-submit buttons.");
  assert.ok(!indexHtml.includes('type="submit"'), "Index shell should not define submit buttons.");
  assert.ok(appUi.includes('type="button"'), "Rendered action buttons must be non-submit buttons.");

  await testButtonActionLock();

  console.log("Phase 4A UI action, refresh lifecycle, and base-path stabilization tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
