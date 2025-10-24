// in convex/vendor.ts

import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// This is the function you are trying to call.
// Notice it is a NAMED EXPORT, not a default export.
export const listAssignedForms = query({
  handler: async (ctx) => {
    // Get logged-in user (vendor)
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Ensure the user has an active vendor role
    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!role || role.role !== "vendor") return [];

    // Find vehicles assigned to this vendor
    // Prefer an index on assignedTransporterId if available; otherwise filter.
    const vehicles = await ctx.db
      .query("transportVehicles")
      .filter((q) => q.eq(q.field("assignedTransporterId"), userId))
      .collect();

    if (vehicles.length === 0) return [];

    // Aggregate per formId
    const grouped = new Map<string, { total: number; submitted: number }>();
    for (const v of vehicles as any[]) {
      const fid = (v.formId as string) || (v.formId?.id as string);
      if (!fid) continue;
      const acc = grouped.get(fid) || { total: 0, submitted: 0 };
      acc.total += 1;
      if (v.status === "submitted") acc.submitted += 1;
      grouped.set(fid, acc);
    }

    // Join back to forms for refId and createdAt
    const results: { formId: any; refId: string; total: number; submitted: number; createdAt?: number }[] = [];
    for (const [fid, agg] of grouped) {
      const form: any = await ctx.db.get(fid as any);
      if (!form || form.isDeleted) continue;
      results.push({
        formId: fid as any,
        refId: form.refId,
        total: agg.total,
        submitted: agg.submitted,
        createdAt: form.createdAt,
      });
    }

    // Newest first
    results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return results;
  },
});

// If you have other vendor-related functions, you can add them here as other named exports.
// For example:
// export const getVendorProfile = query({ ... });