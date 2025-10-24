import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface FormCreatorProps {
  onFormCreated: (formId: string) => void;
}

type Vehicle = {
  allocationId: string;
  transporterName: string;
  ContactPerson: string;
  ContactPersonMobile: string;
  // CargoVolume: string;
  // ContainerType: string;
  // VehicleSize: string;
  // ContainerSize: string;
  // weight: string;
  vehicleNumber: string;
  driverName: string;
  driverMobile: string;
  estimatedDeparture: string; // yyyy-mm-dd
  estimatedArrival: string;   // yyyy-mm-dd
};

type Allocation = {
  id: string; // local row id
  vendorUserId: string; // selected vendor's user id
  contactPerson: string;
  contactMobile: string;
  // containerType: string;
  // vehicleSize: string;
  // containerSize: string;
  // weight: string;
  // cargoVolume: string;
  count: number;
};

// NEW: This type is now correctly placed outside the component.
type DocItem = {
  id: string;
  file: File;
  url: string; // object URL for preview
  kind: "do" | "other";
};

const emptyVehicleDraft = {
  transporterName: "",
  ContactPerson: "",
  ContactPersonMobile: "",
  // ContainerType: "",
  // VehicleSize: "",
  // ContainerSize: "",
  // weight: "",
  // CargoVolume: "",
  vehicleNumber: "",
  driverName: "",
  driverMobile: "",
  estimatedDeparture: "",
  estimatedArrival: "",
};

const genId = () => Math.random().toString(36).slice(2, 10);

const ACCEPTED_DOC_TYPES = "image/*";
const isImageFile = (file: File) => file.type?.startsWith("image/");

