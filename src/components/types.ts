export type Allocation = {
id: string;
transporterUserId?: string; // strongly recommended so we assign to an actual vendor user
transporterName: string;
contactPerson: string;
contactMobile: string;
containerType?: string;
vehicleSize?: string;
containerSize?: string;
weight?: string;
cargoVolume?: string;
count: number;
};

export type Vehicle = {
_id?: string; // server-generated
formId?: string; // server-generated
allocationId: string;
assignedTransporterId?: string; // server-generated if you pass transporterUserId in allocation
transporterName: string;
contactPerson?: string;
contactMobile?: string;
containerType?: string;
vehicleSize?: string;
containerSize?: string;
weight?: string;
cargoVolume?: string;

vehicleNumber: string;
driverName: string;
driverMobile: string;
estimatedDeparture: string; // yyyy-mm-dd on client
estimatedArrival: string; // yyyy-mm-dd on client
status?: "draft" | "submitted";
};

export type BookingDetails = {
bookingNo: string;
poNumber?: string;
shipperName?: string;
vehicalQty: string; // keep as string input; parse to number on submit
pod?: string;
vessel?: string;
stuffingDate?: string; // yyyy-mm-dd
cutoffDate?: string; // yyyy-mm-dd
stuffingPlace?: string;
commodity?: string;
quantity?: string;
category?: string;
placementDate?: string; // yyyy-mm-dd
factory?: string;
remark?: string;
containerType?: string;
cargoWt?: string;
cleranceLocation?: string;
cleranceContact?: string;
};