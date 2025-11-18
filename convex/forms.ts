import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Helper to check user permissions
async function checkPermission(ctx: QueryCtx | MutationCtx, permission: string) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const userRole = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();

  if (!userRole) {
    throw new Error("No role assigned");
  }

  const hasPermission =
    userRole.permissions.includes("*") || userRole.permissions.includes(permission);

  if (!hasPermission) {
    throw new Error("Insufficient permissions");
  }

  return { userId, userRole };
}

// Generate unique reference ID
export const generateRefId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Working year starts April 1st
    const workingYearStart = new Date(currentYear, 3, 1); // April 1st
    const isAfterApril = now >= workingYearStart;

    const workingYear = isAfterApril
      ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}`
      : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

    // Get or create counter for this working year
    let counter = await ctx.db
      .query("refIdCounters")
      .withIndex("by_working_year", (q) => q.eq("workingYear", workingYear))
      .first();

    if (!counter) {
      counter = {
        _id: await ctx.db.insert("refIdCounters", {
          workingYear,
          counter: 0,
          lastUsed: Date.now(),
        }),
        workingYear,
        counter: 0,
        lastUsed: Date.now(),
        _creationTime: Date.now(),
      };
    }

    // Increment counter
    const newCounter = counter.counter + 1;
    await ctx.db.patch(counter._id, {
      counter: newCounter,
      lastUsed: Date.now(),
    });

    // Format: IFL{workingYear}-{counter:05d}
    const refId = `IFL${workingYear}-${newCounter.toString().padStart(5, "0")}`;

    return refId;
  },
});

// Create transportVehicles for a form (after createForm) so vendors can fill Transport Details
export const createTransportVehiclesForForm = mutation({
  args: {
    formId: v.id("transportForms"),
    vehicles: v.array(
      v.object({
        allocationId: v.optional(v.string()),
        assignedTransporterId: v.optional(v.id("users")),
        transporterName: v.optional(v.string()),
        containerNumber: v.optional(v.string()),
        sealNumber: v.optional(v.string()),
        vehicleNumber: v.optional(v.string()),
        driverName: v.optional(v.string()),
        driverMobile: v.optional(v.string()),
    
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkPermission(ctx, "forms.edit");

    const form = await ctx.db.get(args.formId);
    if (!form || form.isDeleted) throw new Error("Form not found");

    const now = Date.now();
    for (const vdata of args.vehicles) {
      await ctx.db.insert("transportVehicles", {
        formId: args.formId,
        allocationId: vdata.allocationId,
        assignedTransporterId: vdata.assignedTransporterId,
        transporterName: vdata.transporterName || "",
        containerNumber: vdata.containerNumber,
        sealNumber: vdata.sealNumber,
        vehicleNumber: vdata.vehicleNumber,
        driverName: vdata.driverName,
        driverMobile: vdata.driverMobile,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        updatedBy: userId,
      } as any);

      // Notify assigned vendor
      if (vdata.assignedTransporterId) {
        try {
          await ctx.runMutation(internal.notifications.sendNotification, {
            userId: vdata.assignedTransporterId,
            type: "form_assigned",
            title: `New vehicle assigned for ${form.refId}`,
            message: `You have been assigned a vehicle on form ${form.refId}. Please fill Transport Details.`,
            data: { formId: args.formId, refId: (form as any).refId },
          });
        } catch {}
      }
    }

    await ctx.runMutation(internal.audit.logAction, {
      entityType: "transportForm",
      entityId: args.formId,
      action: "create_assignments",
      userId,
      changes: { after: { vehiclesCreated: args.vehicles.length } },
    });
    // Reconcile transportVehicles to match allocation counts so vendors see assignments
    // 1) Load current vehicles for this form
    const vehicles = await ctx.db
      .query("transportVehicles")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();

    // 2) Build current count per vendor and list of their vehicle ids
    const byVendor: Record<string, { ids: string[]; draftIds: string[] }> = {};
    for (const v of vehicles as any[]) {
      const vendorId = v.assignedTransporterId ? String(v.assignedTransporterId) : "";
      if (!vendorId) continue;
      if (!byVendor[vendorId]) byVendor[vendorId] = { ids: [], draftIds: [] };
      byVendor[vendorId].ids.push(String(v._id));
      if (v.status === "draft") byVendor[vendorId].draftIds.push(String(v._id));
    }

    // use the existing 'now' captured earlier in this handler

    // 3) For each allocation vendor, ensure the correct count exists
    for (const alloc of ((form as any)?.allocations || []) as any[]) {
      const vendorId = String(alloc.vendorUserId);
      const needed = Number(alloc.count || 0);
      const current = byVendor[vendorId]?.ids.length || 0;

      if (current < needed) {
        const toCreate = needed - current;
        for (let i = 0; i < toCreate; i++) {
          const vehId = await ctx.db.insert("transportVehicles", {
            formId: args.formId,
            allocationId: vendorId, // no per-allocation id available here; use vendorId as stable key
            assignedTransporterId: alloc.vendorUserId,
            transporterName: "",
            status: "draft",
            createdAt: now,
            updatedAt: now,
            updatedBy: userId,
          } as any);
          // notify vendor
          try {
            await ctx.runMutation(internal.notifications.sendNotification, {
              userId: alloc.vendorUserId,
              type: "form_assigned",
              title: "New vehicle assignment",
              message: `You have been assigned a vehicle. Please fill Transport Details.`,
              data: { formId: args.formId, vehicleId: vehId },
            });
          } catch {}
        }
      } else if (current > needed) {
        // reduce by deleting extra draft vehicles first
        let toDelete = current - needed;
        const draftIds = byVendor[vendorId]?.draftIds || [];
        for (const id of draftIds) {
          if (toDelete <= 0) break;
          await ctx.db.delete(id as any);
          toDelete--;
        }
        // If still over, do not delete submitted vehicles; keep extras but could log
      }
    }

    return { success: true };
  },
});

// Transporter overview stats across all bookings
export const getTransporterOverviewStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!role || (role.role !== "transporter" && role.role !== "admin" && role.role !== "employee")) {
      throw new Error("Access denied");
    }

    const forms = await ctx.db
      .query("transportForms")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    // total assigned = sum of all allocation counts
    const totalAssigned = (forms as any[]).reduce((sum, f) => {
      const allocs = (f.allocations || []) as any[];
      return sum + allocs.reduce((s, a) => s + (a.count || 0), 0);
    }, 0);

    // total submitted = count of transportVehicles with status submitted
    const vehicles = await ctx.db
      .query("transportVehicles")
      .filter((q) => q.or(q.eq(q.field("status"), "submitted"), q.eq(q.field("status"), "completed")))
      .collect();
    const totalSubmitted = (vehicles as any[]).length;

    return { totalAssignedVehicles: totalAssigned, totalSubmittedVehicles: totalSubmitted };
  },
});

// Vendor: list assignments for a specific form
export const getVendorAssignmentsForForm = query({
  args: { formId: v.id("transportForms") },
  handler: async (ctx, { formId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!role || role.role !== "vendor") throw new Error("Access denied");

    const items = await ctx.db
      .query("transportVehicles")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .filter((q) => q.eq(q.field("assignedTransporterId"), userId))
      .collect();

    return items;
  },
});

// Admin/Employee: get all vehicles for a form
export const getVehiclesForForm = query({
  args: { formId: v.id("transportForms") },
  handler: async (ctx, { formId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const form: any = await ctx.db.get(formId);
    if (!form || form.isDeleted) throw new Error("Form not found");

    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    const canView =
      userRole?.role === "admin" ||
      (userRole?.role === "employee" && form.employeeId === userId) ||
      userRole?.role === "transporter" ||
      userRole?.permissions?.includes("forms.view_readonly");
    if (!canView) throw new Error("Access denied");

    const vehicles = await ctx.db
      .query("transportVehicles")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .collect();
    return vehicles;
  },
});

// Vendor submits Transport Details for an assigned vehicle; updates parent form snapshot too
export const vendorSubmitTransportDetails = mutation({
  args: {
    vehicleId: v.id("transportVehicles"),
    transporterName: v.string(),
    vehicleNumber: v.string(),
    driverName: v.string(),
    driverMobile: v.string(),
    containerNumber: v.string(),
    sealNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!role || role.role !== "vendor") throw new Error("Access denied");

    const vehicle: any = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new Error("Assignment not found");
    if (vehicle.assignedTransporterId !== userId) throw new Error("Not your assignment");

    const now = Date.now();
    await ctx.db.patch(args.vehicleId, {
      transporterName: args.transporterName,
      vehicleNumber: args.vehicleNumber,
      driverName: args.driverName,
      driverMobile: args.driverMobile,
    
      containerNumber: args.containerNumber,
      sealNumber: args.sealNumber,
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
      updatedBy: userId,
    } as any);

    // Update parent form snapshot and completion flag
    const form: any = await ctx.db.get(vehicle.formId);
    if (form) {
      await ctx.db.patch(vehicle.formId, {
        transportDetails: {
          transporterName: args.transporterName,
          vehicleNumber: args.vehicleNumber,
          driverName: args.driverName,
          driverMobile: args.driverMobile,
          containerNumber: args.containerNumber,
          sealNumber: args.sealNumber,
        },
        completionStatus: {
          ...form.completionStatus,
          transportDetailsComplete: true,
        },
        updatedAt: now,
      });

      // Notify the form owner (employee) that vendor submitted details
      try {
        await ctx.runMutation(internal.notifications.sendNotification, {
          userId: form.employeeId,
          type: "vendor_submitted",
          title: `Vendor submitted details for ${form.refId}`,
          message: `Transport details have been submitted for an assigned vehicle.`,
          data: { formId: vehicle.formId, vehicleId: args.vehicleId, refId: form.refId },
        });
      } catch {}
    }

    await ctx.runMutation(internal.audit.logAction, {
      entityType: "transportVehicle",
      entityId: args.vehicleId,
      action: "vendor_submit_details",
      userId,
      changes: { after: { status: "submitted" } },
    });

    return { success: true };
  },
});

// Create new transport form (now supports either transportDetails OR vehicles)
export const createForm = mutation({
  args: {
    // Make transportDetails optional
    transportDetails: v.optional(
      v.object({
        transporterName: v.string(),
        vehicleNumber: v.string(),
        driverName: v.string(),
        driverMobile: v.string(),
        containerNumber: v.optional(v.string()),
        sealNumber: v.optional(v.string()),
      }),
    ),
    // Allow multi-vehicle payloads
    vehicles: v.optional(
      v.array(
        v.object({
         
          transporterName: v.string(),
          vehicleNumber: v.optional(v.string()),
          driverName: v.optional(v.string()),
          driverMobile: v.optional(v.string()),
          containerNumber: v.optional(v.string()),
          sealNumber: v.optional(v.string()),
          allocationId: v.optional(v.string()),
          // allow vendor on a per-vehicle basis
          vendorUserId: v.optional(v.id("users")),
          // optional alias if your client sometimes sends this name
          transporterUserId: v.optional(v.id("users")),
        }),
      ),
    ),
    // Optional: accept allocations metadata if you send it
    allocations: v.optional(
      v.array(
        v.object({
          id: v.optional(v.string()),
          vendorUserId: v.optional(v.id("users")),
          transporterName: v.optional(v.string()),
         
          count: v.number(),
        }),
      ),
    ),

    bookingDetails: v.object({
      bookingNo: v.string(),
      poNumber: v.string(),
      shipperName: v.string(),
      vehicalQty: v.string(),
    
      pod:v.string(),
      vessel: v.string(),
      stuffingDate: v.number(),
      cutoffDate: v.number(),
      stuffingPlace: v.string(),
      commodity: v.string(),
      // quantity intentionally removed
      catagory: v.string(),
      placementDate: v.number(),
      factory: v.string(),
      remark: v.string(),
      // containerType intentionally removed
      
      cargoWt:v.string(),
      cleranceLocation: v.string(),
      // cleranceContact intentionally removed
    }),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkPermission(ctx, "forms.create");

    // Allow creating a form with bookingDetails only; transportDetails/vehicles are optional
    const transportDetails = args.transportDetails ?? undefined;

const refId: string = await ctx.runMutation(internal.forms.generateRefId, {});
const now = Date.now();

const formId: Id<"transportForms"> = await ctx.db.insert("transportForms", {
  refId,
  employeeId: userId,
  status: "pending",
  ...(transportDetails ? { transportDetails } : {}),
  bookingDetails: args.bookingDetails,
  allocations: (args.allocations ?? []) as any,
  completionStatus: {
    transportDetailsComplete: Boolean(transportDetails),
    bookingDetailsComplete: true,
    containersComplete: false,
    photosComplete: false,
    overallComplete: false,
  },
  createdAt: now,
  updatedAt: now,
  isDeleted: false,
} as any);

await ctx.runMutation(internal.audit.logAction, {
  entityType: "transportForm",
  entityId: formId,
  action: "create",
  userId,
  changes: { after: { refId, status: "pending" } },
});

// Notify all transporters that a new booking was created
try {
  const transporterRoles = await ctx.db
    .query("userRoles")
    .withIndex("by_role", (q) => q.eq("role", "transporter"))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();
  for (const tr of transporterRoles) {
    await ctx.runMutation(internal.notifications.sendNotification, {
      userId: tr.userId,
      type: "booking_created",
      title: `New booking ${refId}`,
      message: `A new booking has been created. Ref ${refId}.`,
      data: { formId, refId },
    });
  }
} catch {}

return { formId, refId };
  },
});

// List bookings for transporter dashboard
export const listBookings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!role || (role.role !== "transporter" && role.role !== "admin" && role.role !== "employee")) {
      throw new Error("Access denied");
    }

    let forms = await ctx.db
      .query("transportForms")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .order("desc")
      .collect();

    // Build vendor map for names
    const vendorIds = new Set<string>();
    for (const f of forms as any[]) {
      for (const a of (f.allocations || []) as any[]) {
        if (a.vendorUserId) vendorIds.add(String(a.vendorUserId));
      }
    }
    const vendorDocs = await Promise.all(
      Array.from(vendorIds).map((id) => ctx.db.get(id as unknown as Id<"users">))
    );
    const vendorNameById = new Map<string, string>();
    for (const vdoc of vendorDocs) {
      if (vdoc) vendorNameById.set(String(vdoc._id), (vdoc as any).name || "");
    }

    const result = (forms as any[]).map((f) => ({
      _id: f._id,
      _creationTime: f.createdAt,
      bookingNo: f.bookingDetails?.bookingNo || "",
      shipperName: f.bookingDetails?.shipperName || "",
      vehicalQty: parseInt(f.bookingDetails?.vehicalQty || "0", 10) || 0,
      pod: f.bookingDetails?.pod || "",
      stuffingDate: f.bookingDetails?.stuffingDate,
      status: f.status,
      vendorAllocations: ((f.allocations || []) as any[]).map((a) => ({
        vendorId: a.vendorUserId ? String(a.vendorUserId) : "",
        vendorName: a.vendorUserId ? (vendorNameById.get(String(a.vendorUserId)) || a.transporterName || "") : (a.transporterName || ""),
        vehicleCount: a.count || 0,
      })),
    }));

    return result;
  },
});

// Allow transporter to update vendor allocations on a booking
export const updateBookingAllocations = mutation({
  args: {
    bookingId: v.id("transportForms"),
    allocations: v.array(v.object({
      vendorId: v.id("users"),
      vehicleCount: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!role || (!role.permissions.includes("bookings.allocate_vendors") && role.role !== "admin")) {
      throw new Error("Insufficient permissions");
    }

    const form = await ctx.db.get(args.bookingId);
    if (!form || (form as any).isDeleted) throw new Error("Booking not found");

    const newAllocs = args.allocations
      .filter((a) => a.vehicleCount > 0)
      .map((a) => ({ vendorUserId: a.vendorId, count: a.vehicleCount } as any));
    // Enforce cap: total allocations cannot exceed vehicalQty in bookingDetails
    const totalRequested = newAllocs.reduce((s: number, a: any) => s + (a.count || 0), 0);
    const vehicalQtyStr = (form as any)?.bookingDetails?.vehicalQty || "0";
    const vehicalQty = parseInt(vehicalQtyStr || "0", 10) || 0;
    if (totalRequested > vehicalQty) {
      throw new Error(`Total allocated (${totalRequested}) exceeds allowed vehicles (${vehicalQty}).`);
    }

    await ctx.db.patch(args.bookingId, {
      allocations: newAllocs,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      entityType: "transportForm",
      entityId: args.bookingId,
      action: "update_allocations",
      userId,
      changes: { after: { allocations: newAllocs } },
    });

    // Reconcile transportVehicles to match new allocations for this booking
    const vehicles = await ctx.db
      .query("transportVehicles")
      .withIndex("by_form", (q) => q.eq("formId", args.bookingId))
      .collect();

    const byVendor: Record<string, { ids: string[]; draftIds: string[] }> = {};
    for (const v of vehicles as any[]) {
      const vendorId = v.assignedTransporterId ? String(v.assignedTransporterId) : "";
      if (!vendorId) continue;
      if (!byVendor[vendorId]) byVendor[vendorId] = { ids: [], draftIds: [] };
      byVendor[vendorId].ids.push(String(v._id));
      if (v.status === "draft") byVendor[vendorId].draftIds.push(String(v._id));
    }

    const now = Date.now();
    for (const alloc of newAllocs as any[]) {
      const vendorId = String(alloc.vendorUserId);
      const needed = Number(alloc.count || 0);
      const current = byVendor[vendorId]?.ids.length || 0;

      if (current < needed) {
        const toCreate = needed - current;
        for (let i = 0; i < toCreate; i++) {
          const vehId = await ctx.db.insert("transportVehicles", {
            formId: args.bookingId,
            allocationId: vendorId,
            assignedTransporterId: alloc.vendorUserId,
            transporterName: "",
            status: "draft",
            createdAt: now,
            updatedAt: now,
            updatedBy: userId,
          } as any);
          // notify vendor about new assignment
          try {
            await ctx.runMutation(internal.notifications.sendNotification, {
              userId: alloc.vendorUserId,
              type: "form_assigned",
              title: "New vehicle assignment",
              message: `You have been assigned a vehicle. Please fill Transport Details.`,
              data: { formId: args.bookingId, vehicleId: vehId },
            });
          } catch {}
        }
      } else if (current > needed) {
        let toDelete = current - needed;
        const draftIds = byVendor[vendorId]?.draftIds || [];
        for (const id of draftIds) {
          if (toDelete <= 0) break;
          await ctx.db.delete(id as any);
          toDelete--;
        }
      }
    }

    return { success: true };
  },
});

// Get form by ID
export const getForm = query({
  args: { formId: v.id("transportForms") },
  handler: async (ctx, args) => {
    // ...
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const form = await ctx.db.get(args.formId);
    if (!form || form.isDeleted) {
      return null;
    }

    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!userRole) {
      throw new Error("No role assigned");
    }

    // Check access permissions
    const canView =
      userRole.role === "admin" ||
      (userRole.role === "employee" && form.employeeId === userId) ||
      userRole.permissions.includes("forms.view_assigned") ||
      userRole.role === "transporter" ||
      userRole.permissions.includes("forms.view_readonly");

    if (!canView) {
      throw new Error("Access denied");
    }

    // Get containers
    const containers = await ctx.db
      .query("containers")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();

    return {
      ...form,
      containers,
    };
  },
});

// List forms with filters
export const listForms = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"))),
    employeeId: v.optional(v.id("users")),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!userRole) {
      throw new Error("No role assigned");
    }

    let forms;

    // Apply role-based filtering
    if (userRole.role === "employee") {
      forms = await ctx.db
        .query("transportForms")
        .withIndex("by_employee", (q) => q.eq("employeeId", userId))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .collect();
    } else if (args.employeeId && userRole.role === "admin") {
      forms = await ctx.db
        .query("transportForms")
        .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId!))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .collect();
    } else {
      forms = await ctx.db
        .query("transportForms")
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .collect();
    }

    // Apply additional filters
    if (args.status) {
      forms = forms.filter((form: any) => form.status === args.status);
    }

    if (args.dateFrom) {
      forms = forms.filter((form: any) => form.createdAt >= args.dateFrom!);
    }

    if (args.dateTo) {
      forms = forms.filter((form: any) => form.createdAt <= args.dateTo!);
    }

    if (args.searchQuery) {
      const searchLower = args.searchQuery.toLowerCase();
      forms = forms.filter((form: any) => {
        const matchesRef = form.refId?.toLowerCase?.().includes(searchLower);
        const matchesVehicle =
          form.transportDetails?.vehicleNumber?.toLowerCase?.().includes(searchLower);
        const matchesShipper =
          form.bookingDetails?.shipperName?.toLowerCase?.().includes(searchLower);
        return Boolean(matchesRef || matchesVehicle || matchesShipper);
      });
    }

    // Sort by creation time (newest first)
    forms.sort((a: any, b: any) => b.createdAt - a.createdAt);

    return forms;
  },
});

// Update form
export const updateForm = mutation({
  args: {
    formId: v.id("transportForms"),

    // Make transportDetails optional to allow partial updates
    transportDetails: v.optional(
      v.object({
        transporterName: v.string(),
        vehicleNumber: v.string(),
        driverName: v.string(),
        driverMobile: v.string(),
        containerNumber: v.optional(v.string()),
        sealNumber: v.optional(v.string()),
      }),
    ),
    bookingDetails: v.optional(
      v.object({
        bookingNo: v.string(),
        poNumber: v.string(),
        shipperName: v.string(),
        pod:v.string(),
      
        vessel: v.string(),
        stuffingDate: v.number(),
        stuffingPlace: v.string(),
        commodity: v.string(),
        // quantity removed
        catagory: v.string(),
        placementDate: v.number(),
        factory: v.string(),
        remark: v.string(),
        // containerType removed
        
        cargoWt:v.string(),
        cutoffDate: v.number(),
        cleranceLocation: v.string(),
        vehicalQty: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkPermission(ctx, "forms.edit");

    const form = await ctx.db.get(args.formId);
    if (!form || form.isDeleted) {
      throw new Error("Form not found");
    }

    // Check if user can edit this form
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    const canEdit =
      userRole?.role === "admin" ||
      (userRole?.role === "employee" && form.employeeId === userId);

    if (!canEdit) {
      throw new Error("Cannot edit this form");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.transportDetails) {
      updates.transportDetails = args.transportDetails;
    }

    if (args.bookingDetails) {
      updates.bookingDetails = args.bookingDetails;
    }

    await ctx.db.patch(args.formId, updates);

    // Log audit trail
    await ctx.runMutation(internal.audit.logAction, {
      entityType: "transportForm",
      entityId: args.formId,
      action: "update",
      userId,
      changes: {
        before: form,
        after: { ...form, ...updates },
      },
    });

    return { success: true };
  },
});

// Submit form (mark as completed)
export const submitForm = mutation({
  args: { formId: v.id("transportForms") },
  handler: async (ctx, args) => {
    const { userId } = await checkPermission(ctx, "forms.edit");

    const form: any = await ctx.db.get(args.formId);
    if (!form || form.isDeleted) {
      throw new Error("Form not found");
    }

    // Check if user can submit this form
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    const canSubmit =
      userRole?.role === "admin" ||
      (userRole?.role === "employee" && form.employeeId === userId);

    if (!canSubmit) {
      throw new Error("Cannot submit this form");
    }

    // Check if form is complete
    const containers = await ctx.db
      .query("containers")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();

    const photos = await ctx.db
      .query("photos")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    const containersComplete = containers.length > 0;
    const photosComplete = photos.length > 0;

    const completionStatus = {
      transportDetailsComplete: true,
      bookingDetailsComplete: true,
      containersComplete,
      photosComplete,
      overallComplete: containersComplete && photosComplete,
    };

    if (!completionStatus.overallComplete) {
      throw new Error("Form is not complete. Please add containers and photos.");
    }

    const now = Date.now();
    await ctx.db.patch(args.formId, {
      status: "completed",
      submittedAt: now,
      updatedAt: now,
      completionStatus,
    });

    // Log audit trail
    await ctx.runMutation(internal.audit.logAction, {
      entityType: "transportForm",
      entityId: args.formId,
      action: "submit",
      userId,
      changes: {
        before: { status: form.status },
        after: { status: "completed", submittedAt: now },
      },
    });

    return { success: true };
  },
});

// Soft delete form (admin only)
export const deleteForm = mutation({
  args: {
    formId: v.id("transportForms"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkPermission(ctx, "forms.delete");

    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    if (form.isDeleted) {
      throw new Error("Form already deleted");
    }

    const now = Date.now();
    await ctx.db.patch(args.formId, {
      isDeleted: true,
      deletedAt: now,
      deletedBy: userId,
      deletionReason: args.reason,
      updatedAt: now,
    });

    // Log audit trail
    await ctx.runMutation(internal.audit.logAction, {
      entityType: "transportForm",
      entityId: args.formId,
      action: "delete",
      userId,
      changes: {
        before: { isDeleted: false },
        after: { isDeleted: true, deletionReason: args.reason },
      },
    });

    return { success: true };
  },
});

// Restore deleted form (admin only)
export const restoreForm = mutation({
  args: { formId: v.id("transportForms") },
  handler: async (ctx, args) => {
    const { userId } = await checkPermission(ctx, "forms.restore");

    const form = await ctx.db.get(args.formId);
    if (!form) {
      throw new Error("Form not found");
    }

    if (!form.isDeleted) {
      throw new Error("Form is not deleted");
    }

    const now = Date.now();
    await ctx.db.patch(args.formId, {
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      deletionReason: undefined,
      updatedAt: now,
    });

    // Log audit trail
    await ctx.runMutation(internal.audit.logAction, {
      entityType: "transportForm",
      entityId: args.formId,
      action: "restore",
      userId,
      changes: {
        before: { isDeleted: true },
        after: { isDeleted: false },
      },
    });

    return { success: true };
  },
});

// Get form statistics (admin dashboard)
export const getFormStats = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await checkPermission(ctx, "forms.view_all");

    const allForms = await ctx.db
      .query("transportForms")
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();

    const stats = {
      total: allForms.length,
      pending: allForms.filter((f: any) => f.status === "pending").length,
      completed: allForms.filter((f: any) => f.status === "completed").length,
      thisMonth: allForms.filter((f: any) => {
        const formDate = new Date(f.createdAt);
        const now = new Date();
        return (
          formDate.getMonth() === now.getMonth() &&
          formDate.getFullYear() === now.getFullYear()
        );
      }).length,
    };

    return stats;
  },
});

// Search forms with full-text search
export const searchForms = query({
  args: {
    searchQuery: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!userRole) {
      throw new Error("No role assigned");
    }

    let sq = ctx.db
      .query("transportForms")
      .withSearchIndex("search_forms", (q) => {
        let search = q.search("refId", args.searchQuery);
        if (args.status) {
          search = search.eq("status", args.status);
        }
        if (userRole.role === "employee") {
          search = search.eq("employeeId", userId);
        }
        return search;
      });

    const results = await sq.take(args.limit || 20);

    return results.filter((form: any) => !form.isDeleted);
  },
});

// V2: Create form by allocating counts to vendors, without full transportDetails yet
export const createFormV2 = mutation({
  args: {
    bookingDetails: v.object({
      bookingNo: v.string(),
      poNumber: v.optional(v.string()),
      shipperName: v.optional(v.string()),
      vehicalQty: v.string(),
      pod: v.optional(v.string()),
      vessel: v.optional(v.string()),
      stuffingDate: v.optional(v.number()),
      cutoffDate: v.optional(v.number()),
      stuffingPlace: v.optional(v.string()),
      commodity: v.optional(v.string()),
      // quantity: v.optional(v.string()),
      catagory: v.optional(v.string()),
      placementDate: v.optional(v.number()),
      factory: v.optional(v.string()),
      remark: v.optional(v.string()),
      // containerType: v.optional(v.string()),
      cargoWt: v.optional(v.string()),
      cleranceLocation: v.optional(v.string()),
      cleranceContact: v.optional(v.string()),
    }),
    allocations: v.array(
      v.object({
        id: v.optional(v.string()),
        transporterUserId: v.id("users"), // vendor user picked in UI
        transporterName: v.optional(v.string()),
        driverName: v.optional(v.string()),
        driverContact: v.optional(v.string()),
        containerNumber: v.optional(v.string()),
        
        sealNumber: v.optional(v.string()),
        // containerType: v.optional(v.string()),
        // vehicleSize: v.optional(v.string()),
        // containerSize: v.optional(v.string()),
        // weight: v.optional(v.string()),
        // cargoVolume: v.optional(v.string()),
        count: v.number(),
      }),
    ),
  },

  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Only admin/employee can create
    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!role || (role.role !== "admin" && role.role !== "employee")) {
      throw new Error("Insufficient permissions");
    }

    const total = parseInt(args.bookingDetails.vehicalQty || "0", 10) || 0;
    const allocated = args.allocations.reduce((s, a) => s + a.count, 0);
    if (!total || total !== allocated) {
      throw new Error(`Allocated (${allocated}) must equal Total Vehicles (${total}).`);
    }

    const refId: string = await ctx.runMutation(internal.forms.generateRefId, {});
    const now = Date.now();

    // Note: We intentionally do not set transportDetails here.
    const formId: Id<"transportForms"> = await ctx.db.insert("transportForms", {
      refId,
      employeeId: userId,
      status: "pending",
      bookingDetails: args.bookingDetails as any,
      allocations: args.allocations as any, // optional snapshot if your schema supports it
      completionStatus: {
        transportDetailsComplete: false,
        bookingDetailsComplete: true,
        containersComplete: false,
        photosComplete: false,
        overallComplete: false,
      },
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    } as any);

    // Create placeholder vehicles assigned to vendors
    for (const a of args.allocations) {
      for (let i = 0; i < a.count; i++) {
        const vehId = await ctx.db.insert("transportVehicles", {
          formId,
          allocationId: a.id,
          assignedTransporterId: a.transporterUserId,
          transporterName: a.transporterName || "",
          // containerType: a.containerType,
          // vehicleSize: a.vehicleSize,
          // containerSize: a.containerSize,
          // weight: a.weight,
          // cargoVolume: a.cargoVolume,

          vehicleNumber: undefined,
          driverName: undefined,
          driverMobile: undefined,
          containerNumber: undefined,
          sealNumber: undefined,
  
          status: "draft",
          createdAt: now,
          updatedAt: now,
          updatedBy: userId,
        } as any);

        // Notify assigned vendor
        if (a.transporterUserId) {
          try {
            await ctx.runMutation(internal.notifications.sendNotification, {
              userId: a.transporterUserId,
              type: "form_assigned",
              title: `New vehicle assigned for ${refId}`,
              message: `You have been assigned a vehicle on form ${refId}. Please fill Transport Details.`,
              data: { formId, vehicleId: vehId, refId },
            });
          } catch {}
        }
      }
    }

    await ctx.runMutation(internal.audit.logAction, {
      entityType: "transportForm",
      entityId: formId,
      action: "create",
      userId,
      changes: { after: { refId, status: "pending" } },
    });

    return { formId, refId };
  },
});