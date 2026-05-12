(function () {
  const STORAGE_KEY = "it_opex_records_v3";
  const LEGACY_KEYS = ["it_opex_records_v2", "it_opex_records", "it_opex_records_v1"];
  const YEARS = ["2023-24", "2024-25", "2025-26", "2026-27", "2027-28", "2028-29", "2029-30", "2030-31"];
  const LOCATIONS = ["Saket", "Max Smart", "Gurgaon", "Lajpat Nagar", "Panchsheel", "Patparganj", "Vaishali", "Noida", "Shalimar Bagh", "Mohali", "Dehradun", "Bathinda", "HO", "BLK", "Nanawati", "Nagpur", "Lucknow", "Dwarka", "Jaypee Noida"];
  const FIELD_DEFS = [
    ["coding", "Coding"],
    ["item", "Item"],
    ["subCategoryMapped", "Sub Category (Mapped)"],
    ["categoryIt", "Category_IT"],
    ["subCategory", "Sub Category"],
    ["newCategory", "New Category"],
    ["appCate", "App Cate."],
    ["cate3", "Cate.3"],
    ["cate4", "Cate.4"],
    ["owner1", "Owner1"],
    ["owner", "Owner"],
    ["costCenter", "Cost Center / Department"]
  ];
  const DRIVER_FIELDS = [
    ["newAmc", "New AMC"],
    ["newProject", "New Project"],
    ["annualized", "Annualized"],
    ["priceIncrease", "Price Increase"],
    ["newUnit", "New Unit"],
    ["licenseIncrease", "License Increase"],
    ["rest", "Rest"]
  ];
  const FALLBACK_OPTIONS = {
    coding: ["ITOPEX042", "ITOPEX066", "ITOPEX205", "ITOPEX036", "ITOPEX034", "ITOPEX013", "ITOPEX009", "ITOPEX338", "ITOPEX101", "ITOPEX075", "ITOPEX323", "ITOPEX065", "ITOPEX186", "ITOPEX289", "ITOPEX062", "ITOPEX192", "ITOPEX029", "ITOPEX050", "ITOPEX063", "ITOPEX173", "ITOPEX069", "ITOPEX046", "ITOPEX279", "ITOPEX091", "ITOPEX084", "ITOPEX210", "ITOPEX007", "ITOPEX053", "ITOPEX156", "ITOPEX047", "ITOPEX058", "ITOPEX060", "ITOPEX008", "ITOPEX095", "ITOPEX172", "ITOPEX163", "ITOPEX014", "ITOPEX032", "ITOPEX067", "ITOPEX170", "ITOPEX273", "ITOPEX071", "ITOPEX038", "ITOPEX023", "ITOPEX169", "ITOPEX206", "ITOPEX301", "ITOPEX339", "ITOPEX092", "ITOPEX085", "ITOPEX252", "ITOPEX100", "ITOPEX049", "ITOPEX106", "ITOPEX108", "ITOPEX175", "ITOPEX268", "ITOPEX113", "ITOPEX024", "ITOPEX117", "ITOPEX037", "ITOPEX118", "ITOPEX128", "ITOPEX129", "ITOPEX143", "ITOPEX204", "ITOPEX005", "ITOPEX145", "ITOPEX149", "ITOPEX324", "ITOPEX154", "ITOPEX332", "ITOPEX337", "ITOPEX070", "ITOPEX171", "ITOPEX064", "ITOPEX270", "ITOPEX155", "ITOPEX043", "ITOPEX333", "ITOPEX166", "ITOPEX052", "ITOPEX015", "ITOPEX081", "ITOPEX174", "ITOPEX229", "ITOPEX179", "ITOPEX208", "ITOPEX309", "ITOPEX196", "ITOPEX011", "ITOPEX226", "ITOPEX057", "ITOPEX061", "ITOPEX203", "ITOPEX035", "ITOPEX211", "ITOPEX111", "ITOPEX090", "ITOPEX033", "ITOPEX167", "ITOPEX230", "ITOPEX236", "ITOPEX241", "ITOPEX159", "ITOPEX109", "ITOPEX264", "ITOPEX266", "ITOPEX056", "ITOPEX158", "ITOPEX271", "ITOPEX121", "ITOPEX073", "ITOPEX274", "ITOPEX275", "ITOPEX276", "ITOPEX162", "ITOPEX131", "ITOPEX051", "ITOPEX291", "ITOPEX299", "ITOPEX277", "ITOPEX213", "ITOPEX313", "ITOPEX314", "ITOPEX315", "ITOPEX316", "ITOPEX317", "ITOPEX320", "ITOPEX321", "ITOPEX212", "ITOPEX018", "ITOPEX325", "ITOPEX326", "ITOPEX328", "ITOPEX329", "ITOPEX330", "ITOPEX331", "ITOPEX135", "ITOPEX150", "ITOPEX335", "ITOPEX272", "ITOPEX122", "ITOPEX269"],
    item: ["IMS", "Sify DC", "AWS (Manage service, infra ,PACS storge)", "HRMS", "Connectivity e.g.Sify,Airtel ,Vodafone & ILL", "Enhancements (CRM)", "CRM License", "Outsytems License Renewal 300 AO + 500 internal +1000 external", "Complinity", "LIMS Support", "Seclore (UPSI safety)", "O365 email subscription renewal", "Volody", "Developler Licenses and subscription", "Citrix license", "Azure New", "Sify DR", "EHR support", "Crowdstrike Antivirus", "Brand Monitoring & Cyber Protection -", "L2 Support", "HIS DB Upgradation", "Reosurces-2 Exisiting & 1 Resource for ERP & New 2 Resources for Outsystem", "RPA Bot (AMC Finance BOT)", "WAF(Web Application Firewall)", "SMS Value First", "Sampark", "Complaint Management", "Enhansment (samprak, deramsol, HRMS, Biometric)", "Qlikview Monitoring", "SMS services(Netcore/ Dreamsol for BLK)", "EHR Enhancement (BI & CPRS)", "Pentaho Support Renewal", "Renewal of Zoom Licenses", "User Awareness & Phishing Simulation", "Manpower Renewal", "Data, Recovery, Printers, Laptops, IT Room Hygiene, Passive cabling, Spares batteries chargers & Toners, Contigency, Backup tapes etc...", "Sonarqube", "Sapphire Support", "Porter Mangement", "RPA Bot (On boarding  Off boarding Nischay)License +Enhancement", "ERP enhancements", "RIS PACS(GE/MED SYNAPTIC/MEDIFF)", "BB Enhancements", "IT Infra Training", "AWS manage services", "Passport Application Imlementation", "Innovation and Experimentation", "Mailvault(Mail Archrival Solution)", "PIM PAM (support renewal + managed services)", "QLIK REPLICATE", "Assest Cleaning", "VAPT", "AMC CCTV", "Vmware License Renewal(PAN MAX)", "Resource for Firewall Management (Managed Services)", "GE Infra AMC", "AMC- ABG Machine Interfacing", "DMS Enhancements", "Email Security Solution", "NW Switches (including servers)", "Epabx Hardware AMC", "AMC for Biometric Hardware", "IPD Discharge Process Software", "LMS Support (Learning Management System)", "CR and other", "Lab, BB, ABG equipment interfacing/Integration", "Harmony", "Augnito software license subscription (E-Prescription)", "Firewall Renewal", "Cloud Email Backup Solution(Renewal)", "Consint Solution (AI)", "FAR (new Asset register for finance)", "MS support", "Cyber Security Posture Visibility Software (Safe Me)", "IT Security SOC", "F&B Idoraa", "MedQPro : Medical Quality Software Subscription Fees", "DB Support", "AI in Clinical Applications", "SD WAN Support( Renewal)", "EMS, doctor payout and e prapti AMC", "AMC for central Desktop support", "APM - Dynatrace", "Qlik View Developer (Outsource)", "CSPM and CNAPP", "Audit Trail Grant Thomson", "THB AMC", "Licenses and Subscriptions (Adobe/PDF Editor)", "DC Operations L2- (2 resources)", "Amazon PACS back up", "DevSecOps Tool", "Infor, SUN financial and EAM (Anurakshan/procurment) AMC Cost", "SSL Certficate/Domain registration, Hosting/License & Subscription Renewal", "VDI solution AWS", "AMC Cow Trolleys", "Google Dynamic Maps+, Geocoding, Auto complete", "Back up (Server, End Point)", "Checkpoint internet firewall", "AMC SSC", "Assessments (New Projects, Network Audit, Firewall Config Review, Cyber Security Assessment, Source code review, Application Security assessment)+VIP protaction", "DPDP - (Data Privacy Assessment & Data Privacy Tool)", "Innowave", "ITSM (ITAM)", "QA Automation", "Windows Upgradation", "LMS Software Infra AMC", "Medqpro & Isansys Infra AMC", "Qliksense AMC", "Augnito software license subscription (Radiology)", "Noise Monitoring", "AMC of Q Management System", "Internet Authentication service", "PHP", "Patient Tracking", "Infant & Mother Tracking", "RIS PACS workstations/Medical monitors AMC", "Dream Sol(Patient  Feed Back System)", "Biometric/attendance system", "Jira License & Tool", "BOT - UiPath New Projects", "Geofencing Google", "Sentry Account", "Azure cloud managed services", "Jira Licenses (Enterprise)", "Annotation Tool", "HMIS Appication & DB", "Whatsapp business", "Token Kiosk Machine", "20 KVA UPS", "100MS", "DMS Support Renewal", "Licenses and Subscriptions (Digital)", "Veritas Netback License Renewal", "Neox Software", "Jaypee HIS", "SAP Cloud Hosting & SAP Support Service", "Oracle License", "ISO 27001 - Assessment & Policy Prepration", "Amc & Support Navision/ User license Renewal Costing Module", "ISansys", "Hand Hygiene-OT", "Call centre Software AMC renewal", "Google Cloud Managed services"],
    subCategoryMapped: ["IT Cost - Support", "Communication - Connectivity", "IT Cost - License Subscription", "IT Cost - Consulting", "AMC - IT Software", "IT Cost - Consumables", "AMC - IT Equipment", "IT Cost - Managed Services & S/w implementation", "AMC - IT Infra"],
    categoryIt: ["Outsourced IT Manpower (IMS)", "Data Center", "MPLS/ILL Connectivity", "Digital transformation", "Emailing", "Application", "Disaster recovery", "IT infra", "Cyber/info Security", "Clinical Application", "Unit Local exp.", "SMS/Email consumable", "Epabx", "Backup & Cloud storage", "SD Wan", "Dropped"],
    subCategory: ["Support restructuring", "adding new projects", "IT Infra-AWS Cloud", "Existing renewal", "HRMS", "EHR", "Resource renewal", "Digital transformation", "SMS", "Infra managed service", "New AMC FY 26", "EMS/E prapti/Doctor payour", "renewal and adding new lic.", "New project FY 26", "Anticpated enhancement", "Dropped"],
    newCategory: ["Existing renewal", "Annualized impact", "MPLS-connectivity", "User increased", "DR Upgradation", "Service improvement", "Security enhancement", "New Location addition", "New project FY 26", "Outsourced resource", "New AMC FY 26", "Assessment", "Anticpated enhancement", "Training", "New Technology", "Dropped"],
    appCate: ["IMS", "DC", "Connectivity", "Emailing", "HRMS", "CRM", "DR", "Security", "Medical app", "Outsource manpower", "Unit", "SMS", "Infra AMC", "Digital", "SUN", "Application AMC", "Managed service renewal", "Qlik", "Partner Support", "EMS", "billing app (FnB)", "Existing renewal", "Complinity", "Seclore", "Sampark", "Firewall", "Volody", "Lic. Renewal", "Backup", "Sdwan", "New Project", "BOT", "Dreamsol", "EHR", "Sonarqube", "DMS", "BB", "PIM/PAM", "New project FY 26", "Managed service", "Training", "VDI", "Dropped"],
    cate3: ["Existing Renewal", "Annualized Impact", "Connectivity", "Existing renewal", "DR restrcturing", "New Project", "Manpower Renewal", "Consumable exp.", "Anticipated Enhancement (Digital)", "Existing Partner Support", "Assessment", "New AMC", "First time Renewal", "New AMC FY 26", "New manpower", "New lic. Procurment", "New Innovation", "Enhancement/Upgradation", "Training", "Dropped"],
    cate4: ["Price Increase + New Location Addition", "Tech Refresh", "No Increment", "Projection", "New lic. Procurement", "User increased", "DR restrcturing", "HIS Modernization", "New location addition", "Consumable exp.", "Price Increase", "Existing renewal", "General Increase", "Anticipated Enhancement", "Transaction Increased", "Annualized Impact", "New Project", "Dropped", "New AMC", "License addition", "New AMC FY 26", "New Innovation", "New lic. Procurment + General Increase", "Training"],
    owner1: ["IT Infra", "Application", "Security", "Clinical", "Unit", "Digital"],
    owner: ["Anil", "Jatin", "Akshant", "Kapil", "Amit", "Unit", "Arjun", "Vivek", "Rakesh", "Jitender", "Hemant", "Tauqueer"],
    costCenter: ["30SUP020", "30SUP066", "30SUP056"]
  };
  const CODE_ITEM_MAP = {};
  const CODE_PROFILE_MAP = {};
  const PROFILE_FIELD_OPTIONS = {};
  const VIEW_META = {
    dashboardView: ["Dashboard", "Enterprise view of planning, allocation, utilization, and reporting."],
    plannerView: ["Budget Planner", "Plan coding, ownership, and MAX Hospital budget details in one responsive workspace."],
    locationSummaryView: ["Location Summary", "Review derived location-level values from the saved planner records."],
    unitBudgetView: ["Unit Wise Budget", "Compare unit expense, current budget, growth, share, and expansion."],
    allocationView: ["Allocation-Fixed and % wise", "Preview how coding and item budgets spread across selected locations."],
    utilizationView: ["Opex Budget Utilization", "Track used budget, remaining budget, and over-budget locations."],
    comparisonView: ["Comparison", "Compare last year expense, current year budget, and growth across locations."],
    reportView: ["Report", "Download the full local report as an Excel workbook."]
  };

  function nowString() {
    return new Date().toLocaleString("en-IN");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const num = Number(String(value).replace(/,/g, "").replace(/%/g, "").trim());
    return Number.isFinite(num) ? num : 0;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2
    }).format(Number(value || 0));
  }

  function formatPercent(value) {
    return formatNumber(value) + "%";
  }

  function previousYear(year) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(year || ""));
    if (!match) return "Previous FY";
    const start = Number(match[1]) - 1;
    const end = String((Number(match[2]) + 99) % 100).padStart(2, "0");
    return start + "-" + end;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  (function buildCodeItemMap() {
    const codes = FALLBACK_OPTIONS.coding || [];
    const items = FALLBACK_OPTIONS.item || [];
    codes.forEach(function (code, index) {
      const key = normalizeText(code);
      if (key && items[index]) {
        CODE_ITEM_MAP[key] = items[index];
      }
    });
  })();

  (function buildCodeProfileMap() {
    const raw = [
      "ITOPEX042|IT Cost - Support|Outsourced IT Manpower (IMS)|Support restructuring|Existing renewal|IMS|Existing Renewal|Price Increase + New Location Addition",
      "ITOPEX066|IT Cost - Support|Data Center|adding new projects|Annualized impact|DC|Annualized Impact|Tech Refresh",
      "ITOPEX034|Communication - Connectivity|MPLS/ILL Connectivity|adding new projects|MPLS-connectivity|Connectivity|Connectivity|No Increment",
      "ITOPEX205|IT Cost - Support|Digital transformation|IT Infra-AWS Cloud|Existing renewal|DC|Existing Renewal|Projection",
      "ITOPEX065|IT Cost - License Subscription|Emailing|Existing renewal|Existing renewal|Emailing|Existing renewal|New lic. Procurement",
      "ITOPEX036|IT Cost - Consulting|Application|HRMS|User increased|HRMS|Existing Renewal|User increased",
      "ITOPEX009|IT Cost - License Subscription|Application|Existing renewal|Existing renewal|CRM|Existing renewal|User increased",
      "ITOPEX029|IT Cost - Support|Disaster recovery|adding new projects|DR Upgradation|DR|DR restrcturing|DR restrcturing",
      "ITOPEX192|IT Cost - Support|IT infra|adding new projects|Service improvement|DC|New Project|HIS Modernization",
      "ITOPEX063|IT Cost - License Subscription|Cyber/info Security|Existing renewal|Security enhancement|Security|Existing renewal|User increased",
      "ITOPEX050|AMC - IT Software|Clinical Application|EHR|New Location addition|Medical app|Existing renewal|New location addition",
      "ITOPEX163|IT Cost - Support|IT infra|Existing renewal|Existing renewal|Outsource manpower|Manpower Renewal|New Location Addition",
      "ITOPEX014|IT Cost - Consumables|Unit Local exp.|Existing renewal|Existing renewal|Unit|Consumable exp.|Consumable exp.",
      "ITOPEX084|IT Cost - License Subscription|Cyber/info Security|Existing renewal|Existing renewal|Security|Existing renewal|Price Increase",
      "ITOPEX058|AMC - IT Software|SMS/Email consumable|Existing renewal|Existing renewal|SMS|Existing renewal|Existing renewal",
      "ITOPEX069|IT Cost - Support|Application|Resource renewal|Existing renewal|Outsource manpower|Existing renewal|General Increase",
      "ITOPEX037|AMC - IT Equipment|IT infra|Existing renewal|Existing renewal|Infra AMC|Existing renewal|No Increment",
      "ITOPEX204|IT Cost - Support|Digital transformation|Digital transformation|New project FY 26|Digital|Anticipated Enhancement (Digital)|Anticipated Enhancement",
      "ITOPEX210|AMC - IT Software|Digital transformation|SMS|Existing renewal|Digital|Existing renewal|Transaction Increased",
      "ITOPEX057|AMC - IT Software|Application|Existing renewal|Existing renewal|SUN|Existing Partner Support|Annualized Impact",
      "ITOPEX038|IT Cost - Managed Services & S/w implementation|Clinical Application|Existing renewal|Existing renewal|Application AMC|Existing renewal|No Increment",
      "ITOPEX206|IT Cost - Support|Digital transformation|Infra managed service|Existing renewal|Managed service renewal|Existing renewal|Projection",
      "ITOPEX252|IT Cost - Support|Data Center|Existing renewal|Existing renewal|Qlik|Existing renewal|Annualized Impact",
      "ITOPEX049|IT Cost - Managed Services & S/w implementation|Cyber/info Security|Existing renewal|Security enhancement|Security|Assessment|Annualized Impact",
      "ITOPEX175|IT Cost - Support|Cyber/info Security|Existing renewal|Outsourced resource|Security|Existing renewal|No Increment",
      "ITOPEX117|IT Cost - License Subscription|Cyber/info Security|Existing renewal|Existing renewal|Security|Existing renewal|General Increase",
      "ITOPEX268|AMC - IT Equipment|Clinical Application|Existing renewal|Existing renewal|Infra AMC|Existing renewal|General Increase",
      "ITOPEX170|AMC - IT Software|Application|Existing renewal|Existing renewal|Application AMC|Existing renewal|Annualized Impact",
      "ITOPEX070|IT Cost - Support|Application|Existing renewal|Existing renewal|Partner Support|Existing renewal|General Increase",
      "ITOPEX332|AMC - IT Software|Clinical Application|New AMC FY 26|New Location addition|Medical app|New Project|New Project",
      "ITOPEX075|IT Cost - Support|Application|Resource renewal|Existing renewal|Outsource manpower|Existing Partner Support|Dropped",
      "ITOPEX171|IT Cost - Managed Services & S/w implementation|Cyber/info Security|Existing renewal|Existing renewal|Security|Existing renewal|Annualized Impact",
      "ITOPEX064|IT Cost - License Subscription|Cyber/info Security|Existing renewal|Existing renewal|Security|Existing renewal|Anticipated Enhancement",
      "ITOPEX052|AMC - IT Software|Application|EMS/E prapti/Doctor payour|Existing renewal|EMS|Existing Partner Support|Projection",
      "ITOPEX270|IT Cost - Managed Services & S/w implementation|Application|New AMC FY 26|Service improvement|billing app (FnB)|Existing renewal|Annualized Impact",
      "ITOPEX338|AMC - IT Software|Application|Existing renewal|Existing renewal|Application AMC|New AMC|New AMC",
      "ITOPEX335|AMC - IT Software|Clinical Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|New Location Addition",
      "ITOPEX118|AMC - IT Equipment|Epabx|Existing renewal|Existing renewal|Infra AMC|Existing renewal|Annualized Impact",
      "ITOPEX101|AMC - IT Software|Application|Existing renewal|Existing renewal|Complinity|Existing renewal|License addition",
      "ITOPEX323|IT Cost - Support|Cyber/info Security|New AMC FY 26|Security enhancement|Seclore|First time Renewal|Annualized Impact",
      "ITOPEX007|AMC - IT Software|Application|Existing renewal|Existing renewal|Sampark|Existing renewal|User increased",
      "ITOPEX015|AMC - IT Equipment|IT infra|renewal and adding new lic.|Existing renewal|Infra AMC|Existing renewal|User increased",
      "ITOPEX324|AMC - IT Software|Cyber/info Security|New AMC FY 26|Security enhancement|Firewall|New AMC|New AMC",
      "ITOPEX186|IT Cost - Consulting|Application|Existing renewal|Existing renewal|Volody|Existing renewal|License addition",
      "ITOPEX289|IT Cost - License Subscription|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|New lic. Procurement",
      "ITOPEX081|IT Cost - Managed Services & S/w implementation|IT infra|Existing renewal|Existing renewal|Application AMC|Existing renewal|General Increase",
      "ITOPEX229|IT Cost - License Subscription|Cyber/info Security|New AMC FY 26|Security enhancement|Security|Existing renewal|No Increment",
      "ITOPEX208|AMC - IT Software|Digital transformation|Digital transformation|New AMC FY 26|Digital|New AMC FY 26|New AMC FY 26",
      "ITOPEX062|IT Cost - License Subscription|Unit Local exp.|Existing renewal|Existing renewal|Lic. Renewal|Existing renewal|General Increase",
      "ITOPEX111|IT Cost - License Subscription|Backup & Cloud storage|Existing renewal|Existing renewal|Backup|Existing renewal|General Increase",
      "ITOPEX226|IT Cost - Managed Services & S/w implementation|Cyber/info Security|New AMC FY 26|Security enhancement|Security|Existing renewal|General Increase",
      "ITOPEX196|IT Cost - Support|Outsourced IT Manpower (IMS)|Existing renewal|Outsourced resource|Outsource manpower|New manpower|General Increase",
      "ITOPEX166|IT Cost - Support|SD Wan|Existing renewal|Existing renewal|Sdwan|Existing renewal|No Increment",
      "ITOPEX155|IT Cost - License Subscription|Clinical Application|Existing renewal|Existing renewal|Medical app|Existing renewal|New Location Addition",
      "ITOPEX129|IT Cost - Managed Services & S/w implementation|Unit Local exp.|Existing renewal|Existing renewal|Unit|Existing renewal|No Increment",
      "ITOPEX325|IT Cost - License Subscription|Digital transformation|New project FY 26|New project FY 26|Digital|New lic. Procurment|New lic. Procurement",
      "ITOPEX043|AMC - IT Software|Application|Existing renewal|Existing renewal|Partner Support|Existing renewal|Annualized Impact",
      "ITOPEX167|IT Cost - Support|Cyber/info Security|Existing renewal|Assessment|Security|Assessment|Annualized Impact",
      "ITOPEX333|AMC - IT Software|Clinical Application|New project FY 26|New project FY 26|Medical app|New Project|New Project",
      "ITOPEX159|IT Cost - Managed Services & S/w implementation|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|No Increment",
      "ITOPEX108|IT Cost - License Subscription|IT infra|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Price Increase",
      "ITOPEX061|IT Cost - License Subscription|Unit Local exp.|Existing renewal|Existing renewal|Existing renewal|Existing renewal|General Increase",
      "ITOPEX035|AMC - IT Equipment|Unit Local exp.|Existing renewal|Existing renewal|Unit|Existing renewal|Existing renewal",
      "ITOPEX266|AMC - IT Software|Clinical Application|New project FY 26|Existing renewal|DC|New AMC|New AMC",
      "ITOPEX330|IT Cost - Managed Services & S/w implementation|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Existing renewal",
      "ITOPEX090|IT Cost - License Subscription|Cyber/info Security|Existing renewal|Existing renewal|Security|Existing renewal|No Increment",
      "ITOPEX033|AMC - IT Software|Application|Existing renewal|Existing renewal|Application AMC|Existing renewal|New Location Addition",
      "ITOPEX339|IT Cost - Managed Services & S/w implementation|Digital transformation|Digital transformation|New project FY 26|Digital|New Innovation|New Innovation",
      "ITOPEX109|IT Cost - Support|IT infra|New project FY 26|New project FY 26|New Project|New Project|New Project",
      "ITOPEX056|AMC - IT Software|Application|Existing renewal|Existing renewal|Qlik|Existing renewal|No Increment",
      "ITOPEX158|AMC - IT Software|Clinical Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|User increased",
      "ITOPEX329|AMC - IT Equipment|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Existing renewal",
      "ITOPEX264|AMC - IT Software|IT infra|Existing renewal|Existing renewal|DC|Existing renewal|General Increase",
      "ITOPEX173|IT Cost - Support|Cyber/info Security|Existing renewal|Existing renewal|Security|Existing renewal|No Increment",
      "ITOPEX309|IT Cost - License Subscription|IT infra|Existing renewal|Existing renewal|Unit|Existing renewal|No Increment",
      "ITOPEX274|IT Cost - License Subscription|Application|New project FY 26|Service improvement|New Project|New Project|New Project",
      "ITOPEX291|IT Cost - License Subscription|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|No Increment",
      "ITOPEX279|IT Cost - Support|Application|Existing renewal|Outsourced resource|Outsource manpower|Existing renewal|General Increase",
      "ITOPEX131|AMC - IT Software|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|No Increment",
      "ITOPEX091|IT Cost - License Subscription|Application|Existing renewal|Existing renewal|BOT|Existing renewal|No Increment",
      "ITOPEX156|IT Cost - Support|Application|Anticpated enhancement|Anticpated enhancement|Dreamsol|Enhancement/Upgradation|Anticipated Enhancement",
      "ITOPEX060|IT Cost - Consulting|Clinical Application|Anticpated enhancement|Anticpated enhancement|EHR|Enhancement/Upgradation|Anticipated Enhancement",
      "ITOPEX100|AMC - IT Infra|Unit Local exp.|Existing renewal|Existing renewal|Unit|Existing renewal|New Location Addition",
      "ITOPEX095|IT Cost - License Subscription|Unit Local exp.|Existing renewal|Existing renewal|Unit|Existing renewal|New lic. Procurment + General Increase",
      "ITOPEX211|IT Cost - Managed Services & S/w implementation|Digital transformation|Digital transformation|Existing renewal|Digital|Existing renewal|General Increase",
      "ITOPEX106|AMC - IT Infra|Unit Local exp.|Existing renewal|Existing renewal|Unit|Existing renewal|Existing renewal",
      "ITOPEX032|IT Cost - Support|Application|Existing renewal|Existing renewal|Sonarqube|Enhancement/Upgradation|General Increase",
      "ITOPEX047|IT Cost - Consulting|Application|Resource renewal|Existing renewal|Qlik|Existing renewal|No Increment",
      "ITOPEX008|IT Cost - License Subscription|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|General Increase",
      "ITOPEX317|AMC - IT Software|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Existing renewal",
      "ITOPEX121|AMC - IT Software|Unit Local exp.|Existing renewal|Existing renewal|Unit|Existing renewal|Existing renewal",
      "ITOPEX150|AMC - IT Software|Application|Existing renewal|Existing renewal|Application AMC|Existing renewal|Existing renewal",
      "ITOPEX073|AMC - IT Equipment|IT infra|Existing renewal|Existing renewal|Infra AMC|Existing renewal|Annualized Impact",
      "ITOPEX018|AMC - IT Software|Application|Existing renewal|Existing renewal|DMS|Existing renewal|General Increase",
      "ITOPEX145|IT Cost - Support|Clinical Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|General Increase",
      "ITOPEX135|IT Cost - Managed Services & S/w implementation|Cyber/info Security|New AMC FY 26|Security enhancement|Security|Assessment|No Increment",
      "ITOPEX172|IT Cost - Support|Cyber/info Security|Existing renewal|Security enhancement|Security|Existing renewal|Existing renewal",
      "ITOPEX162|AMC - IT Equipment|Clinical Application|Existing renewal|Existing renewal|Infra AMC|Existing renewal|No Increment",
      "ITOPEX326|IT Cost - License Subscription|IT infra|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Existing renewal",
      "ITOPEX212|IT Cost - Support|Digital transformation|Digital transformation|Existing renewal|Digital|Existing renewal|No Increment",
      "ITOPEX273|IT Cost - License Subscription|Application|Existing renewal|Anticpated enhancement|BOT|Enhancement/Upgradation|Annualized Impact",
      "ITOPEX023|IT Cost - Managed Services & S/w implementation|Application|Anticpated enhancement|Anticpated enhancement|BB|Enhancement/Upgradation|Anticipated Enhancement",
      "ITOPEX092|AMC - IT Software|Backup & Cloud storage|Existing renewal|Existing renewal|Unit|Existing renewal|No Increment",
      "ITOPEX085|AMC - IT Software|IT infra|Existing renewal|Existing renewal|PIM/PAM|Existing renewal|No Increment",
      "ITOPEX005|AMC - IT Software|Application|Existing renewal|Existing renewal|Unit|Existing renewal|No Increment",
      "ITOPEX122|AMC - IT Software|Epabx|Existing renewal|Existing renewal|Unit|Existing renewal|Annualized Impact",
      "ITOPEX149|IT Cost - License Subscription|Clinical Application|Existing renewal|Service improvement|Existing renewal|Existing renewal|New lic. Procurement",
      "ITOPEX024|IT Cost - Managed Services & S/w implementation|Application|Anticpated enhancement|Anticpated enhancement|DMS|Enhancement/Upgradation|Anticipated Enhancement",
      "ITOPEX143|IT Cost - Support|Clinical Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|General Increase",
      "ITOPEX316|AMC - IT Software|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Existing renewal",
      "ITOPEX236|IT Cost - License Subscription|Clinical Application|New AMC FY 26|New project FY 26|Medical app|Existing Renewal|Annualized Impact",
      "ITOPEX272|IT Cost - License Subscription|Application|New project FY 26|Service improvement|New project FY 26|New Project|New Project",
      "ITOPEX128|AMC - IT Infra|Unit Local exp.|Existing renewal|Existing renewal|Unit|Existing renewal|General Increase",
      "ITOPEX337|AMC - IT Software|Application|New project FY 26||Application AMC|New Project|New Project",
      "ITOPEX320|AMC - IT Software|IT infra|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Annualized Impact",
      "ITOPEX328|AMC - IT Software|IT infra|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Existing renewal",
      "ITOPEX313|IT Cost - Support|IT infra|Existing renewal|Existing renewal|Managed service|Existing Renewal|Annualized Impact",
      "ITOPEX271|IT Cost - Managed Services & S/w implementation|Application|New project FY 26|Service improvement|New Project|New Project|New Project",
      "ITOPEX213|IT Cost - License Subscription|Digital transformation|Digital transformation|Existing renewal|Digital|Existing renewal|Existing renewal",
      "ITOPEX169|IT Cost - Support|IT infra|Existing renewal|Training|Training|Training|Training",
      "ITOPEX275|IT Cost - License Subscription|Application|New project FY 26|Service improvement|New Project|New Project|New Project",
      "ITOPEX276|AMC - IT Software|Application|New project FY 26|Service improvement|New Project|New Project|New Project",
      "ITOPEX269|IT Cost - Support|IT infra|New AMC FY 26|New Technology|Managed service|Existing Renewal|Annualized Impact",
      "ITOPEX113|AMC - IT Infra|Unit Local exp.|Existing renewal|Existing renewal|Unit|Existing renewal|New Location Addition",
      "ITOPEX011|IT Cost - License Subscription|IT infra|Existing renewal|Existing renewal|Existing renewal|Existing renewal|No Increment",
      "ITOPEX203|IT Cost - Support|Data Center|Existing renewal|New Technology|VDI|New AMC|New AMC",
      "ITOPEX051|IT Cost - Managed Services & S/w implementation|Application|Anticpated enhancement|Anticpated enhancement|HRMS|Enhancement/Upgradation|Anticipated Enhancement",
      "ITOPEX277|AMC - IT Software|Application|New project FY 26|Service improvement|New Project|New Project|New Project",
      "ITOPEX321|AMC - IT Equipment|IT infra|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Existing renewal",
      "ITOPEX301|AMC - IT Software|Dropped|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX230|IT Cost - License Subscription|Cyber/info Security|Dropped|Dropped|Security|Dropped|Dropped",
      "ITOPEX241|IT Cost - Support|Dropped|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX053|AMC - IT Software|Dropped|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX314|IT Cost - License Subscription|Application|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX315|IT Cost - License Subscription|Application|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX299|IT Cost - Managed Services & S/w implementation|Application|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX071|IT Cost - Managed Services & S/w implementation|Dropped|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX067|IT Cost - Support|Dropped|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX179|IT Cost - License Subscription|Cyber/info Security|Dropped|Dropped|Security|Dropped|Dropped",
      "ITOPEX154|IT Cost - License Subscription|Dropped|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX174|IT Cost - Support|Application|Dropped|Dropped|Qlik|Dropped|Dropped",
      "ITOPEX331|IT Cost - Managed Services & S/w implementation|Application|Existing renewal|Existing renewal|Existing renewal|Existing renewal|Existing renewal",
      "ITOPEX013|IT Cost - Managed Services & S/w implementation|Application|Dropped|Dropped|Dropped|Dropped|Dropped",
      "ITOPEX046|IT Cost - Consulting|Application|Dropped|Dropped|Dropped|Dropped|Dropped"
    ];

    raw.forEach(function (line) {
      const parts = line.split("|");
      const code = normalizeText(parts[0]);
      if (!code) return;
      CODE_PROFILE_MAP[code] = {
        subCategoryMapped: parts[1] || "",
        categoryIt: parts[2] || "",
        subCategory: parts[3] || "",
        newCategory: parts[4] || "",
        appCate: parts[5] || "",
        cate3: parts[6] || "",
        cate4: parts[7] || ""
      };
    });

    Object.keys(CODE_PROFILE_MAP).forEach(function (code) {
      const profile = CODE_PROFILE_MAP[code];
      Object.keys(profile).forEach(function (fieldKey) {
        if (!PROFILE_FIELD_OPTIONS[fieldKey]) PROFILE_FIELD_OPTIONS[fieldKey] = [];
        if (profile[fieldKey]) PROFILE_FIELD_OPTIONS[fieldKey].push(profile[fieldKey]);
      });
    });
  })();

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function pick(source, keys) {
    for (const key of keys) {
      if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
    }
    return "";
  }

  function defaultForm(record) {
    record = record || {};
    return {
      coding: record.coding || "",
      item: record.item || "",
      subCategoryMapped: record.subCategoryMapped || "",
      categoryIt: record.categoryIt || "",
      subCategory: record.subCategory || "",
      newCategory: record.newCategory || "",
      appCate: record.appCate || "",
      cate3: record.cate3 || "",
      cate4: record.cate4 || "",
      owner1: record.owner1 || "",
      owner: record.owner || "",
      costCenter: record.costCenter || "",
      costDistribution: record.costDistribution || "Fixed Cost",
      financialYear: record.financialYear || "",
      location: record.location || "",
      locLe: record.locLe != null ? String(record.locLe) : "",
      locFyCurrent: record.locFyCurrent != null ? String(record.locFyCurrent) : "",
      locFyLast: record.locFyLast != null ? String(record.locFyLast) : "",
      newAmc: record.newAmc != null ? String(record.newAmc) : "",
      newProject: record.newProject != null ? String(record.newProject) : "",
      annualized: record.annualized != null ? String(record.annualized) : "",
      priceIncrease: record.priceIncrease != null ? String(record.priceIncrease) : "",
      newUnit: record.newUnit != null ? String(record.newUnit) : "",
      licenseIncrease: record.licenseIncrease != null ? String(record.licenseIncrease) : "",
      rest: record.rest != null ? String(record.rest) : "",
      justification: record.justification || ""
    };
  }

  function normalizeRecord(record) {
    return {
      id: pick(record, ["id"]) || "rec_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
      savedAt: pick(record, ["savedAt", "Saved At"]) || nowString(),
      coding: pick(record, ["coding", "Coding"]),
      item: pick(record, ["item", "Item"]),
      subCategoryMapped: pick(record, ["subCategoryMapped", "Sub Category (Mapped)"]),
      categoryIt: pick(record, ["categoryIt", "Category_IT", "Category IT"]),
      subCategory: pick(record, ["subCategory", "Sub Category"]),
      newCategory: pick(record, ["newCategory", "New Category"]),
      appCate: pick(record, ["appCate", "App Cate.", "App Cate"]),
      cate3: pick(record, ["cate3", "Cate.3"]),
      cate4: pick(record, ["cate4", "Cate.4"]),
      owner1: pick(record, ["owner1", "Owner1"]),
      owner: pick(record, ["owner", "Owner"]),
      costCenter: pick(record, ["costCenter", "Cost Center / Department"]),
      costDistribution: pick(record, ["costDistribution", "Cost Distribution"]) || "Fixed Cost",
      financialYear: pick(record, ["financialYear", "Financial Year"]),
      location: pick(record, ["location", "MAX Hospital", "Max Hospital"]),
      locLe: toNumber(pick(record, ["locLe", "Location LE", "LE FY 25"])),
      locFyCurrent: toNumber(pick(record, ["locFyCurrent", "Location FY Current", "Budget FY 26"])),
      locFyLast: toNumber(pick(record, ["locFyLast", "Location FY Last", "Total Budget of Last Year"])),
      locPercent: toNumber(
        pick(record, ["locPercent", "Location % Change", "Difference in Percentage(%)"])
      ),
      newAmc: toNumber(pick(record, ["newAmc", "New AMC for FY", "New AMC"])),
      newProject: toNumber(pick(record, ["newProject", "New Project"])),
      annualized: toNumber(pick(record, ["annualized", "Annualized"])),
      priceIncrease: toNumber(pick(record, ["priceIncrease", "Price Increase"])),
      newUnit: toNumber(pick(record, ["newUnit", "New Unit"])),
      licenseIncrease: toNumber(pick(record, ["licenseIncrease", "License Increase"])),
      rest: toNumber(pick(record, ["rest", "Rest"])),
      justification: pick(record, ["justification", "Justification"])
    };
  }

  function loadRecords() {
    const keys = [STORAGE_KEY].concat(LEGACY_KEYS);
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(normalizeRecord);
      } catch (_error) {
        // Ignore malformed payloads.
      }
    }
    return [];
  }

  function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    localStorage.setItem("it_opex_records_v2", JSON.stringify(records));
  }

  function getBudget(record) {
    return DRIVER_FIELDS.reduce(function (sum, field) {
      return sum + toNumber(record[field[0]]);
    }, 0);
  }

  function buildCodingProfiles(records) {
    const profiles = {};
    records.forEach(function (record) {
      const key = normalizeText(record.coding);
      if (!key) return;
      if (!profiles[key]) profiles[key] = {};
      FIELD_DEFS.forEach(function (field) {
        if (!profiles[key][field[0]] && record[field[0]]) profiles[key][field[0]] = record[field[0]];
      });
    });
    return profiles;
  }

  function summaryRows(records, filters) {
    const filtered = records.filter(function (record) {
      if (filters.location && record.location !== filters.location) return false;
      if (filters.financialYear && record.financialYear !== filters.financialYear) return false;
      return true;
    });
    const yearTotals = {};
    filtered.forEach(function (record) {
      yearTotals[record.financialYear] = (yearTotals[record.financialYear] || 0) + getBudget(record);
    });
    let running = 0;
    return filtered.slice().sort(function (a, b) { return getBudget(b) - getBudget(a); }).map(function (record) {
      const total = getBudget(record);
      const share = yearTotals[record.financialYear] ? (total / yearTotals[record.financialYear]) * 100 : 0;
      running += share;
      return {
        savedAt: record.savedAt,
        financialYear: record.financialYear,
        location: record.location,
        leFy25: record.locLe,
        budgetFy26: record.locFyCurrent,
        differencePercent: record.locLe ? ((record.locFyCurrent - record.locLe) / record.locLe) * 100 : 0,
        differenceAmount: record.locFyCurrent - record.locLe,
        totalBudgetCurrentYear: total,
        totalBudgetLastYear: record.locFyLast,
        sharePercent: share,
        cumulativePercent: running,
        newAmc: record.newAmc,
        newAmcPercent: total ? (record.newAmc / total) * 100 : 0,
        newProject: record.newProject,
        newProjectPercent: total ? (record.newProject / total) * 100 : 0,
        annualized: record.annualized,
        annualizedPercent: total ? (record.annualized / total) * 100 : 0,
        priceIncrease: record.priceIncrease,
        priceIncreasePercent: total ? (record.priceIncrease / total) * 100 : 0,
        newUnit: record.newUnit,
        newUnitPercent: total ? (record.newUnit / total) * 100 : 0,
        licenseIncrease: record.licenseIncrease,
        licenseIncreasePercent: total ? (record.licenseIncrease / total) * 100 : 0,
        rest: record.rest,
        restPercent: total ? (record.rest / total) * 100 : 0,
        total: total,
        totalLocation: total,
        justification: record.justification
      };
    });
  }

  function unitRows(records) {
    const grouped = {};
    records.forEach(function (record) {
      const key = record.location || "Unassigned";
      if (!grouped[key]) grouped[key] = { location: key, lyExpense: 0, currentBudget: 0, newExpansion: 0 };
      grouped[key].lyExpense += record.locFyLast;
      grouped[key].currentBudget += record.locFyCurrent;
      grouped[key].newExpansion += record.newUnit;
    });
    const rows = Object.values(grouped);
    const totalCurrent = rows.reduce(function (sum, row) { return sum + row.currentBudget; }, 0);
    return rows.map(function (row) {
      return {
        location: row.location,
        lyExpense: row.lyExpense,
        currentBudget: row.currentBudget,
        budgetIncrease: row.currentBudget - row.lyExpense,
        budgetIncreasePercent: row.lyExpense ? ((row.currentBudget - row.lyExpense) / row.lyExpense) * 100 : 0,
        sharePercent: totalCurrent ? (row.currentBudget / totalCurrent) * 100 : 0,
        newExpansion: row.newExpansion
      };
    }).sort(function (a, b) { return b.currentBudget - a.currentBudget; });
  }

  function allocationGroups(records) {
    const grouped = {};
    records.forEach(function (record) {
      const key = [record.coding, record.item, record.owner].join("||");
      if (!grouped[key]) grouped[key] = { coding: record.coding, item: record.item, owner: record.owner, totalBudget: 0, byLocation: {} };
      grouped[key].totalBudget += getBudget(record);
      grouped[key].byLocation[record.location] = (grouped[key].byLocation[record.location] || 0) + getBudget(record);
    });
    return Object.values(grouped).sort(function (a, b) { return b.totalBudget - a.totalBudget; });
  }

  function utilizationRows(records) {
    const grouped = {};
    records.forEach(function (record) {
      const key = record.location || "Unassigned";
      if (!grouped[key]) grouped[key] = { location: key, planned: 0, used: 0 };
      grouped[key].planned += record.locFyCurrent;
      grouped[key].used += getBudget(record);
    });
    return Object.values(grouped).map(function (row) {
      return {
        location: row.location,
        planned: row.planned,
        used: row.used,
        remaining: row.planned - row.used,
        utilization: row.planned ? (row.used / row.planned) * 100 : 0
      };
    }).sort(function (a, b) { return b.utilization - a.utilization; });
  }

  window.OpexData = {
    STORAGE_KEY: STORAGE_KEY,
    YEARS: YEARS,
    LOCATIONS: LOCATIONS,
    FIELD_DEFS: FIELD_DEFS,
    DRIVER_FIELDS: DRIVER_FIELDS,
    FALLBACK_OPTIONS: FALLBACK_OPTIONS,
    CODE_ITEM_MAP: CODE_ITEM_MAP,
    CODE_PROFILE_MAP: CODE_PROFILE_MAP,
    PROFILE_FIELD_OPTIONS: PROFILE_FIELD_OPTIONS,
    VIEW_META: VIEW_META,
    state: {
      records: loadRecords(),
      activeView: "dashboardView",
      editId: null,
      dashboardFilters: { location: "", categoryIt: "", financialYear: "", owner: "" },
      summaryFilters: { location: "", financialYear: "" },
      comparisonFilters: { location1: "", location2: "", coding: "", financialYear: "" },
      allocationControls: { mode: "Distribution", amount: "", percent: "100", financialYear: "", selectedLocations: [] },
      form: defaultForm()
    },
    helpers: {
      nowString: nowString,
      escapeHtml: escapeHtml,
      toNumber: toNumber,
      formatNumber: formatNumber,
      formatPercent: formatPercent,
      previousYear: previousYear,
      normalizeText: normalizeText,
      unique: unique,
      defaultForm: defaultForm,
      normalizeRecord: normalizeRecord,
      saveRecords: saveRecords,
      getBudget: getBudget,
      buildCodingProfiles: buildCodingProfiles,
      summaryRows: summaryRows,
      unitRows: unitRows,
      allocationGroups: allocationGroups,
      utilizationRows: utilizationRows
    }
  };
})();
