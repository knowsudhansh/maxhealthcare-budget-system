const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(file, text, message) {
  assert.ok(file.includes(text), message || `Expected ${text}`);
}

const configMap = read("k8s/dev/configmap.yaml");
const deployment = read("k8s/dev/deployment.yaml");
const service = read("k8s/dev/service.yaml");
const ingress = read("k8s/dev/ingress.yaml");
const kustomization = read("k8s/dev/kustomization.yaml");
const secretExample = read("k8s/dev/secret.example.yaml");

assertIncludes(configMap, "namespace: dev");
assertIncludes(configMap, 'APP_ENV: "development"');
assertIncludes(configMap, 'APP_BASE_PATH: "/budget-app"');
assertIncludes(configMap, 'HOST: "0.0.0.0"');
assertIncludes(configMap, 'PORT: "3000"');
assertIncludes(configMap, 'DB_PORT: "4000"');
assertIncludes(configMap, 'DB_SSL: "true"');
assertIncludes(configMap, 'DB_SSL_CA: "/run/secrets/tidb-ca.pem"');
assertIncludes(configMap, 'AUTH_COOKIE_SECURE: "true"');
assertIncludes(configMap, 'AUTH_TRUST_PROXY: "true"');

["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "AUTH_SESSION_SECRET"].forEach((name) => {
  assert.ok(!new RegExp(`${name}:\\s*"?(?!\\$|<)\\S+`, "i").test(configMap), `${name} must not be in ConfigMap`);
  assertIncludes(deployment, `name: ${name}`);
  assertIncludes(deployment, "secretKeyRef:");
});

assertIncludes(deployment, "configMapRef:");
assertIncludes(deployment, "name: budget-app-config");
assertIncludes(deployment, "name: budget-app-secrets");
assertIncludes(deployment, "containerPort: 3000");
assertIncludes(deployment, "mountPath: /run/secrets/tidb-ca.pem");
assertIncludes(deployment, "subPath: tidb-ca.pem");
assertIncludes(deployment, "readinessProbe:");
assertIncludes(deployment, "path: /budget-app/health/ready");
assertIncludes(deployment, "livenessProbe:");
assertIncludes(deployment, "path: /health/live");
assert.ok(!deployment.includes("optional: true"), "mandatory config must not be optional");
assert.ok(!deployment.includes("value: <"), "Deployment must not contain placeholder env values");

assertIncludes(service, "type: ClusterIP");
assertIncludes(service, "port: 80");
assertIncludes(service, "targetPort: http");
assertIncludes(service, "app: budget-app");

assertIncludes(ingress, "kubernetes.io/ingress.class: alb");
assertIncludes(ingress, "alb.ingress.kubernetes.io/scheme: internal");
assertIncludes(ingress, "alb.ingress.kubernetes.io/target-type: ip");
assertIncludes(ingress, "alb.ingress.kubernetes.io/healthcheck-path: /budget-app/health/ready");
assertIncludes(ingress, "path: /budget-app");
assertIncludes(ingress, "pathType: Prefix");
assert.ok(!/rewrite-target/i.test(ingress), "ALB ingress must preserve the /budget-app prefix");

["configmap.yaml", "deployment.yaml", "service.yaml", "ingress.yaml"].forEach((resource) => {
  assertIncludes(kustomization, resource);
});

assertIncludes(secretExample, "Example only. Do not apply this file.");
assert.ok(!/^apiVersion:/m.test(secretExample), "secret example should not be directly applyable");
assert.ok(!/stringData:|data:/m.test(secretExample), "secret example must not contain secret data fields");
assert.ok(!/BEGIN CERTIFICATE|PRIVATE KEY|2gZSXLNqVYDUEy3|tidbcloud|gateway01/i.test(secretExample));
assert.ok(!/--from-literal=DB_PASSWORD='(?!<database-password>')[^']+'/i.test(secretExample));
assert.ok(!/--from-literal=AUTH_SESSION_SECRET='(?!<32-plus-character-session-secret>')[^']+'/i.test(secretExample));

console.log("Kubernetes deployment manifest checks passed.");
