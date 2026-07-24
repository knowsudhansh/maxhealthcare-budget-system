-- Phase 5A authentication and RBAC foundation.
-- Additive and non-destructive. Do not run against UAT/Production without approval.

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id VARCHAR(80) NOT NULL,
  email VARCHAR(180) NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  password_changed_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_employee_id (employee_id),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_status (status),
  KEY idx_users_last_login (last_login_at)
);

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  is_system_role TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_roles_code (code)
);

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(120) NOT NULL,
  module VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_permissions_code (code),
  KEY idx_permissions_module (module)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  valid_from DATETIME NULL,
  valid_until DATETIME NULL,
  assigned_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role (role_id),
  KEY idx_user_roles_valid_until (valid_until)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id)
);

CREATE TABLE IF NOT EXISTS locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  parent_location_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_locations_code (code),
  KEY idx_locations_status (status),
  KEY idx_locations_parent (parent_location_id)
);

CREATE TABLE IF NOT EXISTS user_locations (
  user_id BIGINT UNSIGNED NOT NULL,
  location_id BIGINT UNSIGNED NOT NULL,
  access_type VARCHAR(40) NOT NULL DEFAULT 'VIEW_EDIT',
  valid_from DATETIME NULL,
  valid_until DATETIME NULL,
  assigned_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, location_id, access_type),
  KEY idx_user_locations_location (location_id),
  KEY idx_user_locations_valid_until (valid_until)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  session_token_hash CHAR(64) NOT NULL,
  ip_address VARCHAR(80) NULL,
  user_agent VARCHAR(512) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_sessions_token_hash (session_token_hash),
  KEY idx_user_sessions_user (user_id),
  KEY idx_user_sessions_expiry (expires_at),
  KEY idx_user_sessions_revoked (revoked_at)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id_or_email_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  failure_reason VARCHAR(120) NULL,
  ip_address VARCHAR(80) NULL,
  user_agent VARCHAR(512) NULL,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_login_attempts_identifier (employee_id_or_email_hash),
  KEY idx_login_attempts_user (user_id),
  KEY idx_login_attempts_time (attempted_at)
);

CREATE TABLE IF NOT EXISTS security_audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(120) NOT NULL,
  resource_type VARCHAR(120) NULL,
  resource_id VARCHAR(120) NULL,
  outcome VARCHAR(40) NOT NULL,
  metadata_json JSON NULL,
  ip_address VARCHAR(80) NULL,
  user_agent VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_security_audit_actor (actor_user_id),
  KEY idx_security_audit_event_type (event_type),
  KEY idx_security_audit_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS password_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_password_history_user (user_id, created_at)
);

-- Rollback guidance for isolated non-production environments only:
-- DROP TABLE password_history;
-- DROP TABLE security_audit_events;
-- DROP TABLE login_attempts;
-- DROP TABLE user_sessions;
-- DROP TABLE user_locations;
-- DROP TABLE locations;
-- DROP TABLE role_permissions;
-- DROP TABLE user_roles;
-- DROP TABLE permissions;
-- DROP TABLE roles;
-- DROP TABLE users;
