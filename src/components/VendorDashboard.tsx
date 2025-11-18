import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
// import{vendor} from "../../convex/vendor";
import { FormViewer } from "./FormViewer";
import { toast } from "sonner";

//vendor_1@intercont.com
//Vendor@11
interface User {
  _id: string;
  name?: string;
  email?: string;
  role: "employee" | "admin" | "vendor" | "order_placer" | "transporter" | null;
  permissions: string[];
}

interface VendorDashboardProps {
  user: User;
}

type AssignedForm = {
  formId: { id: string } | string;
  refId: string;
  total: number;       // total vehicles assigned to this vendor for the form
  submitted: number;   // how many of those vehicles the vendor has submitted
  createdAt?: number;
};


export function VendorDashboard({ user }: VendorDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "assigned">("overview");
  const [refIdToOpen, setRefIdToOpen] = useState("");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  // Pull only forms that have vehicles assigned to this vendor
  const assignedForms = (useQuery(api.vendor.listAssignedForms, {}) || []) as unknown as AssignedForm[];
  const notifications = useQuery(api.notifications.getNotifications, { limit: 10 }) || [];
  const markAsRead = useMutation(api.notifications.markAsRead);
  const seenNotifIds = useRef<Set<string>>(new Set());

  // Derived metrics for Overview
  const { totalAssignedVehicles, totalSubmittedVehicles } = useMemo(() => {
    const totals = assignedForms.reduce(
      (acc, f) => {
        acc.totalAssignedVehicles += f.total || 0;
        acc.totalSubmittedVehicles += f.submitted || 0;
        return acc;
      },
      { totalAssignedVehicles: 0, totalSubmittedVehicles: 0 }
    );
    return totals;
  }, [assignedForms]);

  const handleOpenByRefId = () => {
    const ref = refIdToOpen.trim();
    if (!ref) return;
    const match = assignedForms.find((f) => f.refId === ref);
    if (match) {
      const id = typeof match.formId === "string" ? match.formId : (match.formId as any)?.id;
      if (id) setSelectedFormId(id);
    }
  };

  // Popup new assignment notifications
  useEffect(() => {
    for (const n of notifications as any[]) {
      if (n.type === "form_assigned" && !n.isRead && !seenNotifIds.current.has(n._id)) {
        seenNotifIds.current.add(n._id);
        toast.info(n.title || "New assignment", {
          description: n.message,
          action: {
            label: "Open",
            onClick: () => {
              const formId = (n.data && (n.data.formId?.id || n.data.formId)) || undefined;
              if (formId) setSelectedFormId(formId);
              markAsRead({ notificationId: n._id });
            },
          },
        });
      }
    }
  }, [notifications]);

  if (selectedFormId) {
    return <FormViewer formId={selectedFormId} onBack={() => setSelectedFormId(null)} user={user} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Dashboard</h1>
        <p className="text-gray-600">View assigned forms and fill Transport Details</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "overview", label: "Overview" },
            { id: "assigned", label: "Assigned Forms" }, // renamed for clarity
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
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Welcome, {user.name || "Vendor"}</h3>
            <p className="text-gray-600 mb-4">
              Forms assigned to you will appear below. You can open a form and fill only the “Transport Details”
              for your vehicles. Once submitted, details can’t be changed.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Assigned Vehicles</h4>
                <p className="text-2xl font-bold text-blue-600">{totalAssignedVehicles}</p>
                <p className="text-sm text-gray-500">Total vehicles assigned across your forms</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Submitted Vehicles</h4>
                <p className="text-2xl font-bold text-green-600">{totalSubmittedVehicles}</p>
                <p className="text-sm text-gray-500">You’ve submitted Transport Details for these</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "assigned" && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between flex-col sm:flex-row gap-3">
              <h3 className="text-lg font-medium text-gray-900">Assigned Forms</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  value={refIdToOpen}
                  onChange={(e) => setRefIdToOpen(e.target.value)}
                  placeholder="Enter Reference ID"
                  className="border rounded px-3 py-2 w-full sm:w-64"
                />
                <button
                  onClick={handleOpenByRefId}
                  disabled={!refIdToOpen.trim()}
                  className={`px-4 py-2 rounded text-white ${
                    refIdToOpen.trim() ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  Open
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            {!assignedForms ? (
              <p>Loading…</p>
            ) : assignedForms.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-500">No forms assigned yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Forms will appear here when an employee assigns vehicles to you
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedForms.map((f) => {
                  const key = typeof f.formId === "string" ? f.formId : f.formId?.id || f.refId;
                  const percent =
                    f.total && f.total > 0 ? Math.min(100, Math.round((f.submitted / f.total) * 100)) : 0;
                  return (
                    <div key={key} className="border rounded p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{f.refId}</div>
                        <div className="text-sm text-gray-600">
                          Submitted {f.submitted} of {f.total}
                        </div>
                        <div className="mt-2 w-full max-w-md">
                          <div className="w-full bg-gray-200 rounded h-2">
                            <div
                              className="bg-blue-600 h-2 rounded"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{percent}% complete</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const id = typeof f.formId === "string" ? (f.formId as string) : (f.formId as any)?.id;
                          if (id) setSelectedFormId(id);
                        }}
                        className="px-3 py-2 border rounded hover:bg-gray-50 text-center"
                      >
                        Open
                      </button>
                      </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}