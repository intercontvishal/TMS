// import { useState } from "react";
// import { useQuery } from "convex/react";
// import { api } from "../../convex/_generated/api";

// interface User {
//   _id: string;
//   name?: string;
//   email?: string;
//   role: "employee" | "admin" | "vendor" | "order_placer" | null;
//   permissions: string[];
// }

// interface OrderPlacerDashboardProps {
//   user: User;
// }

// export function OrderPlacerDashboard({ user }: OrderPlacerDashboardProps) {
//   const [accessToken, setAccessToken] = useState("");
//   const [accessData, setAccessData] = useState<any>(null);
  
//   const accessFormData = useQuery(
//     api.access.accessFormByToken,
//     accessToken ? { token: accessToken } : "skip"
//   );

//   const handleAccessForm = () => {
//     if (!accessToken.trim()) {
//       return;
//     }
//     // The query will automatically update when accessToken changes
//   };

//   return (
//     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//       {/* Header */}
//       <div className="mb-8">
//         <h1 className="text-2xl font-bold text-gray-900">Order Placer Dashboard</h1>
//         <p className="text-gray-600">Access transport forms with provided links</p>
//       </div>

//       {/* Access Form */}
//       <div className="bg-white rounded-lg shadow p-6 mb-6">
//         <h3 className="text-lg font-medium text-gray-900 mb-4">Access Transport Form</h3>
//         <div className="flex space-x-4">
//           <input
//             type="text"
//             value={accessToken}
//             onChange={(e) => setAccessToken(e.target.value)}
//             placeholder="Enter access token"
//             className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
//           />
//           <button
//             onClick={handleAccessForm}
//             disabled={!accessToken.trim()}
//             className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
//           >
//             Access Form
//           </button>
//         </div>
//       </div>

//       {/* Form Data */}
//       {accessFormData && (
//         <div className="space-y-6">
//           {/* Form Details */}
//           <div className="bg-white rounded-lg shadow p-6">
//             <h3 className="text-lg font-medium text-gray-900 mb-4">
//               Form {accessFormData.form.refId}
//             </h3>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               <div>
//                 <h4 className="font-medium text-gray-900 mb-2">Transport Details</h4>
//                 <div className="space-y-2 text-sm">
//                   <p><span className="font-medium">Vehicle:</span> {accessFormData.form.transportDetails.vehicleNumber}</p>
//                   <p><span className="font-medium">Driver:</span> {accessFormData.form.transportDetails.driverName}</p>
//                   <p><span className="font-medium">Route:</span> {accessFormData.form.bookingDetails.stuffingPlace} → {accessFormData.form.bookingDetails.POD}</p>
//                   <p><span className="font-medium">Departure:</span> {new Date(accessFormData.form.transportDetails.estimatedDeparture).toLocaleString()}</p>
//                   <p><span className="font-medium">Arrival:</span> {new Date(accessFormData.form.transportDetails.estimatedArrival).toLocaleString()}</p>
//                 </div>
//               </div>
//               <div>
//                 <h4 className="font-medium text-gray-900 mb-2">Booking Details</h4>
//                 <div className="space-y-2 text-sm">
//                   <p><span className="font-medium">Reference:</span> {accessFormData.form.bookingDetails.bookingNo}</p>
//                   <p><span className="font-medium">Customer:</span> {accessFormData.form.bookingDetails.shipperName}</p>
//                   <p><span className="font-medium">Contact:</span> {accessFormData.form.transportDetails.ContactPersonMobile}</p>
//                   <p><span className="font-medium">Value:</span> {accessFormData.form.bookingDetails.cargoWt.toLocaleString()}</p>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Containers */}
//           <div className="bg-white rounded-lg shadow">
//             <div className="px-6 py-4 border-b border-gray-200">
//               <h3 className="text-lg font-medium text-gray-900">Containers</h3>
//             </div>
//             <div className="divide-y divide-gray-200">
//               {accessFormData.containers.map((container: any) => (
//                 <div key={container._id} className="px-6 py-4">
//                   <div className="mb-4">
//                     <h4 className="font-medium text-gray-900">{container.containerNumber}</h4>
//                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
//                       <div>
//                         <span className="font-medium">Seal:</span> {container.sealNumber}
//                       </div>
//                       <div>
//                         <span className="font-medium">DO:</span> {container.doNumber}
//                       </div>
//                       <div>
//                         <span className="font-medium">Type:</span> {container.containerType}
//                       </div>
//                       <div>
//                         <span className="font-medium">Weight:</span> {container.weight}kg
//                       </div>
//                     </div>
//                   </div>
                  
//                   {/* Photos */}
//                   {container.photos && container.photos.length > 0 && (
//                     <div>
//                       <h5 className="font-medium text-gray-900 mb-2">Photos</h5>
//                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//                         {container.photos.map((photo: any) => (
//                           <div key={photo._id} className="relative">
//                             <img
//                               src={photo.url}
//                               alt={photo.description || "Container photo"}
//                               className="w-full h-24 object-cover rounded-lg border"
//                             />
//                             <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg">
//                               {photo.category.replace("_", " ")}
//                             </div>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Access Info */}
//           <div className="bg-blue-50 rounded-lg p-4">
//             <div className="flex items-center space-x-2">
//               <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
//               <p className="text-sm text-blue-800">
//                 Access expires: {new Date(accessFormData.linkInfo.expiresAt).toLocaleString()}
//               </p>
//             </div>
//             <p className="text-xs text-blue-600 mt-1">
//               This link has been accessed {accessFormData.linkInfo.accessCount} times
//             </p>
//           </div>
//         </div>
//       )}

//       {!accessFormData && accessToken && (
//         <div className="bg-red-50 rounded-lg p-4">
//           <p className="text-red-800">Invalid or expired access token</p>
//         </div>
//       )}
//     </div>
//   );
// }
