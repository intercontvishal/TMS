// import { useState } from "react";
// import { useQuery, useMutation } from "convex/react";
// import { api } from "../../convex/_generated/api";
// import { toast } from "sonner";

// export default function TransporterVehiclesPage() {
// const [selected, setSelected] = useState<any | null>(null);
// const vehicles = useQuery(api.transportVehicles.listForMe, {});
// const saveDraft = useMutation(api.transportVehicles.saveDraft);
// const submit = useMutation(api.transportVehicles.submit);

// if (!vehicles) return <div className="p-6">Loading…</div>;

// return (
// <div className="max-w-5xl mx-auto p-6">
// <h1 className="text-xl font-semibold mb-4">My Assigned Vehicles</h1>
// {vehicles.length === 0 ? (
// <p className="text-sm text-gray-600">No vehicles assigned.</p>
// ) : (
// <div className="space-y-3">
// {vehicles.map((v: any) => (
// <div key={v._id} className="border rounded-md p-3">
// <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
// <div className="text-sm">
// <div className="font-medium">
// {v.vehicleNumber || "Vehicle"} • Form: {v.formRefId || "-"}
// </div>
// <div className="text-gray-600">
// Driver: {v.driverName || "-"} ({v.driverMobile || "-"})
// <span className="mx-2 text-gray-400">•</span>
// ETA: {v.estimatedArrival ? new Date(v.estimatedArrival).toLocaleDateString() : "-"}
// <span className="mx-2 text-gray-400">•</span>
// ETD: {v.estimatedDeparture ? new Date(v.estimatedDeparture).toLocaleDateString() : "-"}
// <span className="mx-2 text-gray-400">•</span>
// Status:{" "}
// <span className={v.status === "submitted" ? "text-green-700" : "text-amber-700"}>
// {v.status}
// </span>
// </div>
// </div>
// <div className="flex gap-2">
// <button
// className="px-3 py-2 text-sm rounded-md border hover:bg-gray-50"
// onClick={() => setSelected(v)}
// >
// {v.status === "submitted" ? "View" : "Fill Details"}
// </button>
// </div>
// </div>
// </div>
// ))}
// </div>
// )}

//   {/* Drawer/Modal-like inline form */}
//   {selected && <VehicleEditor
//     vehicle={selected}
//     onClose={() => setSelected(null)}
//     onSaveDraft={async (patch) => {
//       try {
//         await saveDraft({
//           vehicleId: selected._id,
//           patch: {
//             ...patch,
//             estimatedArrival: new Date(patch.estimatedArrival).getTime(),
//             estimatedDeparture: new Date(patch.estimatedDeparture).getTime(),
//           },
//         });
//         toast.success("Draft saved.");
//       } catch (e: any) {
//         toast.error(e.message);
//       }
//     }}
//     onSubmit={async (patch) => {
//       // 1) Save latest values as draft
//       try {
//         await saveDraft({
//           vehicleId: selected._id,
//           patch: {
//             ...patch,
//             estimatedArrival: new Date(patch.estimatedArrival).getTime(),
//             estimatedDeparture: new Date(patch.estimatedDeparture).getTime(),
//           },
//         });
//       } catch (e: any) {
//         toast.error(e.message);
//         return;
//       }
//       // 2) Confirm final submission
//       const ok = window.confirm(
//         "Once submitted, these details cannot be changed. Do you want to submit?"
//       );
//       if (!ok) return;

//       try {
//         await submit({ vehicleId: selected._id });
//         toast.success("Submitted successfully.");
//         setSelected(null);
//       } catch (e: any) {
//         toast.error(e.message);
//       }
//     }}
//   />}
// </div>

// );
// }

// function VehicleEditor({
// vehicle,
// onClose,
// onSaveDraft,
// onSubmit,
// }: {
// vehicle: any;
// onClose: () => void;
// onSaveDraft: (patch: any) => Promise<void>;
// onSubmit: (patch: any) => Promise<void>;
// }) {
// const [form, setForm] = useState({
// vehicleNumber: vehicle.vehicleNumber || "",
// driverName: vehicle.driverName || "",
// driverMobile: vehicle.driverMobile || "",
// estimatedArrival: vehicle.estimatedArrival
// ? new Date(vehicle.estimatedArrival).toISOString().slice(0, 10)
// : "",
// estimatedDeparture: vehicle.estimatedDeparture
// ? new Date(vehicle.estimatedDeparture).toISOString().slice(0, 10)
// : "",
// });

// const disabled = vehicle.status === "submitted";

// return (
// <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-50">
// <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
// <div className="flex items-center justify-between mb-4">
// <h2 className="text-lg font-semibold">Vehicle Details</h2>
// <button onClick={onClose} className="text-gray-600 hover:text-black">✕</button>
// </div>

//     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//       <div>
//         <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Number</label>
//         <input
//           type="text"
//           disabled={disabled}
//           value={form.vehicleNumber}
//           onChange={(e) => setForm((p) => ({ ...p, vehicleNumber: e.target.value }))}
//           className="w-full border border-gray-300 rounded-md px-3 py-2"
//         />
//       </div>
//       <div>
//         <label className="block text-sm font-medium text-gray-700 mb-2">Driver Name</label>
//         <input
//           type="text"
//           disabled={disabled}
//           value={form.driverName}
//           onChange={(e) => setForm((p) => ({ ...p, driverName: e.target.value }))}
//           className="w-full border border-gray-300 rounded-md px-3 py-2"
//         />
//       </div>
//       <div>
//         <label className="block text-sm font-medium text-gray-700 mb-2">Driver Mobile</label>
//         <input
//           type="text"
//           disabled={disabled}
//           value={form.driverMobile}
//           onChange={(e) => setForm((p) => ({ ...p, driverMobile: e.target.value }))}
//           className="w-full border border-gray-300 rounded-md px-3 py-2"
//         />
//       </div>
//       <div>
//         <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Arrival</label>
//         <input
//           type="date"
//           disabled={disabled}
//           value={form.estimatedArrival}
//           onChange={(e) => setForm((p) => ({ ...p, estimatedArrival: e.target.value }))}
//           className="w-full border border-gray-300 rounded-md px-3 py-2"
//         />
//       </div>
//       <div>
//         <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Departure</label>
//         <input
//           type="date"
//           disabled={disabled}
//           value={form.estimatedDeparture}
//           onChange={(e) => setForm((p) => ({ ...p, estimatedDeparture: e.target.value }))}
//           className="w-full border border-gray-300 rounded-md px-3 py-2"
//         />
//       </div>
//     </div>

//     <div className="mt-6 flex items-center justify-end gap-3">
//       <button onClick={onClose} className="px-4 py-2 rounded-md border">Close</button>
//       {!disabled && (
//         <>
//           <button
//             onClick={() => onSaveDraft(form)}
//             className="px-4 py-2 rounded-md border bg-white hover:bg-gray-50"
//           >
//             Save Draft
//           </button>
//           <button
//             onClick={() => onSubmit(form)}
//             className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
//           >
//             Submit
//           </button>
//         </>
//       )}
//     </div>

//     {disabled && (
//       <p className="mt-3 text-sm text-gray-600">
//         This vehicle has been submitted and can no longer be edited.
//       </p>
//     )}
//   </div>
// </div>

// );
// }
