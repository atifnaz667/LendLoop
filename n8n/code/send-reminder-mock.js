// Mock reminder: logs instead of emailing. Throws when the reminder cannot be
// sent, which routes the item to the "failed" branch and records reminder_failed.
// Set LENDLOOP_SIMULATE_REMINDER_FAILURE=true to demo the failure path.
if ($env.LENDLOOP_SIMULATE_REMINDER_FAILURE === "true") {
  throw new Error("Simulated reminder failure");
}
const loan = $json;
if (!loan.borrower.email) throw new Error("Borrower has no email on file");

const masked = loan.borrower.email.replace(/^(.).*(@.*)$/, "$1***$2");
const dayWord = loan.daysOverdue === 1 ? "day" : "days";
console.log(
  `[LendLoop mock reminder] to=${masked} "Hi ${loan.borrower.firstName}, the ${loan.tool.name} was due back ${loan.daysOverdue} ${dayWord} ago (${loan.endDate}). Please return it soon."`,
);

return {
  json: {
    writeback: {
      requestId: loan.requestId,
      kind: "reminder_sent",
      idempotencyKey: loan.idempotencyKey,
    },
  },
};
