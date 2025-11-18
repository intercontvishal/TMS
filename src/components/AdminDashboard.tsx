import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { FormViewer } from "./FormViewer";

interface User {
  _id: string;
  name?: string;
  email?: string;
  role: "employee" | "admin" | "vendor" | "order_placer" | "transporter" | null;
  permissions: string[];
}

interface AdminDashboardProps {
  user: User;
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "forms" | "users" | "activity">("overview");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [pwdInputs, setPwdInputs] = useState<Record<string, { pwd: string; confirm: string }>>({});
  
  const forms = useQuery(api.forms.listForms, {}) || [];
  const users = useQuery(api.users.listUsersWithRoles) || [];
  const recentActivity = useQuery(api.audit.getRecentActivity, { limit: 10 }) || [];
  const assignRole = useMutation(api.users.assignRole);
  const resetVendorPassword = useAction(api.users.adminSetVendorPassword);

  const stats = {
    total: forms.length,
    pending: forms.filter(f => f.status === "pending").length,
    completed: forms.filter(f => f.status === "completed").length,
    thisMonth: forms.filter(f => {
      const formDate = new Date(f.createdAt);
      const now = new Date();
      return formDate.getMonth() === now.getMonth() && 
             formDate.getFullYear() === now.getFullYear();
    }).length,
  };

  const handleAssignRole = async (userId: string, role: "employee" | "admin" | "vendor" | "order_placer" | "transporter") => {
    try {
      await assignRole({ userId: userId as any, role });
      toast.success("Role assigned successfully");
    } catch (error) {
      toast.error("Failed to assign role: " + (error as Error).message);
    }
  };

  if (selectedFormId) {
    return (
      <FormViewer 
        formId={selectedFormId} 
        onBack={() => setSelectedFormId(null)}
        user={user}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Manage the transport management system</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "overview", label: "Overview" },
            { id: "forms", label: "All Forms" },
            { id: "users", label: "User Management" },
            { id: "activity", label: "Recent Activity" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">{stats.total}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Forms</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 font-semibold">{stats.pending}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pending</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.pending}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-semibold">{stats.completed}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.completed}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-semibold">{stats.thisMonth}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">This Month</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.thisMonth}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Forms */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Forms</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {forms.slice(0, 5).map((form) => (
                <div key={form._id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{form.refId}</p>
                      <p className="text-sm text-gray-500">
                        {form.bookingDetails.stuffingPlace} → {form.bookingDetails.pod}
                      </p>
                      <p className="text-xs text-gray-400">
                        Created {new Date(form.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        form.status === "completed" 
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {form.status}
                      </span>
                      <button
                        onClick={() => setSelectedFormId(form._id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "forms" && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">All Forms</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {forms.map((form) => (
              <div key={form._id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{form.refId}</p>
                        <p className="text-sm text-gray-500">
                          {form.transportDetails?.vehicleNumber ?? "-"} • {form.bookingDetails.shipperName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">
                          {form.bookingDetails.stuffingPlace} → {form.bookingDetails.pod}
                        </p>
                        <p className="text-xs text-gray-400">
                          Created {new Date(form.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        form.status === "completed" 
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {form.status}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        {form.completionStatus.overallComplete ? "Complete" : "In Progress"}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFormId(form._id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">User Management</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {users.map((user) => (
              <div key={user._id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.name || "Unnamed User"}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === "admin" ? "bg-red-100 text-red-800" :
                      user.role === "employee" ? "bg-blue-100 text-blue-800" :
                      user.role === "vendor" ? "bg-purple-100 text-purple-800" :
                      user.role === "transporter" ? "bg-indigo-100 text-indigo-800" :
                      user.role === "order_placer" ? "bg-green-100 text-green-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {user.role || "No Role"}
                    </span>
                    <select
                      value={user.role || ""}
                      onChange={(e) => handleAssignRole(user._id, e.target.value as any)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="">Select Role</option>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="vendor">Vendor</option>
                      <option value="transporter">Transporter</option>
                      <option value="order_placer">Order Placer</option>
                    </select>
                  </div>
                </div>
                {user.role === "vendor" && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="password"
                      placeholder="New password (min 8 chars)"
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                      value={pwdInputs[user._id]?.pwd || ""}
                      onChange={(e) => setPwdInputs((prev) => ({
                        ...prev,
                        [user._id]: { pwd: e.target.value, confirm: prev[user._id]?.confirm || "" },
                      }))}
                    />
                    <input
                      type="password"
                      placeholder="Confirm password"
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                      value={pwdInputs[user._id]?.confirm || ""}
                      onChange={(e) => setPwdInputs((prev) => ({
                        ...prev,
                        [user._id]: { pwd: prev[user._id]?.pwd || "", confirm: e.target.value },
                      }))}
                    />
                    <button
                      className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                      onClick={async () => {
                        const pwd = pwdInputs[user._id]?.pwd || "";
                        const confirm = pwdInputs[user._id]?.confirm || "";
                        if (!pwd || pwd.length < 8) {
                          toast.error("Password must be at least 8 characters long");
                          return;
                        }
                        if (pwd !== confirm) {
                          toast.error("Passwords do not match");
                          return;
                        }
                        try {
                          await resetVendorPassword({ targetUserId: user._id as any, newPassword: pwd });
                          toast.success("Vendor password updated and sessions invalidated");
                          setPwdInputs((prev) => ({ ...prev, [user._id]: { pwd: "", confirm: "" } }));
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                    >
                      Set Password
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recentActivity.map((log) => (
              <div key={log._id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.user?.name || "Unknown User"} {log.action}d {log.entityType}
                    </p>
                    <p className="text-sm text-gray-500">Entity ID: {log.entityId}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    log.action === "create" ? "bg-green-100 text-green-800" :
                    log.action === "update" ? "bg-blue-100 text-blue-800" :
                    log.action === "delete" ? "bg-red-100 text-red-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {log.action}
                  </span>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
