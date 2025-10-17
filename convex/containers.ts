import { v } from "convex/values";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Helper to validate ISO 6346 container number
function validateISO6346(containerNumber: string): boolean {
  // Basic ISO 6346 validation
  const regex = /^[A-Z]{4}[0-9]{7}$/;
  if (!regex.test(containerNumber)) {
    return false;
  }
  
  // Check digit validation (simplified)
  const letters = containerNumber.slice(0, 4);
  const digits = containerNumber.slice(4, 10);
  const checkDigit = parseInt(containerNumber.slice(10));
  
  // Convert letters to numbers (A=10, B=12, C=13, etc.)
  let sum = 0;
  for (let i = 0; i < letters.length; i++) {
    const letterValue = letters.charCodeAt(i) - 55; // A=10, B=11, etc.
    sum += letterValue * Math.pow(2, i);
  }
  
  // Add digit values
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i]) * Math.pow(2, i + 4);
  }
  
  const calculatedCheckDigit = sum % 11;
  return calculatedCheckDigit === checkDigit;
}

// Add container to form
export const addContainer = mutation({
  args: {
    formId: v.id("transportForms"),
    containerNumber: v.string(),
    sealNumber: v.string(),
    doNumber: v.string(),
    isoCode: v.string(),
    // containerType: v.string(),
    // weight: v.number(),
    dimensions: v.object({
      length: v.number(),
      width: v.number(),
      height: v.number(),
    }),
    sealIntact: v.boolean(),
    damageReported: v.boolean(),
    damageDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Check if user can edit this form
    const form = await ctx.db.get(args.formId);
    if (!form || form.isDeleted) {
      throw new Error("Form not found");
    }
    
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    const canEdit = userRole?.role === "admin" || 
                   (userRole?.role === "employee" && form.employeeId === userId);
    
    if (!canEdit) {
      throw new Error("Cannot edit this form");
    }
    
    // Validate ISO 6346 container number
    const isoValidated = validateISO6346(args.containerNumber);
    
    // Check for duplicate container number in this form
    const existingContainer = await ctx.db
      .query("containers")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .filter((q) => q.eq(q.field("containerNumber"), args.containerNumber))
      .first();
    
    if (existingContainer) {
      throw new Error("Container number already exists in this form");
    }
    
    const now = Date.now();
    const containerId = await ctx.db.insert("containers", {
      formId: args.formId,
      containerNumber: args.containerNumber,
      sealNumber: args.sealNumber,
      doNumber: args.doNumber,
      isoCode: args.isoCode,
      // containerType: args.containerType,
      // weight: args.weight,
      dimensions: args.dimensions,
      isoValidated,
      sealIntact: args.sealIntact,
      damageReported: args.damageReported,
      damageDescription: args.damageDescription,
      assignedVendors: [],
      createdAt: now,
      updatedAt: now,
    });
    
    // Update form completion status
    const containers = await ctx.db
      .query("containers")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    
    await ctx.db.patch(args.formId, {
      completionStatus: {
        ...form.completionStatus,
        containersComplete: containers.length > 0,
      },
      updatedAt: now,
    });
    
    // Log audit trail
    await ctx.runMutation(internal.audit.logAction, {
      entityType: "container",
      entityId: containerId,
      action: "create",
      userId,
      changes: {
        after: { containerNumber: args.containerNumber, formId: args.formId },
      },
    });
    
    return { containerId, isoValidated };
  },
});

