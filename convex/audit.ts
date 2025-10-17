import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Log audit action (internal)
export const logAction = internalMutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    userId: v.id("users"),
    changes: v.optional(v.object({
      before: v.optional(v.any()),
      after: v.optional(v.any()),
    })),
    metadata: v.optional(v.object({
      userAgent: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      requestId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      userId: args.userId,
      timestamp: Date.now(),
      changes: args.changes,
      metadata: args.metadata,
    });
  },
});

// Get audit logs for entity (admin only)
export const getAuditLogs = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
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
    
    if (!userRole || userRole.role !== "admin") {
      throw new Error("Admin access required");
    }
    
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) => q.eq("entityType", args.entityType).eq("entityId", args.entityId))
      .order("desc")
      .collect();
    
    // Get user details for each log
    const logsWithUsers = await Promise.all(
      logs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          ...log,
          user: user ? { name: user.name, email: user.email } : null,
        };
      })
    );
    
    return logsWithUsers;
  },
});

// Get recent activity (admin dashboard)
export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
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
    
    if (!userRole || userRole.role !== "admin") {
      throw new Error("Admin access required");
    }
    
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      .order("desc")
      .take(args.limit || 50);
    
    // Get user details for each log
    const logsWithUsers = await Promise.all(
      logs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          ...log,
          user: user ? { name: user.name, email: user.email } : null,
        };
      })
    );
    
    return logsWithUsers;
  },
});
