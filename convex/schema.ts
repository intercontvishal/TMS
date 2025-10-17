import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

const applicationTables = {
  // User roles and permissions
  userRoles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("employee"), v.literal("admin"), v.literal("vendor"), v.literal("order_placer")),
    permissions: v.array(v.string()),
    assignedBy: v.optional(v.id("users")),
    isActive: v.boolean(),
  }).index("by_user", ["userId"])
    .index("by_role", ["role"]),



  // Transport forms
  transportForms: defineTable({
    refId: v.string(), // IFL{workingYear}-{counter}
    employeeId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("completed")),


    transportDetails: v.object({

      estimatedDeparture: v.number(),
      estimatedArrival: v.number(),
      transporterName: v.string(),
      ContactPerson: v.string(),
      ContactPersonMobile: v.string(),
      vehicleNumber: v.string(),
      driverName: v.string(),
      driverMobile: v.string(),
    }),
    // Booking & Shipment Summary
    bookingDetails: v.object({
      bookingNo: v.string(),
      poNumber: v.string(),
      shipperName: v.string(),
      // POD: v.string(),
      vessel: v.string(),
      stuffingDate: v.number(),
      cutoffDate: v.number(),
      stuffingPlace: v.string(),
      commodity: v.string(),
      catagory: v.string(),
      placementDate: v.number(),
      factory: v.string(),
      remark: v.string(),
      // containerType: v.string(),
      // quantity: v.string(),
      // cargoWt: v.string(),
      cleranceLocation: v.string(),    //Cutoff Place
      // cleranceContact: v.string(),
      vehicalQty:v.string(),

    }),
    // Add this field if you want it on the form
allocations: v.optional(
v.array(
v.object({
id: v.optional(v.string()),
vendorUserId: v.optional(v.id("users")),
transporterName: v.optional(v.string()),
contactPerson: v.optional(v.string()),
contactMobile: v.optional(v.string()),
count: v.number(),
})
)
),

    // Form completion tracking
    completionStatus: v.object({
      transportDetailsComplete: v.boolean(),
      bookingDetailsComplete: v.optional(v.boolean()),
      containersComplete: v.boolean(),
      photosComplete: v.boolean(),
      overallComplete: v.boolean(),
    }),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
    submittedAt: v.optional(v.number()),
    isDeleted: v.boolean(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deletionReason: v.optional(v.string()),
  }).index("by_ref_id", ["refId"])
    .index("by_employee", ["employeeId"])
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"])
    .searchIndex("search_forms", {
      searchField: "refId",
      filterFields: ["status", "employeeId"]
    }),

  // Container details
  containers: defineTable({
    formId: v.id("transportForms"),
    containerNumber: v.string(),

    // Container Details
    sealNumber: v.string(),
    doNumber: v.string(), // Delivery Order
    isoCode: v.string(), // ISO 6346 compliant
    // containerType: v.string(),
    // weight: v.number(),
    dimensions: v.object({
      length: v.number(),
      width: v.number(),
      height: v.number(),
    }),

    // Validation flags
    isoValidated: v.boolean(),
    sealIntact: v.boolean(),
    damageReported: v.boolean(),
    damageDescription: v.optional(v.string()),

    // Vendor assignments
    assignedVendors: v.array(v.id("users")),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_form", ["formId"])
    .index("by_container_number", ["containerNumber"]),

  // Photo documentation
  photos: defineTable({
    formId: v.id("transportForms"),
    containerId: v.optional(v.id("containers")),
    storageId: v.id("_storage"),

    // Photo metadata
    category: v.union(
      v.literal("container_exterior"),
      v.literal("container_interior"),
      v.literal("documents"),
      v.literal("damage"),
      v.literal("other")
    ),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),

    // Upload metadata
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
    fileHash: v.string(), // For deduplication
    originalFilename: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),

    // Location data
    location: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
      accuracy: v.optional(v.number()),
      timestamp: v.number(),
      source: v.union(v.literal("gps"), v.literal("manual")),
    })),

    // EXIF data
    exifData: v.optional(v.object({
      camera: v.optional(v.string()),
      timestamp: v.optional(v.number()),
      gpsCoords: v.optional(v.string()),
    })),

    isDeleted: v.boolean(),
  }).index("by_form", ["formId"])
    .index("by_container", ["containerId"])
    .index("by_hash", ["fileHash"])
    .index("by_uploader", ["uploadedBy"]),

  // Reference ID counter
  refIdCounters: defineTable({
    workingYear: v.string(), // e.g., "2025-26"
    counter: v.number(),
    lastUsed: v.number(),
  }).index("by_working_year", ["workingYear"]),

  // Audit trail
  auditLogs: defineTable({
    entityType: v.string(), // "transportForm", "container", "photo"
    entityId: v.string(),
    action: v.string(), // "create", "update", "delete", "restore"
    userId: v.id("users"),
    timestamp: v.number(),
    changes: v.optional(v.object({
      before: v.optional(v.any()),
      after: v.optional(v.any()),
    })),
    metadata: v.optional(v.object({
      userAgent: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      requestId: v.optional(v.string()),
    })),
  }).index("by_entity", ["entityType", "entityId"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),

  // Notifications
  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(), // "form_assigned", "status_changed", "photo_uploaded", etc.
    title: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
    isRead: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"]),



    //allocations 
    allocations: defineTable({
  // ... other fields like bookingId, vehicleCount, etc.
  
  // REMOVE the old field:
  // transporterName: v.optional(v.string()), 
  
  // ADD the new relational field:
  vendorUserId: v.optional(v.id("users")),


}).index("by_vendor", ["vendorUserId"]), 

  // User preferences
  userPreferences: defineTable({
    userId: v.id("users"),
    emailNotifications: v.boolean(),
    pushNotifications: v.boolean(),
    notificationTypes: v.array(v.string()),
    timezone: v.string(),
    language: v.string(),
  }).index("by_user", ["userId"]),

  // Access links for order placers
  accessLinks: defineTable({
    token: v.string(),
    formId: v.id("transportForms"),
    containerIds: v.array(v.id("containers")),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    isRevoked: v.boolean(),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.id("users")),
    accessCount: v.number(),
    lastAccessedAt: v.optional(v.number()),
  }).index("by_token", ["token"])
    .index("by_form", ["formId"]),

  // System configuration
  systemConfig: defineTable({
    key: v.string(),
    value: v.any(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),


// ...authTables and your existing tables
// ...existing tables
transportVehicles: defineTable({
formId: v.id("transportForms"),
allocationId: v.string(),
assignedTransporterId: v.optional(v.id("users")), // vendor user
transporterName: v.string(),
contactPerson: v.optional(v.string()),
contactMobile: v.optional(v.string()),
// containerType: v.optional(v.string()),
vehicleSize: v.optional(v.string()),
// containerSize: v.optional(v.string()),
// weight: v.optional(v.string()),
// cargoVolume: v.optional(v.string()),
vehicleNumber: v.optional(v.string()),
driverName: v.optional(v.string()),
driverMobile: v.optional(v.string()),
estimatedDeparture: v.optional(v.number()), // epoch ms
estimatedArrival: v.optional(v.number()), // epoch ms
status: v.union(v.literal("draft"), v.literal("submitted")),
submittedAt: v.optional(v.number()),
submittedBy: v.optional(v.id("users")),
createdAt: v.number(),
updatedAt: v.number(),
updatedBy: v.optional(v.id("users")),
})
.index("by_form", ["formId"])
.index("by_transporter", ["assignedTransporterId"])
.index("by_status", ["status"]),

transporterContacts: defineTable({
name: v.string(),
email: v.optional(v.string()),
contactPerson: v.optional(v.string()),
contactMobile: v.optional(v.string()),
createdAt: v.number(),
createdBy: v.id("users"),
}).index("by_email", ["email"]),
};


export default defineSchema({
  ...authTables,
  ...applicationTables,
});
