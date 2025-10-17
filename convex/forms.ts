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

// Assign vendor to an allocation
export const assignVendor = mutation({
  args: {
    allocationId: v.id("allocations"),
    vendorUserId: v.id("users"),
  },
  handler: async (ctx, { allocationId, vendorUserId }) => {
    // RBAC
    await checkPermission(ctx, "allocations.assign_vendor");

    // Validate vendor role is active vendor
    const vendorRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", vendorUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!vendorRole || vendorRole.role !== "vendor") {
      throw new Error("Selected user is not an active vendor");
    }

    // Fetch allocation
    const allocation = await ctx.db.get(allocationId);
    if (!allocation) throw new Error("Allocation not found");

    // Patch allocation with vendor (don't touch _creationTime)
    await ctx.db.patch(allocationId, {
      vendorUserId,
      updatedAt: Date.now(),
    } as any);

    // Optional: Reassign any draft vehicles that reference this allocation
    // Requires an index on transportVehicles: .withIndex("by_allocation", q => q.eq("allocationId", allocationId))
    try {
      const vehicles = await ctx.db
        .query("transportVehicles")
        // @ts-ignore: Index name must exist in your schema
        .withIndex("by_allocation", (q) => q.eq("allocationId", allocationId))
        .collect();

      await Promise.all(
        vehicles.map((veh) =>
          ctx.db.patch(veh._id, {
            assignedTransporterId: vendorUserId,
            updatedAt: Date.now(),
          } as any),
        ),
      );
    } catch {
      // If the collection or index doesn't exist, ignore silently
    }

    return { ok: true };
  },
});

// Create new transport form (now supports either transportDetails OR vehicles)
export const createForm = mutation({
  args: {
    // Make transportDetails optional
    transportDetails: v.optional(
      v.object({
        estimatedDeparture: v.number(),
        estimatedArrival: v.number(),
        transporterName: v.string(),
        ContactPerson: v.string(),
        ContactPersonMobile: v.string(),
        vehicleNumber: v.string(),
        driverName: v.string(),
        driverMobile: v.string(),
      }),
    ),
    // Allow multi-vehicle payloads
    vehicles: v.optional(
      v.array(
        v.object({
          estimatedDeparture: v.number(),
      estimatedArrival: v.number(),
      transporterName: v.string(),
      ContactPerson: v.string(),
      ContactPersonMobile: v.string(),
      vehicleNumber: v.string(),
      driverName: v.string(),
      driverMobile: v.string(),
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
          contactPerson: v.optional(v.string()),
          contactMobile: v.optional(v.string()),
          count: v.number(),
        }),
      ),
    ),

    bookingDetails: v.object({
      bookingNo: v.string(),
      poNumber: v.string(),
      shipperName: v.string(),
      vehicalQty: v.string(),
      // POD intentionally removed
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
      // cargoWt intentionally removed
      cleranceLocation: v.string(),
      // cleranceContact intentionally removed
    }),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkPermission(ctx, "forms.create");

    // Need either a transportDetails object or at least one vehicle
   const hasTD = !!args.transportDetails;
const hasVehicles = !!args.vehicles && args.vehicles.length > 0;
if (!hasTD && !hasVehicles) {
  throw new Error("Provide either transportDetails or at least one vehicle.");
}

const transportDetails =
  args.transportDetails ??
  ({
    estimatedDeparture: args.vehicles![0].estimatedDeparture,
    estimatedArrival: args.vehicles![0].estimatedArrival,
    transporterName: args.vehicles![0].transporterName,
    ContactPerson: args.vehicles![0].ContactPerson,
    ContactPersonMobile: args.vehicles![0].ContactPersonMobile,
    vehicleNumber: args.vehicles![0].vehicleNumber,
    driverName: args.vehicles![0].driverName,
    driverMobile: args.vehicles![0].driverMobile,
  } as const);

const refId: string = await ctx.runMutation(internal.forms.generateRefId, {});
const now = Date.now();

const formId: Id<"transportForms"> = await ctx.db.insert("transportForms", {
  refId,
  employeeId: userId,
  status: "pending",
  transportDetails,
  bookingDetails: args.bookingDetails,
  allocations: (args.allocations ?? []) as any,
  completionStatus: {
    transportDetailsComplete: true,
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

return { formId, refId };
  },
});

// Get form by ID
export const getForm = query({
  args: { formId: v.id("transportForms") },
  handler: async (ctx, args) => {
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
      userRole.permissions.includes("forms.view_assigned");

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
        ContactPerson: v.string(),
        ContactPersonMobile: v.string(),
        vehicleNumber: v.string(),
        driverName: v.string(),
        driverMobile: v.string(),
        estimatedDeparture: v.number(),
        estimatedArrival: v.number(),
      }),
    ),
    bookingDetails: v.optional(
      v.object({
        bookingNo: v.string(),
        poNumber: v.string(),
        shipperName: v.string(),
        // POD removed
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
        // cargoWt removed
        cutoffDate: v.number(),
        cleranceLocation: v.string(),
        // cleranceContact removed
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
      // POD: v.optional(v.string()),
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
      // cargoWt: v.optional(v.string()),
      cleranceLocation: v.optional(v.string()),
      // cleranceContact: v.optional(v.string()),
    }),
    allocations: v.array(
      v.object({
        id: v.optional(v.string()),
        transporterUserId: v.id("users"), // vendor user picked in UI
        transporterName: v.optional(v.string()),
        contactPerson: v.optional(v.string()),
        contactMobile: v.optional(v.string()),
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
        await ctx.db.insert("transportVehicles", {
          formId,
          allocationId: a.id,
          assignedTransporterId: a.transporterUserId,
          transporterName: a.transporterName || "",
          contactPerson: a.contactPerson,
          contactMobile: a.contactMobile,
          // containerType: a.containerType,
          // vehicleSize: a.vehicleSize,
          // containerSize: a.containerSize,
          // weight: a.weight,
          // cargoVolume: a.cargoVolume,
          vehicleNumber: undefined,
          driverName: undefined,
          driverMobile: undefined,
          estimatedDeparture: undefined,
          estimatedArrival: undefined,
          status: "draft",
          createdAt: now,
          updatedAt: now,
          updatedBy: userId,
        } as any);
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