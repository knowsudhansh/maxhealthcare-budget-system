const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");
const { loadEnvironment } = require("../src/config/environment");
const { loadDbSecret } = require("../src/config/secrets");
const { initializePool, closePool } = require("../src/db/pool");
const { bootstrapAdmin } = require("../src/modules/auth/auth.service");
const { normalizeBootstrapAdminPayload } = require("../src/modules/auth/auth.validation");
const { serializeDatabaseError } = require("../src/db/error-diagnostics");

function parseArgs(argv) {
  const result = {};
  argv.forEach((arg) => {
    const match = String(arg).match(/^--([^=]+)=(.*)$/);
    if (match) result[match[1]] = match[2];
    else if (arg === "--generate-password") result.generatePassword = true;
  });
  return result;
}

async function collectInput(args) {
  const mutedOutput = Object.create(output);
  mutedOutput.write = function writeMuted(string) {
    if (!this.muted) return output.write(string);
    if (String(string).includes("\n")) return output.write("\n");
    return true;
  };
  const rl = readline.createInterface({ input, output: mutedOutput });
  try {
    const employeeId = args["employee-id"] || await rl.question("Employee ID: ");
    const email = args.email || await rl.question("Email: ");
    const displayName = args["display-name"] || await rl.question("Display name: ");
    let password = args.password || process.env.AUTH_BOOTSTRAP_PASSWORD || "";
    if (!password) {
      mutedOutput.muted = true;
      password = await rl.question("Temporary password: ");
      mutedOutput.muted = false;
    }
    return { employeeId, email, displayName, password };
  } finally {
    rl.close();
  }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const inputPayload = await collectInput(args);
  const payload = normalizeBootstrapAdminPayload(inputPayload);
  const config = loadEnvironment(process.env);
  const secret = await loadDbSecret(config);
  await initializePool(config, secret);
  const user = await bootstrapAdmin(payload, { runtimeConfig: config });
  console.log("Bootstrap admin created.");
  console.log(JSON.stringify({
    id: user.id,
    employeeId: user.employeeId,
    email: user.email,
    displayName: user.displayName,
    mustChangePassword: user.mustChangePassword
  }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Bootstrap admin failed.");
      console.error(JSON.stringify(serializeDatabaseError(error, { stage: "auth-bootstrap-admin" }), null, 2));
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}

module.exports = {
  main,
  parseArgs
};
