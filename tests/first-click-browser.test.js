const assert = require("assert");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const { startServer } = require("../server");
const {
  closePool,
  initializePool,
  resetPoolForTests
} = require("../src/db/pool");

const CHROME_PATHS = [
  path.join(process.env.ProgramFiles || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env.ProgramFiles || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe")
];

function findChrome() {
  const fs = require("fs");
  return CHROME_PATHS.find((candidate) => fs.existsSync(candidate));
}

function listen(appInstance) {
  return new Promise((resolve) => {
    const server = appInstance.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function httpJson(url, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function waitForJson(url, timeoutMs = 10000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      return await httpGetJson(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method) {
        const listeners = this.listeners.get(message.method) || [];
        listeners.forEach((listener) => listener(message.params || {}));
      }
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "CDP error"));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.socket.close();
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }
}

async function createBrowserClient() {
  const chromePath = findChrome();
  assert.ok(chromePath, "Chrome or Edge executable not found.");

  const debuggingPort = 9333 + Math.floor(Math.random() * 400);
  const userDataDir = path.join(os.tmpdir(), `opex-first-click-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
  const browser = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ], {
    stdio: "ignore"
  });

  await waitForJson(`http://127.0.0.1:${debuggingPort}/json/version`);
  const target = await httpJson(`http://127.0.0.1:${debuggingPort}/json/new`, "PUT");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    browser,
    client: new CdpClient(socket),
    async close() {
      try {
        socket.close();
      } catch (_) {}
      browser.kill();
    }
  };
}

async function setupFakePool(counters) {
  resetPoolForTests();
  const allocationMapRows = [
    { location: "Saket", percent: 13.87 },
    { location: "Max Smart", percent: 5.67 },
    { location: "Gurgaon", percent: 3.59 },
    { location: "Lajpat Nagar", percent: 0.36 },
    { location: "Panchsheel", percent: 1.42 },
    { location: "Patparganj", percent: 8.03 },
    { location: "Vaishali", percent: 7.56 },
    { location: "Noida", percent: 0.47 },
    { location: "Shalimar Bagh", percent: 6.44 },
    { location: "Mohali", percent: 4.53 },
    { location: "Dehradun", percent: 3.5 },
    { location: "Bathinda", percent: 1.91 },
    { location: "HO", percent: 3.4 },
    { location: "BLK", percent: 11.28 },
    { location: "Nanawati", percent: 6.19 },
    { location: "Nagpur", percent: 4.72 },
    { location: "Lucknow", percent: 5.2 },
    { location: "Dwarka", percent: 5.2 },
    { location: "Jaypee Noida", percent: 6.67 }
  ];
  const executeSql = async (sql) => {
    const text = String(sql);
    if (/INSERT INTO budget_submissions/i.test(text)) {
      counters.budgetWrites += 1;
      return [{ insertId: 202, affectedRows: 1 }];
    }
    if (/DELETE FROM budget_submissions/i.test(text)) {
      counters.budgetDeletes += 1;
      return [{ affectedRows: 1 }];
    }
    if (/INSERT INTO allocation_matrix/i.test(text)) {
      counters.matrixWrites += 1;
      return [{ insertId: 303, affectedRows: 1 }];
    }
    if (/DELETE FROM allocation_matrix/i.test(text)) {
      counters.matrixDeletes += 1;
      return [{ affectedRows: 1 }];
    }
    if (/INSERT INTO allocation_records/i.test(text)) {
      counters.allocationWrites += 1;
      return [{ insertId: 404, affectedRows: 1 }];
    }
    if (/DELETE FROM allocation_records/i.test(text)) {
      counters.allocationDeletes += 1;
      return [{ affectedRows: 1 }];
    }
    if (/SELECT \* FROM allocation_matrix/i.test(text)) {
      return [[{
        id: 303,
        financial_year: "2026-27",
        coding: "ITOPEX005",
        item: "Lab, BB, ABG equipment interfacing/Integration",
        owner: "jatin",
        total_budget: 100000,
        cost_distribution: "Distributed",
        location_amounts_json: JSON.stringify({ Saket: 13870, "Max Smart": 5670, Gurgaon: 3590 }),
        location_percents_json: JSON.stringify({ Saket: 13.87, "Max Smart": 5.67, Gurgaon: 3.59 })
      }]];
    }
    if (/SELECT \* FROM allocation_records/i.test(text)) {
      return [[{
        id: 404,
        coding: "ITOPEX005",
        item: "Lab, BB, ABG equipment interfacing/Integration",
        owner: "jatin",
        financial_year: "2026-27",
        mode: "Distributed",
        amount_input: 100000,
        target_amount: 100000
      }]];
    }
    return [{ affectedRows: 1 }];
  };
  const querySql = async (sql) => {
    const text = String(sql);
    if (/allocation_location_map/i.test(text)) {
      return [allocationMapRows];
    }
    return executeSql(sql);
  };
  await initializePool(
    {
      db: {
        host: "localhost",
        port: 3306,
        database: "budget",
        user: "user",
        password: "password",
        ssl: false,
        connectionLimit: 10,
        connectTimeoutMs: 10000
      }
    },
    null,
    {
      mysql: {
        createPool: () => ({
          query: async (sql) => {
            const text = String(sql);
            if (/allocation_location_map/i.test(text)) {
              return [allocationMapRows];
            }
            if (/SHOW COLUMNS FROM budget_submissions/i.test(text)) {
              return [[
                { Field: "sub_category_mapped" },
                { Field: "cost_distribution" },
                { Field: "justification" }
              ]];
            }
            if (/FROM budget_submissions/i.test(text)) {
              counters.budgetReads += 1;
              return [[
                {
                  id: 101,
                  coding: "ITOPEX005",
                  item: "Lab, BB, ABG equipment interfacing/Integration",
                  sub_category_mapped: "AMC - IT Software",
                  category_it: "Application",
                  sub_category: "Existing renewal",
                  new_category: "Existing renewal",
                  app_cate: "Unit",
                  cate3: "Existing renewal",
                  cate4: "No Increment",
                  owner1: "Unit",
                  owner: "jatin",
                  cost_center_department: "IT",
                  financial_year: "2026-27",
                  location: "Saket",
                  cost_distribution: "Fixed Cost",
                  loc_fy_current: 100000,
                  loc_fy_last: 90000,
                  loc_le: 80000,
                  new_amc: 25000,
                  new_project: 15000,
                  annualized: 10000,
                  price_increase: 8000,
                  new_unit: 12000,
                  license_increase: 15000,
                  rest: 15000,
                  justification: "Browser test row"
                }
              ]];
            }
            if (/FROM allocation_records/i.test(text)) {
              counters.allocationReads += 1;
              return [[]];
            }
            if (/FROM allocation_matrix/i.test(text)) {
              counters.matrixReads += 1;
              return [[]];
            }
            return [[{ ok: 1 }]];
          },
          execute: executeSql,
          getConnection: async () => ({
            beginTransaction: async () => {
              counters.transactions += 1;
            },
            commit: async () => {
              counters.commits += 1;
            },
            rollback: async () => {
              counters.rollbacks += 1;
            },
            release: () => {
              counters.releases += 1;
            },
            query: querySql,
            execute: executeSql
          }),
          end: async () => {}
        })
      }
    }
  );
}

async function evaluate(client, expression, awaitPromise = true) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result ? result.result.value : undefined;
}

async function waitFor(client, expression, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(client, expression);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function clickSelector(client, selector) {
  const rect = await evaluate(
    client,
    `(() => {
      const candidates = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const el = candidates.find((candidate) => {
        const style = window.getComputedStyle(candidate);
        const rect = candidate.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "center" });
      const rect = el.getBoundingClientRect();
      const points = [
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        { x: rect.left + Math.min(rect.width - 2, 8), y: rect.top + rect.height / 2 },
        { x: rect.right - Math.min(rect.width - 2, 8), y: rect.top + rect.height / 2 },
        { x: rect.left + rect.width / 2, y: rect.top + Math.min(rect.height - 2, 8) },
        { x: rect.left + rect.width / 2, y: rect.bottom - Math.min(rect.height - 2, 8) }
      ];
      const point = points.find((candidate) => {
        const hit = document.elementFromPoint(candidate.x, candidate.y);
        return hit === el || (hit && el.contains(hit));
      }) || points[0];
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        x: point.x,
        y: point.y,
        id: el.id || "",
        action: el.getAttribute("data-action") || "",
        hit: hit ? [hit.tagName, hit.id || "", hit.getAttribute && hit.getAttribute("data-action") || ""].join("|") : ""
      };
    })()`
  );
  assert.ok(rect, `Missing selector ${selector}`);
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
}

async function showPlannerWithForm(client) {
  await clickSelector(client, '[data-view="plannerView"]');
  await waitFor(client, "window.OpexData.state.activeView === 'plannerView'");

  await evaluate(
    client,
    `(() => {
      const state = window.OpexData.state;
      state.form = Object.assign({}, state.form, {
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
        costCenter: "IT",
        costDistribution: "Fixed Cost",
        financialYear: "2026-27",
        location: "Saket",
        entryType: "Budget Taken",
        locLe: "80000",
        locFyCurrent: "100000",
        locFyLast: "90000",
        newAmc: "25000",
        newProject: "15000",
        annualized: "10000",
        priceIncrease: "8000",
        newUnit: "12000",
        licenseIncrease: "15000",
        rest: "15000",
        justification: "first click browser test"
      });
      state.editId = null;
      window.OpexUI.renderAll();
    })()`
  );
  await waitFor(client, "Boolean(document.querySelector('#planner-locFyCurrent') && document.querySelector('[data-action=\"save-record\"]'))");
}

async function seedBrowserAppState(client) {
  await evaluate(
    client,
    `(() => {
      const state = window.OpexData.state;
      const record = {
        id: 101,
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
        costCenter: "IT",
        costCenterDepartment: "IT",
        financialYear: "2026-27",
        location: "Saket",
        costDistribution: "Fixed Cost",
        locFyCurrent: 100000,
        locFyLast: 90000,
        locLe: 80000,
        newAmc: 25000,
        newProject: 15000,
        annualized: 10000,
        priceIncrease: 8000,
        newUnit: 12000,
        licenseIncrease: 15000,
        rest: 15000,
        justification: "Browser test row"
      };
      state.records = [record];
      state.allocationDb = [{
        id: 404,
        coding: "ITOPEX005",
        item: record.item,
        owner: "jatin",
        financialYear: "2026-27",
        mode: "Distributed",
        amountInput: 100000,
        targetAmount: 100000
      }];
      state.allocationMatrixRows = [{
        id: 303,
        financialYear: "2026-27",
        coding: "ITOPEX005",
        item: record.item,
        owner: "jatin",
        totalBudget: 100000,
        costDistribution: "Distributed",
        locationAmounts: { Saket: 13870, "Max Smart": 5670, Gurgaon: 3590 },
        locationPercents: { Saket: 13.87, "Max Smart": 5.67, Gurgaon: 3.59 }
      }];
      state.allocationMatrixLocalRows = [];
      state.allocationMatrixEdits = {};
      state.allocationMatrixFilters = {};
      state.dashboardFilters = {};
    })()`
  );
}

async function showAllocationWithControls(client) {
  await seedBrowserAppState(client);
  await evaluate(
    client,
    `(() => {
      const state = window.OpexData.state;
      state.activeView = "allocationView";
      state.allocationControls = Object.assign({}, state.allocationControls || {}, {
        mode: "Distributed",
        coding: "ITOPEX005",
        codings: ["ITOPEX005"],
        codingSearch: "",
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
        costCenterDepartment: "IT",
        financialYear: "2026-27",
        amount: "100000"
      });
      state.allocationSubmitMessage = "";
      window.OpexUI.renderAll();
    })()`
  );
  await waitFor(client, "window.OpexData.state.activeView === 'allocationView'");
  await waitFor(client, "Boolean(document.querySelector('[data-action=\"allocation-submit\"]'))");
}

function createNetworkCounter() {
  const requests = [];
  return {
    requests,
    track(params) {
      const request = params.request || {};
      if (!request.url || !/\/api\//.test(request.url)) return;
      requests.push({
        method: request.method,
        url: request.url.replace(/^https?:\/\/[^/]+/, "")
      });
    },
    count(method, pathPart) {
      return requests.filter((request) => request.method === method && request.url.includes(pathPart)).length;
    }
  };
}

async function runScenario(basePath) {
  const previousBasePath = process.env.APP_BASE_PATH;
  const previousPort = process.env.PORT;
  const previousAppEnv = process.env.APP_ENV;
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const previousDbHost = process.env.DB_HOST;
  const previousDbPort = process.env.DB_PORT;
  const previousDbName = process.env.DB_NAME;
  const previousDbUser = process.env.DB_USER;
  const previousDbPassword = process.env.DB_PASSWORD;
  const previousDbSsl = process.env.DB_SSL;

  const port = await getFreePort();
  process.env.APP_BASE_PATH = basePath;
  process.env.PORT = String(port);
  process.env.APP_ENV = "development";
  process.env.ALLOWED_ORIGINS = `http://127.0.0.1:${port}`;
  process.env.DB_HOST = "localhost";
  process.env.DB_PORT = "3306";
  process.env.DB_NAME = "budget";
  process.env.DB_USER = "user";
  process.env.DB_PASSWORD = "password";
  process.env.DB_SSL = "false";

  const counters = {
    budgetReads: 0,
    budgetWrites: 0,
    budgetDeletes: 0,
    allocationReads: 0,
    allocationWrites: 0,
    allocationDeletes: 0,
    matrixReads: 0,
    matrixWrites: 0,
    matrixDeletes: 0,
    transactions: 0,
    commits: 0,
    rollbacks: 0,
    releases: 0
  };

  await setupFakePool(counters);
  const server = await startServer();
  const browser = await createBrowserClient();
  const client = browser.client;
  const network = createNetworkCounter();
  try {
    await client.send("Page.enable");
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    client.on("Network.requestWillBeSent", (params) => network.track(params));
    await client.send("Runtime.enable");
    await client.send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${basePath || ""}/` });
    await waitFor(client, "document.readyState === 'interactive' || document.readyState === 'complete'");
    await waitFor(client, "Boolean(window.OpexUI && window.OpexData && document.querySelector('[data-view=\"plannerView\"]'))");

    await evaluate(
      client,
      `(() => {
        window.__firstClickTrace = [];
        const describe = (el) => {
          if (!el) return "";
          const action = el.closest && el.closest("[data-action]");
          return [
            el.tagName,
            el.id || "",
            action ? action.getAttribute("data-action") : "",
            document.activeElement ? document.activeElement.id || document.activeElement.tagName : "",
            el.isConnected ? "connected" : "detached"
          ].join("|");
        };
        ["pointerdown", "mousedown", "change", "focusout", "click"].forEach((type) => {
          document.addEventListener(type, (event) => {
            const hit = event.clientX == null ? null : document.elementFromPoint(event.clientX, event.clientY);
            window.__firstClickTrace.push({
              type,
              phase: event.eventPhase,
              target: describe(event.target),
              button: describe(event.target && event.target.closest ? event.target.closest("button") : null),
              hit: describe(hit),
              defaultPrevented: event.defaultPrevented,
              time: Math.round(performance.now())
            });
          }, true);
          document.addEventListener(type, (event) => {
            window.__firstClickTrace.push({
              type,
              phase: event.eventPhase,
              target: describe(event.target),
              button: describe(event.target && event.target.closest ? event.target.closest("button") : null),
              defaultPrevented: event.defaultPrevented,
              time: Math.round(performance.now())
            });
          }, false);
        });
      })()`
    );

    await showPlannerWithForm(client);

    await evaluate(client, "document.querySelector('#planner-locFyCurrent').focus(); document.querySelector('#planner-locFyCurrent').value = '';");
    await client.send("Input.insertText", { text: "100001" });
    await clickSelector(client, '[data-action="save-record"]');
    await waitFor(client, "window.OpexData.state.activeView === 'plannerView'");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const trace = await evaluate(client, "window.__firstClickTrace.slice(-30)");
    const saveClicks = trace.filter((entry) => entry.type === "click" && String(entry.button || "").includes("save-record"));
    assert.ok(saveClicks.length >= 1, `Save click did not reach the button. Trace: ${JSON.stringify(trace)}`);
    assert.strictEqual(counters.budgetWrites, 1, `One Save click should send one write. Trace: ${JSON.stringify(trace)}`);

    await showPlannerWithForm(client);
    await clickSelector(client, '#plannerContent [data-action="edit-record"]');
    await waitFor(client, "window.OpexData.state.editId === '101'");

    await evaluate(client, "window.OpexData.state.editId = null; window.OpexUI.renderAll();");
    await waitFor(client, "Boolean(document.querySelector('#plannerContent [data-action=\"delete-record\"]'))");
    await clickSelector(client, '#plannerContent [data-action="delete-record"]');
    await new Promise((resolve) => setTimeout(resolve, 300));
    const deleteTrace = await evaluate(client, "window.__firstClickTrace.slice(-20)");
    assert.strictEqual(counters.budgetDeletes, 1, `One Delete click should send one delete request. Trace: ${JSON.stringify(deleteTrace)}`);

    await showPlannerWithForm(client);
    await evaluate(client, "document.querySelector('[data-action=\"clear-form\"]').scrollIntoView({ block: 'center' }); document.querySelector('[data-action=\"clear-form\"]').focus();");
    await waitFor(client, "document.activeElement && document.activeElement.getAttribute('data-action') === 'clear-form'");
    await evaluate(client, "document.querySelector('[data-view=\"dashboardView\"]').focus();");
    await waitFor(client, "document.activeElement && document.activeElement.getAttribute('data-view') === 'dashboardView'");

    await clickSelector(client, '[data-view="dashboardView"]');
    await waitFor(client, "window.OpexData.state.activeView === 'dashboardView'");

    await seedBrowserAppState(client);
    await evaluate(
      client,
      `(() => {
        window.__exportCounts = { dashboard: 0, allocation: 0, planner: 0 };
        window.OpexUI.exportDashboardPdf = async () => { window.__exportCounts.dashboard += 1; };
        window.OpexUI.exportAllocationMatrixWorkbook = () => { window.__exportCounts.allocation += 1; };
        window.OpexUI.exportPlannerSavedRecordsWorkbook = () => { window.__exportCounts.planner += 1; };
        if (!window.XLSX) window.XLSX = { utils: { book_new: () => ({}), json_to_sheet: () => ({}), book_append_sheet: () => {} }, writeFile: () => {} };
        const originalWriteFile = window.XLSX.writeFile;
        window.XLSX.writeFile = (...args) => {
          window.__exportCounts.report = (window.__exportCounts.report || 0) + 1;
          return originalWriteFile && originalWriteFile.__firstClickStub ? undefined : undefined;
        };
        window.XLSX.writeFile.__firstClickStub = true;
        window.OpexUI.renderAll();
      })()`
    );
    await waitFor(client, "Boolean(document.querySelector('[data-action=\"dashboard-export\"]'))");

    await clickSelector(client, '[data-action="dashboard-export"]');
    await waitFor(client, "window.__exportCounts.dashboard === 1");

    await evaluate(client, "window.OpexData.state.dashboardFilters = { location: 'All', coding: 'ITOPEX005', financialYear: '2026-27', owner: 'jatin' }; window.OpexUI.renderAll();");
    await waitFor(client, "Boolean(document.querySelector('[data-combo-clear=\"dashboard-location\"]'))");
    const readsBeforeDashboardClear = counters.budgetReads + counters.allocationReads + counters.matrixReads;
    await clickSelector(client, '[data-combo-clear="dashboard-location"]');
    await waitFor(client, "window.OpexData.state.dashboardFilters.location === ''");
    await clickSelector(client, '[data-combo-clear="dashboard-coding"]');
    await waitFor(client, "window.OpexData.state.dashboardFilters.coding === ''");
    await clickSelector(client, '[data-combo-clear="dashboard-financialYear"]');
    await waitFor(client, "window.OpexData.state.dashboardFilters.financialYear === ''");
    await clickSelector(client, '[data-combo-clear="dashboard-owner"]');
    await waitFor(client, "window.OpexData.state.dashboardFilters.owner === ''");
    assert.strictEqual(
      counters.budgetReads + counters.allocationReads + counters.matrixReads,
      readsBeforeDashboardClear,
      "Dashboard clear buttons should rerender local filters without duplicate API refreshes."
    );

    await showAllocationWithControls(client);
    await evaluate(client, "document.querySelector('#allocation-amount').focus(); document.querySelector('#allocation-amount').value = '';");
    await client.send("Input.insertText", { text: "100001" });
    const allocationWritesBefore = network.count("POST", "/api/allocation-data");
    const matrixWritesBeforeSubmit = network.count("POST", "/api/allocation-matrix");
    await evaluate(client, "document.querySelector('[data-combo-id=\"allocation-coding\"]').classList.add('open');");
    await waitFor(client, "document.querySelector('[data-combo-id=\"allocation-coding\"]').classList.contains('open')");
    await clickSelector(client, '[data-action="allocation-submit"]');
    await waitFor(client, "String(window.OpexData.state.allocationSubmitMessage || '').includes('Saved distribution')");
    assert.strictEqual(network.count("POST", "/api/allocation-data") - allocationWritesBefore, 1, "One Allocation Submit click should send one allocation-data write.");
    assert.ok(network.count("POST", "/api/allocation-matrix") - matrixWritesBeforeSubmit >= 1, "Allocation Submit should persist allocation matrix rows.");

    await showAllocationWithControls(client);
    await clickSelector(client, '#allocationContent [data-action="allocation-row-edit"]');
    await waitFor(client, "Boolean(window.OpexData.state.allocationEditModal && window.OpexData.state.allocationEditModal.rowKey)");
    await waitFor(client, "Boolean(document.querySelector('[data-action=\"allocation-modal-save\"]'))");
    await evaluate(client, "document.querySelector('.allocation-modal-input').focus(); document.querySelector('.allocation-modal-input').value = '';");
    await client.send("Input.insertText", { text: "14000" });
    const matrixWritesBeforeModal = network.count("POST", "/api/allocation-matrix");
    await clickSelector(client, '[data-action="allocation-modal-save"]');
    await waitFor(client, "!window.OpexData.state.allocationEditModal");
    assert.strictEqual(network.count("POST", "/api/allocation-matrix") - matrixWritesBeforeModal, 1, "One Allocation Matrix modal Save click should send one matrix write.");

    await showAllocationWithControls(client);
    const matrixDeletesBefore = network.count("DELETE", "/api/allocation-matrix/");
    const allocationDeletesBefore = network.count("DELETE", "/api/allocation-data/");
    await clickSelector(client, '#allocationContent [data-action="allocation-row-delete"]');
    await waitFor(client, "String(window.OpexData.state.allocationSubmitMessage || '').includes('Removed Distributed allocation')");
    assert.strictEqual(network.count("DELETE", "/api/allocation-matrix/") - matrixDeletesBefore, 1, "One Allocation Delete click should send one matrix delete.");
    assert.strictEqual(network.count("DELETE", "/api/allocation-data/") - allocationDeletesBefore, 1, "One Allocation Delete click should send one allocation delete.");

    await showAllocationWithControls(client);
    await clickSelector(client, '[data-action="allocation-matrix-export"]');
    await waitFor(client, "window.__exportCounts.allocation === 1");

    await evaluate(client, "window.OpexData.state.activeView = 'plannerView'; window.OpexUI.renderAll();");
    await waitFor(client, "window.OpexData.state.activeView === 'plannerView'");
    await waitFor(client, "Boolean(document.querySelector('[data-action=\"planner-saved-export\"]'))");
    await clickSelector(client, '[data-action="planner-saved-export"]');
    await waitFor(client, "window.__exportCounts.planner === 1");

    await evaluate(client, "window.OpexData.state.activeView = 'reportView'; window.OpexUI.renderAll();");
    await waitFor(client, "window.OpexData.state.activeView === 'reportView'");
    await waitFor(client, "Boolean(document.querySelector('[data-action=\"download-report\"]'))");
    await clickSelector(client, '[data-action="download-report"]');
    await waitFor(client, "(window.__exportCounts.report || 0) === 1");

    for (const viewId of ["locationSummaryView", "unitBudgetView", "comparisonView", "utilizationView"]) {
      await clickSelector(client, `[data-view="${viewId}"]`);
      await waitFor(client, `window.OpexData.state.activeView === '${viewId}'`);
    }

    return { trace, counters, requests: network.requests };
  } finally {
    await browser.close();
    await closeServer(server);
    await closePool();
    if (previousBasePath === undefined) delete process.env.APP_BASE_PATH;
    else process.env.APP_BASE_PATH = previousBasePath;
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
    if (previousAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousAppEnv;
    if (previousAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
    if (previousDbHost === undefined) delete process.env.DB_HOST;
    else process.env.DB_HOST = previousDbHost;
    if (previousDbPort === undefined) delete process.env.DB_PORT;
    else process.env.DB_PORT = previousDbPort;
    if (previousDbName === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = previousDbName;
    if (previousDbUser === undefined) delete process.env.DB_USER;
    else process.env.DB_USER = previousDbUser;
    if (previousDbPassword === undefined) delete process.env.DB_PASSWORD;
    else process.env.DB_PASSWORD = previousDbPassword;
    if (previousDbSsl === undefined) delete process.env.DB_SSL;
    else process.env.DB_SSL = previousDbSsl;
  }
}

async function run() {
  const rootResult = await runScenario("");
  assert.strictEqual(rootResult.counters.budgetWrites, 1);

  const basePathResult = await runScenario("/budget-app");
  assert.strictEqual(basePathResult.counters.budgetWrites, 1);

  console.log("First-click browser tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
