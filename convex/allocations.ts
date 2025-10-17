// // /convex/allocations.ts
// import { mutation } from "./_generated/server";
// import { v } from "convex/values";

// // Adjust table names as per your schema.
// export const assignVendor = mutation({
//   args: {
//     allocationId: v.id("allocations"),
//     vendorUserId: v.id("users"),
//   },
//   handler: async (ctx, { allocationId, vendorUserId }) => {
//     // Validate vendor role
//     const vendorRole = await ctx.db
//       .query("userRoles")
//       .withIndex("by_user", (q) => q.eq("userId", vendorUserId))
//       .first();
//     if (!vendorRole || vendorRole.role !== "vendor" || !vendorRole.isActive) {
//       throw new Error("Selected user is not an active vendor");
//     }

//     // Fetch and patch allocation
//     const allocation = await ctx.db.get(allocationId);
//     if (!allocation) throw new Error("Allocation not found");

//     // TODO: Add your RBAC guard (require admin/employee)
//     await ctx.db.patch(allocationId, {
//       vendorUserId,
//       vendorAssignedAt: Date.now(),
//     });

//     // OPTIONAL: If you already create Transport Details rows per allocation,
//     // re-assign them to the chosen vendor here.
//     // Example (change "transportDetails" + index to match your schema):
//     const details = await ctx.db
//       .query("transportDetails")
//       .withIndex("by_allocation", (q) => q.eq("allocationId", allocationId))
//       .collect();

//     await Promise.all(
//       details.map((d) =>
//         ctx.db.patch(d._id, {
//           assignedVendorId: vendorUserId,
//           // Optionally reset status to Pending if reassigning
//           // status: "Pending",
//         })
//       )
//     );

//     return { ok: true };
//   },
// });