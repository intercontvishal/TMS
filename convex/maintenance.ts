import { mutation } from "./_generated/server";

// One-time cleanup: remove legacy contactPerson/contactMobile from transportVehicles
export const cleanupLegacyContactFields = mutation({
  args: {},
  handler: async (ctx) => {
    // Iterate over all transportVehicles and strip legacy fields if present
    const rows = await ctx.db.query("transportVehicles").collect();
    let updated = 0;
    for (const doc of rows as any[]) {
      if (doc.contactPerson !== undefined || doc.contactMobile !== undefined) {
        await ctx.db.patch(doc._id, {
          contactPerson: undefined,
          contactMobile: undefined,
        } as any);
        updated++;
      }
    }
    return { updated };
  },
});

// One-time fix: populate transporterName from assigned vendor's user record
export const populateTransporterNames = mutation({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("transportVehicles").collect();
    let updated = 0;
    
    for (const vehicle of vehicles) {
      // Skip if transporterName is already set
      if (vehicle.transporterName && vehicle.transporterName.trim()) {
        continue;
      }
      
      // Get the assigned vendor user
      if (vehicle.assignedTransporterId) {
        const vendorUser = await ctx.db.get(vehicle.assignedTransporterId);
        if (vendorUser && vendorUser.name) {
          await ctx.db.patch(vehicle._id, {
            transporterName: vendorUser.name,
          });
          updated++;
        }
      }
    }
    
    return { updated, total: vehicles.length };
  },
});
