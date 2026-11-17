/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as automation from "../automation.js";
import type * as borrowRequests from "../borrowRequests.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as integrations_clerkWebhook from "../integrations/clerkWebhook.js";
import type * as integrations_n8nDispatch from "../integrations/n8nDispatch.js";
import type * as integrations_n8nHttp from "../integrations/n8nHttp.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_hmac from "../lib/hmac.js";
import type * as lib_validators from "../lib/validators.js";
import type * as models_automationEventModel from "../models/automationEventModel.js";
import type * as models_requestModel from "../models/requestModel.js";
import type * as models_toolModel from "../models/toolModel.js";
import type * as models_userModel from "../models/userModel.js";
import type * as models_webhookDeliveryModel from "../models/webhookDeliveryModel.js";
import type * as services_automationService from "../services/automationService.js";
import type * as services_notificationService from "../services/notificationService.js";
import type * as services_outboxService from "../services/outboxService.js";
import type * as services_policy from "../services/policy.js";
import type * as services_requestService from "../services/requestService.js";
import type * as services_requestStateMachine from "../services/requestStateMachine.js";
import type * as services_toolService from "../services/toolService.js";
import type * as services_userService from "../services/userService.js";
import type * as shared_constants from "../shared/constants.js";
import type * as tools from "../tools.js";
import type * as users from "../users.js";
import type * as webhookDeliveries from "../webhookDeliveries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  automation: typeof automation;
  borrowRequests: typeof borrowRequests;
  crons: typeof crons;
  http: typeof http;
  "integrations/clerkWebhook": typeof integrations_clerkWebhook;
  "integrations/n8nDispatch": typeof integrations_n8nDispatch;
  "integrations/n8nHttp": typeof integrations_n8nHttp;
  "lib/auth": typeof lib_auth;
  "lib/dates": typeof lib_dates;
  "lib/errors": typeof lib_errors;
  "lib/hmac": typeof lib_hmac;
  "lib/validators": typeof lib_validators;
  "models/automationEventModel": typeof models_automationEventModel;
  "models/requestModel": typeof models_requestModel;
  "models/toolModel": typeof models_toolModel;
  "models/userModel": typeof models_userModel;
  "models/webhookDeliveryModel": typeof models_webhookDeliveryModel;
  "services/automationService": typeof services_automationService;
  "services/notificationService": typeof services_notificationService;
  "services/outboxService": typeof services_outboxService;
  "services/policy": typeof services_policy;
  "services/requestService": typeof services_requestService;
  "services/requestStateMachine": typeof services_requestStateMachine;
  "services/toolService": typeof services_toolService;
  "services/userService": typeof services_userService;
  "shared/constants": typeof shared_constants;
  tools: typeof tools;
  users: typeof users;
  webhookDeliveries: typeof webhookDeliveries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
