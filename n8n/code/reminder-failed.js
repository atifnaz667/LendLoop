// Error branch of "Send reminder": record reminder_failed so the failure is
// visible on the loan in LendLoop. Uses the same idempotency key family with a
// ":failed" suffix, so a later successful retry is still recorded.
const loan = $("Split overdue loans").item.json;
const reason = ($json.error && ($json.error.message || $json.error)) || "Unknown error";

return {
  json: {
    writeback: {
      requestId: loan.requestId,
      kind: "reminder_failed",
      idempotencyKey: `${loan.idempotencyKey}:failed`,
      detail: String(reason).slice(0, 300),
    },
  },
};
