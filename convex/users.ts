import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";





export const getVendors = query({
  handler: async (ctx) => {
    // 1. Find all userRole documents where the role is 'vendor'.
    // We use the 'by_role' index you defined for efficiency.
    const vendorRoles = await ctx.db
      .query("userRoles")
      .withIndex("by_role", (q) => q.eq("role", "vendor"))
      // .filter((q) => q.eq(q.field("isActive"), true)) // Optional: only fetch active vendors
      .collect();

    // 2. The `userRoles` table only has `userId`. We need the user's name.
    // We map over the roles and fetch the full user document for each one.
    const vendors = await Promise.all(
      vendorRoles.map(async (role) => {
        // Assume you have a `users` table with a `name` field.
        const user = await ctx.db.get(role.userId);
        
        if (user) {
          // Return a clean object with only the data needed for the dropdown.
          return {
            _id: user._id,   // This will be the value of the <option>
            name: user.name, // This will be the text displayed in the dropdown
          };
        }
        return null; // Handle cases where a user might be deleted but the role remains
      })
    );
    
    // 3. Filter out any null results to ensure a clean array.
    return vendors.filter((v): v is { _id: any; name: string } => v !== null);
  },
});

// Get current user with role
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    return {
      ...user,
      role: userRole?.role || null,
      permissions: userRole?.permissions || [],
    };
  },
});



// Check if user has permission
export const hasPermission = query({
  args: { permission: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }
    
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!userRole) {
      return false;
    }
    
    return userRole.permissions.includes(args.permission) || userRole.role === "admin";
  },
});

// Assign role to user (admin only)
export const assignRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("employee"), v.literal("admin"), v.literal("vendor"), v.literal("order_placer")),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }
    
    // Check if current user is admin
    const currentUserRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", currentUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!currentUserRole || currentUserRole.role !== "admin") {
      throw new Error("Insufficient permissions");
    }
    
    // Deactivate existing roles
    const existingRoles = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    for (const role of existingRoles) {
      await ctx.db.patch(role._id, { isActive: false });
    }
    
    // Define permissions based on role
    const permissions = {
      employee: ["forms.create", "forms.edit", "forms.view_own", "photos.upload"],
      admin: ["*"], // All permissions
      vendor: ["photos.upload", "forms.view_assigned"],
      order_placer: ["forms.view_readonly"],
    };
    
    // Create new role
    await ctx.db.insert("userRoles", {
      userId: args.userId,
      role: args.role,
      permissions: permissions[args.role],
      assignedBy: currentUserId,
      isActive: true,
    });
    
    return { success: true };
  },
});




// Initialize default users and roles (public for demo)
export const initializeDefaultUsers = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already initialized
    const existingConfig = await ctx.db
      .query("systemConfig")
      .withIndex("by_key", (q) => q.eq("key", "users_initialized"))
      .first();
    
    if (existingConfig) {
      return { message: "Users already initialized" };
    }
    
    // Create default users (these would be created through sign-up in real app)
    const defaultUsers = [
      { name: "Akshay Kumar", email: "akshay@intercont.com", role: "employee" as const },
      { name: "Gautam Singh", email: "gautam@intercont.com", role: "employee" as const },
      { name: "Admin User", email: "admin@intercont.com", role: "admin" as const },
      { name: "Vendor User", email: "vendor@intercont.com", role: "vendor" as const },
      { name: "Order Placer", email: "orders@intercont.com", role: "order_placer" as const },
    ];
    
    for (const userData of defaultUsers) {
      // In a real app, users would be created through auth sign-up
      // This is just for demo purposes
      const userId = await ctx.db.insert("users", {
        name: userData.name,
        email: userData.email,
      });
      
      const permissions = {
        employee: ["forms.create", "forms.edit", "forms.view_own", "photos.upload"],
        admin: ["*"],
        vendor: ["photos.upload", "forms.view_assigned"],
        order_placer: ["forms.view_readonly"],
      };
      
      await ctx.db.insert("userRoles", {
        userId,
        role: userData.role,
        permissions: permissions[userData.role],
        isActive: true,
      });
    }


    
    // Get the admin user ID for the system config
    const adminUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), "admin@intercont.com"))
      .first();
    
    // Mark as initialized
    await ctx.db.insert("systemConfig", {
      key: "users_initialized",
      value: true,
      updatedBy: adminUser!._id, // Use the actual admin user ID
      updatedAt: Date.now(),
    });
    
    return { message: "Default users created successfully" };
  },
});

// List users with roles (admin only)
export const listUsersWithRoles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    const currentUserRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!currentUserRole || currentUserRole.role !== "admin") {
      throw new Error("Insufficient permissions");
    }
    
    const users = await ctx.db.query("users").collect();
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const role = await ctx.db
          .query("userRoles")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
        
        return {
          ...user,
          role: role?.role || null,
          permissions: role?.permissions || [],
        };
      })
    );
    
    return usersWithRoles;
  },
});
