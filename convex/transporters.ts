import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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