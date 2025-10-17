// in convex/vendor.ts

import { query } from "./_generated/server";
import { v } from "convex/values";

// This is the function you are trying to call.
// Notice it is a NAMED EXPORT, not a default export.
export const listAssignedForms = query({
  handler: async (ctx) => {
    // 1. Get the identity of the currently logged-in user.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // If no user is logged in, return an empty array.
      return [];
    }

    // The 'subject' from the JWT token is typically the user's ID in the `users` table.
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.tokenIdentifier))
      .unique();

    if (!user || user.name !== "vendor") {
      // If the user isn't found or is not a vendor, they have no assigned forms.
      return [];
    }
    
    // 2. Find all allocations assigned to this vendor user.
    const allocations = await ctx.db
      .query("allocations")
      .withIndex("by_vendor", (q) => q.eq("vendorUserId", user._id))
      .collect();

    // 3. For each allocation, fetch the full parent booking details.
    const assignedForms = await Promise.all(
      allocations.map(async (allocation) => {
        // Fetch the main booking document
        const booking = await ctx.db.get(allocation._id);
        
        // Fetch transport details submitted for this allocation (if any)
        const transportDetails = await ctx.db
          .query("allocations")
          .withIndex("by_vendor", (q) => q.eq("vendorUserId", allocation.vendorUserId))
          .collect();

        // Combine the data into a useful structure for the frontend
        return {
          // Spread the booking details
          ...booking, 
          // Add specific allocation info
          allocationId: allocation._id,
          allocatedVehicles: allocation._creationTime,
          allocationStatus: allocation._creationTime,
          // Add submitted transport details
          submittedVehicles: transportDetails,
        };
      })
    );

    // Filter out any results where the booking might have been deleted
    return assignedForms.filter(form => form._id);
  },
});

// If you have other vendor-related functions, you can add them here as other named exports.
// For example:
// export const getVendorProfile = query({ ... });