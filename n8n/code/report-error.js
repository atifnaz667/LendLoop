// Error workflow: every failed LendLoop execution lands here, so failures are
// visible in logs (and optionally in Slack/Discord) instead of failing silently.
const { execution = {}, workflow = {} } = $input.first().json;
const summary = {
  workflow: workflow.name,
  executionId: execution.id,
  url: execution.url,
  failedNode: execution.lastNodeExecuted,
  message: execution.error && execution.error.message,
  at: new Date().toISOString(),
};
console.error(`[LendLoop automation failure] ${JSON.stringify(summary)}`);

return [
  {
    json: {
      ...summary,
      // Slack and Discord incoming webhooks both accept a "text"/"content" field.
      text: `LendLoop automation failed: ${summary.workflow} at node "${summary.failedNode}": ${summary.message}. ${summary.url || ""}`,
      content: `LendLoop automation failed: ${summary.workflow} at node "${summary.failedNode}": ${summary.message}. ${summary.url || ""}`,
    },
  },
];
