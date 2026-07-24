const bcrypt = require("bcryptjs");

const DEFAULT_COST = 12;
const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "welcome123",
  "admin123",
  "qwerty123",
  "maxhealthcare"
]);

async function hashPassword(password, options = {}) {
  const cost = Number.isInteger(options.cost) ? options.cost : DEFAULT_COST;
  return bcrypt.hash(String(password || ""), cost);
}

async function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) return false;
  return bcrypt.compare(String(password), String(passwordHash));
}

function validatePasswordPolicy(password, user = {}, options = {}) {
  const minLength = options.minLength || 12;
  const value = String(password || "");
  const errors = [];
  if (value.length < minLength) errors.push(`Password must be at least ${minLength} characters.`);
  if (!/[A-Z]/.test(value)) errors.push("Password must include an uppercase letter.");
  if (!/[a-z]/.test(value)) errors.push("Password must include a lowercase letter.");
  if (!/[0-9]/.test(value)) errors.push("Password must include a number.");
  if (!/[^A-Za-z0-9]/.test(value)) errors.push("Password must include a special character.");

  const normalized = value.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) errors.push("Password is too common.");
  [user.employeeId, user.employee_id, user.email, user.displayName, user.display_name].forEach((part) => {
    const text = String(part || "").trim().toLowerCase();
    if (text && normalized.includes(text)) {
      errors.push("Password must not contain employee, email, or display-name values.");
    }
  });
  return errors;
}

module.exports = {
  hashPassword,
  validatePasswordPolicy,
  verifyPassword
};
