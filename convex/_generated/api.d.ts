/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as http from "../http.js";
import type * as integrations_clerkWebhook from "../integrations/clerkWebhook.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_validators from "../lib/validators.js";
import type * as models_userModel from "../models/userModel.js";
import type * as services_policy from "../services/policy.js";
import type * as services_userService from "../services/userService.js";
import type * as shared_constants from "../shared/constants.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  http: typeof http;
  "integrations/clerkWebhook": typeof integrations_clerkWebhook;
  "lib/auth": typeof lib_auth;
  "lib/errors": typeof lib_errors;
  "lib/validators": typeof lib_validators;
  "models/userModel": typeof models_userModel;
  "services/policy": typeof services_policy;
  "services/userService": typeof services_userService;
  "shared/constants": typeof shared_constants;
  users: typeof users;
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
