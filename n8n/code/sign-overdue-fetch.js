// Signs GET /n8n/overdue-loans. Signed string: `${timestamp}.GET./n8n/overdue-loans.` (empty body).
const crypto = require("crypto");

const secret = $env.N8N_TO_LENDLOOP_SECRET;
if (!secret) throw new Error("N8N_TO_LENDLOOP_SECRET is not configured in the n8n environment");

const PATH = "/n8n/overdue-loans";
const timestamp = Math.floor(Date.now() / 1000).toString();
const digest = crypto
  .createHmac("sha256", secret)
  .update(`${timestamp}.GET.${PATH}.`)
  .digest("hex");

return [{ json: { timestamp, signature: `v1=${digest}` } }];
