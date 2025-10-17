/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as access from "../access.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as containers from "../containers.js";
import type * as forms from "../forms.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as photos from "../photos.js";
import type * as router from "../router.js";
import type * as transporters from "../transporters.js";
import type * as users from "../users.js";
import type * as vendor from "../vendor.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  access: typeof access;
  audit: typeof audit;
  auth: typeof auth;
  containers: typeof containers;
  forms: typeof forms;
  http: typeof http;
  notifications: typeof notifications;
  photos: typeof photos;
  router: typeof router;
  transporters: typeof transporters;
  users: typeof users;
  vendor: typeof vendor;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
