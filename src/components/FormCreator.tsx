import { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

interface FormCreatorProps {
  onFormCreated: (formId: string) => void;
}

type Vehicle = {
  allocationId: string;
  transporterName: string;
  containerNumber: string;
  sealNumber: string;
  vehicleNumber: string;
  driverName: string;
  driverMobile: string;
};

type Allocation = {
  id: string; // local row id
  vendorUserId: string; // selected vendor's user id
  // contactPerson?: string;
  // contactMobile?: string;
  count: number;
};

type DocItem = {
  id: string;
  file: File;
  url: string; // object URL for preview
  kind: "do" | "other";
};

const emptyVehicleDraft = {
  transporterName: "",
  containerNumber: "",
  sealNumber: "",
  vehicleNumber: "",
  driverName: "",
  driverMobile: "",
};

const genId = () => Math.random().toString(36).slice(2, 10);
const ACCEPTED_DOC_TYPES = "image/*";
const isImageFile = (file: File) => file.type?.startsWith("image/");
const dateStrToMs = (s?: string) => (s ? Date.parse(s) : undefined);

// Optional: centralize file size validation
const validateImage = (file: File) => {
  if (!isImageFile(file)) {
    return "Please select an image file (JPEG/PNG/WebP)";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "Image must be 10MB or smaller";
  }
  return null;
};

export function FormCreator({ onFormCreated }: FormCreatorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vendors = useQuery(api.users.getVendors, {}) || [];
  const createForm = useMutation(api.forms.createForm);
  const createTransportVehiclesForForm = useMutation(
    (api as any).forms.createTransportVehiclesForForm
  );
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const uploadPhoto = useMutation(api.photos.uploadPhoto);

  // Vehicles across all transporters
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  // Allocations
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  // Bulk add panel state
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [activeAllocationId, setActiveAllocationId] = useState<string | null>(null);
  const [vehicleDraft, setVehicleDraft] =
    useState<typeof emptyVehicleDraft>(emptyVehicleDraft);
  const [addCount, setAddCount] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Booking details
  const [bookingDetails, setBookingDetails] = useState({
    bookingNo: "",
    poNumber: "",
    shipperName: "",
    vehicalQty: "",
    pod: "",
    vessel: "",
    stuffingDate: "",
    cutoffDate: "",
    stuffingPlace: "",
    commodity: "",
    catagory: "",
    placementDate: "",
    factory: "",
    remark: "",
    cargoWt: "",
    cleranceLocation: "",
  });

  // Documents (stored locally for preview; uploaded after form creation)
  const [isDocSectionOpen, setIsDocSectionOpen] = useState(false);
  const [doDoc, setDoDoc] = useState<DocItem | null>(null);
  const [supportingDocs, setSupportingDocs] = useState<DocItem[]>([]);

  // Memo: map vendorId → name to avoid repeated finds
  const vendorMap = useMemo(() => {
    const map = new Map<string, string>();
    vendors.forEach((v: any) => map.set(v._id, v.name));
    return map;
  }, [vendors]);

  // Derived totals
  const totalVehicles = useMemo(
    () => Number.parseInt(bookingDetails.vehicalQty || "0", 10) || 0,
    [bookingDetails.vehicalQty]
  );

  const allocatedCount = useMemo(
    () => allocations.reduce((sum, a) => sum + (a.count || 0), 0),
    [allocations]
  );

  // Memo: count vehicles per allocation once
  const vehicleCountByAllocation = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of vehicles) {
      counts[v.allocationId] = (counts[v.allocationId] || 0) + 1;
    }
    return counts;
  }, [vehicles]);

  const vehiclesByAllocation = useCallback(
    (allocationId: string) => vehicleCountByAllocation[allocationId] || 0,
    [vehicleCountByAllocation]
  );

  const remainingToAllocate = Math.max(0, totalVehicles - allocatedCount);
  const totalVehiclesAdded = vehicles.length;

  // Validation
  function validateVehicleDraft(d: typeof emptyVehicleDraft) {
    const e: Record<string, string> = {};
    if (!d.vehicleNumber?.trim()) e.vehicleNumber = "Vehicle number is required";
    if (!d.driverName?.trim()) e.driverName = "Driver name is required";
    if (!d.driverMobile?.trim()) e.driverMobile = "Driver mobile is required";
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
        // contactPerson: "",
        // contactMobile: "",
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
      toast.warning(
        "Remove vehicles assigned to this transporter before deleting the allocation."
      );
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
    const transporterName = vendorMap.get(allocation.vendorUserId) || "Unknown";

    const already = vehiclesByAllocation(activeAllocationId);
    const remainingHere = allocation.count - already;
    if (remainingHere <= 0) return;

    const count = Math.max(1, Math.min(addCount || 1, remainingHere));

    const newVehicles: Vehicle[] = Array.from({ length: count }, (_, i) => ({
      allocationId: activeAllocationId,
      transporterName,
      containerNumber: vehicleDraft.containerNumber,
      sealNumber: vehicleDraft.sealNumber,
      vehicleNumber: vehicleDraft.vehicleNumber.includes("#")
        ? withAutoNumber(vehicleDraft.vehicleNumber, i + already)
        : vehicleDraft.vehicleNumber,
      driverName: vehicleDraft.driverName,
      driverMobile: vehicleDraft.driverMobile,
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

  // Document handling
  const handleDoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateImage(file);
    if (error) {
      toast.error(error);
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
    const items: DocItem[] = [];
    for (const file of files) {
      const error = validateImage(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
        continue;
      }
      items.push({ id: genId(), file, url: URL.createObjectURL(file), kind: "other" });
    }
    if (items.length > 0) setSupportingDocs((prev) => [...prev, ...items]);
    e.target.value = "";
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

  // Upload helpers
  const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const uploadSingleImage = async (file: File, formId: string) => {
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

  const uploadSelectedDocs = async (formId: string) => {
    const tasks: Array<Promise<void>> = [];
    if (doDoc?.file) tasks.push(uploadSingleImage(doDoc.file, formId));
    for (const d of supportingDocs) tasks.push(uploadSingleImage(d.file, formId));

    if (tasks.length === 0) return { success: 0, failed: 0 };

    const results = await Promise.allSettled(tasks);
    const failed = results.filter((r) => r.status === "rejected").length;
    const success = results.length - failed;

    if (success > 0) toast.success(`${success} document(s) uploaded`);
    if (failed > 0) toast.error(`${failed} document(s) failed to upload`);

    // Cleanup object URLs after upload attempt
    if (doDoc?.url) URL.revokeObjectURL(doDoc.url);
    supportingDocs.forEach((d) => d.url && URL.revokeObjectURL(d.url));
    setDoDoc(null);
    setSupportingDocs([]);

    return { success, failed };
  };

  // Submission checks
  const allocationsMatchTotal = totalVehicles > 0 && allocatedCount === totalVehicles;
  const perAllocationSatisfied = allocations.every(
    (a) => vehiclesByAllocation(a.id) === a.count
  );
  const isReadyToSubmit = useMemo(() => {
    return (
      totalVehicles > 0 &&
      allocationsMatchTotal &&
      perAllocationSatisfied &&
      totalVehiclesAdded === totalVehicles
    );
  }, [totalVehicles, allocationsMatchTotal, perAllocationSatisfied, totalVehiclesAdded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Submission no longer depends on allocations; transporter will allocate later

    setIsSubmitting(true);
    try {
      const result = await createForm({
        bookingDetails: {
          ...bookingDetails,
          stuffingDate: dateStrToMs(bookingDetails.stuffingDate),
          cutoffDate: dateStrToMs(bookingDetails.cutoffDate),
          placementDate: dateStrToMs(bookingDetails.placementDate),
        },
        allocations: allocations.map((a) => ({
          vendorUserId: a.vendorUserId,
          count: a.count,
        })),
        vehicles: vehicles.map((v) => {
          const parentAllocation = allocations.find((alloc) => alloc.id === v.allocationId);
          const obj: any = {
            transporterName: v.transporterName,
            vehicleNumber: v.vehicleNumber,
            driverName: v.driverName,
            driverMobile: v.driverMobile,
            containerNumber: v.containerNumber || undefined,
            sealNumber: v.sealNumber || undefined,
            allocationId: v.allocationId,
            vendorUserId: parentAllocation?.vendorUserId,
          };
          // remove any accidental empty-string values
          for (const k of Object.keys(obj)) {
            if (obj[k] === "") obj[k] = undefined;
          }
          return obj;
        }),
      } as any);

      // Vendor assignments for this form
      try {
        const vehiclesPayload = vehicles.map((v) => {
          const parentAllocation = allocations.find((a) => a.id === v.allocationId);
          const vendor = vendors.find((ven: any) => ven._id === parentAllocation?.vendorUserId);
          return {
            allocationId: v.allocationId,
            assignedTransporterId: parentAllocation?.vendorUserId as any,
            transporterName: vendor?.name || v.transporterName || "",
            containerNumber: v.containerNumber || undefined,
            sealNumber: v.sealNumber || undefined,
            vehicleNumber: v.vehicleNumber || undefined,
            driverName: v.driverName || undefined,
            driverMobile: v.driverMobile || undefined,
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

      // Upload queued document images for this form
      await uploadSelectedDocs(result.formId);

      toast.success(`Form ${result.refId} created successfully!`);
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
              <h2 className="text-lg sm:text-xl font-bold text-white">Booking & Shipment Details</h2>
              <span className="text-xs sm:text-sm text-white/90">
                Added: {totalVehiclesAdded} / {totalVehicles || 0}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Booking Number
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Line</label>
                <input
                  type="text"
                  value={bookingDetails.poNumber} //(poNumber is refer to 'Line'  )
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, poNumber: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Line Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Vehicles / Containers QTY.
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
                  placeholder="Add Total Vehicles / Containers QTY."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Allocated: {allocatedCount} / {totalVehicles || 0}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shipper Name</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Vessel Name</label>
                <input
                  type="text"
                  value={bookingDetails.vessel}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, vessel: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Vessel Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">POD</label>
                <input
                  type="text"
                  value={bookingDetails.pod}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, pod: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter POD"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cargo Weight</label>
                <input
                  type="text"
                  value={bookingDetails.cargoWt}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, cargoWt: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Cargo Weight"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Commodity</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Cargo Type</label>
                <input
                  type="text"
                  value={bookingDetails.catagory}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, catagory: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Cargo Type"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Cutoff Date</label>
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

              

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Empty Pickup Depot</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Empty Pickup Date</label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Factory Stuffing Place</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Factory Placement Date</label>
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

              

             

              {/* Documents */}
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
                    <span className="text-xs text-gray-500">DO is mandatory; others are optional.</span>
                  </div>

                  {/* DO */}
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
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {doDoc.file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(doDoc.file.size / 1024).toFixed(1)} KB •{" "}
                            {doDoc.file.type || "Unknown type"}
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

                  {/* Supporting */}
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
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {d.file.name}
                              </p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                <input
                  type="text"
                  value={bookingDetails.remark}
                  onChange={(e) =>
                    setBookingDetails((prev) => ({ ...prev, remark: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add Remark"
                />
              </div>
            </div>

            {/* Transporter Allocations removed: transporter will allocate later in their dashboard */}
          </div>
        </div>

        {/* Transport Details vehicle-add panel removed */}

        {/* Submit Button */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? "Creating..." : "Create Transport Form"}
          </button>
        </div>
      </form>
    </div>
  );
}