-- Root login example:
-- mysql -u root -p
--
-- Replace CHANGE_ME_APP_PASSWORD with your own password.
-- Do not keep the sample password in production.

CREATE DATABASE IF NOT EXISTS maxhealthcare_it_opex
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'it_opex_app'@'localhost'
IDENTIFIED BY 'CHANGE_ME_APP_PASSWORD';

GRANT ALL PRIVILEGES ON maxhealthcare_it_opex.* TO 'it_opex_app'@'localhost';
FLUSH PRIVILEGES;

-- Optional: allow the app user from any host on a LAN / VM.
-- CREATE USER IF NOT EXISTS 'it_opex_app'@'%'
-- IDENTIFIED BY 'CHANGE_ME_APP_PASSWORD';
-- GRANT ALL PRIVILEGES ON maxhealthcare_it_opex.* TO 'it_opex_app'@'%';
-- FLUSH PRIVILEGES;

-- Root connection values are not stored in this repo.
-- Use your own MySQL root password configured on your machine.
