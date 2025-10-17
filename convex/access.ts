//access.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { useQuery } from "convex/react";


// Node "crypto" is not available here. Use a safe UUID generator for Convex.
// Works in Convex queries/mutations (no Node "crypto" import needed)
function safeRandomId(): string {
  const g = globalThis as any;
  const c = g?.crypto || g?.msCrypto;

  if (c?.randomUUID) return c.randomUUID();

  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);        // strongly typed
    c.getRandomValues(bytes);

    // RFC4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    // annotate b so it's number (not unknown)
    const hex = Array.from(bytes, (b: number) =>
      b.toString(16).padStart(2, "0")
    );

    return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
  }

  // Fallback (non‑crypto)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generate access link (admin only)
export const generateAccessLink = mutation({
  args: {
    formId: v.id("transportForms"),
    containerIds: v.array(v.id("containers")),
    expiryHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("isActive"), true))
      .first();
    if (!userRole || userRole.role !== "admin") throw new Error("Admin access required");

    const token = safeRandomId(); // replaced randomUUID()
    const expiryHours = args.expiryHours ?? 72;
    const expiresAt = Date.now() + expiryHours * 60 * 60 * 1000;

    const linkId = await ctx.db.insert("accessLinks", {
      token,
      formId: args.formId,
      containerIds: args.containerIds,
      createdBy: userId,
      expiresAt,
      isRevoked: false,
      accessCount: 0,
      // lastAccessedAt: undefined
    });

    await ctx.runMutation(internal.audit.logAction, {
      entityType: "accessLink",
      entityId: linkId,
      action: "create",
      userId,
      changes: { after: { token, formId: args.formId, expiresAt } },
    });

    return { token, expiresAt };
  },
});

// Revoke access link (admin only)
export const revokeAccessLink = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("isActive"), true))
      .first();
    if (!userRole || userRole.role !== "admin") throw new Error("Admin access required");

    const link = await ctx.db
      .query("accessLinks")
      .withIndex("by_token", q => q.eq("token", args.token))
      .unique();
    if (!link) throw new Error("Access link not found");

    await ctx.db.patch(link._id, {
      isRevoked: true,
      revokedAt: Date.now(),
      revokedBy: userId,
    });

    return { success: true };
  },
});

// Access form via token (now a mutation to allow incrementing counters)
export const accessFormByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("accessLinks")
      .withIndex("by_token", q => q.eq("token", args.token))
      .unique();
    if (!link) throw new Error("Invalid access link");
    if (link.isRevoked) throw new Error("Access link has been revoked");
    if (Date.now() > link.expiresAt) throw new Error("Access link has expired");

    const form = await ctx.db.get(link.formId);
    if (!form || form.isDeleted) throw new Error("Form not found");

    // Get containers + photos
    const containers = await Promise.all(
      link.containerIds.map(async (containerId) => {
        const container = await ctx.db.get(containerId);
        if (!container) return null;

        const photos = await ctx.db
          .query("photos")
          .withIndex("by_container", q => q.eq("containerId", containerId))
          .filter(q => q.eq(q.field("isDeleted"), false))
          .collect();

        const photosWithUrls = await Promise.all(
          photos.map(async (photo) => ({
            ...photo,
            url: await ctx.storage.getUrl(photo.storageId),
          }))
        );

        return { ...container, photos: photosWithUrls };
      })
    );

    // Increment usage counters
    await ctx.db.patch(link._id, {
      accessCount: (link.accessCount ?? 0) + 1,
      lastAccessedAt: Date.now(),
    });

    return {
      form: {
        refId: form.refId,
        status: form.status,
        transportDetails: (form as any).transportDetails, // keep if you still store it on the form
        bookingDetails: form.bookingDetails,
        createdAt: form.createdAt,
        submittedAt: form.submittedAt,
      },
      containers: containers.filter(Boolean),
      linkInfo: {
        expiresAt: link.expiresAt,
        accessCount: (link.accessCount ?? 0) + 1,
      },
    };
  },
});

// List vendors (transporters)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Not authenticated");

    const vendorRoles = await ctx.db
      .query("userRoles")
      .withIndex("by_role", q => q.eq("role", "vendor"))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();

    const vendors: { userId: string; name?: string; email?: string }[] = [];
    for (const r of vendorRoles) {
      const u = await ctx.db.get(r.userId);
      if (u) vendors.push({ userId: u._id, name: (u as any).name, email: (u as any).email });
    }

    vendors.sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));
    return vendors;
  },
});

// List access links (admin only)
export const listAccessLinks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("isActive"), true))
      .first();
    if (!userRole || userRole.role !== "admin") throw new Error("Admin access required");

    const links = await ctx.db.query("accessLinks").collect();
    links.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));

    const linksWithForms = await Promise.all(
      links.map(async (link) => {
        const form = await ctx.db.get(link.formId);
        const createdBy = await ctx.db.get(link.createdBy);
        return {
          ...link,
          form: form ? { refId: form.refId, status: form.status } : null,
          createdBy: createdBy ? { name: (createdBy as any).name, email: (createdBy as any).email } : null,
        };
      })
    );

    return linksWithForms;
  },
});