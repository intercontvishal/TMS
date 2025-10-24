import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { ContainerManager } from "./ContainerManager";
import { PhotoManager } from "./PhotoManager";

interface User {
  _id: string;
  name?: string;
  email?: string;
  role: "employee" | "admin" | "vendor" | "order_placer" | null;
  permissions: string[];
}

interface FormViewerProps {
  formId: string;
  onBack: () => void;
  user: User;
}

export function FormViewer({ formId, onBack, user }: FormViewerProps) {
  const [activeTab, setActiveTab] = useState<"details" | "containers" | "photos">("details");
  
  const form = useQuery(api.forms.getForm, { formId: formId as any });
  const containers = useQuery(api.containers.getContainers, { formId: formId as any }) || [];
  const photos = useQuery(api.photos.getPhotos, { formId: formId as any }) || [];
  const documents = (photos || []).filter((p: any) => p.category === "documents");
  const submitForm = useMutation(api.forms.submitForm);
  const vendorAssignments = user.role === "vendor" ? (useQuery(api.forms.getVendorAssignmentsForForm, { formId: formId as any }) || []) : [];
  const allVehicles = user.role !== "vendor" ? (useQuery(api.forms.getVehiclesForForm, { formId: formId as any }) || []) : [];
  const submitVendorDetails = useMutation(api.forms.vendorSubmitTransportDetails);
  const [vendorEdits, setVendorEdits] = useState<Record<string, any>>({});

  const handleSubmitForm = async () => {
    try {
      await submitForm({ formId: formId as any });
      toast.success("Form submitted successfully!");
    } catch (error) {
      toast.error("Failed to submit form: " + (error as Error).message);
    }
  };

  const handleVendorSubmit = async (veh: any) => {
    try {
      const vid = veh._id as string;
      const data = vendorEdits[vid] || {};
      const depMs = data.estimatedDeparture
        ? new Date(data.estimatedDeparture).getTime()
        : (veh.estimatedDeparture ?? Date.now());
      const arrMs = data.estimatedArrival
        ? new Date(data.estimatedArrival).getTime()
        : (veh.estimatedArrival ?? Date.now());
      await submitVendorDetails({
        vehicleId: vid as any,
        transporterName: data.transporterName ?? veh.transporterName ?? "",
        ContactPerson: data.ContactPerson ?? veh.contactPerson ?? "",
        ContactPersonMobile: data.ContactPersonMobile ?? veh.contactMobile ?? "",
        vehicleNumber: data.vehicleNumber ?? veh.vehicleNumber ?? "",
        driverName: data.driverName ?? veh.driverName ?? "",
        driverMobile: data.driverMobile ?? veh.driverMobile ?? "",
        estimatedDeparture: depMs,
        estimatedArrival: arrMs,
      });
      toast.success("Transport details submitted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!form) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const canEdit = user.role === "admin" || (user.role === "employee" && form.employeeId === user._id);
  const canSubmit = canEdit && form.status === "pending" && form.completionStatus.overallComplete;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Form {form.refId}</h1>
              <p className="text-gray-600">
                {form.bookingDetails.stuffingPlace} → {form.bookingDetails.cleranceLocation}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              form.status === "completed" 
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}>
              {form.status}
            </span>
            {canSubmit && (
              <button
                onClick={handleSubmitForm}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                Submit Form
              </button>
            )}
          </div>
        </div>

        {/* Completion Status */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Completion Status</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${form.completionStatus.transportDetailsComplete ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span>Transport Details</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${form.completionStatus.bookingDetailsComplete ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span>Booking Details</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${form.completionStatus.containersComplete ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span>Containers ({containers.length})</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${form.completionStatus.photosComplete ? "bg-green-500" : "bg-gray-300"}`}></div>
              <span>Photos ({photos.length})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "details", label: "Form Details" },
            { id: "containers", label: `Containers (${containers.length})` },
            { id: "photos", label: `Photos (${photos.length})` },
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
{activeTab === "details" && (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
    <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-bold text-white">
          Booking & Shipment Details
        </h2>
      </div>
    </div>

    <div className="p-4 sm:p-6">
      {/* Grid identical to create form but read-only */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Booking Number /Reference
          </label>
          <input
            type="text"
            value={form.bookingDetails?.bookingNo || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PO Number
          </label>
          <input
            type="text"
            value={form.bookingDetails?.poNumber || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Vehicles / Containers
          </label>
          <input
            type="text"
            value={form.bookingDetails?.vehicalQty ?? ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
          <p className="text-xs text-gray-500 mt-1">
            {(() => {
              const total = Number.parseInt(form.bookingDetails?.vehicalQty || "0", 10) || 0;
              const allocatedCount = (form.allocations || []).reduce((s: number, a: any) => s + (a.count || 0), 0);
              return `Allocated: ${allocatedCount} / ${total}`;
            })()}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Shipper Name
          </label>
          <input
            type="text"
            value={form.bookingDetails?.shipperName || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer
          </label>
          <input
            type="text"
            value={form.bookingDetails?.vessel || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Commodity
          </label>
          <input
            type="text"
            value={form.bookingDetails?.commodity || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pickup Place
          </label>
          <input
            type="text"
            value={form.bookingDetails?.stuffingPlace || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pickup Date
          </label>
          <input
            type="text"
            value={form.bookingDetails?.stuffingDate ? new Date(form.bookingDetails.stuffingDate).toLocaleDateString() : ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Factory
          </label>
          <input
            type="text"
            value={form.bookingDetails?.factory || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Placement Date
          </label>
          <input
            type="text"
            value={form.bookingDetails?.placementDate ? new Date(form.bookingDetails.placementDate).toLocaleDateString() : ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <input
            type="text"
            value={form.bookingDetails?.catagory || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cutoff Place (cleranceLocation)
          </label>
          <input
            type="text"
            value={form.bookingDetails?.cleranceLocation || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cutoff Date
          </label>
          <input
            type="text"
            value={form.bookingDetails?.cutoffDate ? new Date(form.bookingDetails.cutoffDate).toLocaleDateString() : ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div className="md:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Remarks
          </label>
          <input
            type="text"
            value={form.bookingDetails?.remark || ""}
            readOnly
            disabled
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>
      </div>

      {/* Documents Section (DO and Supporting) */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Documents</h3>
          <span className="text-xs text-gray-500">{documents.length} file(s)</span>
        </div>

        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">No documents uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {documents.map((doc: any) => (
              <div key={doc._id} className="border rounded-md bg-white overflow-hidden">
                <div className="aspect-video bg-gray-50 flex items-center justify-center">
                  <img
                    src={doc.url || ""}
                    alt={doc.originalFilename || "Document"}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800 truncate" title={doc.originalFilename}>
                    {doc.originalFilename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(doc.fileSize / 1024).toFixed(1)} KB • {doc.mimeType}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Preview
                    </a>
                    <span className="text-[11px] text-gray-400">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transporter Allocation Section (read-only) */}
      
      
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Transporter Allocations</h3>
        </div>

        <div className="space-y-3">
          {!(form.allocations && form.allocations.length) ? (
            <p className="text-sm text-gray-500">No transporters allocated yet.</p>
          ) : (
            (form.allocations || []).map((a: any) => {
              // const used = (form.vehicles || []).filter((v: any) => v.allocationId === a.id).length;
              return (
                <div key={a.id} className="border rounded-md p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Transporter Name
                      </label>
                      <input
                        type="text"
                        value={a.transporterName || a.vendorName || form.transportDetails?.transporterName || ""}
                        readOnly
                        disabled
                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={a.contactPerson || ""}
                        readOnly
                        disabled
                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Contact Mobile
                      </label>
                      <input
                        type="text"
                        value={a.contactMobile || ""}
                        readOnly
                        disabled
                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Vehicles Allocated
                      </label>
                      <input
                        type="text"
                        value={a.count ?? 0}
                        readOnly
                        disabled
                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700"
                      />
                    </div>
                    <div className="flex items-end gap-2">no actions in view-only </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      

      {user.role !== "vendor" && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Vendor Transport Details</h3>
          </div>
          {!(allVehicles && allVehicles.length) ? (
            <p className="text-sm text-gray-500">No vehicles for this form.</p>
          ) : (
            <div className="space-y-3">
              {(allVehicles as any[]).map((veh: any) => (
                <div key={veh._id} className="border rounded-md p-3 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-gray-500">Transporter: </span>{veh.transporterName || "-"}</div>
                    <div><span className="text-gray-500">Contact: </span>{veh.contactPerson || "-"} {veh.contactMobile ? `(${veh.contactMobile})` : ""}</div>
                    <div><span className="text-gray-500">Vehicle: </span>{veh.vehicleNumber || "-"}</div>
                    <div><span className="text-gray-500">Driver: </span>{veh.driverName || "-"} {veh.driverMobile ? `(${veh.driverMobile})` : ""}</div>
                    <div><span className="text-gray-500">ETD: </span>{veh.estimatedDeparture ? new Date(veh.estimatedDeparture).toLocaleDateString() : "-"}</div>
                    <div><span className="text-gray-500">ETA: </span>{veh.estimatedArrival ? new Date(veh.estimatedArrival).toLocaleDateString() : "-"}</div>
                    <div><span className="text-gray-500">Status: </span>{veh.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {user.role === "vendor" && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Transport Details</h3>
          </div>
          <div className="space-y-4">
            {!(vendorAssignments && vendorAssignments.length) ? (
              <p className="text-sm text-gray-500">No vehicles assigned to you for this form.</p>
            ) : (
              vendorAssignments.map((veh: any) => {
                const vid = veh._id as string;
                const getVal = (k: string, fallback?: any) => (vendorEdits[vid]?.[k] ?? fallback ?? "");
                const disabled = veh.status === "submitted";
                const toInputDate = (ms?: number) => {
                  if (!ms) return "";
                  const d = new Date(ms);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  return `${y}-${m}-${day}`;
                };
                return (
                  <div key={vid} className="border rounded-md p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Transporter Name</label>
                        <input
                          value={getVal("transporterName", veh.transporterName)}
                          onChange={(e) => setVendorEdits((s) => ({ ...s, [vid]: { ...s[vid], transporterName: e.target.value } }))}
                          disabled={disabled}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Contact Person</label>
                        <input
                          value={getVal("ContactPerson", veh.contactPerson)}
                          onChange={(e) => setVendorEdits((s) => ({ ...s, [vid]: { ...s[vid], ContactPerson: e.target.value } }))}
                          disabled={disabled}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Contact Mobile</label>
                        <input
                          value={getVal("ContactPersonMobile", veh.contactMobile)}
                          onChange={(e) => setVendorEdits((s) => ({ ...s, [vid]: { ...s[vid], ContactPersonMobile: e.target.value } }))}
                          disabled={disabled}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Number</label>
                        <input
                          value={getVal("vehicleNumber", veh.vehicleNumber)}
                          onChange={(e) => setVendorEdits((s) => ({ ...s, [vid]: { ...s[vid], vehicleNumber: e.target.value } }))}
                          disabled={disabled}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Driver Name</label>
                        <input
                          value={getVal("driverName", veh.driverName)}
                          onChange={(e) => setVendorEdits((s) => ({ ...s, [vid]: { ...s[vid], driverName: e.target.value } }))}
                          disabled={disabled}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Driver Mobile</label>
                        <input
                          value={getVal("driverMobile", veh.driverMobile)}
                          onChange={(e) => setVendorEdits((s) => ({ ...s, [vid]: { ...s[vid], driverMobile: e.target.value } }))}
                          disabled={disabled}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Departure (ms)</label>
                        <input
                          type="date"
                          value={getVal("estimatedDeparture", toInputDate(veh.estimatedDeparture))}
                          onChange={(e) => setVendorEdits((s) => ({ ...s, [vid]: { ...s[vid], estimatedDeparture: e.target.value } }))}
                          disabled={disabled}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Arrival (ms)</label>
                        <input
                          type="date"
                          value={getVal("estimatedArrival", toInputDate(veh.estimatedArrival))}
                          onChange={(e) => setVendorEdits((s) => ({ ...s, [vid]: { ...s[vid], estimatedArrival: e.target.value } }))}
                          disabled={disabled}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => handleVendorSubmit(veh)}
                        disabled={disabled}
                        className={`px-4 py-2 rounded text-white ${disabled ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                      >
                        {disabled ? "Submitted" : "Submit Details"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  </div>
)}

{activeTab === "containers" && (
  <ContainerManager formId={formId} canEdit={canEdit} />
)}

      {activeTab === "photos" && (
        <PhotoManager formId={formId} containers={containers} canUpload={canEdit || user.role === "vendor"} />
      )}
    </div>
  );
}
