import { httpRouter } from "convex/server";
import { handleClerkWebhook } from "./integrations/clerkWebhook";

/**
 * HTTP routes. Each route maps to a controller in convex/integrations.
 * Every inbound route verifies a signature before doing any work.
 */
const http = httpRouter();

http.route({ path: "/clerk/webhook", method: "POST", handler: handleClerkWebhook });

export default http;
