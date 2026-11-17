import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Safety net for the webhook outbox: picks up deliveries whose scheduled run was missed.
crons.interval("sweep webhook outbox", { minutes: 5 }, internal.webhookDeliveries.sweep, {});

export default crons;
