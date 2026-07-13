(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.OpexUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_LOCALE = "en-IN";
  const DEFAULT_FALLBACK = "0";
  const EXCEL_FINANCIAL_FORMAT = "#,##,##0.##";

  function parseFinancialAmount(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    const cleaned = String(value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .replace(/₹/g, "")
      .replace(/\s+/g, "")
      .trim();

    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function decimalOptions(value, options) {
    if (options && (options.minimumFractionDigits !== undefined || options.maximumFractionDigits !== undefined)) {
      return {
        minimumFractionDigits: options.minimumFractionDigits,
        maximumFractionDigits: options.maximumFractionDigits
      };
    }

    const raw = String(value ?? "");
    const decimals = raw.includes(".") ? raw.split(".").pop().replace(/\D/g, "").length : 0;
    const maximumFractionDigits = Math.min(Math.max(decimals, 0), 2);
    return {
      minimumFractionDigits: 0,
      maximumFractionDigits
    };
  }

  function formatFinancialAmount(value, options) {
    const fallback = options && Object.prototype.hasOwnProperty.call(options, "fallback") ? options.fallback : DEFAULT_FALLBACK;
    const parsed = parseFinancialAmount(value);
    if (!Number.isFinite(parsed)) return fallback;

    const fraction = decimalOptions(value, options || {});
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      minimumFractionDigits: fraction.minimumFractionDigits,
      maximumFractionDigits: fraction.maximumFractionDigits
    }).format(parsed);
  }

  function normalizeSearchKey(value) {
    return String(value ?? "").trim().toLocaleUpperCase(DEFAULT_LOCALE);
  }

  function normalizeCodingKey(value) {
    return normalizeSearchKey(value);
  }

  function chooseCanonicalCodingValue(currentValue, candidateValue) {
    const current = String(currentValue || "").trim();
    const candidate = String(candidateValue || "").trim();
    if (!current) return candidate;
    if (!candidate) return current;
    if (candidate === normalizeCodingKey(candidate) && current !== normalizeCodingKey(current)) return candidate;
    return current;
  }

  function uniqueCodingValues(values) {
    const byKey = new Map();
    (values || []).forEach((value) => {
      const candidate = String(value || "").trim();
      const key = normalizeCodingKey(candidate);
      if (!key) return;
      byKey.set(key, chooseCanonicalCodingValue(byKey.get(key), candidate));
    });
    return Array.from(byKey.values());
  }

  function filterCodingValues(values, query) {
    const queryKey = normalizeCodingKey(query);
    const queryDigits = String(query ?? "").replace(/\D/g, "");
    return uniqueCodingValues(values).filter((value) => {
      if (!queryKey && !queryDigits) return true;
      const valueKey = normalizeCodingKey(value);
      const valueDigits = String(value ?? "").replace(/\D/g, "");
      return valueKey.includes(queryKey) || Boolean(queryDigits && valueDigits.includes(queryDigits));
    });
  }

  function shouldShowClearButton(config) {
    const options = config || {};
    const value = options.value;
    const emptyValue = Object.prototype.hasOwnProperty.call(options, "emptyValue") ? options.emptyValue : "";
    const placeholderValue = options.placeholderValue;
    if (options.disabled) return false;
    if (value === null || value === undefined) return false;
    const normalizedValue = String(value).trim();
    if (normalizedValue === String(emptyValue).trim()) return false;
    if (placeholderValue !== undefined && normalizedValue === String(placeholderValue).trim()) return false;
    return true;
  }

  function normalizeBasePath(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "/") return "";
    if (
      raw.includes("?") ||
      raw.includes("#") ||
      raw.includes("\\") ||
      /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ) {
      return "";
    }
    const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
    const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/g, "");
    const segments = withoutTrailingSlash.split("/").filter(Boolean);
    if (!segments.length) return "";
    if (segments.some((segment) => segment === "." || segment === "..")) return "";
    if (segments.some((segment) => !/^[A-Za-z0-9._~-]+$/.test(segment))) return "";
    return `/${segments.join("/")}`;
  }

  function getAppBasePath() {
    const config = typeof globalThis !== "undefined" ? globalThis.APP_CONFIG || {} : {};
    return normalizeBasePath(config.basePath || "");
  }

  function trimSlashes(value) {
    return String(value || "").replace(/^\/+|\/+$/g, "");
  }

  function joinUrl(base, path) {
    const normalizedBase = String(base || "").replace(/\/+$/g, "");
    const normalizedPath = trimSlashes(path);
    return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase || "/";
  }

  function buildAppUrl(path) {
    const basePath = getAppBasePath();
    const normalizedPath = trimSlashes(path);
    if (!normalizedPath) return basePath || "/";
    return `${basePath}/${normalizedPath}`;
  }

  function getApiBaseOverride() {
    try {
      if (typeof localStorage === "undefined") return "";
      return String(localStorage.getItem("API_BASE_OVERRIDE") || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function buildApiUrl(path) {
    const apiPath = trimSlashes(path).replace(/^api\/?/i, "");
    const endpointPath = apiPath ? `api/${apiPath}` : "api";
    const override = getApiBaseOverride();
    if (override) return joinUrl(override, endpointPath);
    try {
      if (typeof location !== "undefined" && location.protocol === "file:") {
        return joinUrl("http://localhost:3001", endpointPath);
      }
    } catch (_error) {}
    return buildAppUrl(endpointPath);
  }

  const AppUrls = {
    app: buildAppUrl,
    api: buildApiUrl,
    basePath: getAppBasePath
  };

  return {
    AppUrls,
    DEFAULT_LOCALE,
    EXCEL_FINANCIAL_FORMAT,
    buildApiUrl,
    buildAppUrl,
    filterCodingValues,
    formatFinancialAmount,
    getAppBasePath,
    normalizeBasePath,
    normalizeCodingKey,
    normalizeSearchKey,
    shouldShowClearButton,
    uniqueCodingValues,
    parseFinancialAmount
  };
});
