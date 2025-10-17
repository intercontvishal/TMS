import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Generate upload URL for photos
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    return await ctx.storage.generateUploadUrl();
  },
});

// Upload photo with metadata
export const uploadPhoto = mutation({
  args: {
    formId: v.id("transportForms"),
    containerId: v.optional(v.id("containers")),
    storageId: v.id("_storage"),
    category: v.union(
      v.literal("container_exterior"),
      v.literal("container_interior"), 
      v.literal("documents"),
      v.literal("damage"),
      v.literal("other")
    ),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    fileHash: v.string(),
    originalFilename: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    location: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
      accuracy: v.optional(v.number()),
      timestamp: v.number(),
      source: v.union(v.literal("gps"), v.literal("manual")),
    })),
    exifData: v.optional(v.object({
      camera: v.optional(v.string()),
      timestamp: v.optional(v.number()),
      gpsCoords: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Check file size limit (10MB)
    if (args.fileSize > 10 * 1024 * 1024) {
      throw new Error("File size exceeds 10MB limit");
    }
    
    // Validate MIME type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(args.mimeType)) {
      throw new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
    }
    
    // Check if form exists and user has access
    const form = await ctx.db.get(args.formId);
    if (!form || form.isDeleted) {
      throw new Error("Form not found");
    }
    
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!userRole) {
      throw new Error("No role assigned");
    }
    
    // Check permissions based on role
    let canUpload = false;
    
    if (userRole.role === "admin") {
      canUpload = true;
    } else if (userRole.role === "employee" && form.employeeId === userId) {
      canUpload = true;
    } else if (userRole.role === "vendor") {
      // Vendors can only upload to assigned containers
      if (args.containerId) {
        const container = await ctx.db.get(args.containerId);
        canUpload = container?.assignedVendors.includes(userId) || false;
      }
    }
    
    if (!canUpload) {
      throw new Error("Cannot upload photos to this form/container");
    }
    
    // Check for duplicate hash (deduplication)
    const existingPhoto = await ctx.db
      .query("photos")
      .withIndex("by_hash", (q) => q.eq("fileHash", args.fileHash))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .first();
    
    if (existingPhoto) {
      throw new Error("This photo has already been uploaded");
    }
    
    // Check photo count limit per container (50 photos)
    if (args.containerId) {
      const existingPhotos = await ctx.db
        .query("photos")
        .withIndex("by_container", (q) => q.eq("containerId", args.containerId))
        .filter((q) => q.eq(q.field("isDeleted"), false))
        .collect();
      
      if (existingPhotos.length >= 50) {
        throw new Error("Maximum 50 photos allowed per container");
      }
    }
    
    const now = Date.now();
    const photoId = await ctx.db.insert("photos", {
      formId: args.formId,
      containerId: args.containerId,
      storageId: args.storageId,
      category: args.category,
      description: args.description,
      notes: args.notes,
      uploadedBy: userId,
      uploadedAt: now,
      fileHash: args.fileHash,
      originalFilename: args.originalFilename,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      location: args.location,
      exifData: args.exifData,
      isDeleted: false,
    });
    
    // Update form completion status
    const allPhotos = await ctx.db
      .query("photos")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .filter((q) => q.eq(q.field("isDeleted"), false))
      .collect();
    
    await ctx.db.patch(args.formId, {
      completionStatus: {
        ...form.completionStatus,
        photosComplete: allPhotos.length > 0,
      },
      updatedAt: now,
    });
    
    // Log audit trail
    await ctx.runMutation(internal.audit.logAction, {
      entityType: "photo",
      entityId: photoId,
      action: "create",
      userId,
      changes: {
        after: { 
          filename: args.originalFilename, 
          category: args.category,
          formId: args.formId,
          containerId: args.containerId,
        },
      },
    });
    
    return { photoId };
  },
});

// Get photos for form/container
export const getPhotos = query({
  args: {
    formId: v.id("transportForms"),
    containerId: v.optional(v.id("containers")),
    category: v.optional(v.union(
      v.literal("container_exterior"),
      v.literal("container_interior"), 
      v.literal("documents"),
      v.literal("damage"),
      v.literal("other")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Check access to form
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
                   userRole?.permissions.includes("forms.view_assigned");
    
    if (!canView) {
      throw new Error("Access denied");
    }
    
    let query = ctx.db
      .query("photos")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .filter((q) => q.eq(q.field("isDeleted"), false));
    
    let photos = await query.collect();
    
    // Filter by container if specified
    if (args.containerId) {
      photos = photos.filter(photo => photo.containerId === args.containerId);
    }
    
    // Filter by category if specified
    if (args.category) {
      photos = photos.filter(photo => photo.category === args.category);
    }
    
    // Get URLs for photos
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        url: await ctx.storage.getUrl(photo.storageId),
      }))
    );
    
    return photosWithUrls;
  },
});

// Delete photo
export const deletePhoto = mutation({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.isDeleted) {
      throw new Error("Photo not found");
    }
    
    const form = await ctx.db.get(photo.formId);
    if (!form || form.isDeleted) {
      throw new Error("Form not found");
    }
    
    // Check permissions
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    const canDelete = userRole?.role === "admin" || 
                     (userRole?.role === "employee" && form.employeeId === userId) ||
                     photo.uploadedBy === userId;
    
    if (!canDelete) {
      throw new Error("Cannot delete this photo");
    }
    
    await ctx.db.patch(args.photoId, { isDeleted: true });
    
    // Log audit trail
    await ctx.runMutation(internal.audit.logAction, {
      entityType: "photo",
      entityId: args.photoId,
      action: "delete",
      userId,
      changes: {
        before: photo,
      },
    });
    
    return { success: true };
  },
});

// Compress image action
export const compressImage = action({
  args: {
    storageId: v.id("_storage"),
    maxWidth: v.optional(v.number()),
    maxHeight: v.optional(v.number()),
    quality: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // This would implement image compression using canvas
    // For now, return the original storage ID
    return args.storageId;
  },
});
