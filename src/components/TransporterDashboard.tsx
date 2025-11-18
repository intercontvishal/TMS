import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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

interface TransporterDashboardProps {
  user: User;
}

type Vendor = {
  _id: string;
  name: string;
};

type Booking = {
  _id: string;
  _creationTime: number;
  bookingNo: string;
  shipperName: string;
  vehicalQty: number;
  pod: string;
  stuffingDate: number;
  status: "pending" | "in_progress" | "completed";
  vendorAllocations: { vendorId: string; vendorName: string; vehicleCount: number }[];
};

type AssignedForm = {
  formId: { id: string } | string;
  refId: string;
  total: number;
  submitted: number;
  createdAt?: number;
};

export function TransporterDashboard({ user }: TransporterDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "bookings">("overview");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [vendorAllocations, setVendorAllocations] = useState<Record<string, number>>({});
  const [lockedBookings, setLockedBookings] = useState<Record<string, boolean>>({});

  // Data
  const bookings = (useQuery(api.forms.listBookings, {}) || []) as unknown as Booking[];
  const vendors = (useQuery(api.users.getVendors, {}) || []) as unknown as Vendor[];
  const notifications = useQuery(api.notifications.getNotifications, { limit: 10 }) || [];
  const overviewStats = (useQuery(api.forms.getTransporterOverviewStats, {}) || {
    totalAssignedVehicles: 0,
    totalSubmittedVehicles: 0,
  }) as { totalAssignedVehicles: number; totalSubmittedVehicles: number };

  const markAsRead = useMutation(api.notifications.markAsRead);
  const updateBookingAllocations = useMutation(api.forms.updateBookingAllocations);

  const seenNotifIds = useRef<Set<string>>(new Set());

  // Metrics for Overview (derived from bookings)
  const totalForms = bookings.length;
  const completedAllocations = useMemo(() => {
    return bookings.reduce((count, b) => {
      const allocated = (b.vendorAllocations || []).reduce((s, va) => s + (va.vehicleCount || 0), 0);
      const done = (b.vehicalQty || 0) > 0 && allocated >= (b.vehicalQty || 0);
      return count + (done ? 1 : 0);
    }, 0);
  }, [bookings]);
  const pendingAllocations = Math.max(0, totalForms - completedAllocations);

  // Notification handling for new bookings and form assignments
  useEffect(() => {
    for (const n of notifications as any[]) {
      if ((n.type === "booking_created" || n.type === "form_assigned") && !n.isRead && !seenNotifIds.current.has(n._id)) {
        seenNotifIds.current.add(n._id);
        const title = n.type === "booking_created" ? "New Booking Created" : (n.title || "New Assignment");
        toast.info(title, {
          description: n.message,
          action: {
            label: "Open",
            onClick: () => {
              const formId = (n.data && (n.data.formId?.id || n.data.formId)) || undefined;
              if (formId) {
                setSelectedFormId(String(formId));
              } else if (n.type === "booking_created") {
                setActiveTab("bookings");
              }
              markAsRead({ notificationId: n._id });
            },
          },
        });
      }
    }
  }, [notifications]);

  // Prefill vendor allocations when a booking is opened
  useEffect(() => {
    if (!selectedBooking) return;
    setVendorAllocations((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const va of selectedBooking.vendorAllocations || []) {
        if (!va.vendorId) continue;
        next[`${selectedBooking._id}_${va.vendorId}`] = va.vehicleCount || 0;
      }
      return next;
    });
  }, [selectedBooking]);

  // no quick-open by reference in transporter view; forms appear in bookings

  const handleAllocationChange = (bookingId: string, vendorId: string, count: number) => {
    if (lockedBookings[bookingId]) return; // prevent edits when locked
    setVendorAllocations((prev) => {
      const key = `${bookingId}_${vendorId}`;
      const totalAllowed = (() => {
        const b = selectedBooking && selectedBooking._id === bookingId ? selectedBooking : bookings.find((x) => x._id === bookingId);
        return b ? (b.vehicalQty || 0) : 0;
      })();
      let othersSum = 0;
      for (const k in prev) {
        if (k.startsWith(`${bookingId}_`) && k !== key) {
          othersSum += prev[k] || 0;
        }
      }
      const maxForThis = Math.max(0, totalAllowed - othersSum);
      const clamped = Math.max(0, Math.min(count || 0, maxForThis));
      return { ...prev, [key]: clamped };
    });
  };

  const saveVendorAllocations = async (booking: Booking) => {
    try {
      const confirmed = window.confirm("Are you sure? Once allocations are saved, they cannot be changed.");
      if (!confirmed) return;
      const allocations = vendors.map((vendor) => ({
        vendorId: vendor._id as any,
        vehicleCount: vendorAllocations[`${booking._id}_${vendor._id}`] || 0,
      }));
      await updateBookingAllocations({
        bookingId: booking._id as any,
        allocations: allocations as any,
      });
      setLockedBookings((prev) => ({ ...prev, [booking._id]: true }));
      toast.success("Vendor allocations updated and locked");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (selectedFormId) {
    return <FormViewer formId={selectedFormId} onBack={() => setSelectedFormId(null)} user={user} />;
  }

  if (selectedBooking) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button className="text-gray-600 hover:text-gray-800" onClick={() => setSelectedBooking(null)}>
            ← Back to Bookings
          </button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-col sm:flex-row">
            <h2 className="text-lg font-semibold text-gray-900">Booking Details</h2>
            <div className="flex gap-2">
              <button className="px-3 py-2 border rounded-md bg-white hover:bg-gray-50" onClick={() => setSelectedFormId(String(selectedBooking._id))}>
                Open Full Form
              </button>
            </div>
          </div>
          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-medium">Booking Number: {selectedBooking.bookingNo}</p>
              <p>Shipper: {selectedBooking.shipperName}</p>
              <p>POD: {selectedBooking.pod}</p>
              <p>Stuffing Date: {new Date(selectedBooking.stuffingDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p>Status: {selectedBooking.status}</p>
              <p>Total Vehicles: {selectedBooking.vehicalQty}</p>
              <p>
                Allocation Status: {lockedBookings[selectedBooking._id] ? (
                  <span className="text-green-600 font-medium">Allocation Completed</span>
                ) : (
                  <span className="text-yellow-600 font-medium">Allocation Pending</span>
                )}
              </p>
            </div>
          </div>

          <div className="px-6 pb-6">
            <h3 className="font-medium mb-2">Vendor Allocations</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Vendor</th>
                    <th className="p-2">Vehicles Allocated</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr key={vendor._id} className="border-t">
                      <td className="p-2">{vendor.name}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          value={vendorAllocations[`${selectedBooking._id}_${vendor._id}`] || 0}
                          onChange={(e) =>
                            handleAllocationChange(selectedBooking._id, vendor._id, parseInt(e.target.value) || 0)
                          }
                          disabled={!!lockedBookings[selectedBooking._id]}
                          className="w-24 border rounded px-2 py-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(() => {
              const totalAllowed = selectedBooking.vehicalQty || 0;
              let sum = 0;
              for (const k in vendorAllocations) {
                if (k.startsWith(`${selectedBooking._id}_`)) sum += vendorAllocations[k] || 0;
              }
              const overCap = sum > totalAllowed;
              return (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">Allocated {sum} of {totalAllowed}</div>
                  <button
                    className={`px-4 py-2 rounded text-white ${overCap || lockedBookings[selectedBooking._id] ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                    disabled={overCap || !!lockedBookings[selectedBooking._id]}
                    onClick={() => saveVendorAllocations(selectedBooking)}
                  >
                    {lockedBookings[selectedBooking._id] ? "Allocations Locked" : "Save Allocations"}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Transporter Dashboard</h1>
        <p className="text-gray-600">View assigned forms, allocate vendors to bookings, and track progress.</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { label: "Overview", value: "overview" },
            { label: "Bookings", value: "bookings" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.value
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
                    <span className="text-blue-600 font-semibold">{totalForms}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Forms</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalForms}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-semibold">{completedAllocations}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Completed Allocations</p>
                  <p className="text-2xl font-semibold text-gray-900">{completedAllocations}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 font-semibold">{pendingAllocations}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pending Allocations</p>
                  <p className="text-2xl font-semibold text-gray-900">{pendingAllocations}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Overview list intentionally minimal for clarity */}
        </div>
      )}

      {activeTab === "bookings" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-4">All Bookings</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Booking No</th>
                  <th className="p-2">Shipper</th>
                  <th className="p-2">Vehicles</th>
                  <th className="p-2">POD</th>
                  <th className="p-2">Stuffing Date</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const allocated = (b.vendorAllocations || []).reduce((sum, va) => sum + (va.vehicleCount || 0), 0);
                  const allocationCompleted = (b.vehicalQty || 0) > 0 && allocated >= (b.vehicalQty || 0);
                  return (
                    <tr key={b._id} className="border-t">
                      <td className="p-2">{b.bookingNo}</td>
                      <td className="p-2">{b.shipperName}</td>
                      <td className="p-2">{b.vehicalQty}</td>
                      <td className="p-2">{b.pod}</td>
                      <td className="p-2">{new Date(b.stuffingDate).toLocaleDateString()}</td>
                      <td className="p-2">
                        {allocationCompleted ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Allocation already completed
                          </span>
                        ) : (
                          b.status.replace("_", " ")
                        )}
                      </td>
                      <td className="p-2">
                        {!allocationCompleted && (
                          <button className="px-3 py-1 border rounded mr-2" onClick={() => setSelectedBooking(b)}>
                            View
                          </button>
                        )}
                        <button className="px-3 py-1 border rounded" onClick={() => setSelectedFormId(String(b._id))}>
                          Open Form
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {bookings.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-gray-500" colSpan={7}>
                      No bookings found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assigned Forms section removed per requirement */}
    </div>
  );
}