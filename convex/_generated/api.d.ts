/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as campaignLeads from "../campaignLeads.js";
import type * as campaigns from "../campaigns.js";
import type * as companies from "../companies.js";
import type * as crons from "../crons.js";
import type * as enrichments from "../enrichments.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as leads from "../leads.js";
import type * as scraperRuns from "../scraperRuns.js";
import type * as settings from "../settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  campaignLeads: typeof campaignLeads;
  campaigns: typeof campaigns;
  companies: typeof companies;
  crons: typeof crons;
  enrichments: typeof enrichments;
  http: typeof http;
  jobs: typeof jobs;
  leads: typeof leads;
  scraperRuns: typeof scraperRuns;
  settings: typeof settings;
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
