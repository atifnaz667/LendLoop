// Fails if an exported n8n workflow contains anything that looks like a secret.
// Exports must reference secrets via $env or n8n credentials only.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "n8n/workflows";
const suspicious = [
  /"(secret|password|token|apiKey|api_key)"\s*:\s*"(?!=|\{\{)[^"]{8,}"/i, // literal secret values
  /whsec_[A-Za-z0-9]+/, // Clerk/Svix signing secrets
  /sk_(test|live)_[A-Za-z0-9]+/, // Clerk secret keys
  /"data"\s*:\s*\{[^}]*"(password|apiKey)"/i, // inlined credential data
];

let failed = false;
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
for (const file of files) {
  const text = readFileSync(join(dir, file), "utf8");
  for (const pattern of suspicious) {
    if (pattern.test(text)) {
      console.error(`${file}: matches ${pattern}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.info(`Checked ${files.length} workflow file(s): no secrets found.`);
