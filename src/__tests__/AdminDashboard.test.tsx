// import React from 'react';
// import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import { AdminDashboard } from '../components/AdminDashboard';
// import { useQuery, useMutation, useAction } from 'convex/react';
// import { api } from '../../convex/_generated/api';
// import { toast } from 'sonner';

// // Mock the dependencies
// jest.mock('convex/react');
// jest.mock('sonner');

// const mockUseQuery = useQuery as jest.Mock;
// const mockUseMutation = useMutation as jest.Mock;
// const mockUseAction = useAction as jest.Mock;

// const mockUser = {
//   _id: 'user-1',
//   name: 'Admin User',
//   email: 'admin@example.com',
//   role: 'admin',
//   permissions: ['admin:all']
// };

// describe('AdminDashboard', () => {
//   beforeEach(() => {
//     // Mock the Convex queries
//     mockUseQuery.mockImplementation((query) => {
//       if (query === 'mockedQuery') return [];
      
//       // Return different data based on the query
//       if (query === api.forms.listForms) {
//         return [
//           { _id: 'form-1', status: 'pending', createdAt: new Date().toISOString() },
//           { _id: 'form-2', status: 'completed', createdAt: new Date().toISOString() },
//         ];
//       }
      
//       if (query === api.users.listUsersWithRoles) {
//         return [
//           { _id: 'user-1', name: 'Admin User', email: 'admin@example.com', role: 'admin' },
//           { _id: 'user-2', name: 'Vendor User', email: 'vendor@example.com', role: 'vendor' },
//         ];
//       }
      
//       if (query === api.audit.getRecentActivity) {
//         return [
//           { _id: 'activity-1', action: 'login', userId: 'user-1', timestamp: new Date().toISOString() },
//         ];
//       }
      
//       return [];
//     });
    
//     // Mock mutations and actions
//     mockUseMutation.mockReturnValue(jest.fn());
//     mockUseAction.mockReturnValue(jest.fn());
    
//     // Mock toast
//     (toast as any).error = jest.fn();
//     (toast as any).success = jest.fn();
//   });
  
//   afterEach(() => {
//     jest.clearAllMocks();
//   });

//   it('renders admin dashboard with user information', () => {
//     render(<AdminDashboard user={mockUser} />);
    
//     expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
//     expect(screen.getByText('Admin User')).toBeInTheDocument();
//     expect(screen.getByText('admin@example.com')).toBeInTheDocument();
//   });

//   it('displays the overview tab by default', () => {
//     render(<AdminDashboard user={mockUser} />);
    
//     expect(screen.getByText('Overview')).toHaveClass('border-blue-500');
//     expect(screen.getByText('Total Forms')).toBeInTheDocument();
//     expect(screen.getByText('Pending')).toBeInTheDocument();
//     expect(screen.getByText('Completed')).toBeInTheDocument();
//     expect(screen.getByText('This Month')).toBeInTheDocument();
//   });

//   it('switches between tabs', () => {
//     render(<AdminDashboard user={mockUser} />);
    
//     // Click on Users tab
//     fireEvent.click(screen.getByText('User Management'));
//     expect(screen.getByText('User Management')).toHaveClass('border-blue-500');
//     expect(screen.getByText('Admin User')).toBeInTheDocument();
//     expect(screen.getByText('Vendor User')).toBeInTheDocument();
    
//     // Click on Forms tab
//     fireEvent.click(screen.getByText('All Forms'));
//     expect(screen.getByText('All Forms')).toHaveClass('border-blue-500');
    
//     // Click on Activity tab
//     fireEvent.click(screen.getByText('Recent Activity'));
//     expect(screen.getByText('Recent Activity')).toHaveClass('border-blue-500');
//   });

//   it('allows changing user roles', async () => {
//     const mockAssignRole = jest.fn().mockResolvedValue(undefined);
//     mockUseMutation.mockReturnValue(mockAssignRole);
    
//     render(<AdminDashboard user={mockUser} />);
    
//     // Go to Users tab
//     fireEvent.click(screen.getByText('User Management'));
    
//     // Find the role select for the first user
//     const roleSelect = screen.getAllByRole('combobox')[0];
//     fireEvent.change(roleSelect, { target: { value: 'vendor' } });
    
//     await waitFor(() => {
//       expect(mockAssignRole).toHaveBeenCalledWith({
//         userId: 'user-1',
//         role: 'vendor'
//       });
//     });
    
//     expect(toast.success).toHaveBeenCalledWith('Role assigned successfully');
//   });

//   it('handles role assignment errors', async () => {
//     const errorMessage = 'Failed to assign role';
//     const mockAssignRole = jest.fn().mockRejectedValue(new Error(errorMessage));
//     mockUseMutation.mockReturnValue(mockAssignRole);
    
//     render(<AdminDashboard user={mockUser} />);
    
//     // Go to Users tab
//     fireEvent.click(screen.getByText('User Management'));
    
//     // Find the role select for the first user
//     const roleSelect = screen.getAllByRole('combobox')[0];
//     fireEvent.change(roleSelect, { target: { value: 'vendor' } });
    
//     await waitFor(() => {
//       expect(toast.error).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
//     });
//   });

//   it('displays loading state when data is being fetched', () => {
//     // Mock loading state
//     mockUseQuery.mockReturnValue(undefined);
    
//     render(<AdminDashboard user={mockUser} />);
    
//     expect(screen.getByRole('status')).toBeInTheDocument();
//     expect(screen.getByText('Loading...')).toBeInTheDocument();
//   });

//   it('displays empty state when no data is available', () => {
//     // Mock empty data
//     mockUseQuery.mockReturnValue([]);
    
//     render(<AdminDashboard user={mockUser} />);
    
//     // Go to Forms tab
//     fireEvent.click(screen.getByText('All Forms'));
    
//     expect(screen.getByText('No forms found')).toBeInTheDocument();
//   });
// });
