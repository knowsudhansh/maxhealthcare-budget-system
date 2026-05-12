(function () {
  if (window.__brandingEnhancementsInitialized) {
    return;
  }
  window.__brandingEnhancementsInitialized = true;

  const VIEW_TEXT = [
    {
      ids: ["enterpriseDashboardView", "dashboardView"],
      pill: "Dashboard",
      description: "Dashboard overview for budget, allocation, utilization and unit planning."
    },
    {
      ids: ["plannerView", "budgetPlannerView"],
      pill: "Budget Planner",
      description: "Planner workspace for coding, item, owner, location and MAX Hospital inputs."
    },
    {
      ids: ["locationSummaryView"],
      pill: "Location Summary",
      description: "Location-level summaries, saved records and local database views."
    },
    {
      ids: ["unitBudgetView"],
      pill: "Unit Budget",
      description: "Unit-wise budget comparison with location level budget insights."
    },
    {
      ids: ["allocationFixedView", "allocationView"],
      pill: "Allocation",
      description: "Fixed-cost and distributed-cost allocation workspace by coding, item and owner."
    },
    {
      ids: ["opexUtilizationView", "utilizationView"],
      pill: "Utilization",
      description: "OPEX budget utilization, LE comparison and usage monitoring."
    },
    {
      ids: ["reportsView"],
      pill: "Reports",
      description: "Reporting and export workspace for planning and management summaries."
    }
  ];

  function getVisibleViewMeta() {
    for (let i = 0; i < VIEW_TEXT.length; i += 1) {
      const meta = VIEW_TEXT[i];
      for (let j = 0; j < meta.ids.length; j += 1) {
        const node = document.getElementById(meta.ids[j]);
        if (!node) {
          continue;
        }
        const visible = !node.hidden && node.style.display !== "none";
        if (visible) {
          return meta;
        }
      }
    }
    return VIEW_TEXT[0];
  }

  function updateBrandHeader() {
    const pill = document.getElementById("maxActiveViewPill");
    const description = document.getElementById("maxViewDescription");
    const meta = getVisibleViewMeta();
    if (pill) {
      pill.textContent = meta.pill;
    }
    if (description) {
      description.textContent = meta.description;
    }
    document.title = `MAX Healthcare | ${meta.pill}`;
  }

  function init() {
    updateBrandHeader();

    let scheduled = false;
    const schedule = function () {
      if (scheduled) {
        return;
      }
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        updateBrandHeader();
      });
    };

    document.body.addEventListener("click", schedule, true);
    window.addEventListener("records-updated", schedule);
    window.addEventListener("locationdb-updated", schedule);

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "hidden", "class"]
    });

    setTimeout(updateBrandHeader, 250);
    setTimeout(updateBrandHeader, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
