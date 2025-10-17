import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { FormCreator } from "./FormCreator";
import { FormViewer } from "./FormViewer";

interface User {
  _id: string;
  name?: string;
  email?: string;
  role: "employee" | "admin" | "vendor" | "order_placer" | null;
  permissions: string[];
}

interface EmployeeDashboardProps {
  user: User;
}

export function EmployeeDashboard({ user }: EmployeeDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "create" | "forms">("overview");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  
  const forms = useQuery(api.forms.listForms, {}) || [];
  const stats = {
    total: forms.length,
    pending: forms.filter(f => f.status === "pending").length,
    completed: forms.filter(f => f.status === "completed").length,
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
        <h1 className="text-2xl font-bold text-gray-900">Employee Dashboard</h1>
        <p className="text-gray-600">Manage your transport forms and documentation</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "overview", label: "Overview" },
            { id: "create", label: "Create Form" },
            { id: "forms", label: "My Forms" },
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        {form.bookingDetails.stuffingPlace} → {form.bookingDetails.cleranceLocation}
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
              {forms.length === 0 && (
                <div className="px-6 py-8 text-center">
                  <p className="text-gray-500">No forms created yet</p>
                  <button
                    onClick={() => setActiveTab("create")}
                    className="mt-2 text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Create your first form
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "create" && (
        <FormCreator onFormCreated={(formId) => {
          setSelectedFormId(formId);
          toast.success("Form created successfully!");
        }} />
      )}

      {activeTab === "forms" && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">My Forms</h3>
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
                          {form.transportDetails.vehicleNumber} • {form.bookingDetails.shipperName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">
                          {form.bookingDetails.stuffingPlace} → {form.bookingDetails.cleranceLocation}
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
            {forms.length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-500">No forms found</p>
                <button
                  onClick={() => setActiveTab("create")}
                  className="mt-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  Create your first form
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
