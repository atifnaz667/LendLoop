import { httpRouter } from "convex/server";
import { handleClerkWebhook } from "./integrations/clerkWebhook";
import { getOverdueLoans, postAutomationEvent } from "./integrations/n8nHttp";

/**
 * HTTP routes. Each route maps to a controller in convex/integrations.
 * Every inbound route verifies a signature before doing any work.
 */
const http = httpRouter();

http.route({ path: "/clerk/webhook", method: "POST", handler: handleClerkWebhook });
http.route({ path: "/n8n/overdue-loans", method: "GET", handler: getOverdueLoans });
http.route({ path: "/n8n/automation-events", method: "POST", handler: postAutomationEvent });

export default http;