export function FormCreator({ onFormCreated }: FormCreatorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch vendor list for dropdown




  const vendors = useQuery(api.users.getVendors, {}); // returns array or undefined while loading
  const createForm = useMutation(api.forms.createForm);
  const createTransportVehiclesForForm = useMutation((api as any).forms.createTransportVehiclesForForm);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const uploadPhoto = useMutation(api.photos.uploadPhoto);

  // Vehicles added across all transporters
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Transporter allocations
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  // Bulk add panel state
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [activeAllocationId, setActiveAllocationId] = useState<string | null>(null);
  const [vehicleDraft, setVehicleDraft] = useState<typeof emptyVehicleDraft>(emptyVehicleDraft);
  const [addCount, setAddCount] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Booking details
  const [bookingDetails, setBookingDetails] = useState({
    bookingNo: "",
    poNumber: "",
    shipperName: "",
    vehicalQty: "",
    // POD: "",
    vessel: "",
    stuffingDate: "",
    cutoffDate: "",
    stuffingPlace: "",
    commodity: "",
    // quantity: "",
    catagory: "",
    placementDate: "",
    factory: "",
    remark: "",
    // containerType: "",
    // cargoWt: "",
    cleranceLocation: "",
    // cleranceContact:"",
  });



  const [isDocSectionOpen, setIsDocSectionOpen] = useState(false);
  const [doDoc, setDoDoc] = useState<DocItem | null>(null);
  const [supportingDocs, setSupportingDocs] = useState<DocItem[]>([]);

  // Document handling functions are now correctly placed here
  const handleDoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) {
      toast.error("Please select an image file (JPEG/PNG/WebP)");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be 10MB or smaller");
      e.target.value = "";
      return;
    }
    if (doDoc?.url) URL.revokeObjectURL(doDoc.url);
    const url = URL.createObjectURL(file);
    setDoDoc({ id: genId(), file, url, kind: "do" });
    e.target.value = "";
  };

  const handleSupportingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const validImages = files.filter((file) => {
      if (!isImageFile(file)) {
        toast.error(`Unsupported file type for ${file.name}. Please select an image.`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Image ${file.name} exceeds 10MB limit.`);
        return false;
      }
      return true;
    });
    const items = validImages.map((file) => ({
      id: genId(),
      file,
      url: URL.createObjectURL(file),
      kind: "other" as const,
    }));
    setSupportingDocs((prev) => [...prev, ...items]);
    e.target.value = "";
  };

  // Helper: generate SHA-256 hash for duplicate detection
  const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  // Helper: upload a single image to Convex and attach to form
  const uploadSingleImage = async (file: File, formId: string) => {
    // Redundant guards; selection already validated
    if (!isImageFile(file)) throw new Error("Only image files are allowed");
    if (file.size > 10 * 1024 * 1024) throw new Error("Image exceeds 10MB");

    const uploadUrl = await generateUploadUrl();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error("Failed to upload to storage");
    const { storageId } = await res.json();

    const fileHash = await generateFileHash(file);
    await uploadPhoto({
      formId: formId as any,
      storageId,
      category: "documents" as any,
      fileHash,
      originalFilename: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  };

  // Helper: upload currently selected DO and supporting images after form creation
  const uploadSelectedDocs = async (formId: string) => {
    // DO (optional here; UI indicates mandatory but we don't block form creation)
    if (doDoc?.file) {
      try {
        await uploadSingleImage(doDoc.file, formId);
      } catch (err) {
        toast.error(`Failed to upload DO: ${(err as Error).message}`);
      }
    }

    // Supporting docs
    for (const d of supportingDocs) {
      try {
        await uploadSingleImage(d.file, formId);
      } catch (err) {
        toast.error(`Failed to upload ${d.file.name}: ${(err as Error).message}`);
      }
    }
  };

  const removeDocItem = (kind: "do" | "other", id?: string) => {
    if (kind === "do") {
      if (doDoc?.url) URL.revokeObjectURL(doDoc.url);
      setDoDoc(null);
    } else {
      setSupportingDocs((prev) => {
        const toRemove = prev.find((d) => d.id === id);
        if (toRemove?.url) URL.revokeObjectURL(toRemove.url);
        return prev.filter((d) => d.id !== id);
      });
    }
  };

  // useEffect hook is now correctly placed here
  useEffect(() => {
    return () => {
      if (doDoc?.url) URL.revokeObjectURL(doDoc.url);
      supportingDocs.forEach((d) => d.url && URL.revokeObjectURL(d.url));
    };
    // The effect depends on these state variables to clean up properly.
  }, [doDoc, supportingDocs]);

  // --- END: ALL STATE AND LOGIC MOVED INSIDE THE COMPONENT ---

  // Derived totals
  const totalVehicles = Number.parseInt(bookingDetails.vehicalQty || "0", 10) || 0;
  const allocatedCount = useMemo(
    () => allocations.reduce((sum, a) => sum + (a.count || 0), 0),
    [allocations]
  );
  const remainingToAllocate = Math.max(0, totalVehicles - allocatedCount);
  const totalVehiclesAdded = vehicles.length;
  const vehiclesByAllocation = (allocationId: string) =>
    vehicles.filter((v) => v.allocationId === allocationId).length;

  // Validation
  function validateVehicleDraft(d: typeof emptyVehicleDraft) {
    const e: Record<string, string> = {};
    if (!d.vehicleNumber?.trim()) e.vehicleNumber = "Vehicle number is required";
    if (!d.driverName?.trim()) e.driverName = "Driver name is required";
    if (!d.driverMobile?.trim()) e.driverMobile = "Driver mobile is required";
    if (!d.estimatedArrival) e.estimatedArrival = "Estimated arrival is required";
    if (!d.estimatedDeparture) e.estimatedDeparture = "Estimated departure is required";
    return e;
  }

  // Auto-number helper: “MH12AB##” → “MH12AB01, MH12AB02, …”
  function withAutoNumber(template: string, idx: number) {
    return template.replace(/(#+)/, (m) => String(idx + 1).padStart(m.length, "0"));
  }

  // Allocation CRUD
  const addAllocationRow = () => {
    if (totalVehicles <= 0) {
      toast.warning("Please set Total Vehicles first.");
      return;
    }
    if (remainingToAllocate <= 0) {
      toast.warning("All vehicles are already allocated.");
      return;
    }
    setAllocations((prev) => [
      ...prev,
      {
        id: genId(),
        vendorUserId: "",
        contactPerson: "",
        contactMobile: "",
        // containerType: "",
        // vehicleSize: "",
        // containerSize: "",
        // weight: "",
        // cargoVolume: "",
        count: Math.min(remainingToAllocate, 1),
      },
    ]);
  };

  const updateAllocation = (id: string, patch: Partial<Allocation>) => {
    setAllocations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const updateAllocationCount = (id: string, nextCountRaw: string) => {
    const nextCount = Math.max(0, Number.parseInt(nextCountRaw || "0", 10) || 0);
    setAllocations((prev) => {
      const othersSum = prev.filter((a) => a.id !== id).reduce((s, a) => s + a.count, 0);
      const maxForThis = Math.max(0, totalVehicles - othersSum);
      return prev.map((a) =>
        a.id === id ? { ...a, count: Math.min(nextCount, maxForThis) } : a
      );
    });
  };

  const removeAllocation = (id: string) => {
    if (vehiclesByAllocation(id) > 0) {
      toast.warning("Remove vehicles assigned to this transporter before deleting the allocation.");
      return;
    }
    setAllocations((prev) => prev.filter((a) => a.id !== id));
  };

  // Open bulk add panel
  const handleOpenAddVehiclesForAllocation = (
    allocation: Allocation & { transporterName: string }
  ) => {
    if (totalVehicles <= 0) {
      toast.warning("Please enter a valid Total Vehicles first.");
      return;
    }
    if (!allocation.vendorUserId) {
      toast.warning("Please select a transporter before adding vehicles.");
      return;
    }
    if (!allocation.count || allocation.count <= 0) {
      toast.warning("Set vehicles count for this transporter.");
      return;
    }

    const already = vehiclesByAllocation(allocation.id);
    const remainingHere = allocation.count - already;
    if (remainingHere <= 0) {
      toast.warning("All vehicles for this transporter are already added.");
      return;
    }

    setActiveAllocationId(allocation.id);
    setVehicleDraft({
      ...emptyVehicleDraft,
      transporterName: allocation.transporterName,
      ContactPerson: allocation.contactPerson,
      ContactPersonMobile: allocation.contactMobile,
      // ContainerType: allocation.containerType,
      // VehicleSize: allocation.vehicleSize,
      // ContainerSize: allocation.containerSize,
      // weight: allocation.weight,
      // CargoVolume: allocation.cargoVolume,
    });
    setErrors({});
    setAddCount(remainingHere);
    setIsAddingVehicle(true);
  };

  const handleSaveVehicles = () => {
    if (!activeAllocationId) return;

    const e = validateVehicleDraft(vehicleDraft);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const allocation = allocations.find((a) => a.id === activeAllocationId)!;
    const selectedVendor = (vendors || []).find((v) => v._id === allocation.vendorUserId);
    const transporterName = selectedVendor?.name || "Unknown";

    const already = vehiclesByAllocation(activeAllocationId);
    const remainingHere = allocation.count - already;
    if (remainingHere <= 0) return;

    const count = Math.max(1, Math.min(addCount || 1, remainingHere));

    const newVehicles: Vehicle[] = Array.from({ length: count }, (_, i) => ({
      allocationId: activeAllocationId,
      transporterName,
      ContactPerson: allocation.contactPerson,
      ContactPersonMobile: allocation.contactMobile,
      // ContainerType: allocation.containerType,
      // VehicleSize: allocation.vehicleSize,
      // ContainerSize: allocation.containerSize,
      // weight: allocation.weight,
      // CargoVolume: allocation.cargoVolume,
      vehicleNumber: vehicleDraft.vehicleNumber.includes("#")
        ? withAutoNumber(vehicleDraft.vehicleNumber, i + already)
        : vehicleDraft.vehicleNumber,
      driverName: vehicleDraft.driverName,
      driverMobile: vehicleDraft.driverMobile,
      estimatedArrival: vehicleDraft.estimatedArrival,
      estimatedDeparture: vehicleDraft.estimatedDeparture,
    }));

    setVehicles((prev) => [...prev, ...newVehicles]);
    setIsAddingVehicle(false);
    setActiveAllocationId(null);
    setVehicleDraft(emptyVehicleDraft);
    setAddCount(1);
    toast.success(`Added ${count} vehicle(s) to ${transporterName}.`);
  };

  const handleRemoveVehicle = (index: number) => {
    setVehicles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submission checks
  const allocationsMatchTotal = totalVehicles > 0 && allocatedCount === totalVehicles;
  const perAllocationSatisfied = allocations.every(
    (a) => vehiclesByAllocation(a.id) === a.count
  );
  const allVehicleCountsOk =
    totalVehicles > 0 &&
    allocationsMatchTotal &&
    perAllocationSatisfied &&
    totalVehiclesAdded === totalVehicles;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (totalVehicles <= 0) {
      toast.error("Please set Total Vehicles.");
      return;
    }
    if (!allocationsMatchTotal) {
      toast.error(`Allocated (${allocatedCount}) must equal Total Vehicles (${totalVehicles}).`);
      return;
    }
    if (!perAllocationSatisfied) {
      toast.error("Each transporter must have the exact number of vehicles added as allocated.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createForm({
        bookingDetails: {
          ...bookingDetails,
          stuffingDate: bookingDetails.stuffingDate
            ? new Date(bookingDetails.stuffingDate).getTime()
            : undefined,
          cutoffDate: bookingDetails.cutoffDate
            ? new Date(bookingDetails.cutoffDate).getTime()
            : undefined,
          placementDate: bookingDetails.placementDate
            ? new Date(bookingDetails.placementDate).getTime()
            : undefined,
        },
        allocations: allocations.map((a) => ({
          vendorUserId: a.vendorUserId,
          contactPerson: a.contactPerson,
          contactMobile: a.contactMobile,
          // ContainerType: a.containerType,
          // VehicleSize: a.vehicleSize,
          // ContainerSize: a.containerSize,
          // weight: a.weight,
          // CargoVolume: a.cargoVolume,
          count: a.count,
        })),
        vehicles: vehicles.map((v) => {
          const parentAllocation = allocations.find((alloc) => alloc.id === v.allocationId);
          return {
            ...v,
            vendorUserId: parentAllocation?.vendorUserId,
            estimatedArrival: new Date(v.estimatedArrival).getTime(),
            estimatedDeparture: new Date(v.estimatedDeparture).getTime(),
          };
        }),
      } as any);

      // Create vendor assignments (transportVehicles) for this form so vendors can fill Transport Details
      try {
        const vehiclesPayload = vehicles.map((v) => {
          const parentAllocation = allocations.find((a) => a.id === v.allocationId);
          return {
            allocationId: v.allocationId,
            assignedTransporterId: parentAllocation?.vendorUserId as any,
            transporterName: v.transporterName,
            contactPerson: v.ContactPerson,
            contactMobile: v.ContactPersonMobile,
            vehicleNumber: v.vehicleNumber || undefined,
            driverName: v.driverName || undefined,
            driverMobile: v.driverMobile || undefined,
            estimatedDeparture: v.estimatedDeparture ? new Date(v.estimatedDeparture).getTime() : undefined,
            estimatedArrival: v.estimatedArrival ? new Date(v.estimatedArrival).getTime() : undefined,
          };
        });
        if (vehiclesPayload.length > 0) {
          await createTransportVehiclesForForm({
            formId: result.formId as any,
            vehicles: vehiclesPayload as any,
          });
        }
      } catch (err) {
        toast.error("Failed to create vendor assignments: " + (err as Error).message);
      }

      // Upload queued document images to this newly created form
      await uploadSelectedDocs(result.formId);

      toast.success(`Form ${result.refId} created successfully!`);
      // Clear document selections after successful upload
      if (doDoc?.url) URL.revokeObjectURL(doDoc.url);
      supportingDocs.forEach((d) => d.url && URL.revokeObjectURL(d.url));
      setDoDoc(null);
      setSupportingDocs([]);

      onFormCreated(result.formId);
    } catch (error) {
      toast.error("Failed to create form: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Booking Details */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Booking & Shipment Details
              </h2>
              <span className="text-xs sm:text-sm text-white/90">
                Added: {totalVehiclesAdded} / {totalVehicles || 0}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Booking Number /Reference
                </label>
                <input
                  type="text"
                  required
                  value={bookingDetails.bookingNo}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, bookingNo: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter booking No"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PO Number
                </label>
                <input
                  type="text"
                  value={bookingDetails.poNumber}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, poNumber: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter PO No"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Vehicles / Containers
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={bookingDetails.vehicalQty}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setBookingDetails((prev) => ({ ...prev, vehicalQty: val }));
                    const nextTotal = Number.parseInt(val || "0", 10) || 0;
                    const currentAllocated = allocations.reduce((s, a) => s + a.count, 0);

                    if (currentAllocated > nextTotal) {
                      toast.warning(
                        `Allocated (${currentAllocated}) exceeds new total (${nextTotal}). Reduce allocations.`
                      );
                    }
                    if (vehicles.length > nextTotal) {
                      toast.warning(
                        `You have ${vehicles.length} vehicle(s) added, but total is ${nextTotal}. Remove extra vehicles or increase total.`
                      );
                    }
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Total Vehicles / Containers"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Allocated: {allocatedCount} / {totalVehicles || 0}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shipper Name
                </label>
                <input
                  type="text"
                  value={bookingDetails.shipperName}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, shipperName: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Shipper Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer
                </label>
                <input
                  type="text"
                  value={bookingDetails.vessel}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, vessel: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Customer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commodity
                </label>
                <input
                  type="text"
                  value={bookingDetails.commodity}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, commodity: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Commodity"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Place
                </label>
                <input
                  type="text"
                  value={bookingDetails.stuffingPlace}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, stuffingPlace: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Pickup place"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Date
                </label>
                <input
                  type="date"
                  value={bookingDetails.stuffingDate}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, stuffingDate: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Pickup Date"
                />
              </div>

              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Container Type
                </label>
                <input
                  type="text"
                  value={bookingDetails.containerType}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, containerType: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Container Type"
                />
              </div> */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Factory
                </label>
                <input
                  type="text"
                  value={bookingDetails.factory}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, factory: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Factory place"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placement Date
                </label>
                <input
                  type="date"
                  value={bookingDetails.placementDate}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, placementDate: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Placement Date"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={bookingDetails.catagory}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, catagory: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Category"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cutoff Place(cleranceLocation)
                </label>
                <input
                  type="text"
                  value={bookingDetails.cleranceLocation}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({
                      ...prev,
                      cleranceLocation: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cutoff place"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cutoff Date
                </label>
                <input
                  type="date"
                  value={bookingDetails.cutoffDate}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, cutoffDate: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Cutoff Date"
                />
              </div>



              <div className="md:col-span-2 lg:col-span-3">
                <button
                  type="button"
                  onClick={() => setIsDocSectionOpen((s) => !s)}
                  className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                >
                  {isDocSectionOpen ? "Hide Documents" : "Add Documents"}
                </button>
              </div>

              {isDocSectionOpen && (
                <div className="md:col-span-2 lg:col-span-3 border rounded-lg p-4 bg-gray-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800">Upload Documents</h4>
                    <span className="text-xs text-gray-500">
                      DO is mandatory; others are optional.
                    </span>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Delivery Order (DO) <span className="text-red-500">*</span>
                    </label>
                    {!doDoc ? (
                      <input
                        type="file"
                        accept={ACCEPTED_DOC_TYPES}
                        onChange={handleDoUpload}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    ) : (
                      <div className="border rounded-md p-3 bg-white flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{doDoc.file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(doDoc.file.size / 1024).toFixed(1)} KB • {doDoc.file.type || "Unknown type"}
                          </p>
                          {isImageFile(doDoc.file) && (
                            <img
                              src={doDoc.url}
                              alt="DO preview"
                              className="mt-2 h-20 w-auto rounded border"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={doDoc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Preview
                          </a>
                          <button
                            type="button"
                            onClick={() => removeDocItem("do")}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Other Supporting Documents (Optional)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept={ACCEPTED_DOC_TYPES}
                      onChange={handleSupportingUpload}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    {supportingDocs.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {supportingDocs.map((d) => (
                          <div
                            key={d.id}
                            className="border rounded-md p-3 bg-white flex items-start justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{d.file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(d.file.size / 1024).toFixed(1)} KB • {d.file.type || "Unknown type"}
                              </p>
                              {isImageFile(d.file) && (
                                <img
                                  src={d.url}
                                  alt="Preview"
                                  className="mt-2 h-16 w-auto rounded border"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <a
                                href={d.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Preview
                              </a>
                              <button
                                type="button"
                                onClick={() => removeDocItem("other", d.id)}
                                className="text-red-600 hover:text-red-700 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}



              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks
                </label>
                <input
                  type="text"
                  value={bookingDetails.remark}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, remark: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Remark"
                />
              </div>
            </div>

            {/* Transporter Allocation Section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">
                  Transporter Allocations
                </h3>
                <button
                  type="button"
                  onClick={addAllocationRow}
                  className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  Add Transporter
                </button>
              </div>

              <div className="space-y-3">
                {allocations.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No transporters allocated yet.
                  </p>
                ) : (
                  allocations.map((a) => {
                    const used = vehiclesByAllocation(a.id);
                    const remainingHere = Math.max(0, a.count - used);
                    const selectedVendor = (vendors || []).find(
                      (v) => v._id === a.vendorUserId
                    );
                    const transporterName = selectedVendor?.name || "";

                    return (
                      <div key={a.id} className="border rounded-md p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                          {<div className="lg:col-span-2">
                            <label
                              htmlFor={`transporter-${a.id}`}
                              className="block text-xs font-medium text-gray-700 mb-1"
                            >
                              Transporter Name
                            </label>
                            <select
                              id={`transporter-${a.id}`}
                              value={a.vendorUserId}
                              onChange={(e) =>
                                updateAllocation(a.id, { vendorUserId: e.target.value })
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="" disabled>
                                -- Select a Vendor --
                              </option>
                              {(vendors || []).map((vendor) => (
                                <option key={vendor._id} value={vendor._id}>
                                  {vendor.name}
                                </option>
                              ))}
                            </select>
                          </div>}

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Contact Person
                            </label>
                            <input
                              type="text"
                              value={a.contactPerson}
                              onChange={(e) =>
                                updateAllocation(a.id, { contactPerson: e.target.value })
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Contact person"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Contact Mobile
                            </label>
                            <input
                              type="text"
                              value={a.contactMobile}
                              onChange={(e) =>
                                updateAllocation(a.id, { contactMobile: e.target.value })
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Phone"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Vehicles Allocated
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={a.count}
                              onChange={(e) => updateAllocationCount(a.id, e.target.value)}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">
                              Added: {used} / {a.count}{" "}
                              {remainingHere > 0 ? `(Remaining: ${remainingHere})` : ""}
                            </p>
                          </div>

                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const ok = window.confirm('Are you sure? Once allocated, this action cannot be changed.');
                                if (!ok) return;
                                handleOpenAddVehiclesForAllocation({
                                  ...a,
                                  transporterName,
                                });
                              }}
                              disabled={remainingHere <= 0 || !a.vendorUserId}
                              className={`px-3 py-2 rounded-md text-sm text-white ${remainingHere > 0 && a.vendorUserId
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : "bg-gray-300 cursor-not-allowed"
                                }`}
                            >
                              Send To Transporter
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAllocation(a.id)}
                              disabled={used > 0}
                              className={`px-3 py-2 rounded-md text-sm ${used > 0
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-red-50 text-red-600 hover:bg-red-100"
                                }`}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Allocated: {allocatedCount} / {totalVehicles || 0} • Remaining to
                allocate: {remainingToAllocate}
              </p>
            </div>

            {/* Vehicles summary list */}
            <div className="mt-8">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">
                Vehicles added ({totalVehiclesAdded}/{totalVehicles || 0})
              </h4>
              {vehicles.length === 0 ? (
                <p className="text-sm text-gray-500">No vehicles added yet.</p>
              ) : (
                <div className="space-y-2">
                  {vehicles.map((v, i) => (
                    <div
                      key={`${v.vehicleNumber}-${i}`}
                      className="flex flex-col md:flex-row md:items-center justify-between border rounded-md px-3 py-2"
                    >
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">
                          {v.vehicleNumber || "Vehicle"}
                        </span>
                        <span className="mx-2 text-gray-400">•</span>
                        Transporter: {v.transporterName}
                        <span className="mx-2 text-gray-400">•</span>
                        Driver: {v.driverName} ({v.driverMobile})
                        <span className="mx-2 text-gray-400">•</span>
                        ETA: {v.estimatedArrival || "-"} | ETD:{" "}
                        {v.estimatedDeparture || "-"}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVehicle(i)}
                        className="text-red-600 hover:text-red-700 text-sm mt-2 md:mt-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transport Details bulk-add panel */}
        {isAddingVehicle && activeAllocationId && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Transport Details
                </h2>
                <span className="text-xs sm:text-sm text-white/90">
                  {(() => {
                    const alloc = allocations.find((a) => a.id === activeAllocationId)!;
                    const used = vehiclesByAllocation(activeAllocationId);
                    return `For ${(vendors || []).find((v) => v._id === alloc.vendorUserId)?.name ??
                      "Transporter"
                      } • Remaining: ${Math.max(0, (alloc?.count || 0) - used)}`;
                  })()}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Transporter info (derived, read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transporter
                  </label>
                  <input
                    type="text"
                    value={
                      (() => {
                        const alloc = allocations.find((a) => a.id === activeAllocationId)!;
                        return (
                          (vendors || []).find((v) => v._id === alloc.vendorUserId)?.name ||
                          ""
                        );
                      })()
                    }
                    disabled
                    className="w-full px-4 py-3 border rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={vehicleDraft.ContactPerson}
                    disabled
                    className="w-full px-4 py-3 border rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Mobile
                  </label>
                  <input
                    type="text"
                    value={vehicleDraft.ContactPersonMobile}
                    disabled
                    className="w-full px-4 py-3 border rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>

                {/* Vehicle details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vehicleDraft.vehicleNumber}
                    onChange={(e) =>
                      setVehicleDraft((prev) => ({ ...prev, vehicleNumber: e.target.value }))
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors.vehicleNumber ? "border-red-500" : "border-gray-300"
                      }`}
                    placeholder="e.g., MH12AB## (## auto-numbers to 01, 02, ...)"
                  />
                  {errors.vehicleNumber && (
                    <p className="text-red-600 text-sm mt-1">{errors.vehicleNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Arrival <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={vehicleDraft.estimatedArrival}
                    onChange={(e) =>
                      setVehicleDraft((prev) => ({
                        ...prev,
                        estimatedArrival: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors.estimatedArrival ? "border-red-500" : "border-gray-300"
                      }`}
                  />
                  {errors.estimatedArrival && (
                    <p className="text-red-600 text-sm mt-1">{errors.estimatedArrival}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Departure <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={vehicleDraft.estimatedDeparture}
                    onChange={(e) =>
                      setVehicleDraft((prev) => ({
                        ...prev,
                        estimatedDeparture: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors.estimatedDeparture ? "border-red-500" : "border-gray-300"
                      }`}
                  />
                  {errors.estimatedDeparture && (
                    <p className="text-red-600 text-sm mt-1">{errors.estimatedDeparture}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vehicleDraft.driverName}
                    onChange={(e) =>
                      setVehicleDraft((prev) => ({ ...prev, driverName: e.target.value }))
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors.driverName ? "border-red-500" : "border-gray-300"
                      }`}
                    placeholder="Enter driver name"
                  />
                  {errors.driverName && (
                    <p className="text-red-600 text-sm mt-1">{errors.driverName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver Mobile <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vehicleDraft.driverMobile}
                    onChange={(e) =>
                      setVehicleDraft((prev) => ({ ...prev, driverMobile: e.target.value }))
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors.driverMobile ? "border-red-500" : "border-gray-300"
                      }`}
                    placeholder="Enter driver mobile number"
                  />
                  {errors.driverMobile && (
                    <p className="text-red-600 text-sm mt-1">{errors.driverMobile}</p>
                  )}
                </div>
              </div>

              {/* Bulk add controls */}
              <div className="mt-6 flex items-center justify-between gap-3">
                {/* <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    Number of vehicles to add
                  </label>
                  <input
                    type="number"
                    min={1} 
                    value={addCount}
                    onChange={(e) => {
                      const alloc = allocations.find((a) => a.id === activeAllocationId)!;
                      const used = vehiclesByAllocation(activeAllocationId);
                      const remainingHere = Math.max(0, (alloc?.count || 0) - used);
                      const val = Math.max(
                        1,
                        Math.min(Number(e.target.value || 1), remainingHere || 1)
                      );
                      setAddCount(val);
                    }}
                    className="w-24 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div> */}

                <div className="ml-auto flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingVehicle(false);
                      setActiveAllocationId(null);
                      setVehicleDraft(emptyVehicleDraft);
                      setErrors({});
                      setAddCount(1);
                    }}
                    className="px-4 py-2 rounded-md font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveVehicles}
                    className="px-4 py-2 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Save Vehicle(s)
                  </button>
                </div>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                Tip: Use # in Vehicle Number (e.g., MH12AB##) to auto-number when adding multiple vehicles.
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-between">
          {!allVehicleCountsOk && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Make sure Allocated = Total, and vehicles added match each transporter’s allocation.
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !allVehicleCountsOk}
            className="ml-auto px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? "Creating..." : "Create Transport Form"}
          </button>
        </div>
      </form>
    </div>
  );
}