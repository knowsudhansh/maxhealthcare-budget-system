(function () {
  const data = window.OpexData || {};
  const state = data.state || (data.state = {});
  const h = data.helpers || {};

  const VIEW_HOSTS = {
    dashboardView: "dashboardContent",
    plannerView: "plannerContent",
    locationSummaryView: "locationSummaryContent",
    unitBudgetView: "unitBudgetContent",
    allocationView: "allocationContent",
    utilizationView: "utilizationContent",
    comparisonView: "comparisonContent",
    reportView: "reportContent"
  };

  const DRIVER_KEYS = [
    "newAmc",
    "newProject",
    "annualized",
    "priceIncrease",
    "newUnit",
    "licenseIncrease",
    "rest"
  ];

  const FALLBACK_LOCATIONS = [
    "Saket",
    "Max Smart",
    "Gurgaon",
    "Lajpat Nagar",
    "Panchsheel",
    "Patparganj",
    "Vaishali",
    "Noida",
    "Shalimar Bagh",
    "Mohali",
    "Dehradun",
    "Bathinda",
    "HO",
    "BLK",
    "Nanawati",
    "Nagpur",
    "Lucknow",
    "Dwarka",
    "Jaypee Noida"
  ];

  const ALLOCATION_DISTRIBUTION_MAP = {
    Saket: 13.87,
    "Max Smart": 5.67,
    Gurgaon: 3.59,
    "Lajpat Nagar": 0.36,
    Panchsheel: 1.42,
    Patparganj: 8.03,
    Vaishali: 7.56,
    Noida: 0.47,
    "Shalimar Bagh": 6.44,
    Mohali: 4.53,
    Dehradun: 3.50,
    Bathinda: 1.91,
    HO: 3.40,
    BLK: 11.28,
    Nanawati: 6.19,
    Nagpur: 4.72,
    Lucknow: 5.20,
    Dwarka: 5.20,
    "Jaypee Noida": 6.67
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function num(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function fmt(value) {
    const parsed = num(value);
    return parsed.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function pct(value) {
    return `${num(value).toFixed(2)}%`;
  }

  function normalizeText(value) {
    if (h.normalizeText) return h.normalizeText(value);
    return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function digitsOnly(value) {
    return String(value ?? "").replace(/\D/g, "");
  }

  function uniq(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function prevYear(financialYear) {
    const match = String(financialYear || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) return "";
    const start = Number(match[1]) - 1;
    const end = String(Number(match[2]) - 1).padStart(2, "0");
    return `${start}-${end}`;
  }

  function financialYearStart(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
    return match ? Number(match[1]) : NaN;
  }

  function getRecords() {
    return Array.isArray(state.records) ? state.records : [];
  }

  function getAllLocations() {
    const mapped = Array.isArray(data.ALL_LOCATIONS) ? data.ALL_LOCATIONS : [];
    const fromRecords = getRecords().map((record) => record.location);
    return uniq([].concat(mapped, FALLBACK_LOCATIONS, fromRecords));
  }

  function optionValuesForKey(key) {
    const records = getRecords();
    const profileMap = data.CODE_PROFILE_MAP || {};
    const options = [];
    const fallbackSources = {
      item: []
        .concat(Object.values(data.CODE_ITEM_MAP || {}))
        .concat(data.ALL_ITEMS || []),
      owner1: []
        .concat(data.ALL_OWNER1 || [])
        .concat([
          "Application",
          "Clinical",
          "Digital",
          "Finance",
          "HR",
          "IT Infra",
          "Infrastructure",
          "Security",
          "Unit"
        ]),
      owner: []
        .concat(data.ALL_OWNERS || [])
        .concat([
          "Akshant",
          "Amit",
          "Anil",
          "Arjun",
          "Jatin",
          "Rakesh",
          "Tauqueer",
          "Unit"
        ]),
      costCenterDepartment: []
        .concat(data.ALL_COST_CENTER_DEPARTMENTS || [])
        .concat(data.ALL_COST_CENTERS || [])
        .concat(["30SUP020", "30SUP056", "30SUP066"])
    };

    records.forEach((record) => {
      if (record && record[key]) options.push(record[key]);
    });

    Object.keys(profileMap).forEach((code) => {
      const profile = profileMap[code] || {};
      if (profile[key]) options.push(profile[key]);
    });

    if (key === "coding") {
      options.push.apply(options, Object.keys(data.CODE_ITEM_MAP || {}));
      options.push.apply(options, Object.keys(profileMap));
    }

    if (fallbackSources[key]) {
      options.push.apply(options, fallbackSources[key]);
    }

    if (key === "location") {
      options.push.apply(options, getAllLocations());
    }

    if (key === "financialYear") {
      options.push(
        // "2031-32",
        // "2030-31",
        // "2029-30",
        // "2028-29",
        // "2027-28",
        "2026-27",
        "2025-26",
        "2024-25",
        "2023-24",
        "2022-23",
        "2021-22",
        "2020-21"
      );
    }

    if (key === "costDistribution") {
      options.push("Fixed Cost");
    }

    const uniqueOptions = uniq(options);
    if (key === "financialYear") {
      return uniqueOptions.sort((left, right) => {
        const leftStart = financialYearStart(left);
        const rightStart = financialYearStart(right);
        const leftIsYear = Number.isFinite(leftStart);
        const rightIsYear = Number.isFinite(rightStart);
        if (leftIsYear && rightIsYear) return rightStart - leftStart;
        if (leftIsYear) return -1;
        if (rightIsYear) return 1;
        return String(left).localeCompare(String(right));
      });
    }
    return uniqueOptions.sort((a, b) => String(a).localeCompare(String(b)));
  }

  function getCodeProfile(codeValue) {
    const normalizedCode = normalizeText(codeValue);
    const builtInMap = data.CODE_PROFILE_MAP || {};
    const recordProfiles = h.buildCodingProfiles ? h.buildCodingProfiles(getRecords()) : {};
    return builtInMap[normalizedCode] || recordProfiles[normalizedCode] || null;
  }

  function mappedItemForCode(codeValue) {
    const normalizedCode = normalizeText(codeValue);
    if (!normalizedCode) return "";
    const codeItemMap = data.CODE_ITEM_MAP || {};
    const fromMap =
      codeItemMap[normalizedCode] ||
      codeItemMap[String(normalizedCode).toLowerCase()] ||
      codeItemMap[String(normalizedCode).toUpperCase()] ||
      "";
    if (fromMap) return fromMap;

    const profile = getCodeProfile(codeValue);
    if (profile && profile.item) return profile.item;

    const recordMatch = getRecords().find(
      (record) => normalizeText(record && record.coding) === normalizedCode && String(record && record.item ? record.item : "").trim()
    );
    return recordMatch ? recordMatch.item : "";
  }

  function fieldCard(label, control, modifiers) {
    return `
      <div class="field-card${modifiers || ""}">
        <div class="field-label">${esc(label)}</div>
        ${control}
      </div>
    `;
  }

  function datalistMarkup(id, options) {
    const values = uniq(options);
    if (!values.length) return "";
    return `
      <datalist id="${esc(id)}-list">
        ${values.map((option) => `<option value="${esc(option)}"></option>`).join("")}
      </datalist>
    `;
  }

  function searchCard(id, label, value, options, placeholder, isLocked) {
    const rawValues = uniq([].concat(options || [], value || []).filter(Boolean));
    const values = rawValues
      .filter((option) => normalizeText(option) === "all")
      .concat(rawValues.filter((option) => normalizeText(option) !== "all"));
    if (isLocked) {
      const control = `
        <input
          id="${esc(id)}"
          class="input-control"
          type="text"
          value="${esc(value || "")}"
          placeholder="${esc(placeholder || "")}"
          readonly
        />
      `;
      return fieldCard(label, control, " field-card-locked");
    }

    const control = `
      <div class="combo" data-combo-id="${esc(id)}">
        <input
          id="${esc(id)}"
          class="input-control combo-input"
          type="text"
          value="${esc(value || "")}"
          placeholder="${esc(placeholder || "")}"
          autocomplete="off"
        />
        <button type="button" class="combo-toggle" data-combo-toggle="${esc(id)}" aria-label="Toggle ${esc(label)} options">v</button>
        <div class="combo-menu" data-combo-menu="${esc(id)}">
          ${values.length
            ? values
                .map(
                  (option) =>
                    `<button type="button" class="combo-option" data-combo-option="${esc(id)}" data-value="${esc(option)}">${esc(
                      option
                    )}</button>`
                )
                .join("")
            : `<div class="combo-empty">No values available</div>`}
        </div>
      </div>
    `;
    return fieldCard(label, control);
  }

  function multiSearchCard(id, label, searchValue, selectedValues, options, placeholder, noteResolver) {
    const chosen = Array.isArray(selectedValues) ? selectedValues : [];
    const selectedSet = new Set(chosen.map((value) => normalizeText(value)).filter(Boolean));
    const selectedLabel =
      chosen.length === 0
        ? ""
        : chosen.length <= 2
          ? chosen.join(", ")
          : `${chosen.slice(0, 2).join(", ")} +${chosen.length - 2} more`;
    const control = `
      <div class="combo combo-multi" data-combo-id="${esc(id)}">
        <input
          id="${esc(id)}"
          class="input-control combo-input multi-combo-input"
          type="text"
          value="${esc(searchValue || "")}"
          placeholder="${esc(selectedLabel || placeholder || "")}"
          autocomplete="off"
        />
        <button type="button" class="combo-toggle" data-combo-toggle="${esc(id)}" aria-label="Toggle ${esc(label)} options">v</button>
        <div class="combo-menu combo-menu-multi" data-combo-menu="${esc(id)}">
          ${
            chosen.length
              ? `<div class="combo-selection-summary combo-selection-summary-chips">
                  ${chosen
                    .map((value) => `<span class="allocation-selected-chip">${esc(value)}</span>`)
                    .join("")}
                </div>`
              : `<div class="combo-selection-summary combo-selection-summary-muted">No coding selected</div>`
          }
          ${
            options.length
              ? options
                  .map((option) => {
                    const checked = selectedSet.has(normalizeText(option)) ? "checked" : "";
                    const note = noteResolver ? noteResolver(option) : "";
                    const filterText = [option, note].filter(Boolean).join(" ");
                    return `
                      <label class="multi-combo-option check-row" data-filter-text="${esc(filterText)}">
                        <input type="checkbox" class="allocation-coding" value="${esc(option)}" ${checked}/>
                        <span>${esc(option)}</span>
                        ${note ? `<small>${esc(note)}</small>` : ""}
                      </label>
                    `;
                  })
                  .join("")
              : `<div class="combo-empty">No values available</div>`
          }
        </div>
      </div>
    `;
    return fieldCard(label, control, " allocation-coding-card");
  }

  function selectCard(id, label, value, options, placeholder) {
    const values = uniq(options);
    const control = `
      <select id="${esc(id)}" class="input-control">
        <option value="">${esc(placeholder || `Select ${label}`)}</option>
        ${values
          .map((option) => {
            const selected = String(option) === String(value || "") ? "selected" : "";
            return `<option value="${esc(option)}" ${selected}>${esc(option)}</option>`;
          })
          .join("")}
      </select>
    `;
    return fieldCard(label, control);
  }

  function inputCard(id, label, value, placeholder, type, readOnly, step) {
    const stepAttr = type === "number" && step ? `step="${esc(step)}"` : "";
    const control = `
      <input
        id="${esc(id)}"
        class="input-control"
        type="${esc(type || "text")}"
        value="${esc(value ?? "")}"
        placeholder="${esc(placeholder || "")}"
        ${stepAttr}
        ${readOnly ? "readonly" : ""}
      />
    `;
    return fieldCard(label, control, readOnly ? " field-card-locked" : "");
  }

  function textAreaCard(id, label, value, placeholder) {
    const control = `
      <textarea id="${esc(id)}" class="input-control" rows="3" placeholder="${esc(placeholder || "")}">${esc(
      value || ""
    )}</textarea>
    `;
    return fieldCard(label, control, " field-card-wide");
  }

  function kpiCard(label, value, note, tone) {
    return `
      <article class="kpi-card ${esc(tone || "tone-blue")}">
        <div class="kpi-label">${esc(label)}</div>
        <div class="kpi-value">${esc(value)}</div>
        <div class="kpi-note">${esc(note || "")}</div>
      </article>
    `;
  }

  function emptyCard(title, message) {
    return `
      <section class="card">
        <div class="section-head">
          <div>
            <h3>${esc(title)}</h3>
          </div>
        </div>
        <div class="empty-state">${esc(message)}</div>
      </section>
    `;
  }

  function tableCard(title, subtitle, headers, rows) {
    return `
      <section class="card">
        <div class="section-head">
          <div>
            <h3>${esc(title)}</h3>
            <p>${esc(subtitle || "")}</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}" class="empty-state">No data available.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function inlineStat(label, value) {
    return `
      <div class="inline-stat">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `;
  }

  function palette(index) {
    const colors = ["#2f89dc", "#34b5d5", "#55c6b1", "#6f8ae8", "#f5a338", "#64748b", "#19b5a8", "#4b93ff"];
    return colors[index % colors.length];
  }

  function sectionCard(title, subtitle, body, modifier) {
    return `
      <section class="card chart-card ${esc(modifier || "")}">
        <div class="section-head">
          <div>
            <h3>${esc(title)}</h3>
            <p>${esc(subtitle || "")}</p>
          </div>
        </div>
        ${body}
      </section>
    `;
  }

  function verticalBarChart(items, legendLabel) {
    const normalizedItems = (items || [])
      .slice(0, 8)
      .map((item) => {
        if (Array.isArray(item)) {
          return {
            label: item[0],
            value: item[1],
            remaining: item[2]
          };
        }
        return item;
      });
    if (!normalizedItems.length) return `<div class="empty-state">No data available.</div>`;
      return `
        <div class="chart-frame chart-frame-vertical">
          <div class="vertical-bars">
            ${normalizedItems
              .map((item, index) => {
              const label = item.label;
              const total = num(item.value);
                const remaining =
                  item.remaining !== undefined && item.remaining !== null
                    ? Math.max(num(item.remaining), 0)
                    : 0;
                const used = Math.max(total - remaining, 0);
                const height = total ? 220 : 8;
                const remainingRatio = total ? (remaining / total) * 100 : 0;
                const usedRatio = total ? (used / total) * 100 : 0;
                return `
                  <div class="bar-col">
                    <div class="bar-tooltip">
                    <strong>${esc(label)}</strong>
                    <span>Total Budget: ${esc(fmt(total))}</span>
                    <span>Used Budget: ${esc(fmt(used))}</span>
                    <span>Remaining: ${esc(fmt(remaining))}</span>
                  </div>
                  <div class="bar-value">${esc(fmt(total))}</div>
                  <div class="bar-track">
                    <div class="bar-stack" style="height:${height}px" title="${esc(
                      `${label} | Total Budget: ${fmt(total)} | Used Budget: ${fmt(used)} | Remaining: ${fmt(remaining)}`
                    )}">
                      <div class="bar-segment bar-segment-remaining" style="height:${remainingRatio}%; background:${palette(index)}">
                        ${remainingRatio >= 22 ? `<span>${esc(fmt(remaining))}</span>` : ""}
                      </div>
                      <div class="bar-segment bar-segment-used" style="height:${usedRatio}%">
                        ${usedRatio >= 22 ? `<span>${esc(fmt(used))}</span>` : ""}
                      </div>
                    </div>
                  </div>
                  <div class="bar-label">${esc(label)}</div>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="chart-legend">
          <span class="legend-chip" style="--legend-color:${palette(0)}"></span>
          <span>${esc(legendLabel || "Remaining Budget")}</span>
          <span class="legend-chip legend-chip-muted"></span>
          <span>Used Budget</span>
        </div>
      </div>
    `;
  }

  function donutChart(items) {
      const safeItems = (items || []).slice(0, 6);
      if (!safeItems.length) return `<div class="empty-state">No data available.</div>`;
      const total = safeItems.reduce((sum, item) => sum + num(item[1]), 0) || 1;
      const size = 220;
      const center = size / 2;
      const radius = 72;
      const circumference = 2 * Math.PI * radius;
      let offset = 0;
      const rings = safeItems
        .map(([label, value], index) => {
          const amount = num(value);
          const dash = (amount / total) * circumference;
          const circle = `
            <circle
              class="donut-segment"
              cx="${center}"
              cy="${center}"
              r="${radius}"
              fill="none"
              stroke="${palette(index)}"
              stroke-width="44"
              stroke-linecap="butt"
              stroke-dasharray="${dash} ${Math.max(circumference - dash, 0)}"
              stroke-dashoffset="${-offset}"
              transform="rotate(-90 ${center} ${center})"
            >
              <title>${esc(label)}: ${esc(fmt(amount))}</title>
            </circle>
          `;
          offset += dash;
          return circle;
        })
        .join("");

      return `
        <div class="chart-frame chart-frame-donut">
          <div class="donut-wrap">
            <div class="donut-chart" title="Total Budget: ${esc(fmt(total))}">
              <svg viewBox="0 0 ${size} ${size}" class="donut-svg" aria-hidden="true">
                <circle
                  class="donut-ring-base"
                  cx="${center}"
                  cy="${center}"
                  r="${radius}"
                  fill="none"
                  stroke="#e3edf8"
                  stroke-width="44"
                />
                ${rings}
              </svg>
              <div class="donut-hole">
                <strong>${esc(fmt(total))}</strong>
                <span>Total</span>
              </div>
            </div>
          </div>
          <div class="chart-legend chart-legend-grid">
            ${safeItems
              .map(
                ([label, value], index) => `
                  <div class="legend-item legend-item-stacked" title="${esc(label)}: ${esc(fmt(value))}">
                    <div class="legend-line">
                      <span class="legend-chip" style="--legend-color:${palette(index)}"></span>
                      <span>${esc(label)}</span>
                    </div>
                    <strong class="legend-amount">${esc(fmt(value))}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
      </div>
    `;
  }

  function lineChart(series) {
      const safeSeries = (series || []).slice(0, 6);
      if (!safeSeries.length) return `<div class="empty-state">No data available.</div>`;
    const width = 520;
    const height = 250;
    const padLeft = 44;
    const padRight = 18;
    const padTop = 14;
    const padBottom = 34;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const maxValue = Math.max.apply(
      null,
      safeSeries.map((item) => Math.max(num(item.budget), num(item.expense))).concat([1])
    );

    function point(index, value) {
      const x = padLeft + (safeSeries.length === 1 ? plotWidth / 2 : (plotWidth / (safeSeries.length - 1)) * index);
      const y = padTop + plotHeight - (num(value) / maxValue) * plotHeight;
      return { x, y };
    }

      const budgetPoints = safeSeries.map((item, index) => point(index, item.budget));
      const expensePoints = safeSeries.map((item, index) => point(index, item.expense));
      const budgetPolyline = budgetPoints.map((p) => `${p.x},${p.y}`).join(" ");
      const expensePolyline = expensePoints.map((p) => `${p.x},${p.y}`).join(" ");
      const current = safeSeries[safeSeries.length - 1] || { label: "-", budget: 0, expense: 0 };
      const previous = safeSeries[safeSeries.length - 2] || { label: "-", budget: 0, expense: 0 };
      const totalBudget = safeSeries.reduce((sum, item) => sum + num(item.budget), 0);
      const totalExpense = safeSeries.reduce((sum, item) => sum + num(item.expense), 0);
      const budgetChange = num(current.budget) - num(previous.budget);
      const expenseChange = num(current.expense) - num(previous.expense);
      const budgetChangePct = num(previous.budget) ? (budgetChange / num(previous.budget)) * 100 : 0;
      const expenseChangePct = num(previous.expense) ? (expenseChange / num(previous.expense)) * 100 : 0;
      const trend =
        budgetChange > 0 ? "Upward trend" : budgetChange < 0 ? "Downward trend" : "Stable trend";
      const gridLines = Array.from({ length: 5 }, (_, index) => {
        const y = padTop + (plotHeight / 4) * index;
        return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="chart-grid-line"/>`;
      }).join("");

    return `
      <div class="chart-frame chart-frame-line">
        <svg viewBox="0 0 ${width} ${height}" class="line-chart-svg" aria-hidden="true">
          ${gridLines}
          <polyline points="${budgetPolyline}" class="line-series line-series-budget">
            <title>${esc("Budget trend")}</title>
          </polyline>
          <polyline points="${expensePolyline}" class="line-series line-series-expense">
            <title>${esc("Expense trend")}</title>
          </polyline>
          ${safeSeries
            .map((item, index) => {
              const p = budgetPoints[index];
              return `
                <g class="line-hover-dot line-hover-dot-budget">
                  <circle cx="${p.x}" cy="${p.y}" r="4" class="line-point line-point-budget"/>
                  <circle cx="${p.x}" cy="${p.y}" r="12" class="line-hit-target">
                    <title>${esc(`${item.label} | Budget: ${fmt(item.budget)}`)}</title>
                  </circle>
                  <text x="${p.x}" y="${p.y - 12}" text-anchor="middle" class="line-hover-label line-hover-label-budget">${esc(
                    fmt(item.budget)
                  )}</text>
                </g>
              `;
            })
            .join("")}
          ${safeSeries
            .map((item, index) => {
              const p = expensePoints[index];
              return `
                <g class="line-hover-dot line-hover-dot-expense">
                  <circle cx="${p.x}" cy="${p.y}" r="4" class="line-point line-point-expense"/>
                  <circle cx="${p.x}" cy="${p.y}" r="12" class="line-hit-target">
                    <title>${esc(`${item.label} | Expense: ${fmt(item.expense)}`)}</title>
                  </circle>
                  <text x="${p.x}" y="${p.y + 22}" text-anchor="middle" class="line-hover-label line-hover-label-expense">${esc(
                    fmt(item.expense)
                  )}</text>
                </g>
              `;
            })
            .join("")}
          ${safeSeries
            .map((item, index) => {
              const p = point(index, 0);
              return `<text x="${p.x}" y="${height - 8}" text-anchor="middle" class="line-axis-label">${esc(item.label)}</text>`;
            })
            .join("")}
        </svg>
          <div class="chart-legend chart-legend-inline">
            <div class="legend-item"><span class="legend-chip" style="--legend-color:#2f89dc"></span><span>Budget</span></div>
            <div class="legend-item"><span class="legend-chip" style="--legend-color:#f5a338"></span><span>Expense</span></div>
          </div>
          <div class="growth-insights-grid">
            <div class="growth-stat"><span>Trend</span><strong>${esc(trend)}</strong></div>
            <div class="growth-stat"><span>Last Year Budget (${esc(previous.label)})</span><strong>${esc(fmt(previous.budget))}</strong></div>
            <div class="growth-stat"><span>Current Budget (${esc(current.label)})</span><strong>${esc(fmt(current.budget))}</strong></div>
            <div class="growth-stat"><span>Total Budget</span><strong>${esc(fmt(totalBudget))}</strong></div>
            <div class="growth-stat"><span>Last Year Expense (${esc(previous.label)})</span><strong>${esc(fmt(previous.expense))}</strong></div>
            <div class="growth-stat"><span>Current Expense (${esc(current.label)})</span><strong>${esc(fmt(current.expense))}</strong></div>
            <div class="growth-stat"><span>Total Expense</span><strong>${esc(fmt(totalExpense))}</strong></div>
            <div class="growth-stat"><span>Budget Change % / Expense Change %</span><strong>${esc(pct(budgetChangePct))} / ${esc(pct(expenseChangePct))}</strong></div>
          </div>
        </div>
      `;
    }

  function horizontalBars(items) {
    const safeItems = (items || []).slice(0, 6);
    if (!safeItems.length) return `<div class="empty-state">No data available.</div>`;
    const maxValue = Math.max.apply(
      null,
      safeItems.map((item) => num(item[1])).concat([1])
    );
    return `
      <div class="chart-frame chart-frame-horizontal">
        <div class="horizontal-bars">
          ${safeItems
            .map(([label, value], index) => {
              const amount = num(value);
              const width = Math.max((amount / maxValue) * 100, amount ? 4 : 0);
              return `
                <div class="hbar-row">
                  <div class="hbar-label">${esc(label)}</div>
                  <div class="hbar-track">
                    <div class="hbar-fill" style="width:${width}%; background:${palette(index + 1)}" title="${esc(label)}: ${esc(
                      fmt(amount)
                    )}"></div>
                  </div>
                  <div class="hbar-value">${esc(fmt(amount))}</div>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="chart-legend">
          <span class="legend-chip" style="--legend-color:${palette(1)}"></span>
          <span>Budget</span>
        </div>
      </div>
    `;
  }

  function heatmapTable(matrix, locations, categories) {
    if (!locations.length || !categories.length) return `<div class="empty-state">No data available.</div>`;
    const maxValue = Math.max.apply(
      null,
      locations.flatMap((location) => categories.map((category) => num((matrix[location] || {})[category]))).concat([1])
    );

    return `
      <div class="table-wrap heatmap-wrap">
        <table class="heatmap-table">
          <thead>
            <tr>
              <th>Location / Category</th>
              ${categories.map((category) => `<th>${esc(category)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${locations
              .map((location) => {
                return `
                  <tr>
                    <td class="heatmap-row-label">${esc(location)}</td>
                    ${categories
                      .map((category) => {
                        const value = num((matrix[location] || {})[category]);
                        const strength = value ? 0.12 + (value / maxValue) * 0.78 : 0.06;
                        return `
                          <td class="heatmap-cell" style="background:rgba(28, 180, 206, ${strength.toFixed(2)})" title="${esc(
                            `${location} | ${category}: ${fmt(value)}`
                          )}">
                            ${value ? esc(fmt(value)) : "-"}
                          </td>
                        `;
                      })
                      .join("")}
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="dashboard-heatmap-legend">
        <span>Low</span>
        <i></i>
        <span>High</span>
        <em>${esc(fmt(maxValue))}</em>
      </div>
    `;
  }

  function plannerDistributionFactor(form) {
    const selectedLocation = form && form.location;
    const mode = form && form.costDistribution;
    if (mode !== "Distribution" || !selectedLocation) return 1;
    return num(ALLOCATION_DISTRIBUTION_MAP[selectedLocation]) / 100;
  }

  function plannerRawValueKey(key) {
    return `__raw_${key}`;
  }

  function isPlannerProjectEntry(form) {
    const fields = [form && form.newCategory, form && form.cate3, form && form.cate4, form && form.subCategory];
    return fields.some((value) => normalizeText(value).includes("new project"));
  }

  function sourcePlannerValue(form, key) {
    const rawKey = plannerRawValueKey(key);
    return form && form[rawKey] !== undefined ? form[rawKey] : form ? form[key] : "";
  }

  function preparePlannerSave() {
    const form = state.form || {};
    const factor = plannerDistributionFactor(form);
    if (factor === 1) return true;

    const nextForm = Object.assign({}, form);
    ["locFyCurrent"].concat(DRIVER_KEYS).forEach((key) => {
      const base = num(sourcePlannerValue(form, key));
      nextForm[key] = (base * factor).toFixed(2);
    });
    nextForm.locPercent = num(form.locLe)
      ? (((num(nextForm.locFyCurrent) - num(form.locLe)) / num(form.locLe)) * 100).toFixed(2)
      : "0.00";
    state.form = nextForm;
    return true;
  }

  function getAllocationSelectedCodingSet(controlsInput) {
    const controls = controlsInput || state.allocationControls || {};
    const selectedCoding = String(controls.coding || "").trim();
    const selectedCodings = selectedCoding
      ? [selectedCoding]
      : Array.isArray(controls.codings)
      ? controls.codings
      : controls.codingSearch
      ? [String(controls.codingSearch || "").trim()]
      : [];
    return new Set([].concat(selectedCodings).map((coding) => normalizeText(coding)).filter(Boolean));
  }

  function getAppliedAllocationEntries() {
    const mapByCoding = {};
    const dbEntries = Array.isArray(state.allocationDb) ? state.allocationDb : [];
    dbEntries.forEach((entry) => {
      const codingKey = normalizeText(entry && entry.coding);
      const ownerKey = normalizeText(entry && entry.owner);
      const financialYear = String((entry && (entry.financialYear || entry.year)) || "");
      if (!codingKey || !ownerKey) return;
      const key = `${codingKey}||${ownerKey}||${financialYear}`;
      mapByCoding[key] = Object.assign({}, entry, {
        coding: entry.coding || codingKey,
        owner: entry.owner || ownerKey,
        financialYear
      });
    });
    return Object.values(mapByCoding);
  }

  function allocationRowKey(coding, item, owner, financialYear) {
    return [normalizeText(coding), normalizeText(item), normalizeText(owner), normalizeText(financialYear)].join("||");
  }

  function allocationCellKey(rowKey, location) {
    return `${rowKey}||${normalizeText(location)}`;
  }

  function allocationInputValue(value) {
    const parsed = num(value);
    if (!Number.isFinite(parsed)) return "";
    const rounded = Math.round(parsed * 100) / 100;
    const fixed = rounded.toFixed(2);
    if (fixed.endsWith(".00")) return String(Math.trunc(rounded));
    return fixed.replace(/0$/, "");
  }

  function allocationRoundedValue(value) {
    return Math.round(num(value) * 100) / 100;
  }

  function isAllocationDistributionMode(mode) {
    const normalized = normalizeText(mode);
    return normalized === "distributed" || normalized === "distribution";
  }

  function allocationDistributionShareCard(locations, amountBase, sourceNote) {
    const orderedLocations = uniq([].concat(locations || [], Object.keys(ALLOCATION_DISTRIBUTION_MAP)));
    const rows = orderedLocations.map((location) => {
      const sharePercent = Object.prototype.hasOwnProperty.call(ALLOCATION_DISTRIBUTION_MAP, location)
        ? num(ALLOCATION_DISTRIBUTION_MAP[location])
        : 0;
      const shareAmount = num(amountBase) > 0 ? (num(amountBase) * sharePercent) / 100 : 0;
      return `
        <tr>
          <td>${esc(location)}</td>
          <td><span class="allocation-share-pill">${esc(pct(sharePercent))}</span></td>
          <td>${num(amountBase) > 0 ? esc(fmt(shareAmount)) : `<span class="muted-cell">Enter amount to preview</span>`}</td>
        </tr>
      `;
    });
    const totalPercent = orderedLocations.reduce((sum, location) => sum + num(ALLOCATION_DISTRIBUTION_MAP[location] || 0), 0);
    rows.push(`
      <tr class="table-total-row">
        <td><strong>Total</strong></td>
        <td><strong>${esc(pct(totalPercent))}</strong></td>
        <td><strong>${num(amountBase) > 0 ? esc(fmt(amountBase)) : "-"}</strong></td>
      </tr>
    `);

    return `
      <section class="card allocation-share-card">
        <div class="section-head">
          <div>
            <h3>Location Distribution Percentage</h3>
            <p>The same percentage map is used when Submit Record distributes the amount across all locations.</p>
          </div>
          <div class="allocation-share-summary">
            <span>Amount Base</span>
            <strong>${num(amountBase) > 0 ? esc(fmt(amountBase)) : "Not selected"}</strong>
          </div>
        </div>
        <div class="allocation-share-note">${esc(sourceNote || "Percentages are fixed as per the allocation map.")}</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Distribution %</th>
                <th>Distributed Amount</th>
              </tr>
            </thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function getAllocationBudgetContext(inputRecords, appliedEntriesInput) {
    const source = (inputRecords || []).map((record) => {
      const next = Object.assign({}, record);
      if (!String(next.item || "").trim()) {
        next.item = mappedItemForCode(next.coding) || "";
      }
      next.__allocationType = "Fixed Cost";
      return next;
    });
    const originalBudget = source.reduce((sum, record) => sum + num(record.locFyCurrent), 0);
    const appliedEntries = Array.isArray(appliedEntriesInput) ? appliedEntriesInput : getAppliedAllocationEntries();
    const configs = appliedEntries
      .map((entry) => {
        const codingKey = normalizeText(entry && entry.coding);
        const ownerKey = normalizeText(entry && entry.owner);
        if (!codingKey || !ownerKey) return null;
        return {
          coding: entry.coding || codingKey,
          codingKey,
          owner: entry.owner || ownerKey,
          ownerKey,
          financialYear: String(entry.financialYear || entry.year || "").trim(),
          amountInput: Math.max(0, num(entry.amountInput)),
          percentInput: Math.max(0, num(entry.percentInput)),
          targetAmount: Math.max(0, num(entry.targetAmount))
        };
      })
      .filter(Boolean);

    if (!configs.length) {
      return {
        records: source,
        originalBudget,
        adjustedBudget: originalBudget,
        distributedBudget: 0,
        fixedBudget: originalBudget,
        distributedCodingCount: 0,
        distributedActive: false
      };
    }

    const weightedLocations = getAllLocations().filter(
      (location) =>
        Object.prototype.hasOwnProperty.call(ALLOCATION_DISTRIBUTION_MAP, location) && num(ALLOCATION_DISTRIBUTION_MAP[location]) > 0
    );
    const weightTotal = weightedLocations.reduce((sum, location) => sum + num(ALLOCATION_DISTRIBUTION_MAP[location]), 0);
    if (!weightTotal) {
      return {
        records: source,
        originalBudget,
        adjustedBudget: originalBudget,
        distributedBudget: 0,
        fixedBudget: originalBudget,
        distributedCodingCount: 0,
        distributedActive: false
      };
    }

    const distributedRecords = [];
    const distributedMatchers = [];
    let distributedBudget = 0;
    configs.forEach((config) => {
      const matchesConfig = (row) =>
        normalizeText(row.coding) === config.codingKey &&
        normalizeText(row.owner) === config.ownerKey &&
        (!config.financialYear || String(row.financialYear || "") === config.financialYear);
      const codingRows = source.filter(matchesConfig);
      distributedMatchers.push(matchesConfig);

      if (!codingRows.length) {
        const codeProfile = getCodeProfile(config.coding) || {};
        codingRows.push({
          id: `alloc_virtual_${config.codingKey}_${config.ownerKey}_${config.financialYear || "all"}`,
          coding: config.coding,
          item: mappedItemForCode(config.coding) || "",
          owner: config.owner,
          owner1: "",
          financialYear: config.financialYear || "",
          location: "",
          locLe: 0,
          locFyCurrent: 0,
          locFyLast: 0,
          categoryIt: codeProfile.categoryIt || "",
          subCategoryMapped: codeProfile.subCategoryMapped || "",
          appCate: codeProfile.appCate || "",
          __allocationType: "Distributed"
        });
      }

      const codingOriginal = codingRows.reduce((sum, row) => sum + num(row.locFyCurrent), 0);
      let codingTarget = config.targetAmount;
      if (!codingTarget) {
        codingTarget =
          config.amountInput > 0
            ? config.amountInput
            : config.percentInput > 0
            ? (codingOriginal * config.percentInput) / 100
            : codingOriginal;
      }
      distributedBudget += codingTarget;
      const fallbackWeight = codingRows.length ? 1 / codingRows.length : 0;

      codingRows.forEach((row) => {
        const rowShare = codingOriginal > 0 ? num(row.locFyCurrent) / codingOriginal : fallbackWeight;
        const rowTarget = codingTarget * rowShare;

        weightedLocations.forEach((location) => {
          const mappedWeight = num(ALLOCATION_DISTRIBUTION_MAP[location]);
          const nextCurrent = (rowTarget * mappedWeight) / weightTotal;
          // Distribution mode should only spread current-year target budget.
          // LE and Last-Year values must come from explicit planner entries, not inferred splits.
          const nextLe = 0;
          const nextFyLast = 0;
          const mappedItem = mappedItemForCode(config.coding) || row.item || "";
          distributedRecords.push(
            Object.assign({}, row, {
              location,
              item: mappedItem,
              owner: config.owner || row.owner || "",
              locFyCurrent: nextCurrent,
              locLe: nextLe,
              locFyLast: nextFyLast,
              locPercent: nextLe ? ((nextCurrent - nextLe) / nextLe) * 100 : 0,
              __allocationType: "Distributed"
            })
          );
        });
      });
    });

    const fixedRecords = source.filter((record) => !distributedMatchers.some((match) => match(record)));
    const records = fixedRecords.concat(distributedRecords);
    const adjustedBudget = records.reduce((sum, record) => sum + num(record.locFyCurrent), 0);
    const fixedBudget = Math.max(0, adjustedBudget - distributedBudget);
    const distinctCodingCount = new Set(configs.map((config) => config.codingKey)).size;

    return {
      records,
      originalBudget,
      adjustedBudget,
      distributedBudget,
      fixedBudget,
      distributedCodingCount: distinctCodingCount,
      distributedActive: true
    };
  }

  function applyAllocationMatrixEditsToRecords(recordsInput) {
    const records = Array.isArray(recordsInput) ? recordsInput : [];
    const manualEdits =
      state && state.allocationMatrixEdits && typeof state.allocationMatrixEdits === "object" ? state.allocationMatrixEdits : {};
    const manualKeys = Object.keys(manualEdits || {});
    if (!manualKeys.length) return records;

    return records.map((record) => {
      const next = Object.assign({}, record);
      if (normalizeText(next.__allocationType || "Fixed Cost") !== "distributed") return next;
      const resolvedItem = String(next.item || "").trim() || mappedItemForCode(next.coding);
      const rowKey = allocationRowKey(next.coding || "", resolvedItem || "", next.owner || "", next.financialYear || "");
      const locationKey = next.location || "Unassigned";
      const cellKey = allocationCellKey(rowKey, locationKey);
      if (!Object.prototype.hasOwnProperty.call(manualEdits, cellKey)) return next;

      const editedValue = Math.max(0, num(manualEdits[cellKey]));
      next.locFyCurrent = editedValue;
      next.locPercent = num(next.locLe) ? ((editedValue - num(next.locLe)) / num(next.locLe)) * 100 : 0;
      return next;
    });
  }

  function rowsForDashboard() {
    const filters = state.dashboardFilters || {};
    const adjustedRecords = applyAllocationMatrixEditsToRecords(getAllocationBudgetContext(getRecords()).records);
    return adjustedRecords.filter((record) => {
      const locationFilter = String(filters.location || "").trim();
      const categoryFilter = String(filters.category || "").trim();
      const yearFilter = String(filters.financialYear || filters.year || "").trim();
      const ownerFilter = String(filters.owner || "").trim();
      const codingFilter = String(filters.coding || "").trim();
      const categoryValue = resolveGroupValue(record, "categoryIt");
      const ownerValue = resolveGroupValue(record, "owner");

      if (locationFilter && locationFilter !== "All" && record.location !== locationFilter) return false;
      if (categoryFilter && categoryFilter !== "All" && categoryValue !== categoryFilter) return false;
      if (yearFilter && yearFilter !== "All" && record.financialYear !== yearFilter) return false;
      if (ownerFilter && ownerFilter !== "All" && ownerValue !== ownerFilter) return false;
      if (codingFilter && codingFilter !== "All" && normalizeText(record.coding) !== normalizeText(codingFilter)) return false;
      return true;
    });
  }

  function resolveGroupValue(record, key) {
    if (key === "categoryIt") {
      return record.categoryIt || record.subCategoryMapped || record.appCate || "Unassigned";
    }
    if (key === "owner") {
      return record.owner || record.owner1 || "Unassigned";
    }
    return record[key] || "Unassigned";
  }

  function groupedRows(records, key) {
    const grouped = {};
    records.forEach((record) => {
      const groupKey = resolveGroupValue(record, key);
      grouped[groupKey] = (grouped[groupKey] || 0) + num(record.locFyCurrent);
    });
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }

  function summaryRows() {
    const filters = state.summaryFilters || {};
    return getRecords().filter((record) => {
      const locationFilter = String(filters.location || "").trim();
      const yearFilter = String(filters.financialYear || "").trim();
      if (locationFilter && locationFilter !== "All" && record.location !== locationFilter) return false;
      if (yearFilter && yearFilter !== "All" && record.financialYear !== yearFilter) return false;
      return true;
    });
  }

  function clampPercentValue(value) {
    return Math.max(0, Math.min(num(value), 100));
  }

  function dashboardPanel(title, subtitle, body, modifier) {
    return `
      <section class="dashboard-panel ${esc(modifier || "")}">
        <div class="dashboard-panel-head">
          <div>
            <h3>${esc(title)}</h3>
            <p>${esc(subtitle || "")}</p>
          </div>
        </div>
        ${body}
      </section>
    `;
  }

  function dashboardHeroOverview(currentYearBudget, totalExpense, remaining, growth, utilization, allocationMode, modeSuffix, modeBadgeClass, recordsCount) {
    const utilizationValue = clampPercentValue(utilization);
    const growthValue = clampPercentValue(Math.abs(growth));
    const isGrowthPositive = num(growth) >= 0;
    return `
      <section class="dashboard-hero">
        <div class="dashboard-hero-main">
          <div class="dashboard-hero-kicker">
            <span class="mode-badge ${esc(modeBadgeClass)}">Mode: ${esc(allocationMode + modeSuffix)}</span>
            <span>${esc(recordsCount)} records matched</span>
          </div>
          <h3>Total Budget</h3>
          <div class="dashboard-hero-value">${esc(fmt(currentYearBudget))}</div>
          <p>Current year budget after active dashboard filters and applied allocation distribution.</p>
        </div>
        <div class="dashboard-hero-metrics">
          <div class="dashboard-hero-meter" style="--meter-value:${utilizationValue}%; --meter-color:#0ea5e9;">
            <div class="dashboard-meter-ring"><strong>${esc(pct(utilization))}</strong><span>Utilization</span></div>
          </div>
          <div class="dashboard-hero-meter" style="--meter-value:${growthValue}%; --meter-color:${isGrowthPositive ? "#16a34a" : "#ef4444"};">
            <div class="dashboard-meter-ring"><strong>${esc(pct(growth))}</strong><span>Growth</span></div>
          </div>
          <div class="dashboard-hero-stack">
            <span>Last Expense</span>
            <strong>${esc(fmt(totalExpense))}</strong>
            <span>Remaining</span>
            <strong>${esc(fmt(remaining))}</strong>
          </div>
        </div>
      </section>
    `;
  }

  function dashboardKpiTile(label, value, note, tone, fillPercent) {
    const fill = clampPercentValue(fillPercent);
    return `
      <article class="dashboard-kpi-tile dashboard-kpi-${esc(tone || "blue")}">
        <div class="dashboard-kpi-label">${esc(label)}</div>
        <strong>${esc(value)}</strong>
        <p>${esc(note || "")}</p>
        <div class="dashboard-kpi-rail"><i style="width:${fill}%"></i></div>
      </article>
    `;
  }

  function dashboardLocationLanes(items) {
    const safeItems = (items || []).slice();
    if (!safeItems.length) return `<div class="empty-state">No data available.</div>`;
    const maxValue = Math.max.apply(null, safeItems.map((item) => num(item.value)).concat([1]));
    return `
      <div class="dashboard-location-lanes">
        ${safeItems
          .map((item, index) => {
            const total = num(item.value);
            const remaining = Math.max(num(item.remaining), 0);
            const used = Math.max(total - remaining, 0);
            const laneWidth = Math.max((total / maxValue) * 100, total ? 5 : 0);
            const usedWidth = total ? Math.min((used / total) * 100, 100) : 0;
            const remainingWidth = Math.max(100 - usedWidth, 0);
            return `
              <div class="dashboard-location-row">
                <div class="dashboard-location-rank">${index + 1}</div>
                <div class="dashboard-location-name">${esc(item.label)}</div>
                <div class="dashboard-location-track">
                  <div class="dashboard-location-fill" style="width:${laneWidth}%">
                    <span class="dashboard-location-used" style="width:${usedWidth}%"></span>
                    <span class="dashboard-location-remaining" style="width:${remainingWidth}%"></span>
                  </div>
                </div>
                <div class="dashboard-location-value">
                  <strong>${esc(fmt(total))}</strong>
                  <span>${esc(fmt(used))} used</span>
                </div>
              </div>
            `;
          })
          .join("")}
        <div class="dashboard-chart-legend">
          <span><i class="dashboard-used-chip"></i>Used budget</span>
          <span><i class="dashboard-remaining-chip"></i>Remaining budget</span>
        </div>
      </div>
    `;
  }

  function dashboardCategoryTiles(items, totalBudget) {
    const safeItems = (items || []).slice(0, 8);
    if (!safeItems.length) return `<div class="empty-state">No data available.</div>`;
    const total = num(totalBudget) || safeItems.reduce((sum, item) => sum + num(item[1]), 0) || 1;
    return `
      <div class="dashboard-category-mosaic">
        ${safeItems
          .map(([label, value], index) => {
            const share = (num(value) / total) * 100;
            return `
              <article class="dashboard-category-tile dashboard-category-${index % 5}">
                <span>${esc(label)}</span>
                <strong>${esc(fmt(value))}</strong>
                <small>${esc(pct(share))} of budget</small>
                <i style="width:${Math.max(share, num(value) ? 6 : 0)}%"></i>
              </article>
            `;
          })
          .join("")}
      </div>
      <div class="dashboard-chart-legend">
        <span><i class="dashboard-budget-chip"></i>Tile value</span>
        <span><i class="dashboard-remaining-chip"></i>Bar = share of total</span>
      </div>
    `;
  }

  function dashboardTrendAreaChart(series) {
    const safeSeries = (series || []).slice(0, 8);
    if (!safeSeries.length) return `<div class="empty-state">No data available.</div>`;
    const width = 620;
    const height = 280;
    const padLeft = 42;
    const padRight = 22;
    const padTop = 18;
    const padBottom = 38;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const maxValue = Math.max.apply(
      null,
      safeSeries.flatMap((item) => [num(item.budget), num(item.expense)]).concat([1])
    );

    function point(index, value) {
      const x = padLeft + (safeSeries.length === 1 ? plotWidth / 2 : (plotWidth / (safeSeries.length - 1)) * index);
      const y = padTop + plotHeight - (num(value) / maxValue) * plotHeight;
      return { x, y };
    }

    function pathFor(points) {
      return points.map((p, index) => `${index ? "L" : "M"}${p.x},${p.y}`).join(" ");
    }

    function areaFor(points) {
      const first = points[0];
      const last = points[points.length - 1];
      return `${pathFor(points)} L${last.x},${padTop + plotHeight} L${first.x},${padTop + plotHeight} Z`;
    }

    const budgetPoints = safeSeries.map((item, index) => point(index, item.budget));
    const expensePoints = safeSeries.map((item, index) => point(index, item.expense));
    const gridLines = Array.from({ length: 4 }, (_, index) => {
      const y = padTop + (plotHeight / 3) * index;
      return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="dashboard-trend-grid"/>`;
    }).join("");

    return `
      <div class="dashboard-trend-wrap">
        <svg viewBox="0 0 ${width} ${height}" class="dashboard-trend-svg" aria-hidden="true">
          <defs>
            <linearGradient id="dashboardBudgetArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.03"/>
            </linearGradient>
            <linearGradient id="dashboardExpenseArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#a855f7" stop-opacity="0.22"/>
              <stop offset="100%" stop-color="#a855f7" stop-opacity="0.02"/>
            </linearGradient>
          </defs>
          ${gridLines}
          <path d="${areaFor(budgetPoints)}" class="dashboard-area-budget"/>
          <path d="${areaFor(expensePoints)}" class="dashboard-area-expense"/>
          <path d="${pathFor(budgetPoints)}" class="dashboard-line-budget"/>
          <path d="${pathFor(expensePoints)}" class="dashboard-line-expense"/>
          ${safeSeries
            .map((item, index) => {
              const budgetPoint = budgetPoints[index];
              const expensePoint = expensePoints[index];
              const axisPoint = point(index, 0);
              return `
                <g>
                  <circle cx="${budgetPoint.x}" cy="${budgetPoint.y}" r="4" class="dashboard-dot-budget">
                    <title>${esc(`${item.label} | Budget: ${fmt(item.budget)}`)}</title>
                  </circle>
                  <circle cx="${expensePoint.x}" cy="${expensePoint.y}" r="4" class="dashboard-dot-expense">
                    <title>${esc(`${item.label} | Expense: ${fmt(item.expense)}`)}</title>
                  </circle>
                  <text x="${budgetPoint.x}" y="${budgetPoint.y - 10}" text-anchor="middle" class="dashboard-point-label dashboard-point-label-budget">${esc(
                    fmt(item.budget)
                  )}</text>
                  <text x="${expensePoint.x}" y="${expensePoint.y + 16}" text-anchor="middle" class="dashboard-point-label dashboard-point-label-expense">${esc(
                    fmt(item.expense)
                  )}</text>
                  <text x="${axisPoint.x}" y="${height - 10}" text-anchor="middle" class="dashboard-axis-label">${esc(item.label)}</text>
                </g>
              `;
            })
            .join("")}
        </svg>
        <div class="dashboard-chart-legend">
          <span><i class="dashboard-budget-chip"></i>Budget</span>
          <span><i class="dashboard-expense-chip"></i>Expense</span>
        </div>
      </div>
    `;
  }

  function dashboardOwnerLeaderboard(items) {
    const safeItems = (items || []).slice(0, 7);
    if (!safeItems.length) return `<div class="empty-state">No data available.</div>`;
    const maxValue = Math.max.apply(null, safeItems.map((item) => num(item[1])).concat([1]));
    return `
      <div class="dashboard-owner-board">
        ${safeItems
          .map(([label, value], index) => {
            const width = Math.max((num(value) / maxValue) * 100, num(value) ? 5 : 0);
            return `
              <div class="dashboard-owner-row">
                <span>${index + 1}</span>
                <div>
                  <strong>${esc(label)}</strong>
                  <i><b style="width:${width}%"></b></i>
                </div>
                <em>${esc(fmt(value))}</em>
              </div>
            `;
          })
          .join("")}
      </div>
      <div class="dashboard-chart-legend">
        <span><i class="dashboard-used-chip"></i>Bar length = budget</span>
      </div>
    `;
  }

  function dashboardHighlightGrid(items) {
    return `
      <div class="dashboard-highlight-grid">
        ${items
          .map(
            ([label, value, note]) => `
              <article class="dashboard-highlight">
                <span>${esc(label)}</span>
                <strong>${esc(value)}</strong>
                <small>${esc(note || "")}</small>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function dashboardTopEightyInsights(records, totalBudget) {
    const rows = Array.isArray(records) ? records : [];
    const budgetTotal = Math.max(num(totalBudget), 0);
    if (!rows.length || !budgetTotal) return `<div class="empty-state">No data available.</div>`;

    const groupedByCodingItem = {};
    rows.forEach((record) => {
      const coding = String(record.coding || "Unassigned").trim() || "Unassigned";
      const item = String(record.item || "Unassigned").trim() || "Unassigned";
      const key = `${coding}||${item}`;
      if (!groupedByCodingItem[key]) {
        groupedByCodingItem[key] = {
          coding,
          item,
          current: 0,
          last: 0
        };
      }
      groupedByCodingItem[key].current += num(record.locFyCurrent);
      groupedByCodingItem[key].last += num(record.locFyLast);
    });

    const groupedRows = Object.values(groupedByCodingItem).sort((left, right) => right.current - left.current);
    let runningAmount = 0;
    const topEightyRows = [];

    groupedRows.forEach((row) => {
      if (!row.current) return;
      const sharePct = (row.current / budgetTotal) * 100;
      const before = runningAmount;
      const beforePct = (before / budgetTotal) * 100;
      if (beforePct >= 80) return;
      runningAmount += row.current;
      const cumulativePct = (runningAmount / budgetTotal) * 100;
      const increasePct = row.last ? ((row.current - row.last) / row.last) * 100 : row.current ? Number.POSITIVE_INFINITY : 0;
      topEightyRows.push({
        coding: row.coding,
        item: row.item,
        current: row.current,
        last: row.last,
        sharePct,
        cumulativePct,
        increasePct
      });
    });

    const topAmount = topEightyRows.reduce((sum, row) => sum + num(row.current), 0);
    const topCoveragePct = budgetTotal ? (topAmount / budgetTotal) * 100 : 0;
    const restAmount = Math.max(budgetTotal - topAmount, 0);
    const restPct = Math.max(100 - topCoveragePct, 0);
    const displayTopPct = clampPercentValue(topCoveragePct);
    const displayRestPct = clampPercentValue(restPct);

    function increaseBadge(value) {
      if (!Number.isFinite(value)) return `<span class="trend-badge trend-up">New</span>`;
      if (value >= 80) return `<span class="trend-badge trend-up">${esc(pct(value))}</span>`;
      if (value >= 75) return `<span class="trend-badge trend-flat">${esc(pct(value))}</span>`;
      if (value > 0) return `<span class="trend-badge trend-up">${esc(pct(value))}</span>`;
      if (value < 0) return `<span class="trend-badge trend-down">${esc(pct(Math.abs(value)))}</span>`;
      return `<span class="trend-badge trend-flat">${esc(pct(0))}</span>`;
    }

    const paretoRows = topEightyRows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(row.coding)}</td>
        <td>${esc(row.item)}</td>
        <td>${esc(fmt(row.current))}</td>
        <td>${esc(pct(row.sharePct))}</td>
        <td>${esc(pct(row.cumulativePct))}</td>
        <td>${esc(fmt(row.last))}</td>
        <td>${increaseBadge(row.increasePct)}</td>
      </tr>
    `);

    const increaseAlertRows = groupedRows
      .map((row) => {
        const increasePct = row.last ? ((row.current - row.last) / row.last) * 100 : row.current ? Number.POSITIVE_INFINITY : 0;
        return Object.assign({}, row, { increasePct });
      })
      .filter((row) => !Number.isFinite(row.increasePct) || row.increasePct >= 75)
      .sort((left, right) => {
        const leftValue = Number.isFinite(left.increasePct) ? left.increasePct : Number.POSITIVE_INFINITY;
        const rightValue = Number.isFinite(right.increasePct) ? right.increasePct : Number.POSITIVE_INFINITY;
        return rightValue - leftValue;
      })
      .map((row) => `
        <tr class="${!Number.isFinite(row.increasePct) || row.increasePct >= 80 ? "dashboard-alert-critical" : "dashboard-alert-watch"}">
          <td>${esc(row.coding)}</td>
          <td>${esc(row.item)}</td>
          <td>${esc(fmt(row.last))}</td>
          <td>${esc(fmt(row.current))}</td>
          <td>${increaseBadge(row.increasePct)}</td>
          <td>${!Number.isFinite(row.increasePct) || row.increasePct >= 80 ? "Above 80%" : "Around 80%"}</td>
        </tr>
      `);

    return `
      <div class="dashboard-top80">
        <div class="dashboard-top80-overview">
          <article>
            <span>Total Budget</span>
            <strong>${esc(fmt(budgetTotal))}</strong>
          </article>
          <article>
            <span>Top 80% Bucket</span>
            <strong>${esc(fmt(topAmount))}</strong>
          </article>
          <article>
            <span>Coverage</span>
            <strong>${esc(pct(topCoveragePct))}</strong>
          </article>
          <article>
            <span>Items in Top Bucket</span>
            <strong>${esc(String(topEightyRows.length))}</strong>
          </article>
        </div>

        <div class="dashboard-top80-bar">
          <div class="dashboard-top80-fill" style="width:${displayTopPct}%">${displayTopPct >= 15 ? esc(pct(topCoveragePct)) : ""}</div>
          <div class="dashboard-top80-rest" style="width:${displayRestPct}%">${displayRestPct >= 15 ? esc(pct(restPct)) : ""}</div>
        </div>
        <div class="dashboard-chart-legend">
          <span><i class="dashboard-used-chip"></i>Top contributors (${esc(fmt(topAmount))})</span>
          <span><i class="dashboard-remaining-chip"></i>Remaining (${esc(fmt(restAmount))})</span>
        </div>

        <div class="table-wrap dashboard-top80-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Coding</th>
                <th>Item</th>
                <th>Current Budget</th>
                <th>Share %</th>
                <th>Cumulative %</th>
                <th>FY Last Year</th>
                <th>Change %</th>
              </tr>
            </thead>
            <tbody>
              ${
                paretoRows.length
                  ? paretoRows.join("")
                  : `<tr><td colspan="8" class="empty-state">No data available.</td></tr>`
              }
            </tbody>
          </table>
        </div>

        <div class="table-wrap dashboard-alert-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Coding</th>
                <th>Item</th>
                <th>FY Last Year</th>
                <th>FY Chosen Year</th>
                <th>Increase %</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              ${
                increaseAlertRows.length
                  ? increaseAlertRows.join("")
                  : `<tr><td colspan="6" class="empty-state">No coding/item is around or above 80% increase in current filter.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderDashboard() {
    const records = rowsForDashboard();
    const appliedEntries = getAppliedAllocationEntries();
    const selectedCodingCount = appliedEntries.length;
    const allocationMode = selectedCodingCount ? "Distributed" : "Fixed Cost";
    const modeBadgeClass = allocationMode === "Distributed" ? "mode-badge-distributed" : "mode-badge-fixed";
    const modeSuffix =
      allocationMode === "Distributed" && selectedCodingCount
        ? ` (${selectedCodingCount} coding${selectedCodingCount > 1 ? "s" : ""})`
        : "";
    const currentYearBudget = records.reduce((sum, record) => sum + num(record.locFyCurrent), 0);
    const lastYearBudget = records.reduce((sum, record) => sum + num(record.locFyLast), 0);
    const totalExpense = records.reduce((sum, record) => sum + num(record.locLe), 0);
    const distributedBudget = records.reduce(
      (sum, record) => sum + (record.__allocationType === "Distributed" ? num(record.locFyCurrent) : 0),
      0
    );
    const fixedCostBudget = currentYearBudget - distributedBudget;
    const distributedCodingCount = new Set(
      records
        .filter((record) => record.__allocationType === "Distributed")
        .map((record) => normalizeText(record.coding))
        .filter(Boolean)
    ).size;
    const growth = totalExpense ? ((currentYearBudget - totalExpense) / totalExpense) * 100 : 0;
    const remaining = currentYearBudget - totalExpense;
    const utilizedAmount = currentYearBudget - remaining;
    const utilization = currentYearBudget ? (utilizedAmount / currentYearBudget) * 100 : 0;

    const locationOptions = getAllLocations();
    const categoryOptions = optionValuesForKey("categoryIt");
    const yearOptions = optionValuesForKey("financialYear");
    const ownerOptions = optionValuesForKey("owner");
    const codingOptionMap = {};
    []
      .concat(getRecords().map((record) => record.coding), (data.FALLBACK_OPTIONS && data.FALLBACK_OPTIONS.coding) || [], optionValuesForKey("coding"))
      .filter(Boolean)
      .forEach((coding) => {
        const key = normalizeText(coding);
        if (key && !codingOptionMap[key]) codingOptionMap[key] = coding;
      });
    const codingOptions = Object.values(codingOptionMap).sort((left, right) => String(left).localeCompare(String(right)));

    const locationGroups = groupedRows(records, "location");
    const categoryGroups = groupedRows(records, "categoryIt");
    const expenseByLocation = {};
    records.forEach((record) => {
      const location = record.location || "Unassigned";
      expenseByLocation[location] = (expenseByLocation[location] || 0) + num(record.locLe);
    });
    const locationChartItems = locationGroups.map(([location, budget]) => ({
      label: location,
      value: budget,
      remaining: budget - num(expenseByLocation[location] || 0)
    }));

    const yearGroups = {};
    records.forEach((record) => {
      const key = record.financialYear || "Unassigned";
      if (!yearGroups[key]) yearGroups[key] = { budget: 0, le: 0 };
      yearGroups[key].budget += num(record.locFyCurrent);
      yearGroups[key].le += num(record.locLe);
    });
    const growthSeries = Object.keys(yearGroups)
      .sort()
      .map((year) => ({
        label: year,
        budget: yearGroups[year].budget,
        expense: yearGroups[year].le
      }));

    const ownerGroups = groupedRows(records, "owner");

    const topLocation = locationGroups[0]?.[0] || "-";
    const topCategory = categoryGroups[0]?.[0] || "-";
    const topOwner = ownerGroups[0]?.[0] || "-";
    const topLocations = locationGroups.map((item) => item[0]);
    const topCategories = categoryGroups.map((item) => item[0]);

    const heatmapMatrix = {};
    topLocations.forEach((location) => {
      heatmapMatrix[location] = {};
      topCategories.forEach((category) => {
        heatmapMatrix[location][category] = 0;
      });
    });
    records.forEach((record) => {
      if (!topLocations.includes(record.location) || !topCategories.includes(record.categoryIt)) return;
      heatmapMatrix[record.location][record.categoryIt] += num(record.locFyCurrent);
    });

    const activeLocationCount = locationGroups.length;
    const uniqueItemCount = groupedRows(records, "item").length;
    const averageBudget = records.length ? currentYearBudget / records.length : 0;

    return `
      <section class="card dashboard-filter-panel">
        <div class="section-head">
          <div>
            <h3>Enterprise Dashboard Filters</h3>
            <p>Filter location, category, year, and owner to focus the dashboard story.</p>
          </div>
          <div class="dashboard-filter-meta">
            <div class="meta">${esc(records.length)} records matched</div>
            <button type="button" class="btn btn-soft" data-action="dashboard-export">Download PDF</button>
          </div>
        </div>
        <div class="filter-grid">
          ${searchCard("dashboard-location", "Location", (state.dashboardFilters || {}).location || "", ["All"].concat(locationOptions), "Search location")}
          ${searchCard("dashboard-category", "Category", (state.dashboardFilters || {}).category || "", ["All"].concat(categoryOptions), "Search category")}
          ${searchCard("dashboard-coding", "Coding", (state.dashboardFilters || {}).coding || "", ["All"].concat(codingOptions), "Search coding")}
          ${searchCard(
            "dashboard-financialYear",
            "Financial Year",
            (state.dashboardFilters || {}).financialYear || "",
            ["All"].concat(yearOptions),
            "Search financial year"
          )}
          ${searchCard("dashboard-owner", "Owner", (state.dashboardFilters || {}).owner || "", ["All"].concat(ownerOptions), "Search owner")}
        </div>
      </section>

      ${dashboardHeroOverview(
        currentYearBudget,
        totalExpense,
        remaining,
        growth,
        utilization,
        allocationMode,
        modeSuffix,
        modeBadgeClass,
        records.length
      )}

      <section class="dashboard-kpi-deck">
        ${dashboardKpiTile(
          "Last Year Budget",
          fmt(lastYearBudget),
          "Budget baseline from the filtered planner rows",
          "blue",
          currentYearBudget ? (lastYearBudget / currentYearBudget) * 100 : 0
        )}
        ${dashboardKpiTile("Current Year Budget", fmt(currentYearBudget), "Selected FY budget total", "teal", 100)}
        ${dashboardKpiTile("LE", fmt(totalExpense), "Last estimate / expense total", "violet", currentYearBudget ? (totalExpense / currentYearBudget) * 100 : 0)}
        ${dashboardKpiTile(
          "Remaining Budget",
          fmt(remaining),
          "Current year budget minus LE",
          "amber",
          currentYearBudget ? (Math.max(remaining, 0) / currentYearBudget) * 100 : 0
        )}
        ${dashboardKpiTile("Growth %", pct(growth), "Current budget vs LE", "green", Math.abs(growth))}
        ${dashboardKpiTile("Utilization %", pct(utilization), "Used budget against current budget", "rose", utilization)}
      </section>

      <section class="dashboard-allocation-strip">
        ${dashboardKpiTile(
          "Distributed Budget",
          fmt(distributedBudget),
          distributedCodingCount
            ? `${distributedCodingCount} coding(s) running in Distributed mode`
            : "No coding selected in Distributed mode",
          "green",
          currentYearBudget ? (distributedBudget / currentYearBudget) * 100 : 0
        )}
        ${dashboardKpiTile("Fixed Cost Budget", fmt(fixedCostBudget), "Current-year budget still in fixed-cost rows", "slate", currentYearBudget ? (fixedCostBudget / currentYearBudget) * 100 : 0)}
      </section>

      <section class="dashboard-grid dashboard-grid-primary">
        ${dashboardPanel("Location Budget Pulse", "All filtered MAX Hospital locations by current budget with used and remaining split.", dashboardLocationLanes(locationChartItems), "dashboard-panel-large")}
        ${dashboardPanel("Category Mix", "Top IT category share inside the current dashboard scope.", dashboardCategoryTiles(categoryGroups, currentYearBudget))}
      </section>

      <section class="dashboard-grid dashboard-grid-secondary">
        ${dashboardPanel("Growth Trajectory", "Budget and expense movement across financial years.", dashboardTrendAreaChart(growthSeries), "dashboard-panel-large")}
        ${dashboardPanel("Owner Leaderboard", "Budget contribution by owner.", dashboardOwnerLeaderboard(ownerGroups))}
      </section>

      ${dashboardPanel(
        "Top 80% Budget Utilization",
        "Top coding/item contributors that cumulatively make around 80% of total budget, plus around/above 80% increase alerts vs last year.",
        dashboardTopEightyInsights(records, currentYearBudget),
        "dashboard-panel-large"
      )}

      ${dashboardPanel(
        "Executive Highlights",
        "Quick read on the filtered dataset.",
        dashboardHighlightGrid([
          ["Top Location", topLocation, "Highest current budget"],
          ["Top Category", topCategory, "Highest category spend"],
          ["Top Owner", topOwner, "Largest owner budget"],
          ["Active Locations", String(activeLocationCount), "Locations in current filter"],
          ["Unique Items", String(uniqueItemCount), "Planner item coverage"],
          ["Average Budget / Row", records.length ? fmt(averageBudget) : "0", "Current budget divided by matched records"]
        ])
      )}

      ${dashboardPanel(
        "Location vs Category Heatmap",
        "Planner budget intensity across all filtered locations and categories.",
        heatmapTable(heatmapMatrix, topLocations, topCategories),
        "dashboard-heatmap-panel"
      )}
    `;
  }

  function renderPlanner() {
    const form = state.form || {};
    const yearOptions = optionValuesForKey("financialYear");
    const locationOptions = getAllLocations();
    const selectedYear = form.financialYear || "";
    const selectedLocation = form.location || "";
    const showLocationSection = Boolean(form.costDistribution && selectedYear && selectedLocation);
    const lastYear = prevYear(selectedYear);
    const isNewProjectEntry = isPlannerProjectEntry(form);
    const distributionPercent = num(ALLOCATION_DISTRIBUTION_MAP[selectedLocation] || 0);
    const distributionFactor = form.costDistribution === "Distribution" ? distributionPercent / 100 : 1;
    const effectiveCurrentFy = num(form.locFyCurrent) * distributionFactor;
    const percentChange = num(form.locLe) ? ((effectiveCurrentFy - num(form.locLe)) / num(form.locLe)) * 100 : 0;
    // Keep mapped fields editable so users can adjust values after auto-fill.
    const locked = new Set();

    const fields = [
      ["coding", "Coding", "Select coding"],
      ["item", "Item", "Select item"],
      ["subCategoryMapped", "Sub Category (Mapped)", "Select mapped sub category"],
      ["categoryIt", "Category_IT", "Select category"],
      ["subCategory", "Sub Category", "Select sub category"],
      ["newCategory", "New Category", "Select new category"],
      ["appCate", "App Cate.", "Select app cate."],
      ["cate3", "Cate.3", "Select cate.3"],
      ["cate4", "Cate.4", "Select cate.4"],
      ["owner1", "Owner1", "Select owner1"],
      ["owner", "Owner", "Select owner"],
      ["costCenterDepartment", "Cost Center / Department", "Select cost center / department"]
    ];

    const plannerCards = fields
      .map(([key, label, placeholder]) =>
        searchCard(`planner-${key}`, label, form[key] || "", optionValuesForKey(key), placeholder, locked.has(key))
      )
      .join("");

    const savedFilters = state.plannerSavedFilters || {};
    const savedYear = String(savedFilters.financialYear || "");
    const savedLocation = String(savedFilters.location || "");
    const savedCoding = String(savedFilters.coding || "");
    const savedItem = String(savedFilters.item || "");
    const savedOwner = String(savedFilters.owner || "");

    const allRecords = getRecords();
    const savedFilteredRecords = allRecords.filter((record) => {
      if (savedYear && savedYear !== "All" && String(record.financialYear || "") !== savedYear) return false;
      if (savedLocation && savedLocation !== "All" && String(record.location || "") !== savedLocation) return false;
      if (savedCoding && savedCoding !== "All" && normalizeText(record.coding) !== normalizeText(savedCoding)) return false;
      if (savedItem && savedItem !== "All" && normalizeText(record.item) !== normalizeText(savedItem)) return false;
      if (savedOwner && savedOwner !== "All" && normalizeText(record.owner) !== normalizeText(savedOwner)) return false;
      return true;
    });

    function plannerChangeBadge(changePercent) {
      const value = num(changePercent);
      if (value > 0) return `<span class="trend-badge trend-up">&uarr; ${esc(pct(value))}</span>`;
      if (value < 0) return `<span class="trend-badge trend-down">&darr; ${esc(pct(Math.abs(value)))}</span>`;
      return `<span class="trend-badge trend-flat">&harr; ${esc(pct(0))}</span>`;
    }

    const savedRows = savedFilteredRecords.map((record) => {
      const last = num(record.locFyLast);
      const current = num(record.locFyCurrent);
      const changePct = last ? ((current - last) / last) * 100 : 0;
      return `
        <tr>
          <td>${esc(record.financialYear || "")}</td>
          <td>${esc(record.location || "")}</td>
          <td>${esc(record.coding || "")}</td>
          <td>${esc(record.item || "")}</td>
          <td>${esc(fmt(record.locFyCurrent || 0))}</td>
          <td>${esc(fmt(record.locFyLast || 0))}</td>
          <td>${plannerChangeBadge(changePct)}</td>
          <td>${esc(fmt(record.locLe || 0))}</td>
          <td>${esc(record.owner || "")}</td>
          <td class="row-actions">
            <button type="button" class="btn btn-soft" data-action="edit-record" data-id="${esc(record.id || "")}">Edit</button>
            <button type="button" class="btn btn-soft" data-action="delete-record" data-id="${esc(record.id || "")}">Delete</button>
          </td>
        </tr>
      `;
    });

    return `
      <section class="card">
        <div class="section-head">
          <div>
            <h3>Planning Inputs</h3>
            <p>Select coding or item to auto-map the related planning fields.</p>
          </div>
        </div>
        <div class="form-grid">${plannerCards}</div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>MAX Hospital Budget</h3>
            <p>Select Cost Distribution, Financial Year, and MAX Hospital to open the location entry section.</p>
          </div>
          ${
            form.costDistribution === "Distribution" && selectedLocation
              ? `<div class="meta">${esc(selectedLocation)} share: ${esc(distributionPercent.toFixed(2))}%</div>`
              : ""
          }
        </div>
        <div class="form-grid">
          ${selectCard("planner-costDistribution", "Cost Distribution", form.costDistribution || "", optionValuesForKey("costDistribution"), "Select Cost Distribution")}
          ${selectCard("planner-financialYear", "Financial Year", form.financialYear || "", yearOptions, "Select financial year")}
          ${selectCard("planner-location", "MAX Hospital", form.location || "", locationOptions, "Select location")}
          ${
            form.financialYear && form.location
              ? selectCard(
                  "planner-entryType",
                  "Entry Type",
                  form.entryType || "Budget Taken",
                  ["Budget Taken", "Expense"],
                  "Select entry type"
                )
              : ""
          }
        </div>
        ${
          showLocationSection
            ? `
              <div class="section-mini-title">${esc(selectedLocation)} Location Data</div>
              <div class="form-grid-compact planner-detail-grid">
                ${inputCard(
                  "planner-locLe",
                  form.entryType === "Expense" ? `${selectedLocation} Expense (Same FY)` : `${selectedLocation} LE (Last Year Expense)`,
                  form.locLe || "",
                  isNewProjectEntry ? "New project: LE not required" : "Enter / auto-pull LE",
                  "number",
                  isNewProjectEntry
                )}
                ${inputCard(
                  "planner-locFyCurrent",
                  `${selectedLocation} FY ${selectedYear} (Current Year)`,
                  form.locFyCurrent || "",
                  form.entryType === "Expense" ? "Auto-pulled from saved budget for the same FY" : "Enter chosen year FY",
                  "number"
                  ,
                  form.entryType === "Expense"
                )}
                ${inputCard(
                  "planner-locFyLast",
                  `${selectedLocation} FY ${lastYear} (Last Year)`,
                  form.locFyLast || "",
                  isNewProjectEntry ? "New project: last year FY not required" : "Auto-pulled from previous year when available",
                  "number",
                  isNewProjectEntry
                )}
                ${inputCard("planner-locPercent", `% Change (${selectedLocation})`, percentChange.toFixed(2), "", "text", true)}
                ${textAreaCard("planner-justification", `${selectedLocation} Justification`, form.justification || "", "Enter justification")}
              </div>
              <div class="section-mini-title">${esc(selectedLocation)} Budget Inputs</div>
              <div class="form-grid-compact planner-detail-grid">
                ${inputCard("planner-newAmc", `New AMC for FY ${selectedYear}`, form.newAmc || "", "Enter New AMC", "number")}
                ${inputCard("planner-newProject", "New Project", form.newProject || "", "Enter New Project", "number")}
                ${inputCard("planner-annualized", "Annualized", form.annualized || "", "Enter Annualized", "number")}
                ${inputCard("planner-priceIncrease", "Price Increase", form.priceIncrease || "", "Enter Price Increase", "number")}
                ${inputCard("planner-newUnit", "New Unit", form.newUnit || "", "Enter New Unit", "number")}
                ${inputCard("planner-licenseIncrease", "License Increase", form.licenseIncrease || "", "Enter License Increase", "number")}
                ${inputCard("planner-rest", "Rest", form.rest || "", "Enter Rest", "number")}
              </div>
            `
            : `<div class="empty-state">Select Cost Distribution, Financial Year, and MAX Hospital to open the location entry section.</div>`
        }
        <div class="actions-row">
          <button type="button" class="btn btn-primary" data-action="save-record">Add Record</button>
          <button type="button" class="btn btn-soft" data-action="clear-form">Clear Form</button>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>Saved Records Filters</h3>
            <p>Filter the saved planner rows by year, location, coding, item, and owner.</p>
          </div>
          <div class="dashboard-filter-meta">
            <button type="button" class="btn btn-soft" data-action="planner-saved-export">Download Excel</button>
          </div>
        </div>
        <div class="filter-grid">
          ${selectCard("plannerSaved-financialYear", "Financial Year", savedYear, optionValuesForKey("financialYear"), "All")}
          ${selectCard("plannerSaved-location", "Location", savedLocation, getAllLocations(), "All")}
          ${selectCard("plannerSaved-coding", "Coding", savedCoding, optionValuesForKey("coding"), "All")}
          ${selectCard("plannerSaved-item", "Item", savedItem, optionValuesForKey("item"), "All")}
          ${selectCard("plannerSaved-owner", "Owner", savedOwner, optionValuesForKey("owner"), "All")}
        </div>
      </section>

      ${tableCard(
        "Saved Records",
        "Current planner records stored locally.",
        ["Financial Year", "MAX Hospital", "Coding", "Item", "Current FY", "FY (Last Year)", "% Change", "LE", "Owner", "Actions"],
        savedRows
      )}
    `;
  }

  function renderLocationSummary() {
    const rows = summaryRows();
    const locationOptions = getAllLocations();
    const yearOptions = optionValuesForKey("financialYear");

    function trendBadge(changePercent) {
      const value = num(changePercent);
      if (value > 0) return `<span class="trend-badge trend-up">&uarr; ${esc(pct(value))}</span>`;
      if (value < 0) return `<span class="trend-badge trend-down">&darr; ${esc(pct(Math.abs(value)))}</span>`;
      return `<span class="trend-badge trend-flat">&harr; ${esc(pct(0))}</span>`;
    }

    const groupedLocationYear = {};
    rows.forEach((record) => {
      const location = record.location || "Unassigned";
      const year = record.financialYear || "Unassigned";
      const key = `${location}||${year}`;
      if (!groupedLocationYear[key]) {
        groupedLocationYear[key] = {
          location,
          financialYear: year,
          entries: 0,
          le: 0,
          fyCurrent: 0,
          fyLast: 0,
          newAmc: 0,
          newProject: 0,
          annualized: 0,
          priceIncrease: 0,
          newUnit: 0,
          licenseIncrease: 0,
          rest: 0
        };
      }
      groupedLocationYear[key].entries += 1;
      groupedLocationYear[key].le += num(record.locLe);
      groupedLocationYear[key].fyCurrent += num(record.locFyCurrent);
      groupedLocationYear[key].fyLast += num(record.locFyLast);
      groupedLocationYear[key].newAmc += num(record.newAmc);
      groupedLocationYear[key].newProject += num(record.newProject);
      groupedLocationYear[key].annualized += num(record.annualized);
      groupedLocationYear[key].priceIncrease += num(record.priceIncrease);
      groupedLocationYear[key].newUnit += num(record.newUnit);
      groupedLocationYear[key].licenseIncrease += num(record.licenseIncrease);
      groupedLocationYear[key].rest += num(record.rest);
    });

    const groupedRows = Object.values(groupedLocationYear).sort((left, right) => {
      const yearSort = financialYearStart(right.financialYear) - financialYearStart(left.financialYear);
      if (Number.isFinite(yearSort) && yearSort) return yearSort;
      const locationSort = String(left.location).localeCompare(String(right.location));
      if (locationSort) return locationSort;
      return String(left.financialYear).localeCompare(String(right.financialYear));
    });

    const tableRows = groupedRows.map((row) => {
      const changeAmount = row.fyCurrent - row.le;
      const changePercent = row.le ? (changeAmount / row.le) * 100 : 0;
      return `
        <tr>
          <td>${esc(row.location)}</td>
          <td>${esc(row.financialYear)}</td>
          <td>${esc(String(row.entries))}</td>
          <td>${esc(fmt(row.le))}</td>
          <td>${esc(fmt(row.fyCurrent))}</td>
          <td>${esc(fmt(row.fyLast))}</td>
          <td>${esc(fmt(changeAmount))}</td>
          <td>${trendBadge(changePercent)}</td>
        </tr>
      `;
    });

    const detailsRows = groupedRows.map((row) => `
      <tr>
        <td>${esc(row.location)}</td>
        <td>${esc(row.financialYear)}</td>
        <td>${esc(fmt(row.newAmc))}</td>
        <td>${esc(fmt(row.newProject))}</td>
        <td>${esc(fmt(row.annualized))}</td>
        <td>${esc(fmt(row.priceIncrease))}</td>
        <td>${esc(fmt(row.newUnit))}</td>
        <td>${esc(fmt(row.licenseIncrease))}</td>
        <td>${esc(fmt(row.rest))}</td>
      </tr>
    `);

    const locationTotalsMap = {};
    groupedRows.forEach((row) => {
      const location = row.location || "Unassigned";
      if (!locationTotalsMap[location]) {
        locationTotalsMap[location] = {
          location,
          le: 0,
          fyCurrent: 0,
          fyLast: 0
        };
      }
      locationTotalsMap[location].le += num(row.le);
      locationTotalsMap[location].fyCurrent += num(row.fyCurrent);
      locationTotalsMap[location].fyLast += num(row.fyLast);
    });

    const locationTotals = Object.values(locationTotalsMap).sort((left, right) =>
      String(left.location).localeCompare(String(right.location))
    );

    const grandLe = locationTotals.reduce((sum, row) => sum + num(row.le), 0);
    const grandFyCurrent = locationTotals.reduce((sum, row) => sum + num(row.fyCurrent), 0);
    const grandFyLast = locationTotals.reduce((sum, row) => sum + num(row.fyLast), 0);
    const grandChange = grandFyCurrent - grandLe;
    const grandChangePercent = grandLe ? (grandChange / grandLe) * 100 : 0;
    const grandTotalRow = `
      <tr class="table-total-row">
        <td><strong>All Total</strong></td>
        <td><strong>${esc(fmt(grandLe))}</strong></td>
        <td><strong>${esc(fmt(grandFyCurrent))}</strong></td>
        <td><strong>${esc(fmt(grandFyLast))}</strong></td>
        <td><strong>${esc(fmt(grandChange))}</strong></td>
        <td>${trendBadge(grandChangePercent)}</td>
      </tr>
    `;

    const totalRows = locationTotals
      .map((row) => {
        const changeAmount = row.fyCurrent - row.le;
        const changePercent = row.le ? (changeAmount / row.le) * 100 : 0;
        return `
          <tr>
            <td>${esc(row.location)}</td>
            <td>${esc(fmt(row.le))}</td>
            <td>${esc(fmt(row.fyCurrent))}</td>
            <td>${esc(fmt(row.fyLast))}</td>
            <td>${esc(fmt(changeAmount))}</td>
            <td>${trendBadge(changePercent)}</td>
          </tr>
        `;
      })
      .concat(grandTotalRow);

    return `
      <section class="card">
        <div class="section-head">
          <div>
            <h3>Location Summary Filters</h3>
            <p>Review derived location-level values from the saved planner records.</p>
          </div>
        </div>
        <div class="filter-grid">
          ${selectCard("summary-location", "Location", (state.summaryFilters || {}).location || "", locationOptions, "All")}
          ${selectCard("summary-financialYear", "Financial Year", (state.summaryFilters || {}).financialYear || "", yearOptions, "All")}
        </div>
      </section>

      ${tableCard(
        "Location Data",
        "Location + financial year totals from multiple coding entries.",
        ["Location", "Financial Year", "Coding Entries", "LE", "FY Chosen Year", "FY Last Year", "Budget Change", "% Change"],
        tableRows
      )}

      ${tableCard(
        "Budget Inputs",
        "Driver totals aggregated by location and financial year.",
        ["Location", "Financial Year", "New AMC", "New Project", "Annualized", "Price Increase", "New Unit", "License Increase", "Rest"],
        detailsRows
      )}

      ${tableCard(
        "Total",
        "Location-wise totals for the selected filter with increase/decrease trend.",
        ["Location", "Total LE", "Total FY Chosen Year", "Total FY Last Year", "Total Budget Change", "% Change"],
        totalRows
      )}
    `;
  }

  function renderUnitBudget() {
    const filters = state.unitBudgetFilters || {};
    const filteredRecords = getRecords().filter((record) => {
      if (filters.location && record.location !== filters.location) return false;
      if (filters.financialYear && record.financialYear !== filters.financialYear) return false;
      return true;
    });

    const grouped = {};
    filteredRecords.forEach((record) => {
      const location = record.location || "Unassigned";
      if (!grouped[location]) {
        grouped[location] = { le: 0, budget: 0 };
      }
      grouped[location].le += num(record.locLe);
      grouped[location].budget += num(record.locFyCurrent);
    });

    const totalBudget = Object.values(grouped).reduce((sum, item) => sum + item.budget, 0);
    const totalExpense = Object.values(grouped).reduce((sum, item) => sum + item.le, 0);
    const totalIncrease = totalBudget - totalExpense;

    const rows = Object.entries(grouped).map(([location, item]) => {
      const increase = item.budget - item.le;
      const increasePct = item.le ? (increase / item.le) * 100 : 0;
      const sharePct = totalBudget ? (item.budget / totalBudget) * 100 : 0;
      return `
        <tr>
          <td>${esc(location)}</td>
          <td>${esc(fmt(item.le))}</td>
          <td>${esc(fmt(item.budget))}</td>
          <td>${esc(fmt(increase))}</td>
          <td>${esc(pct(increasePct))}</td>
          <td>${esc(pct(sharePct))}</td>
        </tr>
      `;
    });

    const totalRow = `
      <tr class="table-total-row">
        <td><strong>Total</strong></td>
        <td><strong>${esc(fmt(totalExpense))}</strong></td>
        <td><strong>${esc(fmt(totalBudget))}</strong></td>
        <td><strong>${esc(fmt(totalIncrease))}</strong></td>
        <td><strong>${esc(pct(totalExpense ? (totalIncrease / totalExpense) * 100 : 0))}</strong></td>
        <td><strong>${esc(pct(totalBudget ? 100 : 0))}</strong></td>
      </tr>
    `;

    const locationFilter = `
      <div class="field-card">
        <div class="field-label">Select Location</div>
        <select id="unitBudget-location" class="input-control" onchange="window.OpexUI.setUnitBudgetFilter('location', this.value)">
          <option value="">All</option>
          ${getAllLocations()
            .map((option) => `<option value="${esc(option)}" ${String(option) === String(filters.location || "") ? "selected" : ""}>${esc(option)}</option>`)
            .join("")}
        </select>
      </div>
    `;

    const yearFilter = `
      <div class="field-card">
        <div class="field-label">Select Year</div>
        <select id="unitBudget-financialYear" class="input-control" onchange="window.OpexUI.setUnitBudgetFilter('financialYear', this.value)">
          <option value="">All</option>
          ${optionValuesForKey("financialYear")
            .map(
              (option) =>
                `<option value="${esc(option)}" ${String(option) === String(filters.financialYear || "") ? "selected" : ""}>${esc(option)}</option>`
            )
            .join("")}
        </select>
      </div>
    `;

    return `
      <section class="card">
        <div class="section-head">
          <div>
            <h3>Unit Wise Budget</h3>
            <p>Filter location and year to review unit-wise last year expense, current budget, increase, and share.</p>
          </div>
          <div class="meta">${esc(filteredRecords.length)} records matched</div>
        </div>
        <div class="filter-grid">
          ${locationFilter}
          ${yearFilter}
        </div>
      </section>

      ${tableCard(
        "Unit Budget Table",
        "Location-wise totals from the selected dataset.",
        [
          "Unit Name",
          "LY Unit Expense (Rs L)",
          "Budget Current Year (Rs L)",
          "Total Budget Increase",
          "Increase %",
          "Budget Share %"
        ],
        rows.concat(totalRow)
      )}
    `;
  }

  function renderAllocation() {
    const controls = state.allocationControls || {};
    const submitMessage = String(state.allocationSubmitMessage || "");
    const showLocationSelector = false;
    const selectedLocations = showLocationSelector && Array.isArray(controls.locations) ? controls.locations : [];
    const selectedCodingSet = getAllocationSelectedCodingSet();
    const matrixFilters = state.allocationMatrixFilters || {};
    const matrixLocation = String(matrixFilters.location || "");
    const matrixCoding = String(matrixFilters.coding || "");
    const matrixYear = String(matrixFilters.financialYear || "");
    const matrixOwner = String(matrixFilters.owner || "");
    const ownerOptions = optionValuesForKey("owner");
    const selectedOwner = String(controls.owner || "");
    const yearOptions = optionValuesForKey("financialYear");
    const selectedYear = String(controls.financialYear || "");
    const selectedItem = String(controls.item || "");
    // Allocation mapped fields must remain editable, even when a coding profile exists.
    const appliedEntries = getAppliedAllocationEntries();
    const hasAppliedDistribution = appliedEntries.length > 0;
    const locations = getAllLocations();
    const codingOptionMap = {};
    []
      .concat(getRecords().map((record) => record.coding), (data.FALLBACK_OPTIONS && data.FALLBACK_OPTIONS.coding) || [], optionValuesForKey("coding"))
      .filter(Boolean)
      .forEach((coding) => {
        const key = normalizeText(coding);
        if (key && !codingOptionMap[key]) codingOptionMap[key] = coding;
      });
    const codingOptions = Object.values(codingOptionMap).sort((left, right) => String(left).localeCompare(String(right)));
    const allocationContext = getAllocationBudgetContext(getRecords(), appliedEntries);
    const effectiveRecords = allocationContext.records;
    const matrixRowsFromServer = Array.isArray(state.allocationMatrixRows) ? state.allocationMatrixRows : null;

    const grouped = {};
    if (matrixRowsFromServer && matrixRowsFromServer.length) {
      matrixRowsFromServer.forEach((row) => {
        const year = String(row.financialYear || "");
        const coding = String(row.coding || "");
        const owner = String(row.owner || "");
        const item = String(row.item || "");
        const allocationType = String(row.costDistribution || "Distributed");
        const key = [year, coding, item, owner].join("||");
        if (!grouped[key]) {
          grouped[key] = {
            id: row.id || "",
            financialYear: year,
            coding,
            item,
            owner,
            totalBudget: num(row.totalBudget || 0),
            allocationType,
            locations: Object.assign({}, row.locationAmounts || {})
          };
        }
      });
    } else {
      effectiveRecords.forEach((record) => {
        const resolvedItem = String(record.item || "").trim() || mappedItemForCode(record.coding);
        const key = [record.financialYear || "", record.coding, resolvedItem, record.owner].join("||");
        if (!grouped[key]) {
          grouped[key] = {
            financialYear: record.financialYear || "",
            coding: record.coding || "",
            item: resolvedItem || "",
            owner: record.owner || "",
            totalBudget: 0,
            allocationType: record.__allocationType || "Fixed Cost",
            locations: {}
          };
        }
        if (!grouped[key].item && resolvedItem) {
          grouped[key].item = resolvedItem;
        }
        if (grouped[key].allocationType !== (record.__allocationType || "Fixed Cost")) {
          grouped[key].allocationType = "Mixed";
        }
        grouped[key].totalBudget += num(record.locFyCurrent);
        grouped[key].locations[record.location || "Unassigned"] =
          (grouped[key].locations[record.location || "Unassigned"] || 0) + num(record.locFyCurrent);
      });
    }

    const allEntries = Object.values(grouped)
      .filter((entry) => {
        if (matrixYear && String(entry.financialYear || "") !== matrixYear) return false;
        if (matrixCoding && normalizeText(entry.coding) !== normalizeText(matrixCoding)) return false;
        if (matrixOwner && normalizeText(entry.owner) !== normalizeText(matrixOwner)) return false;
        if (matrixLocation) return num(entry.locations && entry.locations[matrixLocation]) > 0;
        return true;
      })
      .sort((a, b) => {
      const yearSort = String(a.financialYear || "").localeCompare(String(b.financialYear || ""));
      if (yearSort) return yearSort;
      const codingSort = String(a.coding || "").localeCompare(String(b.coding || ""));
      if (codingSort) return codingSort;
      const itemSort = String(a.item || "").localeCompare(String(b.item || ""));
      if (itemSort) return itemSort;
      return String(a.owner || "").localeCompare(String(b.owner || ""));
    });
    const codingTotals = {};
    getRecords().forEach((record) => {
      if (selectedOwner && normalizeText(record.owner) !== normalizeText(selectedOwner)) return;
      if (selectedYear && String(record.financialYear || "") !== selectedYear) return;
      if (!record.coding) return;
      codingTotals[record.coding] = (codingTotals[record.coding] || 0) + num(record.locFyCurrent);
    });
    const headers = ["Financial Year", "Coding", "Item", "Owner", "Cost Distribution", "Total Budget"].concat(locations, ["Actions"]);
    const rowLookup = {};
    const rows = allEntries.map((entry) => {
      const rowKey = allocationRowKey(entry.coding || "", entry.item || "", entry.owner || "", entry.financialYear || "");
      const rowAllocationType = entry.allocationType || "Fixed Cost";
      const canEditRow = normalizeText(rowAllocationType) === "distributed";
      let editableTotal = 0;
      const baseByLocation = {};
      const currentByLocation = {};
      const cells = locations
        .map((location) => {
          const baseValue = num(entry.locations[location] || 0);
          baseByLocation[location] = baseValue;
          const editedValue = baseValue;
          currentByLocation[location] = editedValue;
          const isEdited = false;
          editableTotal += editedValue;

          return `
            <td
              class="allocation-edit-cell allocation-value-cell${canEditRow ? "" : " allocation-readonly-cell"}${isEdited ? " allocation-cell-edited" : ""}"
              data-row-key="${esc(rowKey)}"
              data-location="${esc(location)}"
              data-base-value="${esc(String(baseValue))}"
              data-current-value="${esc(String(editedValue))}"
              title="${esc(canEditRow ? "Distributed cost can be edited" : "Fixed cost rows are read-only in Allocation Matrix")}"
            >
              <span class="allocation-value-pill${canEditRow ? "" : " allocation-value-pill-readonly"}${isEdited ? " is-edited" : ""}">
                ${esc(fmt(editedValue))}
              </span>
            </td>
          `;
        })
        .join("");

      rowLookup[rowKey] = {
        rowKey,
        financialYear: entry.financialYear || "",
        coding: entry.coding || "",
        item: entry.item || "",
        owner: entry.owner || "",
        allocationType: rowAllocationType,
        editable: canEditRow,
        baseByLocation,
        currentByLocation,
        totalBudget: editableTotal
      };

      const rowActions = `
        <td class="allocation-row-actions">
          ${
            canEditRow
              ? `<button
                  type="button"
                  class="btn btn-soft allocation-row-btn"
                  data-action="allocation-row-edit"
                  data-matrix-id="${esc(String(entry.id || ""))}"
                  data-row-key="${esc(rowKey)}"
                  data-year="${esc(entry.financialYear || "")}"
                  data-coding="${esc(entry.coding || "")}"
                  data-item="${esc(entry.item || "")}"
                  data-owner="${esc(entry.owner || "")}"
                  data-allocation-type="${esc(rowAllocationType)}"
                >
                  Edit
                </button>`
              : `<button
                  type="button"
                  class="btn btn-soft allocation-row-btn allocation-row-btn-disabled"
                  disabled
                  title="Fixed Cost rows are read-only. Submit this coding as Distributed to edit location amounts."
                >
                  Fixed Cost Locked
                </button>`
          }
          <button
            type="button"
            class="btn btn-danger allocation-row-btn"
            data-action="allocation-row-delete"
            data-matrix-id="${esc(String(entry.id || ""))}"
            data-row-key="${esc(rowKey)}"
            data-year="${esc(entry.financialYear || "")}"
            data-coding="${esc(entry.coding || "")}"
            data-item="${esc(entry.item || "")}"
            data-owner="${esc(entry.owner || "")}"
            data-allocation-type="${esc(rowAllocationType)}"
          >
            Delete
          </button>
        </td>
      `;

      return `
        <tr>
          <td>${esc(entry.financialYear || "Unassigned")}</td>
          <td>${esc(entry.coding)}</td>
          <td>${esc(entry.item)}</td>
          <td>${esc(entry.owner)}</td>
          <td>${esc(rowAllocationType)}</td>
          <td data-role="allocation-row-total">${esc(fmt(editableTotal))}</td>
          ${cells}
          ${rowActions}
        </tr>
      `;
    });

    const locationCheckboxes = locations
      .map((location) => {
        const checked = selectedLocations.includes(location) ? "checked" : "";
        const mappingText = Object.prototype.hasOwnProperty.call(ALLOCATION_DISTRIBUTION_MAP, location)
          ? `${ALLOCATION_DISTRIBUTION_MAP[location].toFixed(2)}%`
          : "0.00%";
        return `
          <label class="check-row">
            <input type="checkbox" class="allocation-location" value="${esc(location)}" ${checked}/>
            <span>${esc(location)}</span>
            <small>Share: ${esc(mappingText)}</small>
          </label>
        `;
      })
      .join("");

    const isDistributionMode = isAllocationDistributionMode(controls.mode);
    const selectedCoding = String(controls.coding || "").trim();
    const showDistributionFields = isDistributionMode && selectedCodingSet.size > 0 && selectedOwner && selectedYear;
    const allocationSubtitle =
      isDistributionMode
        ? hasAppliedDistribution
          ? `Distributed budget ${fmt(allocationContext.distributedBudget)} is mapped across locations for ${allocationContext.distributedCodingCount} coding(s). Fixed-cost budget remains ${fmt(allocationContext.fixedBudget)}. Update coding/amount and click Submit Record to apply new distribution.`
          : selectedCodingSet.size && selectedOwner && selectedYear
          ? "Select coding and Distribution Amount, then click Submit Record to apply mapped location distribution for the selected year. Comparison will show that year-specific split."
          : selectedCodingSet.size && selectedOwner
          ? "Choose year after owner to unlock Distribution Amount."
          : selectedCodingSet.size
          ? "Choose owner and year after coding to unlock Distribution Amount."
          : "Select coding to open Distribution Amount and apply mapped location percentages."
        : hasAppliedDistribution
        ? `Submitted distributed entries are active. Distributed budget ${fmt(allocationContext.distributedBudget)} and fixed-cost budget ${fmt(
            allocationContext.fixedBudget
          )} are both shown in the matrix.`
        : "Location columns show fixed-cost budgets from Budget Planner records.";

    const modalState = state.allocationEditModal && state.allocationEditModal.rowKey ? state.allocationEditModal : null;
    const modalRow = modalState ? rowLookup[modalState.rowKey] : null;
    if (modalState && !modalRow) {
      state.allocationEditModal = null;
      state.allocationEditDraft = null;
      state.allocationEditDraftRowKey = "";
      state.allocationEditBase = null;
    }

    if (modalRow && state.allocationEditDraftRowKey !== modalRow.rowKey) {
      const draft = {};
      locations.forEach((location) => {
        draft[location] = allocationInputValue(modalRow.currentByLocation[location] || 0);
      });
      state.allocationEditDraft = draft;
      state.allocationEditDraftRowKey = modalRow.rowKey;
      state.allocationEditBase = Object.assign({}, modalRow.baseByLocation);
    }

    const draftValues = state.allocationEditDraft || {};
    const baseValues = state.allocationEditBase || {};
    const editModal = modalRow
      ? `
        <div class="allocation-modal-overlay" data-action="allocation-modal-close"></div>
        <section class="allocation-modal-card" role="dialog" aria-modal="true" aria-labelledby="allocation-modal-title">
          <div class="allocation-modal-head">
            <div>
              <h3 id="allocation-modal-title">Edit Location Amounts</h3>
              <p>${esc(modalRow.financialYear || "Unassigned Year")} | ${esc(modalRow.coding)} | ${esc(modalRow.item || "Mapped item")} | ${esc(modalRow.owner || "Owner")}</p>
            </div>
            <button type="button" class="btn btn-ghost" data-action="allocation-modal-close">Close</button>
          </div>
          <div class="allocation-modal-grid">
            ${locations
              .map((location) => {
                const baseValue = num(baseValues[location]);
                const draftRaw = Object.prototype.hasOwnProperty.call(draftValues, location)
                  ? draftValues[location]
                  : allocationInputValue(modalRow.currentByLocation[location] || 0);
                const draftValue = Math.max(0, num(draftRaw));
                const changed = allocationRoundedValue(draftValue) !== allocationRoundedValue(baseValue);
                return `
                  <div class="field-card allocation-modal-field${changed ? " allocation-cell-edited" : ""}">
                    <div class="field-label">${esc(location)}</div>
                    <input
                      type="number"
                      class="input-control allocation-modal-input${changed ? " is-edited" : ""}"
                      value="${esc(String(draftRaw))}"
                      step="0.01"
                      min="0"
                      data-location="${esc(location)}"
                    />
                    <div class="allocation-modal-base">Base: ${esc(fmt(baseValue))}</div>
                  </div>
                `;
              })
              .join("")}
          </div>
          <div class="allocation-modal-actions">
            <button type="button" class="btn btn-soft" data-action="allocation-modal-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" data-action="allocation-modal-save">Apply Changes</button>
          </div>
        </section>
      `
      : "";
    const amountFieldBase = num(controls.amount);
    const distributionShareBase = amountFieldBase > 0 ? amountFieldBase : allocationContext.distributedBudget;
    const distributionShareNote =
      amountFieldBase > 0
        ? "Preview is based on the current Distribution Amount field."
        : allocationContext.distributedBudget > 0
        ? "Amount preview is based on the active submitted distributed budget."
        : "Enter Distribution Amount and click Submit Record to distribute by these fixed location percentages.";

    const matrixFilterBar = `
      <section class="card">
        <div class="section-head">
          <div>
            <h3>Matrix Filters</h3>
            <p>Filter the allocation matrix by location, coding, year, and owner.</p>
          </div>
          <div class="dashboard-filter-meta">
            <button type="button" class="btn btn-soft" data-action="allocation-matrix-export">Download Excel</button>
          </div>
        </div>
        <div class="filter-grid">
          ${selectCard("allocation-matrix-location", "Location", matrixLocation, locations, "All")}
          ${selectCard("allocation-matrix-coding", "Coding", matrixCoding, codingOptions, "All")}
          ${selectCard("allocation-matrix-financialYear", "Financial Year", matrixYear, yearOptions, "All")}
          ${selectCard("allocation-matrix-owner", "Owner", matrixOwner, ownerOptions, "All")}
        </div>
      </section>
    `;

    return `
      <section class="card">
        <div class="section-head">
          <div>
            <h3>Allocation Controls</h3>
            <p>Choose how allocation should behave before reviewing the matrix. Distributed mode uses the master location percentage map.</p>
          </div>
        </div>
        <div class="control-grid">
          ${selectCard("allocation-mode", "Cost Distribution", "Distribution", ["Distribution"], "Select mode")}
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-coding",
                  "Coding",
                  selectedCoding,
                  codingOptions,
                  "Search coding"
                )
              : ""
          }
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-item",
                  "Item",
                  selectedItem,
                  uniq([].concat(Object.values(data.CODE_ITEM_MAP || {}), getRecords().map((record) => record.item)).filter(Boolean)),
                  "Search item"
                )
              : ""
          }
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-subCategoryMapped",
                  "Sub Category (Mapped)",
                  String(controls.subCategoryMapped || ""),
                  optionValuesForKey("subCategoryMapped"),
                  "Select mapped sub category",
                  false
                )
              : ""
          }
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-categoryIt",
                  "Category_IT",
                  String(controls.categoryIt || ""),
                  optionValuesForKey("categoryIt"),
                  "Select category",
                  false
                )
              : ""
          }
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-subCategory",
                  "Sub Category",
                  String(controls.subCategory || ""),
                  optionValuesForKey("subCategory"),
                  "Select sub category",
                  false
                )
              : ""
          }
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-newCategory",
                  "New Category",
                  String(controls.newCategory || ""),
                  optionValuesForKey("newCategory"),
                  "Select new category",
                  false
                )
              : ""
          }
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-appCate",
                  "App Cate.",
                  String(controls.appCate || ""),
                  optionValuesForKey("appCate"),
                  "Select app cate.",
                  false
                )
              : ""
          }
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-cate3",
                  "Cate.3",
                  String(controls.cate3 || ""),
                  optionValuesForKey("cate3"),
                  "Select cate.3",
                  false
                )
              : ""
          }
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-cate4",
                  "Cate.4",
                  String(controls.cate4 || ""),
                  optionValuesForKey("cate4"),
                  "Select cate.4",
                  false
                )
              : ""
          }
          ${isDistributionMode ? searchCard("allocation-owner1", "Owner1", String(controls.owner1 || ""), optionValuesForKey("owner1"), "Select owner1") : ""}
          ${isDistributionMode ? selectCard("allocation-owner", "Owner", selectedOwner, ownerOptions, "Select owner") : ""}
          ${
            isDistributionMode
              ? searchCard(
                  "allocation-costCenterDepartment",
                  "Cost Center / Department",
                  String(controls.costCenterDepartment || ""),
                  optionValuesForKey("costCenterDepartment"),
                  "Select cost center / department"
                )
              : ""
          }
          ${isDistributionMode ? selectCard("allocation-financialYear", "Select Year", selectedYear, yearOptions, "Select year") : ""}
          ${
            isDistributionMode && (!selectedCodingSet.size || !selectedOwner || !selectedYear)
              ? `<div class="field-card allocation-helper-card">
                  <div class="field-label">Next Step</div>
                  <div class="helper-text">Select coding, owner, and year to unlock <strong>Distribution Amount</strong> and apply mapped location percentage distribution.</div>
                </div>`
              : ""
          }
          ${
            showDistributionFields
              ? inputCard("allocation-amount", "Distribution Amount", controls.amount || "", "Enter amount", "number", false, "0.01")
              : ""
          }
          ${
            showLocationSelector
              ? `<div class="field-card allocation-location-card">
                  <div class="field-label">Select Location</div>
                  <div class="multi-select-panel">${locationCheckboxes}</div>
                </div>`
              : ""
          }
        </div>
        <div class="allocation-action-row">
          <button type="button" class="btn btn-primary" data-action="allocation-submit">
            Submit Record
          </button>
        </div>
        ${submitMessage ? `<div class="allocation-submit-note">${esc(submitMessage)}</div>` : ""}
      </section>

      ${matrixFilterBar}
      ${tableCard("Coding / Item / Owner Allocation Matrix", allocationSubtitle, headers, rows)}
      ${allocationDistributionShareCard(locations, distributionShareBase, distributionShareNote)}
      ${editModal}
    `;
  }

  function renderUtilization() {
    const rows = getRecords().map((record) => {
      const used = Math.max(0, num(record.locFyCurrent) - num(record.locLe));
      const remaining = num(record.locFyCurrent) - used;
      const utilization = num(record.locLe) ? ((num(record.locLe) - num(record.locFyCurrent)) / num(record.locLe)) * 100 : 0;
      return `
        <tr>
          <td>${esc(record.location || "")}</td>
          <td>${esc(record.financialYear || "")}</td>
          <td>${esc(fmt(record.locFyCurrent || 0))}</td>
          <td>${esc(fmt(used))}</td>
          <td>${esc(fmt(remaining))}</td>
          <td>${esc(pct(utilization))}</td>
        </tr>
      `;
    });

    return tableCard(
      "Opex Budget Utilization",
      "Chosen-year budget vs used budget and remaining budget.",
      ["Location", "Financial Year", "Budget", "Used", "Remaining", "Utilization %"],
      rows
    );
  }

  function matchesComparisonFilters(record, filters, includeYear) {
    const codingFilter = String((filters && filters.coding) || "").trim();
    const yearFilter = String((filters && filters.financialYear) || "").trim();
    if (codingFilter && normalizeText(record && record.coding) !== normalizeText(codingFilter)) return false;
    if (includeYear && yearFilter && String((record && record.financialYear) || "") !== yearFilter) return false;
    return true;
  }

  function comparisonLocationMetrics(location, rawRecords, effectiveRecords) {
    const rawForLocation = rawRecords.filter((record) => record.location === location);
    const effectiveForLocation = effectiveRecords.filter((record) => record.location === location);
    const currentBudget = effectiveForLocation.reduce((sum, record) => sum + num(record.locFyCurrent), 0);
    const lastYearBudget = rawForLocation.reduce((sum, record) => sum + num(record.locFyLast), 0);
    const lastYearExpense = rawForLocation.reduce((sum, record) => sum + num(record.locLe), 0);
    const fixedCost = effectiveForLocation.reduce(
      (sum, record) => sum + ((record.__allocationType || "Fixed Cost") === "Distributed" ? 0 : num(record.locFyCurrent)),
      0
    );
    const distributedCost = effectiveForLocation.reduce(
      (sum, record) => sum + ((record.__allocationType || "Fixed Cost") === "Distributed" ? num(record.locFyCurrent) : 0),
      0
    );
    const usedBudget = Math.max(0, currentBudget - lastYearExpense);
    const budgetVariance = currentBudget - lastYearBudget;
    const expenseVariance = currentBudget - lastYearExpense;

    return {
      location,
      lastYearBudget,
      lastYearExpense,
      currentBudget,
      fixedCost,
      distributedCost,
      usedBudget,
      remainingBudget: currentBudget - usedBudget,
      budgetVariance,
      expenseVariance,
      budgetGrowthPercent: lastYearBudget ? (budgetVariance / lastYearBudget) * 100 : 0,
      expenseGrowthPercent: lastYearExpense ? (expenseVariance / lastYearExpense) * 100 : 0,
      utilizationPercent: lastYearExpense ? ((lastYearExpense - currentBudget) / lastYearExpense) * 100 : 0,
      codingCount: new Set(effectiveForLocation.map((record) => normalizeText(record.coding)).filter(Boolean)).size
    };
  }

  function buildComparisonCodingRows(rawRecords, effectiveRecords, location1, location2) {
    const locations = [location1, location2];
    const rowsByCoding = {};

    function emptyLocationMetrics() {
      return { lastYearBudget: 0, lastYearExpense: 0, currentBudget: 0, fixedCost: 0, distributedCost: 0 };
    }

    function ensureRow(record) {
      const coding = record.coding || "Unassigned";
      const key = normalizeText(coding) || "unassigned";
      if (!rowsByCoding[key]) {
        rowsByCoding[key] = {
          coding,
          item: record.item || mappedItemForCode(coding) || "",
          locations: {
            [location1]: emptyLocationMetrics(),
            [location2]: emptyLocationMetrics()
          }
        };
      }
      if (!rowsByCoding[key].item && record.item) rowsByCoding[key].item = record.item;
      return rowsByCoding[key];
    }

    rawRecords.forEach((record) => {
      if (!locations.includes(record.location)) return;
      const row = ensureRow(record);
      row.locations[record.location].lastYearBudget += num(record.locFyLast);
      row.locations[record.location].lastYearExpense += num(record.locLe);
    });

    effectiveRecords.forEach((record) => {
      if (!locations.includes(record.location)) return;
      const row = ensureRow(record);
      const locationMetrics = row.locations[record.location];
      const amount = num(record.locFyCurrent);
      locationMetrics.currentBudget += amount;
      if ((record.__allocationType || "Fixed Cost") === "Distributed") locationMetrics.distributedCost += amount;
      else locationMetrics.fixedCost += amount;
    });

    return Object.values(rowsByCoding).sort((left, right) => {
      const leftTotal = num(left.locations[location1].currentBudget) + num(left.locations[location2].currentBudget);
      const rightTotal = num(right.locations[location1].currentBudget) + num(right.locations[location2].currentBudget);
      return rightTotal - leftTotal;
    });
  }

  function comparisonMetricBars(location1, metrics1, location2, metrics2) {
    const items = [
      ["Last Year Budget", metrics1.lastYearBudget, metrics2.lastYearBudget],
      ["Last Year Expense", metrics1.lastYearExpense, metrics2.lastYearExpense],
      ["Current Year Budget", metrics1.currentBudget, metrics2.currentBudget],
      ["Fixed Cost", metrics1.fixedCost, metrics2.fixedCost],
      ["Distributed Cost", metrics1.distributedCost, metrics2.distributedCost]
    ];
    const maxValue = Math.max.apply(
      null,
      items.flatMap((item) => [num(item[1]), num(item[2])]).concat([1])
    );

    return `
      <div class="comparison-grid comparison-metric-grid">
        ${items
          .map(([label, leftValue, rightValue]) => {
            const leftWidth = Math.max((num(leftValue) / maxValue) * 100, num(leftValue) ? 3 : 0);
            const rightWidth = Math.max((num(rightValue) / maxValue) * 100, num(rightValue) ? 3 : 0);
            return `
              <div class="comparison-row">
                <div class="comparison-metric-label">${esc(label)}</div>
                <div class="comparison-bars">
                  <div class="comparison-bar-line">
                    <span>${esc(location1)}</span>
                    <div class="comparison-track">
                      <div class="comparison-fill budget" style="width:${leftWidth}%"></div>
                    </div>
                    <strong>${esc(fmt(leftValue))}</strong>
                  </div>
                  <div class="comparison-bar-line">
                    <span>${esc(location2)}</span>
                    <div class="comparison-track">
                      <div class="comparison-fill expense" style="width:${rightWidth}%"></div>
                    </div>
                    <strong>${esc(fmt(rightValue))}</strong>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function comparisonSection(title, subtitle, body, modifier) {
    return `
      <section class="comparison-visual-card ${esc(modifier || "")}">
        <div class="comparison-section-head">
          <div>
            <h3>${esc(title)}</h3>
            <p>${esc(subtitle || "")}</p>
          </div>
        </div>
        ${body}
      </section>
    `;
  }

  function comparisonShare(part, total) {
    return num(total) ? (num(part) / num(total)) * 100 : 0;
  }

  function comparisonLeader(location1, leftValue, location2, rightValue) {
    const left = num(leftValue);
    const right = num(rightValue);
    if (left === right) return { name: "Even", gap: 0 };
    return left > right ? { name: location1, gap: left - right } : { name: location2, gap: right - left };
  }

  function comparisonScoreboard(location1, metrics1, location2, metrics2, contextLabel) {
    function panel(location, metrics, side) {
      const distributedShare = comparisonShare(metrics.distributedCost, metrics.currentBudget);
      const fixedShare = comparisonShare(metrics.fixedCost, metrics.currentBudget);
      return `
        <article class="comparison-score-card comparison-score-card-${esc(side)}">
          <div class="comparison-score-eyebrow">${esc(contextLabel)}</div>
          <h3>${esc(location)}</h3>
          <div class="comparison-score-value">${esc(fmt(metrics.currentBudget))}</div>
          <div class="comparison-score-label">Current year budget</div>
          <div class="comparison-score-stats">
            <span><strong>${esc(fmt(metrics.lastYearExpense))}</strong> Last year expense</span>
            <span><strong>${esc(pct(metrics.utilizationPercent))}</strong> Utilization</span>
            <span><strong>${esc(pct(distributedShare))}</strong> Distributed</span>
            <span><strong>${esc(pct(fixedShare))}</strong> Fixed</span>
          </div>
        </article>
      `;
    }

    return `
      <section class="comparison-scoreboard">
        ${panel(location1, metrics1, "left")}
        <div class="comparison-versus">
          <span>vs</span>
        </div>
        ${panel(location2, metrics2, "right")}
      </section>
    `;
  }

  function comparisonInsightTiles(location1, metrics1, location2, metrics2) {
    const budgetLeader = comparisonLeader(location1, metrics1.currentBudget, location2, metrics2.currentBudget);
    const expenseLeader = comparisonLeader(location1, metrics1.lastYearExpense, location2, metrics2.lastYearExpense);
    const distributedShare1 = comparisonShare(metrics1.distributedCost, metrics1.currentBudget);
    const distributedShare2 = comparisonShare(metrics2.distributedCost, metrics2.currentBudget);
    const fixedShare1 = comparisonShare(metrics1.fixedCost, metrics1.currentBudget);
    const fixedShare2 = comparisonShare(metrics2.fixedCost, metrics2.currentBudget);
    const tiles = [
      ["Budget Leader", budgetLeader.name, budgetLeader.gap ? `${fmt(budgetLeader.gap)} gap` : "Same current budget"],
      ["Expense Leader", expenseLeader.name, expenseLeader.gap ? `${fmt(expenseLeader.gap)} gap` : "Same last year expense"],
      ["Utilization Gap", pct(metrics1.utilizationPercent - metrics2.utilizationPercent), `${location1} minus ${location2}`],
      ["Distributed Share Gap", pct(distributedShare1 - distributedShare2), `${pct(distributedShare1)} vs ${pct(distributedShare2)}`],
      ["Fixed Share Gap", pct(fixedShare1 - fixedShare2), `${pct(fixedShare1)} vs ${pct(fixedShare2)}`],
      ["Coding Coverage Gap", metrics1.codingCount - metrics2.codingCount, `${metrics1.codingCount} vs ${metrics2.codingCount} codings`]
    ];

    return `
      <section class="comparison-insight-strip">
        ${tiles
          .map(
            ([label, value, note]) => `
              <article class="comparison-insight-tile">
                <span>${esc(label)}</span>
                <strong>${esc(value)}</strong>
                <small>${esc(note)}</small>
              </article>
            `
          )
          .join("")}
      </section>
    `;
  }

  function comparisonGroupedBudgetChart(location1, metrics1, location2, metrics2) {
    const items = [
      ["Last Budget", metrics1.lastYearBudget, metrics2.lastYearBudget],
      ["Last Expense", metrics1.lastYearExpense, metrics2.lastYearExpense],
      ["Current Budget", metrics1.currentBudget, metrics2.currentBudget],
      ["Fixed Cost", metrics1.fixedCost, metrics2.fixedCost],
      ["Distributed", metrics1.distributedCost, metrics2.distributedCost]
    ];
    const maxValue = Math.max.apply(
      null,
      items.flatMap((item) => [num(item[1]), num(item[2])]).concat([1])
    );

    return `
      <div class="comparison-grouped-chart">
        <div class="comparison-grouped-legend">
          <span><i class="comparison-swatch-left"></i>${esc(location1)}</span>
          <span><i class="comparison-swatch-right"></i>${esc(location2)}</span>
        </div>
        <div class="comparison-grouped-bars">
          ${items
            .map(([label, leftValue, rightValue]) => {
              const leftHeight = Math.max((num(leftValue) / maxValue) * 100, num(leftValue) ? 5 : 0);
              const rightHeight = Math.max((num(rightValue) / maxValue) * 100, num(rightValue) ? 5 : 0);
              return `
                <div class="comparison-group">
                  <div class="comparison-group-bars-pair">
                    <div
                      class="comparison-group-bar comparison-group-bar-left"
                      style="height:${leftHeight}%"
                      title="${esc(`${location1} ${label}: ${fmt(leftValue)}`)}"
                    >
                      <span>${esc(fmt(leftValue))}</span>
                    </div>
                    <div
                      class="comparison-group-bar comparison-group-bar-right"
                      style="height:${rightHeight}%"
                      title="${esc(`${location2} ${label}: ${fmt(rightValue)}`)}"
                    >
                      <span>${esc(fmt(rightValue))}</span>
                    </div>
                  </div>
                  <div class="comparison-group-label">${esc(label)}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function comparisonGapLadder(location1, metrics1, location2, metrics2) {
    const items = [
      ["Current Budget", metrics1.currentBudget, metrics2.currentBudget],
      ["Last Year Budget", metrics1.lastYearBudget, metrics2.lastYearBudget],
      ["Last Year Expense", metrics1.lastYearExpense, metrics2.lastYearExpense],
      ["Fixed Cost", metrics1.fixedCost, metrics2.fixedCost],
      ["Distributed Cost", metrics1.distributedCost, metrics2.distributedCost]
    ];
    const maxAbs = Math.max.apply(
      null,
      items.map((item) => Math.abs(num(item[1]) - num(item[2]))).concat([1])
    );

    return `
      <div class="comparison-gap-list">
        ${items
          .map(([label, leftValue, rightValue]) => {
            const diff = num(leftValue) - num(rightValue);
            const width = Math.max((Math.abs(diff) / maxAbs) * 48, Math.abs(diff) ? 4 : 0);
            const leader = diff > 0 ? location1 : diff < 0 ? location2 : "Even";
            const note = diff ? `${leader} leads this metric` : "Both locations are equal";
            return `
              <div class="comparison-gap-row">
                <div class="comparison-gap-top">
                  <span>${esc(label)}</span>
                  <strong>${esc(diff ? fmt(diff) : "0")}</strong>
                </div>
                <div class="comparison-gap-rail">
                  <i></i>
                  <b
                    class="comparison-gap-fill ${diff >= 0 ? "comparison-gap-positive" : "comparison-gap-negative"}"
                    style="width:${width}%"
                  ></b>
                </div>
                <div class="comparison-gap-note">${esc(note)}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function comparisonCostPies(location1, metrics1, location2, metrics2) {
    function pie(location, metrics, side) {
      const total = num(metrics.currentBudget);
      const fixed = num(metrics.fixedCost);
      const distributed = num(metrics.distributedCost);
      const fixedPct = comparisonShare(fixed, total);
      const distributedPct = comparisonShare(distributed, total);
      const style = total
        ? `background: conic-gradient(var(--comparison-${side}) 0 ${fixedPct}%, var(--comparison-green) ${fixedPct}% 100%);`
        : "background:#edf3f8;";
      return `
        <div class="comparison-pie-panel">
          <div class="comparison-pie" style="${esc(style)}">
            <span>${esc(pct(distributedPct))}</span>
          </div>
          <div>
            <h4>${esc(location)}</h4>
            <p>${esc(fmt(total))} total budget</p>
            <div class="comparison-pie-legend">
              <span><i style="background:var(--comparison-${esc(side)})"></i>Fixed ${esc(pct(fixedPct))}</span>
              <span><i style="background:var(--comparison-green)"></i>Distributed ${esc(pct(distributedPct))}</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="comparison-pie-grid">
        ${pie(location1, metrics1, "left")}
        ${pie(location2, metrics2, "right")}
      </div>
    `;
  }

  function comparisonCodingGapCards(codingRows, location1, location2) {
    const rows = (codingRows || [])
      .map((row) => {
        const left = num(row.locations[location1].currentBudget);
        const right = num(row.locations[location2].currentBudget);
        return {
          coding: row.coding || "Unassigned",
          item: row.item || "",
          left,
          right,
          gap: left - right
        };
      })
      .sort((left, right) => Math.abs(right.gap) - Math.abs(left.gap))
      .slice(0, 5);

    if (!rows.length) return `<div class="empty-state">No data available.</div>`;

    const maxAbs = Math.max.apply(null, rows.map((row) => Math.abs(row.gap)).concat([1]));
    return `
      <div class="comparison-coding-gap-list">
        ${rows
          .map((row, index) => {
            const leader = row.gap > 0 ? location1 : row.gap < 0 ? location2 : "Even";
            const width = Math.max((Math.abs(row.gap) / maxAbs) * 100, Math.abs(row.gap) ? 6 : 0);
            return `
              <div class="comparison-coding-gap-row">
                <div class="comparison-rank">${index + 1}</div>
                <div class="comparison-coding-gap-main">
                  <strong>${esc(row.coding)}</strong>
                  <span>${esc(row.item || leader)}</span>
                  <div class="comparison-coding-gap-track">
                    <i style="width:${width}%"></i>
                  </div>
                </div>
                <div class="comparison-coding-gap-value">
                  <strong>${esc(fmt(row.gap))}</strong>
                  <span>${esc(leader)}</span>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function comparisonTrendChart(records, location1, location2) {
    const grouped = {};
    records.forEach((record) => {
      if (![location1, location2].includes(record.location)) return;
      const year = record.financialYear || "";
      if (!year) return;
      if (!grouped[year]) grouped[year] = { label: year, left: 0, right: 0 };
      if (record.location === location1) grouped[year].left += num(record.locFyCurrent);
      if (record.location === location2) grouped[year].right += num(record.locFyCurrent);
    });

    const series = Object.keys(grouped)
      .sort()
      .map((year) => grouped[year]);
    if (!series.length) return `<div class="empty-state">No data available.</div>`;

    const width = 560;
    const height = 250;
    const padLeft = 44;
    const padRight = 18;
    const padTop = 16;
    const padBottom = 34;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const maxValue = Math.max.apply(
      null,
      series.flatMap((item) => [num(item.left), num(item.right)]).concat([1])
    );

    function point(index, value) {
      const x = padLeft + (series.length === 1 ? plotWidth / 2 : (plotWidth / (series.length - 1)) * index);
      const y = padTop + plotHeight - (num(value) / maxValue) * plotHeight;
      return { x, y };
    }

    const leftPoints = series.map((item, index) => point(index, item.left));
    const rightPoints = series.map((item, index) => point(index, item.right));
    const gridLines = Array.from({ length: 5 }, (_, index) => {
      const y = padTop + (plotHeight / 4) * index;
      return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="chart-grid-line"/>`;
    }).join("");

    return `
      <div class="chart-frame chart-frame-line">
        <svg viewBox="0 0 ${width} ${height}" class="line-chart-svg" aria-hidden="true">
          ${gridLines}
          <polyline points="${leftPoints.map((p) => `${p.x},${p.y}`).join(" ")}" class="line-series line-series-budget">
            <title>${esc(location1)}</title>
          </polyline>
          <polyline points="${rightPoints.map((p) => `${p.x},${p.y}`).join(" ")}" class="line-series line-series-expense">
            <title>${esc(location2)}</title>
          </polyline>
          ${series
            .map((item, index) => {
              const leftPoint = leftPoints[index];
              const rightPoint = rightPoints[index];
              const axisPoint = point(index, 0);
              return `
                <g>
                  <circle cx="${leftPoint.x}" cy="${leftPoint.y}" r="4" class="line-point line-point-budget">
                    <title>${esc(`${item.label} | ${location1}: ${fmt(item.left)}`)}</title>
                  </circle>
                  <circle cx="${rightPoint.x}" cy="${rightPoint.y}" r="4" class="line-point line-point-expense">
                    <title>${esc(`${item.label} | ${location2}: ${fmt(item.right)}`)}</title>
                  </circle>
                  <text x="${leftPoint.x}" y="${leftPoint.y - 10}" text-anchor="middle" class="line-hover-label line-hover-label-budget">${esc(
                    fmt(item.left)
                  )}</text>
                  <text x="${rightPoint.x}" y="${rightPoint.y + 16}" text-anchor="middle" class="line-hover-label line-hover-label-expense">${esc(
                    fmt(item.right)
                  )}</text>
                  <text x="${axisPoint.x}" y="${height - 8}" text-anchor="middle" class="line-axis-label">${esc(item.label)}</text>
                </g>
              `;
            })
            .join("")}
        </svg>
        <div class="chart-legend chart-legend-inline">
          <div class="legend-item"><span class="legend-chip" style="--legend-color:#2f89dc"></span><span>${esc(location1)}</span></div>
          <div class="legend-item"><span class="legend-chip" style="--legend-color:#f5a338"></span><span>${esc(location2)}</span></div>
        </div>
      </div>
    `;
  }

  function renderComparison() {
    const filters = state.comparisonFilters || {};
    const locationOptions = getAllLocations();
    const codingOptionMap = {};
    []
      .concat(getRecords().map((record) => record.coding), (data.FALLBACK_OPTIONS && data.FALLBACK_OPTIONS.coding) || [], optionValuesForKey("coding"))
      .filter(Boolean)
      .forEach((coding) => {
        const key = normalizeText(coding);
        if (key && !codingOptionMap[key]) codingOptionMap[key] = coding;
      });
    const codingOptions = Object.values(codingOptionMap).sort((left, right) => String(left).localeCompare(String(right)));
    const yearOptions = optionValuesForKey("financialYear");
    const location1 = filters.location1 || "";
    const location2 = filters.location2 || "";
    const selectedCoding = filters.coding || "";
    const selectedYear = filters.financialYear || "";
    const allocationContext = getAllocationBudgetContext(getRecords());

    const rawFilteredRecords = getRecords().filter((record) => matchesComparisonFilters(record, filters, true));
    const effectiveFilteredRecords = allocationContext.records.filter((record) => matchesComparisonFilters(record, filters, true));
    const trendRecords = allocationContext.records.filter((record) => matchesComparisonFilters(record, filters, false));

    const filterCard = `
      <section class="card">
        <div class="section-head">
          <div>
            <h3>Comparison Filters</h3>
            <p>Select two MAX Hospital locations, coding, and year from the Budget Planner data.</p>
          </div>
          <div class="meta">${esc(effectiveFilteredRecords.length)} records matched</div>
        </div>
        <div class="filter-grid">
          ${selectCard("comparison-location1", "Location 1", location1, locationOptions, "Select Location 1")}
          ${selectCard("comparison-location2", "Location 2", location2, locationOptions, "Select Location 2")}
          ${searchCard("comparison-coding", "Coding", selectedCoding, codingOptions, "Search coding")}
          ${selectCard("comparison-financialYear", "Select Year", selectedYear, yearOptions, "All Years")}
        </div>
      </section>
    `;

    if (!location1 || !location2) {
      return (
        filterCard +
        emptyCard(
          "Select Two Locations",
          "Choose Location 1 and Location 2 to generate comparison KPIs, charts, heatmaps, and coding analysis."
        )
      );
    }

    if (normalizeText(location1) === normalizeText(location2)) {
      return filterCard + emptyCard("Choose Different Locations", "Location 1 and Location 2 should be different for side-by-side comparison.");
    }

    const metrics1 = comparisonLocationMetrics(location1, rawFilteredRecords, effectiveFilteredRecords);
    const metrics2 = comparisonLocationMetrics(location2, rawFilteredRecords, effectiveFilteredRecords);
    const codingRows = buildComparisonCodingRows(rawFilteredRecords, effectiveFilteredRecords, location1, location2);

    const metricRows = [
      ["Last Year Budget", metrics1.lastYearBudget, metrics2.lastYearBudget],
      ["Last Year Expense", metrics1.lastYearExpense, metrics2.lastYearExpense],
      ["Current Year Budget", metrics1.currentBudget, metrics2.currentBudget],
      ["Fixed Cost", metrics1.fixedCost, metrics2.fixedCost],
      ["Distributed Cost", metrics1.distributedCost, metrics2.distributedCost],
      ["Variance vs Last Year Expense", metrics1.expenseVariance, metrics2.expenseVariance],
      ["Growth vs Last Year Expense", metrics1.expenseGrowthPercent, metrics2.expenseGrowthPercent, true],
      ["Utilization %", metrics1.utilizationPercent, metrics2.utilizationPercent, true]
    ].map(([label, leftValue, rightValue, isPercent]) => {
      const difference = num(leftValue) - num(rightValue);
      return `
        <tr>
          <td>${esc(label)}</td>
          <td>${esc(isPercent ? pct(leftValue) : fmt(leftValue))}</td>
          <td>${esc(isPercent ? pct(rightValue) : fmt(rightValue))}</td>
          <td>${esc(isPercent ? pct(difference) : fmt(difference))}</td>
        </tr>
      `;
    });

    const codingTableRows = codingRows.map((row) => {
      const left = row.locations[location1];
      const right = row.locations[location2];
      const budgetGap = num(left.currentBudget) - num(right.currentBudget);
      return `
        <tr>
          <td>${esc(row.coding || "")}</td>
          <td>${esc(row.item || "")}</td>
          <td>${esc(fmt(left.currentBudget))}</td>
          <td>${esc(fmt(right.currentBudget))}</td>
          <td>${esc(fmt(budgetGap))}</td>
          <td>${esc(fmt(left.fixedCost))}</td>
          <td>${esc(fmt(left.distributedCost))}</td>
          <td>${esc(fmt(right.fixedCost))}</td>
          <td>${esc(fmt(right.distributedCost))}</td>
        </tr>
      `;
    });

    const heatmapCodes = codingRows.slice(0, 8).map((row) => row.coding || "Unassigned");
    const heatmapMatrix = { [location1]: {}, [location2]: {} };
    heatmapCodes.forEach((coding) => {
      heatmapMatrix[location1][coding] = 0;
      heatmapMatrix[location2][coding] = 0;
    });
    codingRows.forEach((row) => {
      if (!heatmapCodes.includes(row.coding)) return;
      heatmapMatrix[location1][row.coding] = num(row.locations[location1].currentBudget);
      heatmapMatrix[location2][row.coding] = num(row.locations[location2].currentBudget);
    });

    const contextLabel = [selectedYear || "All years", selectedCoding || "All codings"].join(" | ");

    return `
      ${filterCard}
      ${comparisonScoreboard(location1, metrics1, location2, metrics2, contextLabel)}
      ${comparisonInsightTiles(location1, metrics1, location2, metrics2)}

      <section class="comparison-analysis-grid comparison-analysis-grid-budget">
        ${comparisonSection(
          "Budget Comparison",
          "Grouped bars for last budget, expense, current budget, fixed cost, and distributed cost.",
          comparisonGroupedBudgetChart(location1, metrics1, location2, metrics2),
          "comparison-visual-wide"
        )}
        ${comparisonSection(
          "Gap Analysis",
          "Center-line variance view showing which location leads each metric.",
          comparisonGapLadder(location1, metrics1, location2, metrics2)
        )}
      </section>

      <section class="comparison-analysis-grid comparison-analysis-grid-three">
        ${comparisonSection(
          "Cost Mix Pie",
          "Fixed and distributed cost share for each selected location.",
          comparisonCostPies(location1, metrics1, location2, metrics2)
        )}
        ${comparisonSection(
          "Budget Trend",
          "Budget movement across planner years for the selected coding scope.",
          comparisonTrendChart(trendRecords, location1, location2)
        )}
        ${comparisonSection(
          "Top Coding Gaps",
          "Largest current budget differences by coding.",
          comparisonCodingGapCards(codingRows, location1, location2)
        )}
      </section>

      ${comparisonSection(
        "Coding Heatmap",
        "Top coding budget intensity across the selected locations.",
        heatmapTable(heatmapMatrix, [location1, location2], heatmapCodes),
        "comparison-heatmap-section"
      )}

      ${tableCard(
        "Metric Comparison",
        "Side-by-side totals for the selected locations.",
        ["Metric", location1, location2, "Difference"],
        metricRows
      )}

      ${tableCard(
        "Coding Comparison",
        "Coding-level current budget, fixed cost, and distributed cost comparison.",
        [
          "Coding",
          "Item",
          `${location1} Current Budget`,
          `${location2} Current Budget`,
          "Budget Gap",
          `${location1} Fixed`,
          `${location1} Distributed`,
          `${location2} Fixed`,
          `${location2} Distributed`
        ],
        codingTableRows
      )}
    `;
  }

  function renderReport() {
    const rows = getRecords().map((record) => `
      <tr>
        <td>${esc(record.financialYear || "")}</td>
        <td>${esc(record.location || "")}</td>
        <td>${esc(record.coding || "")}</td>
        <td>${esc(record.item || "")}</td>
        <td>${esc(record.owner || "")}</td>
        <td>${esc(fmt(record.locLe || 0))}</td>
        <td>${esc(fmt(record.locFyCurrent || 0))}</td>
      </tr>
    `);

    return `
      <section class="card">
        <div class="section-head">
          <div>
            <h3>Report</h3>
            <p>Export the current local report workbook for sharing.</p>
          </div>
          <button type="button" class="btn btn-primary" data-action="download-report">Download Report</button>
        </div>
      </section>

      ${tableCard(
        "Planner Report",
        "Combined snapshot of the locally stored planner data.",
        ["Financial Year", "Location", "Coding", "Item", "Owner", "LE", "FY Chosen Year"],
        rows
      )}
    `;
  }

  function renderFallback(viewId, error) {
    const label = viewId.replace("View", "");
    const message = (error && error.message) || "Unknown render error";
    if (typeof console !== "undefined" && console.error) {
      console.error("[OpexUI] Render failure", viewId, error);
    }
    return emptyCard(`${label} Unavailable`, `Render error: ${message}`);
  }

  function renderView(viewId) {
    const hostId = VIEW_HOSTS[viewId];
    const host = document.getElementById(hostId);
    if (!host) return;

    let html = "";
    try {
      if (viewId === "dashboardView") html = renderDashboard();
      else if (viewId === "plannerView") html = renderPlanner();
      else if (viewId === "locationSummaryView") html = renderLocationSummary();
      else if (viewId === "unitBudgetView") html = renderUnitBudget();
      else if (viewId === "allocationView") html = renderAllocation();
      else if (viewId === "utilizationView") html = renderUtilization();
      else if (viewId === "comparisonView") html = renderComparison();
      else if (viewId === "reportView") html = renderReport();
      else html = emptyCard("Unavailable", "This tab is not configured.");
    } catch (error) {
      html = renderFallback(viewId, error);
    }

    host.innerHTML = html || emptyCard("Unavailable", "No content generated for this tab.");
  }

  function renderAll() {
    const activeView = state.activeView || "dashboardView";
    const activeMeta = (data.VIEW_META && data.VIEW_META[activeView]) || ["Dashboard", ""];

    Object.keys(VIEW_HOSTS).forEach((viewId) => {
      const view = document.getElementById(viewId);
      const host = document.getElementById(VIEW_HOSTS[viewId]);
      if (view) view.classList.toggle("active", viewId === activeView);
      if (host) renderView(viewId);
    });

    Array.from(document.querySelectorAll("[data-view]")).forEach((button) => {
      const isActive = button.getAttribute("data-view") === activeView;
      button.classList.toggle("active", isActive);
      if (isActive) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    const activePill = document.getElementById("activeViewPill");
    const subtitle = document.getElementById("topbarSubtitle");
    const sidebarStatus = document.getElementById("sidebarStatusValue");
    const footerViewName = document.getElementById("footerViewName");
    if (activePill) activePill.textContent = activeMeta[0] || "";
    if (subtitle) subtitle.textContent = activeMeta[1] || "";
    if (sidebarStatus) sidebarStatus.textContent = activeMeta[0] || "Ready";
    if (footerViewName) footerViewName.textContent = activeMeta[0] || "Dashboard";
  }

  function closeAllCombos(exceptId) {
    Array.from(document.querySelectorAll(".combo.open")).forEach((combo) => {
      if (combo.getAttribute("data-combo-id") !== exceptId) combo.classList.remove("open");
    });
  }

  function filterCombo(combo, query) {
    const text = normalizeText(query);
    const digitText = digitsOnly(query);
    const options = Array.from(combo.querySelectorAll(".combo-option, .multi-combo-option"));
    let visibleCount = 0;
    options.forEach((option) => {
      const filterSource =
        option.getAttribute("data-filter-text") || option.getAttribute("data-value") || option.textContent || "";
      const isVisible =
        !text ||
        normalizeText(filterSource).includes(text) ||
        Boolean(digitText && digitsOnly(filterSource).includes(digitText));
      option.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });
    const empty = combo.querySelector(".combo-empty");
    if (empty) empty.hidden = visibleCount > 0;
  }

  document.addEventListener("mousedown", function (event) {
    const multiOption = event.target.closest(".multi-combo-option");
    if (multiOption && !event.target.closest("input")) {
      event.preventDefault();
      const checkbox = multiOption.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }

    const option = event.target.closest(".combo-option");
    if (option) {
      event.preventDefault();
      const inputId = option.getAttribute("data-combo-option");
      const input = document.getElementById(inputId);
      const combo = option.closest(".combo");
      if (input) {
        input.value = option.getAttribute("data-value") || "";
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (combo) combo.classList.remove("open");
      return;
    }

    const toggle = event.target.closest(".combo-toggle");
    if (toggle) {
      event.preventDefault();
      const comboId = toggle.getAttribute("data-combo-toggle");
      const combo = document.querySelector(`.combo[data-combo-id="${comboId}"]`);
      if (!combo) return;
      const input = combo.querySelector(".combo-input");
      const shouldOpen = !combo.classList.contains("open");
      closeAllCombos(shouldOpen ? comboId : "");
      combo.classList.toggle("open", shouldOpen);
      if (input) {
        filterCombo(combo, input.value || "");
        input.focus();
      }
      return;
    }
  });

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".combo")) {
      closeAllCombos("");
    }
  });

  document.addEventListener("input", function (event) {
    const input = event.target.closest(".combo-input");
    if (!input) return;
    const combo = input.closest(".combo");
    if (!combo) return;
    combo.classList.add("open");
    closeAllCombos(combo.getAttribute("data-combo-id"));
    filterCombo(combo, input.value || "");
  });

  document.addEventListener("focusin", function (event) {
    const input = event.target.closest(".combo-input");
    if (!input) return;
    const combo = input.closest(".combo");
    if (!combo) return;
    closeAllCombos(combo.getAttribute("data-combo-id"));
    combo.classList.add("open");
    filterCombo(combo, input.value || "");
  });

  function setUnitBudgetFilter(key, value) {
    state.unitBudgetFilters = Object.assign({}, state.unitBudgetFilters, { [key]: value });
    renderAll();
  }

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (!target || !target.id || !target.id.startsWith("planner-")) return;
    const key = target.id.replace("planner-", "");
    if (!["locFyCurrent"].concat(DRIVER_KEYS).includes(key)) return;
    state.form = Object.assign({}, state.form || {}, { [plannerRawValueKey(key)]: target.value });
  });

  document.addEventListener("change", function (event) {
    const target = event.target;
    if (!target || !target.id || !target.id.startsWith("planner-")) return;
    const key = target.id.replace("planner-", "");
    if (!["locFyCurrent"].concat(DRIVER_KEYS).includes(key)) return;
    state.form = Object.assign({}, state.form || {}, { [plannerRawValueKey(key)]: target.value });
  });

  function computeDashboardTop80(records, totalBudget) {
    const rows = Array.isArray(records) ? records : [];
    const budgetTotal = Math.max(num(totalBudget), 0);
    if (!rows.length || !budgetTotal) return { pareto: [], alerts: [] };

    const groupedByCodingItem = {};
    rows.forEach((record) => {
      const coding = String(record.coding || "Unassigned").trim() || "Unassigned";
      const item = String(record.item || "Unassigned").trim() || "Unassigned";
      const key = `${coding}||${item}`;
      if (!groupedByCodingItem[key]) {
        groupedByCodingItem[key] = { coding, item, current: 0, last: 0 };
      }
      groupedByCodingItem[key].current += num(record.locFyCurrent);
      groupedByCodingItem[key].last += num(record.locFyLast);
    });

    const groupedRows = Object.values(groupedByCodingItem).sort((left, right) => right.current - left.current);

    let runningAmount = 0;
    const pareto = [];
    groupedRows.forEach((row) => {
      if (!row.current) return;
      const beforePct = budgetTotal ? (runningAmount / budgetTotal) * 100 : 0;
      if (beforePct >= 80) return;
      const sharePct = (row.current / budgetTotal) * 100;
      runningAmount += row.current;
      const cumulativePct = (runningAmount / budgetTotal) * 100;
      const increasePct = row.last ? ((row.current - row.last) / row.last) * 100 : row.current ? Number.POSITIVE_INFINITY : 0;
      pareto.push({
        coding: row.coding,
        item: row.item,
        currentBudget: allocationRoundedValue(row.current),
        sharePercent: allocationRoundedValue(sharePct),
        cumulativePercent: allocationRoundedValue(cumulativePct),
        lastYearBudget: allocationRoundedValue(row.last),
        changePercent: Number.isFinite(increasePct) ? allocationRoundedValue(increasePct) : "New"
      });
    });

    const alerts = groupedRows
      .map((row) => {
        const increasePct = row.last ? ((row.current - row.last) / row.last) * 100 : row.current ? Number.POSITIVE_INFINITY : 0;
        return {
          coding: row.coding,
          item: row.item,
          lastYearBudget: allocationRoundedValue(row.last),
          currentBudget: allocationRoundedValue(row.current),
          increasePercent: Number.isFinite(increasePct) ? allocationRoundedValue(increasePct) : "New",
          flag: !Number.isFinite(increasePct) || increasePct >= 80 ? "Above 80%" : increasePct >= 75 ? "Around 80%" : ""
        };
      })
      .filter((row) => row.flag);

    return { pareto, alerts };
  }

  function exportDashboardWorkbook() {
    if (!window.XLSX) {
      alert("XLSX library is not available.");
      return;
    }

    const records = rowsForDashboard();
    const appliedEntries = getAppliedAllocationEntries();
    const selectedCodingCount = appliedEntries.length;
    const allocationMode = selectedCodingCount ? "Distributed" : "Fixed Cost";
    const modeSuffix =
      allocationMode === "Distributed" && selectedCodingCount
        ? ` (${selectedCodingCount} coding${selectedCodingCount > 1 ? "s" : ""})`
        : "";

    const currentYearBudget = records.reduce((sum, record) => sum + num(record.locFyCurrent), 0);
    const lastYearBudget = records.reduce((sum, record) => sum + num(record.locFyLast), 0);
    const totalExpense = records.reduce((sum, record) => sum + num(record.locLe), 0);
    const remaining = currentYearBudget - totalExpense;
    const utilizedAmount = currentYearBudget - remaining;
    const utilization = currentYearBudget ? (utilizedAmount / currentYearBudget) * 100 : 0;
    const growth = totalExpense ? ((currentYearBudget - totalExpense) / totalExpense) * 100 : 0;

    const locationGroups = groupedRows(records, "location");
    const categoryGroups = groupedRows(records, "categoryIt");
    const ownerGroups = groupedRows(records, "owner");

    const expenseByLocation = {};
    records.forEach((record) => {
      const location = record.location || "Unassigned";
      expenseByLocation[location] = (expenseByLocation[location] || 0) + num(record.locLe);
    });
    const locationChartItems = locationGroups.map(([location, budget]) => ({
      location,
      currentBudget: allocationRoundedValue(budget),
      usedBudget: allocationRoundedValue(Math.min(Math.max(num(expenseByLocation[location] || 0), 0), budget)),
      remainingBudget: allocationRoundedValue(Math.max(budget - Math.max(num(expenseByLocation[location] || 0), 0), 0))
    }));

    const yearGroups = {};
    records.forEach((record) => {
      const key = record.financialYear || "Unassigned";
      if (!yearGroups[key]) yearGroups[key] = { budget: 0, le: 0 };
      yearGroups[key].budget += num(record.locFyCurrent);
      yearGroups[key].le += num(record.locLe);
    });
    const growthSeries = Object.keys(yearGroups)
      .sort()
      .map((year) => ({
        financialYear: year,
        budget: allocationRoundedValue(yearGroups[year].budget),
        le: allocationRoundedValue(yearGroups[year].le)
      }));

    const topLocations = locationGroups.map((item) => item[0]);
    const topCategories = categoryGroups.map((item) => item[0]);
    const heatmapMatrix = {};
    topLocations.forEach((location) => {
      heatmapMatrix[location] = {};
      topCategories.forEach((category) => {
        heatmapMatrix[location][category] = 0;
      });
    });
    records.forEach((record) => {
      if (!topLocations.includes(record.location) || !topCategories.includes(record.categoryIt)) return;
      heatmapMatrix[record.location][record.categoryIt] += num(record.locFyCurrent);
    });
    const heatmapRows = [];
    topLocations.forEach((location) => {
      topCategories.forEach((category) => {
        heatmapRows.push({
          location,
          category,
          budget: allocationRoundedValue(num((heatmapMatrix[location] || {})[category]))
        });
      });
    });

    const top80 = computeDashboardTop80(records, currentYearBudget);

    const filters = state.dashboardFilters || {};
    const workbook = window.XLSX.utils.book_new();
    const timestamp = new Date();
    const fileName = `Dashboard-${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(
      timestamp.getDate()
    ).padStart(2, "0")}.xlsx`;

    function appendSheet(name, rows) {
      const safeRows = (rows || []).length ? rows : [{ Message: "No data for current filters" }];
      const sheet = window.XLSX.utils.json_to_sheet(safeRows);
      window.XLSX.utils.book_append_sheet(workbook, sheet, name);
    }

    appendSheet("Filters", [
      {
        location: filters.location || "All",
        category: filters.category || "All",
        financialYear: filters.financialYear || "All",
        owner: filters.owner || "All",
        allocationMode: allocationMode + modeSuffix
      }
    ]);

    appendSheet("KPIs", [
      {
        lastYearBudget: allocationRoundedValue(lastYearBudget),
        currentYearBudget: allocationRoundedValue(currentYearBudget),
        le: allocationRoundedValue(totalExpense),
        remainingBudget: allocationRoundedValue(remaining),
        utilizationPercent: allocationRoundedValue(utilization),
        growthPercent: allocationRoundedValue(growth)
      }
    ]);

    appendSheet(
      "Planner Rows",
      records.map((record) => ({
        financialYear: record.financialYear || "",
        location: record.location || "",
        coding: record.coding || "",
        item: record.item || "",
        owner: record.owner || record.owner1 || "",
        costDistribution: record.__allocationType || "",
        currentBudget: allocationRoundedValue(record.locFyCurrent),
        le: allocationRoundedValue(record.locLe),
        lastYearBudget: allocationRoundedValue(record.locFyLast),
        category: record.categoryIt || record.subCategoryMapped || record.appCate || ""
      }))
    );

    appendSheet(
      "Location Pulse",
      locationChartItems.map((row) => ({
        location: row.location,
        currentBudget: row.currentBudget,
        usedBudget: row.usedBudget,
        remainingBudget: row.remainingBudget
      }))
    );

    appendSheet(
      "Category Mix",
      categoryGroups.map(([category, value]) => ({
        category,
        currentBudget: allocationRoundedValue(value),
        sharePercent: currentYearBudget ? allocationRoundedValue((num(value) / currentYearBudget) * 100) : 0
      }))
    );

    appendSheet("Growth Trajectory", growthSeries);

    appendSheet(
      "Owner Leaderboard",
      ownerGroups.map(([owner, value]) => ({
        owner,
        currentBudget: allocationRoundedValue(value),
        sharePercent: currentYearBudget ? allocationRoundedValue((num(value) / currentYearBudget) * 100) : 0
      }))
    );

    appendSheet("Heatmap", heatmapRows);
    appendSheet("Top80 Contributors", top80.pareto);
    appendSheet("80pct Alerts", top80.alerts);

    window.XLSX.writeFile(workbook, fileName);
  }

  async function exportDashboardPdf() {
    if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF libraries are not available.");
      return;
    }

    const target = document.getElementById("dashboardContent");
    if (!target) {
      alert("Dashboard content is not available.");
      return;
    }

    const exportSections = Array.from(target.children).filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.classList.contains("dashboard-filter-panel")) return false;
      return true;
    });
    if (!exportSections.length) {
      alert("No dashboard visualizations available to export.");
      return;
    }

    const exportRoot = document.createElement("div");
    exportRoot.style.position = "fixed";
    exportRoot.style.left = "-100000px";
    exportRoot.style.top = "0";
    exportRoot.style.width = `${Math.max(target.scrollWidth, target.clientWidth, 1200)}px`;
    exportRoot.style.background = "#ffffff";
    exportRoot.style.padding = "12px";
    exportRoot.style.boxSizing = "border-box";
    exportRoot.style.display = "grid";
    exportRoot.style.gap = "14px";

    exportSections.forEach((section) => {
      exportRoot.appendChild(section.cloneNode(true));
    });
    document.body.appendChild(exportRoot);

    const PDF = window.jspdf.jsPDF;
    const pdf = new PDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const drawWidth = pageWidth - margin * 2;
    const pageContentHeight = pageHeight - margin * 2;
    const maxPages = 3;

    try {
      const mergedCanvas = await window.html2canvas(exportRoot, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: Math.max(exportRoot.scrollWidth, exportRoot.clientWidth),
        height: Math.max(exportRoot.scrollHeight, exportRoot.clientHeight),
        windowWidth: Math.max(exportRoot.scrollWidth, exportRoot.clientWidth),
        windowHeight: Math.max(exportRoot.scrollHeight, exportRoot.clientHeight),
        scrollX: 0,
        scrollY: 0
      });

      const imgData = mergedCanvas.toDataURL("image/png");
      const fullImageHeight = (mergedCanvas.height * drawWidth) / mergedCanvas.width;
      const maxTotalHeight = pageContentHeight * maxPages;
      const shrinkScale = fullImageHeight > maxTotalHeight ? maxTotalHeight / fullImageHeight : 1;
      const renderWidth = drawWidth * shrinkScale;
      const renderHeight = fullImageHeight * shrinkScale;
      const offsetX = margin + (drawWidth - renderWidth) / 2;
      const pagesNeeded = Math.max(1, Math.min(maxPages, Math.ceil(renderHeight / pageContentHeight)));

      for (let pageIndex = 0; pageIndex < pagesNeeded; pageIndex += 1) {
        if (pageIndex > 0) pdf.addPage();
        const yOffset = margin - pageIndex * pageContentHeight;
        pdf.addImage(imgData, "PNG", offsetX, yOffset, renderWidth, renderHeight, undefined, "FAST");
      }
    } finally {
      exportRoot.remove();
    }

    const timestamp = new Date();
    const fileName = `Dashboard-${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(
      timestamp.getDate()
    ).padStart(2, "0")}.pdf`;
    pdf.save(fileName);
  }

  function exportAllocationMatrixWorkbook() {
    if (!window.XLSX) {
      alert("XLSX library is not available.");
      return;
    }

    const controls = state.allocationControls || {};
    const matrixFilters = state.allocationMatrixFilters || {};
    const appliedEntries = getAppliedAllocationEntries();
    const allocationContext = getAllocationBudgetContext(getRecords(), appliedEntries);
    const effectiveRecords = allocationContext.records;
    const manualEdits =
      state && state.allocationMatrixEdits && typeof state.allocationMatrixEdits === "object" ? state.allocationMatrixEdits : {};
    const locations = getAllLocations();

    const grouped = {};
    effectiveRecords.forEach((record) => {
      const resolvedItem = String(record.item || "").trim() || mappedItemForCode(record.coding);
      const key = [record.financialYear || "", record.coding, resolvedItem, record.owner].join("||");
      if (!grouped[key]) {
        grouped[key] = {
          financialYear: record.financialYear || "",
          coding: record.coding || "",
          item: resolvedItem || "",
          owner: record.owner || "",
          allocationType: record.__allocationType || "Fixed Cost",
          locations: {}
        };
      }
      grouped[key].locations[record.location || "Unassigned"] =
        (grouped[key].locations[record.location || "Unassigned"] || 0) + num(record.locFyCurrent);
    });

    const matrixLocation = String(matrixFilters.location || "");
    const matrixCoding = String(matrixFilters.coding || "");
    const matrixYear = String(matrixFilters.financialYear || "");
    const matrixOwner = String(matrixFilters.owner || "");

    const entries = Object.values(grouped)
      .filter((entry) => {
        if (matrixYear && String(entry.financialYear || "") !== matrixYear) return false;
        if (matrixCoding && normalizeText(entry.coding) !== normalizeText(matrixCoding)) return false;
        if (matrixOwner && normalizeText(entry.owner) !== normalizeText(matrixOwner)) return false;
        if (matrixLocation) return num(entry.locations && entry.locations[matrixLocation]) > 0;
        return true;
      })
      .sort((a, b) => {
        const yearSort = String(a.financialYear || "").localeCompare(String(b.financialYear || ""));
        if (yearSort) return yearSort;
        const codingSort = String(a.coding || "").localeCompare(String(b.coding || ""));
        if (codingSort) return codingSort;
        return String(a.owner || "").localeCompare(String(b.owner || ""));
      });

    const exportRows = entries.map((entry) => {
      const rowKey = allocationRowKey(entry.coding || "", entry.item || "", entry.owner || "", entry.financialYear || "");
      const row = {
        financialYear: entry.financialYear || "Unassigned",
        coding: entry.coding || "",
        item: entry.item || "",
        owner: entry.owner || "",
        costDistribution: entry.allocationType || "Fixed Cost"
      };
      let total = 0;
      locations.forEach((location) => {
        const baseValue = num(entry.locations[location] || 0);
        const editKey = allocationCellKey(rowKey, location);
        const editedValue =
          Object.prototype.hasOwnProperty.call(manualEdits, editKey) && normalizeText(entry.allocationType) === "distributed"
            ? Math.max(0, num(manualEdits[editKey]))
            : baseValue;
        row[location] = allocationRoundedValue(editedValue);
        total += editedValue;
      });
      row.totalBudget = allocationRoundedValue(total);
      return row;
    });

    const workbook = window.XLSX.utils.book_new();
    const filterSheet = [
      {
        matrixLocation: matrixLocation || "All",
        matrixCoding: matrixCoding || "All",
        matrixFinancialYear: matrixYear || "All",
        matrixOwner: matrixOwner || "All",
        controlCoding: controls.coding || "",
        controlOwner: controls.owner || "",
        controlYear: controls.financialYear || ""
      }
    ];
    const rows = exportRows.length ? exportRows : [{ Message: "No rows for selected matrix filters." }];
    const filterWs = window.XLSX.utils.json_to_sheet(filterSheet);
    const matrixWs = window.XLSX.utils.json_to_sheet(rows);
    window.XLSX.utils.book_append_sheet(workbook, filterWs, "Matrix Filters");
    window.XLSX.utils.book_append_sheet(workbook, matrixWs, "Allocation Matrix");

    const timestamp = new Date();
    const fileName = `Allocation-Matrix-${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(
      timestamp.getDate()
    ).padStart(2, "0")}.xlsx`;
    window.XLSX.writeFile(workbook, fileName);
  }

  function getAllocationCombinedRowsForReport() {
    const appliedEntries = getAppliedAllocationEntries();
    const allocationContext = getAllocationBudgetContext(getRecords(), appliedEntries);
    const effectiveRecords = allocationContext.records;
    const manualEdits =
      state && state.allocationMatrixEdits && typeof state.allocationMatrixEdits === "object" ? state.allocationMatrixEdits : {};
    const locations = getAllLocations();

    const grouped = {};
    effectiveRecords.forEach((record) => {
      const resolvedItem = String(record.item || "").trim() || mappedItemForCode(record.coding);
      const key = [record.financialYear || "", record.coding, resolvedItem, record.owner].join("||");
      if (!grouped[key]) {
        grouped[key] = {
          financialYear: record.financialYear || "",
          coding: record.coding || "",
          item: resolvedItem || "",
          owner: record.owner || "",
          allocationType: record.__allocationType || "Fixed Cost",
          locations: {}
        };
      }
      grouped[key].locations[record.location || "Unassigned"] =
        (grouped[key].locations[record.location || "Unassigned"] || 0) + num(record.locFyCurrent);
    });

    const entries = Object.values(grouped).sort((a, b) => {
      const yearSort = String(a.financialYear || "").localeCompare(String(b.financialYear || ""));
      if (yearSort) return yearSort;
      const codingSort = String(a.coding || "").localeCompare(String(b.coding || ""));
      if (codingSort) return codingSort;
      return String(a.owner || "").localeCompare(String(b.owner || ""));
    });

    return entries.map((entry) => {
      const rowKey = allocationRowKey(entry.coding || "", entry.item || "", entry.owner || "", entry.financialYear || "");
      const row = {
        financialYear: entry.financialYear || "Unassigned",
        coding: entry.coding || "",
        item: entry.item || "",
        owner: entry.owner || "",
        costDistribution: entry.allocationType || "Fixed Cost"
      };
      let total = 0;
      locations.forEach((location) => {
        const baseValue = num(entry.locations[location] || 0);
        const editKey = allocationCellKey(rowKey, location);
        const editedValue =
          Object.prototype.hasOwnProperty.call(manualEdits, editKey) && normalizeText(entry.allocationType) === "distributed"
            ? Math.max(0, num(manualEdits[editKey]))
            : baseValue;
        row[location] = allocationRoundedValue(editedValue);
        total += editedValue;
      });
      row.totalBudget = allocationRoundedValue(total);
      return row;
    });
  }

  function exportPlannerSavedRecordsWorkbook() {
    if (!window.XLSX) {
      alert("XLSX library is not available.");
      return;
    }

    const savedFilters = state.plannerSavedFilters || {};
    const savedYear = String(savedFilters.financialYear || "");
    const savedLocation = String(savedFilters.location || "");
    const savedCoding = String(savedFilters.coding || "");
    const savedItem = String(savedFilters.item || "");
    const savedOwner = String(savedFilters.owner || "");

    const allRecords = getRecords();
    const filteredRecords = allRecords.filter((record) => {
      if (savedYear && savedYear !== "All" && String(record.financialYear || "") !== savedYear) return false;
      if (savedLocation && savedLocation !== "All" && String(record.location || "") !== savedLocation) return false;
      if (savedCoding && savedCoding !== "All" && normalizeText(record.coding) !== normalizeText(savedCoding)) return false;
      if (savedItem && savedItem !== "All" && normalizeText(record.item) !== normalizeText(savedItem)) return false;
      if (savedOwner && savedOwner !== "All" && normalizeText(record.owner) !== normalizeText(savedOwner)) return false;
      return true;
    });

    const rows = filteredRecords.map((record) => {
      const last = num(record.locFyLast);
      const current = num(record.locFyCurrent);
      const changePct = last ? ((current - last) / last) * 100 : 0;
      return {
        financialYear: record.financialYear || "",
        location: record.location || "",
        coding: record.coding || "",
        item: record.item || "",
        currentFY: allocationRoundedValue(record.locFyCurrent || 0),
        fyLastYear: allocationRoundedValue(record.locFyLast || 0),
        percentChange: allocationRoundedValue(changePct),
        le: allocationRoundedValue(record.locLe || 0),
        owner: record.owner || ""
      };
    });

    const workbook = window.XLSX.utils.book_new();
    const filterSheet = [
      {
        financialYear: savedYear || "All",
        location: savedLocation || "All",
        coding: savedCoding || "All",
        item: savedItem || "All",
        owner: savedOwner || "All"
      }
    ];
    const dataSheet = rows.length ? rows : [{ Message: "No rows for selected Saved Records filters." }];

    const filterWs = window.XLSX.utils.json_to_sheet(filterSheet);
    const dataWs = window.XLSX.utils.json_to_sheet(dataSheet);
    window.XLSX.utils.book_append_sheet(workbook, filterWs, "Saved Records Filters");
    window.XLSX.utils.book_append_sheet(workbook, dataWs, "Saved Records");

    const timestamp = new Date();
    const fileName = `Saved-Records-${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(
      timestamp.getDate()
    ).padStart(2, "0")}.xlsx`;
    window.XLSX.writeFile(workbook, fileName);
  }

  window.OpexUI = {
    renderAll,
    setUnitBudgetFilter,
    preparePlannerSave,
    exportDashboardWorkbook,
    exportDashboardPdf,
    exportAllocationMatrixWorkbook,
    exportPlannerSavedRecordsWorkbook,
    getAllocationCombinedRowsForReport
  };
})();
