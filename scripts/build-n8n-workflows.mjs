// Generates n8n/workflows/*.json from n8n/code/*.js so the Code node logic is
// reviewed and unit tested as normal files. Run: npm run n8n:build
// Secrets are never embedded: Code nodes read $env, HTTP nodes use expressions.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const code = (name) => readFileSync(join(root, "n8n/code", `${name}.js`), "utf8");

// Fixed ids so `n8n import:workflow` keeps them and the errorWorkflow link works.
const IDS = {
  notify: "LLRequestNotify1",
  reminders: "LLOverdueRemind1",
  error: "LLErrorHandler01",
};

let counter = 0;
const nodeId = (prefix) => `${prefix}-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

function codeNode(name, file, position, extra = {}) {
  return {
    id: nodeId("c0de0000"),
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: { jsCode: code(file), ...(extra.mode ? { mode: extra.mode } : {}) },
    ...(extra.node ?? {}),
  };
}

function ifNode(name, expression, position) {
  return {
    id: nodeId("1f000000"),
    name,
    type: "n8n-nodes-base.if",
    typeVersion: 2.2,
    position,
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
        conditions: [
          {
            id: nodeId("1fc00000"),
            leftValue: `={{ ${expression} }}`,
            rightValue: "",
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
  };
}

function respondNode(name, status, body, position) {
  return {
    id: nodeId("2e500000"),
    name,
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position,
    parameters: {
      respondWith: "json",
      responseBody: body,
      options: { responseCode: status },
    },
  };
}

const retry = (maxTries = 3, waitBetweenTries = 2000) => ({
  retryOnFail: true,
  maxTries,
  waitBetweenTries,
});

function writeBackNode(name, position) {
  return {
    id: nodeId("a77e0000"),
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position,
    parameters: {
      method: "POST",
      url: "={{ $env.LENDLOOP_CONVEX_SITE_URL }}/n8n/automation-events",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "X-LendLoop-Timestamp", value: "={{ $json.timestamp }}" },
          { name: "X-LendLoop-Signature", value: "={{ $json.signature }}" },
        ],
      },
      sendBody: true,
      contentType: "raw",
      rawContentType: "application/json",
      body: "={{ $json.body }}",
      options: { timeout: 10000 },
    },
    ...retry(),
  };
}

const link = (to, index = 0) => ({ node: to, type: "main", index });

function workflow(id, name, nodes, connections, settings = {}) {
  return {
    id,
    name,
    active: false,
    nodes,
    connections,
    settings: { executionOrder: "v1", saveManualExecutions: true, ...settings },
    pinData: {},
    meta: { templateCredsSetupCompleted: true },
    tags: [],
  };
}

// ---------------------------------------------------------------------------
// 1. Request notification
// ---------------------------------------------------------------------------
const notify = workflow(
  IDS.notify,
  "LendLoop - Request notification",
  [
    {
      id: nodeId("3eb00000"),
      name: "Request event webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 300],
      webhookId: "7c1f2a5e-3b8d-4c6a-9e21-4c3e5d6f7a81",
      parameters: {
        httpMethod: "POST",
        path: "lendloop-request-events",
        responseMode: "responseNode",
        options: { rawBody: true },
      },
    },
    codeNode("Verify signature", "verify-request-event", [220, 300]),
    ifNode("Signature valid?", "$json.valid", [440, 300]),
    respondNode("Reject (401)", 401, '={{ { "error": "invalid signature" } }}', [660, 480]),
    ifNode("Already handled?", "$json.duplicate", [660, 200]),
    respondNode("Acknowledge duplicate", 200, '={{ { "status": "duplicate" } }}', [880, 60]),
    codeNode("Build message", "build-notification", [880, 300]),
    codeNode("Send notification (mock)", "send-notification-mock", [1100, 300], {
      node: retry(3, 3000),
    }),
    codeNode("Sign write-back", "sign-writeback", [1320, 300], { mode: "runOnceForEachItem" }),
    writeBackNode("Record notification in LendLoop", [1540, 300]),
    codeNode("Mark event handled", "mark-event-seen", [1760, 300]),
    respondNode("Acknowledge", 200, '={{ { "status": "ok" } }}', [1980, 300]),
  ],
  {
    "Request event webhook": { main: [[link("Verify signature")]] },
    "Verify signature": { main: [[link("Signature valid?")]] },
    "Signature valid?": { main: [[link("Already handled?")], [link("Reject (401)")]] },
    "Already handled?": { main: [[link("Acknowledge duplicate")], [link("Build message")]] },
    "Build message": { main: [[link("Send notification (mock)")]] },
    "Send notification (mock)": { main: [[link("Sign write-back")]] },
    "Sign write-back": { main: [[link("Record notification in LendLoop")]] },
    "Record notification in LendLoop": { main: [[link("Mark event handled")]] },
    "Mark event handled": { main: [[link("Acknowledge")]] },
  },
  { errorWorkflow: IDS.error },
);

// ---------------------------------------------------------------------------
// 2. Overdue reminders
// ---------------------------------------------------------------------------
const reminders = workflow(
  IDS.reminders,
  "LendLoop - Overdue reminders",
  [
    {
      id: nodeId("5c4e0000"),
      name: "Every day at 09:00",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [0, 200],
      parameters: { rule: { interval: [{ field: "days", triggerAtHour: 9 }] } },
    },
    {
      id: nodeId("3a400000"),
      name: "Run manually",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, 400],
      parameters: {},
    },
    codeNode("Sign request", "sign-overdue-fetch", [220, 300]),
    {
      id: nodeId("9e700000"),
      name: "Fetch overdue loans",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [440, 300],
      parameters: {
        method: "GET",
        url: "={{ $env.LENDLOOP_CONVEX_SITE_URL }}/n8n/overdue-loans",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "X-LendLoop-Timestamp", value: "={{ $json.timestamp }}" },
            { name: "X-LendLoop-Signature", value: "={{ $json.signature }}" },
          ],
        },
        options: { timeout: 10000 },
      },
      ...retry(),
    },
    codeNode("Split overdue loans", "split-overdue-loans", [660, 300]),
    codeNode("Send reminder (mock)", "send-reminder-mock", [880, 300], {
      mode: "runOnceForEachItem",
      node: { ...retry(2, 3000), onError: "continueErrorOutput" },
    }),
    codeNode("Reminder failed", "reminder-failed", [1100, 460], { mode: "runOnceForEachItem" }),
    codeNode("Sign write-back", "sign-writeback", [1320, 300], { mode: "runOnceForEachItem" }),
    writeBackNode("Record reminder in LendLoop", [1540, 300]),
  ],
  {
    "Every day at 09:00": { main: [[link("Sign request")]] },
    "Run manually": { main: [[link("Sign request")]] },
    "Sign request": { main: [[link("Fetch overdue loans")]] },
    "Fetch overdue loans": { main: [[link("Split overdue loans")]] },
    "Split overdue loans": { main: [[link("Send reminder (mock)")]] },
    "Send reminder (mock)": { main: [[link("Sign write-back")], [link("Reminder failed")]] },
    "Reminder failed": { main: [[link("Sign write-back")]] },
    "Sign write-back": { main: [[link("Record reminder in LendLoop")]] },
  },
  { errorWorkflow: IDS.error },
);

// ---------------------------------------------------------------------------
// 3. Error handler
// ---------------------------------------------------------------------------
const errorHandler = workflow(
  IDS.error,
  "LendLoop - Error handler",
  [
    {
      id: nodeId("e4400000"),
      name: "On workflow error",
      type: "n8n-nodes-base.errorTrigger",
      typeVersion: 1,
      position: [0, 300],
      parameters: {},
    },
    codeNode("Log failure", "report-error", [220, 300]),
    ifNode("Alert webhook configured?", "!!$env.LENDLOOP_ALERT_WEBHOOK_URL", [440, 300]),
    {
      id: nodeId("a1e70000"),
      name: "Send alert",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [660, 200],
      parameters: {
        method: "POST",
        url: "={{ $env.LENDLOOP_ALERT_WEBHOOK_URL }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify({ text: $json.text, content: $json.content }) }}",
        options: { timeout: 10000 },
      },
      ...retry(),
    },
  ],
  {
    "On workflow error": { main: [[link("Log failure")]] },
    "Log failure": { main: [[link("Alert webhook configured?")]] },
    "Alert webhook configured?": { main: [[link("Send alert")], []] },
  },
);

const out = (file, data) =>
  writeFileSync(join(root, "n8n/workflows", file), `${JSON.stringify(data, null, 2)}\n`);
out("request-notification.json", notify);
out("overdue-reminders.json", reminders);
out("error-handler.json", errorHandler);
console.info("Wrote 3 workflows to n8n/workflows/");
