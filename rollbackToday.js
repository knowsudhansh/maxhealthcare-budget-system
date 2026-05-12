(function () {
  const CLASS_NAMES = [
    "responsive-app-shell",
    "responsive-app-main",
    "responsive-app-sidebar",
    "legacy-sticky-shell",
    "legacy-sticky-main",
    "legacy-sticky-sidebar",
    "legacy-sticky-path",
    "ui-aligned-shell",
    "ui-aligned-sidebar",
    "ui-aligned-main",
    "responsive-sidebar-button"
  ];

  function removeTodayClasses() {
    CLASS_NAMES.forEach(function (className) {
      document.querySelectorAll("." + className).forEach(function (node) {
        node.classList.remove(className);
      });
    });

    document.querySelectorAll("[aria-current='page']").forEach(function (node) {
      node.removeAttribute("aria-current");
    });
  }

  function removeTodayUiElements() {
    [
      "responsiveSidebarToggle",
      "responsiveSidebarBackdrop"
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  function unwrapResponsiveTables() {
    document.querySelectorAll(".responsive-table-wrap").forEach(function (wrapper) {
      const parent = wrapper.parentNode;
      if (!parent) return;
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }
      wrapper.remove();
    });
  }

  function cleanupInlineStyles() {
    document.querySelectorAll("[style]").forEach(function (node) {
      const style = node.getAttribute("style") || "";
      if (
        /position\s*:\s*sticky/i.test(style) ||
        /position\s*:\s*fixed/i.test(style) ||
        /grid-template-columns/i.test(style) ||
        /min-width/i.test(style) ||
        /width\s*:\s*calc/i.test(style)
      ) {
        node.removeAttribute("style");
      }
    });
  }

  function rollbackTodayChanges() {
    removeTodayClasses();
    removeTodayUiElements();
    unwrapResponsiveTables();
    cleanupInlineStyles();
  }

  function initRollbackToday() {
    rollbackTodayChanges();
    setTimeout(rollbackTodayChanges, 50);
    setTimeout(rollbackTodayChanges, 250);
    setTimeout(rollbackTodayChanges, 800);

    window.addEventListener("resize", rollbackTodayChanges);

    const observer = new MutationObserver(function () {
      rollbackTodayChanges();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-current"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRollbackToday);
  } else {
    initRollbackToday();
  }
})();
