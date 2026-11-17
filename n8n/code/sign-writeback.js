// Signs a write-back to LendLoop: POST /n8n/automation-events.
// Signed string: `${timestamp}.POST./n8n/automation-events.${body}`.
// Runs once for each item; expects $json.writeback = { requestId, kind, idempotencyKey, detail? }.
const crypto = require("crypto");

const secret = $env.N8N_TO_LENDLOOP_SECRET;
if (!secret) throw new Error("N8N_TO_LENDLOOP_SECRET is not configured in the n8n environment");

const PATH = "/n8n/automation-events";
const body = JSON.stringify($json.writeback);
const timestamp = Math.floor(Date.now() / 1000).toString();
const digest = crypto
  .createHmac("sha256", secret)
  .update(`${timestamp}.POST.${PATH}.${body}`)
  .digest("hex");

return { json: { body, timestamp, signature: `v1=${digest}` } };
