import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Safety net for the webhook outbox: picks up deliveries whose scheduled run was missed.
crons.interval("sweep webhook outbox", { minutes: 5 }, internal.webhookDeliveries.sweep, {});

// Data minimization: drop old outbox payloads (they contain a recipient email).
crons.daily(
  "purge old webhook deliveries",
  { hourUTC: 3, minuteUTC: 30 },
  internal.webhookDeliveries.purgeOld,
  {},
);

export default crons;
