window.IT_OPEX_DEFS = (function () {
  function lines(text) {
    return text
      .trim()
      .split("\n")
      .map(function (v) { return v.trim(); })
      .filter(Boolean);
  }

  var codingValues = lines(`
ITOPEX042
ITOPEX066
ITOPEX205
ITOPEX036
ITOPEX034
ITOPEX013
ITOPEX009
ITOPEX338
ITOPEX101
ITOPEX075
ITOPEX323
ITOPEX065
ITOPEX186
ITOPEX289
ITOPEX062
ITOPEX192
ITOPEX029
ITOPEX050
ITOPEX063
ITOPEX173
ITOPEX069
ITOPEX046
ITOPEX279
ITOPEX091
ITOPEX084
ITOPEX210
ITOPEX007
ITOPEX053
ITOPEX156
ITOPEX047
ITOPEX058
ITOPEX060
ITOPEX008
ITOPEX095
ITOPEX172
ITOPEX163
ITOPEX014
ITOPEX032
ITOPEX067
ITOPEX170
ITOPEX273
ITOPEX071
ITOPEX038
ITOPEX023
ITOPEX169
ITOPEX206
ITOPEX301
ITOPEX339
ITOPEX092
ITOPEX085
ITOPEX252
ITOPEX100
ITOPEX049
ITOPEX106
ITOPEX108
ITOPEX175
ITOPEX268
ITOPEX113
ITOPEX024
ITOPEX117
ITOPEX037
ITOPEX118
ITOPEX128
ITOPEX129
ITOPEX143
ITOPEX204
ITOPEX005
ITOPEX145
ITOPEX149
ITOPEX324
ITOPEX154
ITOPEX332
ITOPEX337
ITOPEX070
ITOPEX171
ITOPEX064
ITOPEX270
ITOPEX155
ITOPEX043
ITOPEX333
ITOPEX166
ITOPEX052
ITOPEX015
ITOPEX081
ITOPEX174
ITOPEX229
ITOPEX179
ITOPEX208
ITOPEX309
ITOPEX196
ITOPEX011
ITOPEX226
ITOPEX057
ITOPEX061
ITOPEX203
ITOPEX035
ITOPEX211
ITOPEX111
ITOPEX090
ITOPEX033
ITOPEX167
ITOPEX230
ITOPEX236
ITOPEX241
ITOPEX159
ITOPEX109
ITOPEX264
ITOPEX266
ITOPEX056
ITOPEX158
ITOPEX271
ITOPEX121
ITOPEX073
ITOPEX274
ITOPEX275
ITOPEX276
ITOPEX162
ITOPEX131
ITOPEX051
ITOPEX291
ITOPEX299
ITOPEX277
ITOPEX213
ITOPEX313
ITOPEX314
ITOPEX315
ITOPEX316
ITOPEX317
ITOPEX320
ITOPEX321
ITOPEX212
ITOPEX018
ITOPEX325
ITOPEX326
ITOPEX328
ITOPEX329
ITOPEX330
ITOPEX331
ITOPEX135
ITOPEX150
ITOPEX335
ITOPEX272
ITOPEX122
ITOPEX269
`);

  var itemValues = lines(`
IMS
Sify DC
AWS (Manage service, infra ,PACS storge)
HRMS
Connectivity e.g.Sify,Airtel ,Vodafone & ILL
Enhancements (CRM)
CRM License
Outsytems License Renewal 300 AO + 500 internal +1000 external
Complinity
LIMS Support
Seclore (UPSI safety)
O365 email subscription renewal
Volody
Developler Licenses and subscription
Citrix license
Azure New
Sify DR
EHR support
Crowdstrike Antivirus
Brand Monitoring & Cyber Protection -
L2 Support
HIS DB Upgradation
Reosurces-2 Exisiting & 1 Resource for ERP & New 2 Resources for Outsystem
RPA Bot (AMC Finance BOT)
WAF(Web Application Firewall)
SMS Value First
Sampark
Complaint Management
Enhansment (samprak, deramsol, HRMS, Biometric)
Qlikview Monitoring
SMS services(Netcore/ Dreamsol for BLK)
EHR Enhancement (BI & CPRS)
Pentaho Support Renewal
Renewal of Zoom Licenses
User Awareness & Phishing Simulation
Manpower Renewal
Data, Recovery, Printers, Laptops, IT Room Hygiene, Passive cabling, Spares batteries chargers & Toners, Contigency, Backup tapes etc...
Sonarqube
Sapphire Support
Porter Mangement
RPA Bot (On boarding  Off boarding Nischay)License +Enhancement
ERP enhancements
RIS PACS(GE/MED SYNAPTIC/MEDIFF)
BB Enhancements
IT Infra Training
AWS manage services
Passport Application Imlementation
Innovation and Experimentation
Mailvault(Mail Archrival Solution)
PIM PAM (support renewal + managed services)
QLIK REPLICATE
Assest Cleaning
VAPT
AMC CCTV
Vmware License Renewal(PAN MAX)
Resource for Firewall Management (Managed Services)
GE Infra AMC
AMC- ABG Machine Interfacing
DMS Enhancements
Email Security Solution
NW Switches (including servers)
Epabx Hardware AMC
AMC for Biometric Hardware
IPD Discharge Process Software
LMS Support (Learning Management System)
CR and other
Lab, BB, ABG equipment interfacing/Integration
Harmony
Augnito software license subscription (E-Prescription)
Firewall Renewal
Cloud Email Backup Solution(Renewal)
Consint Solution (AI)
FAR (new Asset register for finance)
MS support
Cyber Security Posture Visibility Software (Safe Me)
IT Security SOC
F&B Idoraa
MedQPro : Medical Quality Software Subscription Fees
DB Support
AI in Clinical Applications
SD WAN Support( Renewal)
EMS, doctor payout and e prapti AMC
AMC for central Desktop support
APM - Dynatrace
Qlik View Developer (Outsource)
CSPM and CNAPP
Audit Trail Grant Thomson
THB AMC
Licenses and Subscriptions (Adobe/PDF Editor)
DC Operations L2- (2 resources)
Amazon PACS back up
DevSecOps Tool
Infor, SUN financial and EAM (Anurakshan/procurment) AMC Cost
SSL Certficate/Domain registration, Hosting/License & Subscription Renewal
VDI solution AWS
AMC Cow Trolleys
Google Dynamic Maps+, Geocoding, Auto complete
Back up (Server, End Point)
Checkpoint internet firewall
AMC SSC
Assessments (New Projects, Network Audit, Firewall Config Review, Cyber Security Assessment, Source code review, Application Security assessment)+VIP protaction
DPDP - (Data Privacy Assessment & Data Privacy Tool)
Innowave
ITSM (ITAM)
QA Automation
Windows Upgradation
LMS Software Infra AMC
Medqpro & Isansys Infra AMC
Qliksense AMC
Augnito software license subscription (Radiology)
Noise Monitoring
AMC of Q Management System
Internet Authentication service
PHP
Patient Tracking
Infant & Mother Tracking
RIS PACS workstations/Medical monitors AMC
Dream Sol(Patient  Feed Back System)
Biometric/attendance system
Jira License & Tool
BOT - UiPath New Projects
Geofencing Google
Sentry Account
Azure cloud managed services
Jira Licenses (Enterprise)
Annotation Tool
HMIS Appication & DB
Whatsapp business
Token Kiosk Machine
20 KVA UPS
100MS
DMS Support Renewal
Licenses and Subscriptions (Digital)
Veritas Netback License Renewal
Neox Software
Jaypee HIS
SAP Cloud Hosting & SAP Support Service
Oracle License
ISO 27001 - Assessment & Policy Prepration
Amc & Support Navision/ User license Renewal Costing Module
ISansys
Hand Hygiene-OT
Call centre Software AMC renewal
Google Cloud Managed services
`);

  var categoryItValues = lines(`
Outsourced IT Manpower (IMS)
Data Center
MPLS/ILL Connectivity
Digital transformation
Emailing
Application
Disaster recovery
IT infra
Cyber/info Security
Clinical Application
Unit Local exp.
SMS/Email consumable
Epabx
Backup & Cloud storage
SD Wan
Dropped
`);

  var subCategoryValues = lines(`
Support restructuring
adding new projects
IT Infra-AWS Cloud
Existing renewal
HRMS
EHR
Resource renewal
Digital transformation
SMS
Infra managed service
New AMC FY 26
EMS/E prapti/Doctor payour
renewal and adding new lic.
New project FY 26
Anticpated enhancement
Dropped
`);

  var newCategoryValues = lines(`
Existing renewal
Annualized impact
MPLS-connectivity
User increased
DR Upgradation
Service improvement
Security enhancement
New Location addition
New project FY 26
Outsourced resource
New AMC FY 26
Assessment
Anticpated enhancement
Training
New Technology
Dropped
`);

  var appCateValues = lines(`
IMS
DC
Connectivity
Emailing
HRMS
CRM
DR
Security
Medical app
Outsource manpower
Unit
SMS
Infra AMC
Digital
SUN
Application AMC
Managed service renewal
Qlik
Partner Support
EMS
billing app (FnB)
Existing renewal
Complinity
Seclore
Sampark
Firewall
Volody
Lic. Renewal
Backup
Sdwan
New Project
BOT
Dreamsol
EHR
Sonarqube
DMS
BB
PIM/PAM
New project FY 26
Managed service
Training
VDI
Dropped
`);

  var cate3Values = lines(`
Existing Renewal
Annualized Impact
Connectivity
Existing renewal
DR restrcturing
New Project
Manpower Renewal
Consumable exp.
Anticipated Enhancement (Digital)
Existing Partner Support
Assessment
New AMC
First time Renewal
New AMC FY 26
New manpower
New lic. Procurment
New AMC
New Innovation
Enhancement/Upgradation
Training
Dropped
`);

  var cate4Values = lines(`
Price Increase + New Location Addition
Tech Refresh
No Increment
Projection
New lic. Procurement
User increased
DR restrcturing
HIS Modernization
New location addition
Consumable exp.
Price Increase
Existing renewal
General Increase
Anticipated Enhancement
Transaction Increased
Annualized Impact
New Project
Dropped
New AMC
License addition
New AMC FY 26
New Innovation
New lic. Procurment + General Increase
Training
`);

  var owner1Values = lines(`
IT Infra
Application
Security
Clinical
Unit
Digital
`);

  var ownerValues = lines(`
Anil
Jatin
Akshant
Kapil
Amit
Unit
Arjun
Vivek
Rakesh
Jitender
Hemant
Unit
Tauqueer
`);

  var costCenterValues = lines(`
30SUP020
30SUP066
30SUP056
`);

  return [
    { id:"coding", label:"Coding", key:"Coding", list:codingValues },
    { id:"item", label:"Item", key:"Item", list:itemValues },
    { id:"categoryIt", label:"Category_IT", key:"Category_IT", list:categoryItValues },
    { id:"subCategory", label:"Sub Category", key:"Sub Category", list:subCategoryValues },
    { id:"newCategory", label:"New Category", key:"New Category", list:newCategoryValues },
    { id:"appCate", label:"App Cate.", key:"App Cate.", list:appCateValues },
    { id:"cate3", label:"Cate.3", key:"Cate.3", list:cate3Values },
    { id:"cate4", label:"Cate.4", key:"Cate.4", list:cate4Values },
    { id:"owner1", label:"Owner1", key:"Owner1", list:owner1Values },
    { id:"owner", label:"Owner", key:"Owner", list:ownerValues },
    { id:"costCenter", label:"Cost Center / Department", key:"Cost Center / Department", list:costCenterValues }
  ];
})();