// Update container
export const updateContainer = mutation({
  args: {
    containerId: v.id("containers"),
    containerNumber: v.optional(v.string()),
    sealNumber: v.optional(v.string()),
    doNumber: v.optional(v.string()),
    isoCode: v.optional(v.string()),
    // containerType: v.optional(v.string()),
    // weight: v.optional(v.number()),
    dimensions: v.optional(v.object({
      length: v.number(),
      width: v.number(),
      height: v.number(),
    })),
    sealIntact: v.optional(v.boolean()),
    damageReported: v.optional(v.boolean()),
    damageDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    const container = await ctx.db.get(args.containerId);
    if (!container) {
      throw new Error("Container not found");
    }
    
    const form = await ctx.db.get(container.formId);
    if (!form || form.isDeleted) {
      throw new Error("Form not found");
    }
    
    // Check permissions
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    const canEdit = userRole?.role === "admin" || 
                   (userRole?.role === "employee" && form.employeeId === userId);
    
    if (!canEdit) {
      throw new Error("Cannot edit this container");
    }
    
    const updates: any = {
      updatedAt: Date.now(),
    };
    
    // Apply updates
    if (args.containerNumber !== undefined) {
      updates.containerNumber = args.containerNumber;
      updates.isoValidated = validateISO6346(args.containerNumber);
    }
    if (args.sealNumber !== undefined) updates.sealNumber = args.sealNumber;
    if (args.doNumber !== undefined) updates.doNumber = args.doNumber;
    if (args.isoCode !== undefined) updates.isoCode = args.isoCode;
    // if (args.containerType !== undefined) updates.containerType = args.containerType;
    // if (args.weight !== undefined) updates.weight = args.weight;
    if (args.dimensions !== undefined) updates.dimensions = args.dimensions;
    if (args.sealIntact !== undefined) updates.sealIntact = args.sealIntact;
    if (args.damageReported !== undefined) updates.damageReported = args.damageReported;
    if (args.damageDescription !== undefined) updates.damageDescription = args.damageDescription;
    
    await ctx.db.patch(args.containerId, updates);
    
    // Log audit trail
    await ctx.runMutation(internal.audit.logAction, {
      entityType: "container",
      entityId: args.containerId,
      action: "update",
      userId,
      changes: {
        before: container,
        after: { ...container, ...updates },
      },
    });
    
    return { success: true };
  },
});

// Remove container from form
export const removeContainer = mutation({
  args: { containerId: v.id("containers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    const container = await ctx.db.get(args.containerId);
    if (!container) {
      throw new Error("Container not found");
    }
    
    const form = await ctx.db.get(container.formId);
    if (!form || form.isDeleted) {
      throw new Error("Form not found");
    }
    
    // Check permissions
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    const canEdit = userRole?.role === "admin" || 
                   (userRole?.role === "employee" && form.employeeId === userId);
    
    if (!canEdit) {
      throw new Error("Cannot remove this container");
    }
    
    // Remove associated photos
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_container", (q) => q.eq("containerId", args.containerId))
      .collect();
    
    for (const photo of photos) {
      await ctx.db.patch(photo._id, { isDeleted: true });
    }
    
    await ctx.db.delete(args.containerId);
    
    // Update form completion status
    const remainingContainers = await ctx.db
      .query("containers")
      .withIndex("by_form", (q) => q.eq("formId", container.formId))
      .collect();
    
    await ctx.db.patch(container.formId, {
      completionStatus: {
        ...form.completionStatus,
        containersComplete: remainingContainers.length > 0,
      },
      updatedAt: Date.now(),
    });
    
    // Log audit trail
    await ctx.runMutation(internal.audit.logAction, {
      entityType: "container",
      entityId: args.containerId,
      action: "delete",
      userId,
      changes: {
        before: container,
      },
    });
    
    return { success: true };
  },
});

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
  
  const hasPermission = userRole.permissions.includes("*") || 
                       userRole.permissions.includes(permission);
  
  if (!hasPermission) {
    throw new Error("Insufficient permissions");
  }
  
  return { userId, userRole };
}

// Assign vendor to container (admin only)
export const assignVendorToContainer = mutation({
  args: {
    containerId: v.id("containers"),
    vendorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkPermission(ctx, "containers.assign_vendor");
    
    const container = await ctx.db.get(args.containerId);
    if (!container) {
      throw new Error("Container not found");
    }
    
    // Verify vendor role
    const vendorRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.vendorId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!vendorRole || vendorRole.role !== "vendor") {
      throw new Error("User is not a vendor");
    }
    
    // Add vendor to assigned list if not already assigned
    const assignedVendors = container.assignedVendors;
    if (!assignedVendors.includes(args.vendorId)) {
      assignedVendors.push(args.vendorId);
      
      await ctx.db.patch(args.containerId, {
        assignedVendors,
        updatedAt: Date.now(),
      });
    }
    
    return { success: true };
  },
});

// Get containers for form
export const getContainers = query({
  args: { formId: v.id("transportForms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Check if user can view this form
    const form = await ctx.db.get(args.formId);
    if (!form || form.isDeleted) {
      return [];
    }
    
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    const canView = userRole?.role === "admin" || 
                   (userRole?.role === "employee" && form.employeeId === userId) ||
                   (userRole?.role === "vendor" && userRole.permissions.includes("forms.view_assigned"));
    
    if (!canView) {
      throw new Error("Access denied");
    }
    
    const containers = await ctx.db
      .query("containers")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    
    return containers;
  },
});
