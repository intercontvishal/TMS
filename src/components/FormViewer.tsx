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
  const submitForm = useMutation(api.forms.submitForm);

  const handleSubmitForm = async () => {
    try {
      await submitForm({ formId: formId as any });
      toast.success("Form submitted successfully!");
    } catch (error) {
      toast.error("Failed to submit form: " + (error as Error).message);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transport Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Transport Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Vehicle Number:</span>
                <span className="ml-2">{form.transportDetails.vehicleNumber}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Driver:</span>
                <span className="ml-2">{form.transportDetails.driverName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Mobile:</span>
                <span className="ml-2">{form.transportDetails.driverMobile}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Contact Person:</span>
                <span className="ml-2">{form.transportDetails.ContactPerson}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Route:</span>
                <span className="ml-2">{form.bookingDetails.stuffingPlace} → {form.bookingDetails.cleranceLocation}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Stuffing date:</span>
                <span className="ml-2">{new Date(form.bookingDetails.stuffingDate).toLocaleString()}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Contact Person Mobile:</span>
                <span className="ml-2">{form.transportDetails.ContactPersonMobile}</span>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Booking Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Reference:</span>
                <span className="ml-2">{form.bookingDetails.bookingNo}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Shipper Name:</span>
                <span className="ml-2">{form.bookingDetails.shipperName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Contact:</span>
                <span className="ml-2">{form.bookingDetails.shipperName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Catagory:</span>
                <span className="ml-2">{form.bookingDetails.catagory}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Quantity:</span>
                <span className="ml-2">₹{form.bookingDetails.vehicalQty.toLocaleString()}</span>
              </div>
              {/* {form.bookingDetails.insuranceDetails && (
                <div>
                  <span className="font-medium text-gray-700">Insurance:</span>
                  <span className="ml-2">{form.bookingDetails.insuranceDetails}</span>
                </div>
              )}
              {form.bookingDetails.specialInstructions && (
                <div>
                  <span className="font-medium text-gray-700">Instructions:</span>
                  <span className="ml-2">{form.bookingDetails.specialInstructions}</span>
                </div>
              )} */}
            </div>
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
