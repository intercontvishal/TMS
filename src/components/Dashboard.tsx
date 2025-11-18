import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { EmployeeDashboard } from "./EmployeeDashboard";
import { AdminDashboard } from "./AdminDashboard";
import { VendorDashboard } from "./VendorDashboard";
import { TransporterDashboard } from "./TransporterDashboard";
// import { OrderPlacerDashboard } from "./OrderPlacerDashboard";

interface User {
  _id: string;
  name?: string;
  email?: string;
  role: "employee" | "admin" | "vendor" | "order_placer" | "transporter" | null;
  permissions: string[];
}

interface DashboardProps {
  user: User;
}

export function Dashboard({ user }: DashboardProps) {
  if (!user.role) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Role Assigned</h2>
          <p className="text-gray-600">Please contact an administrator to assign you a role.</p>
        </div>
      </div>
    );
  }
  
  switch (user.role) {
    case "employee":
      return <EmployeeDashboard user={user} />;
    case "admin":
      return <AdminDashboard user={user} />;
    case "vendor":
      return <VendorDashboard user={user} />;
    case "transporter":
      return <TransporterDashboard user={user} />;
    // case "order_placer":
    //   return <OrderPlacerDashboard user={user} />;
    default:
      return (
        <div className="flex justify-center items-center min-h-96">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unknown Role</h2>
            <p className="text-gray-600">Please contact an administrator.</p>
          </div>
        </div>
      );
  }
}
