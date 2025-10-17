// import { query, mutation } from "./_generated/server";
// import { v } from "convex/values";

// // Helper to get current user doc
// async function getCurrentUser(ctx: any) {
// const identity = await ctx.auth.getUserIdentity();
// if (!identity) throw new Error("Not authenticated");
// // If you maintain a users doc mapped to identity, fetch it here.
// // With @convex-dev/auth, a "users" table exists. Replace this with your mapping as needed.
// const user = await ctx.db
// .query("users")
// .withIndex("by_tokenIdentifier", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
// .unique();
// if (!user) throw new Error("User not found");
// return user;
// }

// // List vehicles for current transporter
// export const listForMe = query({
// args: { status: v.optional(v.union(v.literal("draft"), v.literal("submitted"))) },
// handler: async (ctx, args) => {
// const me = await getCurrentUser(ctx);
// let q = ctx.db
// .query("transportVehicles")
// .withIndex("by_transporter", q => q.eq("assignedTransporterId", me._id));
// if (args.status) {
// q = q.withIndex("by_status", q => q.eq("status", args.status!));
// }
// const rows = await q.collect();

// // Add form refId for display
// const results = [];
// for (const vDoc of rows) {
//   const form = await ctx.db.get(vDoc.formId);
//   results.push({ ...vDoc, formRefId: form?.refId });
// }
// return results;

// },
// });

// // Get one vehicle (ownership enforced)
// export const getOne = query({
// args: { vehicleId: v.id("transportVehicles") },
// handler: async (ctx, args) => {
// const me = await getCurrentUser(ctx);
// const vDoc = await ctx.db.get(args.vehicleId);
// if (!vDoc) throw new Error("Vehicle not found");
// if (vDoc.assignedTransporterId !== me._id) throw new Error("Forbidden");
// return vDoc;
// },
// });

// // Save draft (transporter can edit only drafts they own)
// export const saveDraft = mutation({
// args: {
// vehicleId: v.id("transportVehicles"),
// patch: v.object({
// vehicleNumber: v.string(),
// driverName: v.string(),
// driverMobile: v.string(),
// estimatedDeparture: v.number(),
// estimatedArrival: v.number(),
// }),
// },
// handler: async (ctx, { vehicleId, patch }) => {
// const me = await getCurrentUser(ctx);
// const vDoc = await ctx.db.get(vehicleId);
// if (!vDoc) throw new Error("Vehicle not found");
// if (vDoc.assignedTransporterId !== me._id) throw new Error("Forbidden");
// if (vDoc.status === "submitted") throw new Error("Vehicle already submitted");


// await ctx.db.patch(vehicleId, {
//   ...patch,
//   updatedAt: Date.now(),
//   updatedBy: me._id,
// });
// return { ok: true };

// },
// });

// // Submit (lock forever, update parent form)
// export const submit = mutation({
// args: { vehicleId: v.id("transportVehicles") },
// handler: async (ctx, { vehicleId }) => {
// const me = await getCurrentUser(ctx);
// const vDoc = await ctx.db.get(vehicleId);
// if (!vDoc) throw new Error("Vehicle not found");
// if (vDoc.assignedTransporterId !== me._id) throw new Error("Forbidden");
// if (vDoc.status === "submitted") throw new Error("Already submitted");

// // Final validation before submit (ensure required fields present)
// const missing = [];
// if (!vDoc.vehicleNumber?.trim()) missing.push("vehicleNumber");
// if (!vDoc.driverName?.trim()) missing.push("driverName");
// if (!vDoc.driverMobile?.trim()) missing.push("driverMobile");
// if (!vDoc.estimatedArrival) missing.push("estimatedArrival");
// if (!vDoc.estimatedDeparture) missing.push("estimatedDeparture");
// if (missing.length) throw new Error("Missing required fields: " + missing.join(", "));

// await ctx.db.patch(vehicleId, {
//   status: "submitted",
//   submittedAt: Date.now(),
//   submittedBy: me._id,
//   updatedAt: Date.now(),
//   updatedBy: me._id,
// });

// // Optionally, update parent form (e.g., recalc submitted count)
// const siblings = await ctx.db
//   .query("transportVehicles")
//   .withIndex("by_form", q => q.eq("formId", vDoc.formId))
//   .collect();
// const submittedCount = siblings.filter(s => s.status === "submitted").length;

// // Example: store submittedVehiclesCount on transportForms (add this field in schema if useful)
// await ctx.db.patch(vDoc.formId, {
//   updatedAt: Date.now(),
//   // submittedVehiclesCount: submittedCount, // uncomment if you added this field to transportForms
// });

// return { ok: true, submittedCount };
// },
// });