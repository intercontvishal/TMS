// // convex/vendorUsers.ts
// import { query } from "./_generated/server";
// import { v } from "convex/values";

// export const list = query({
//   args: {
//     includeInactive: v.optional(v.boolean()),
//     search: v.optional(v.string()),
//   },
//   handler: async (ctx, { includeInactive, search }) => {
//     // 1) Find all userRoles rows where role = "vendor"
//     const roles = await ctx.db
//       .query("userRoles")
//       .withIndex("by_role", (q) => q.eq("role", "vendor"))
//       .collect();

//     // 2) Filter isActive unless explicitly requested and dedupe by userId
//     const vendorUserIds = new Set(
//       roles
//         .filter((r) => (includeInactive ? true : r.isActive))
//         .map((r) => r.userId)
//     );

//     // 3) Load user docs
//     const users = await Promise.all(
//       [...vendorUserIds].map(async (userId) => {
//         const u = await ctx.db.get(userId);
//         if (!u) return null;

//         // Normalize name for the dropdown
//         const name =
//           (u as any).name ??
//           (u as any).displayName ??
//           (u as any).email ??
//           "Unnamed";

//         return {
//           _id: u._id,             // Id<"users">
//           name,
//           email: (u as any).email ?? "",
//           phone: (u as any).phone ?? "",
//         };
//       })
//     );

//     let list = users.filter(Boolean) as {
//       _id: string;
//       name: string;
//       email: string;
//       phone: string;
//     }[];

//     // 4) Optional search
//     if (search?.trim()) {
//       const s = search.toLowerCase();
//       list = list.filter(
//         (u) =>
//           u.name.toLowerCase().includes(s) ||
//           (u.email ?? "").toLowerCase().includes(s) ||
//           (u.phone ?? "").toLowerCase().includes(s)
//       );
//     }

//     // 5) Sort by name for nicer UX
//     list.sort((a, b) => a.name.localeCompare(b.name));

//     return list;
//   },
// });