// Mock notification channel: logs the message instead of sending an email.
// Swap this node for Email (SMTP), Slack or Discord in production; the rest of
// the workflow stays the same. The email address is masked in logs.
const item = $input.first().json;
const email = item.to.email || "";
const masked = email.replace(/^(.).*(@.*)$/, "$1***$2") || "(no email on file)";

console.log(
  `[LendLoop mock notification] to=${masked} subject="${item.subject}" event=${item.eventId}`,
);

return [{ json: { ...item, sentAt: new Date().toISOString(), channel: "mock-log" } }];
