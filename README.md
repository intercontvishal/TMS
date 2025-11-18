# Transport Management System (TMS)

A comprehensive Transport Management System built with React, TypeScript, and Convex as the backend. This system facilitates container management, order processing, and transportation logistics for freight companies.

## Features

- **User Authentication & Authorization**
  - Role-based access control (Admin, Employee, Vendor, Transporter)
  - Secure authentication using Convex Auth

- **Container Management**
  - Track container status and location
  - Manage container assignments and history
  - Photo documentation

- **Order Management**
  - Create and track orders
  - Form builder for custom order forms
  - Real-time order status updates

- **Vendor & Transporter Portal**
  - Vendor dashboard for order management
  - Transporter vehicle tracking
  - Document management

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Convex (Serverless Backend)
- **Authentication**: Convex Auth
- **State Management**: React Context API
- **Testing**: Jest, React Testing Library

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── AdminDashboard.tsx
│   ├── ContainerManager.tsx
│   ├── Dashboard.tsx
│   └── ...
├── __tests__/           # Test files
├── lib/                 # Utility functions
└── App.tsx              # Main application component

convex/
├── _generated/          # Auto-generated Convex types and API
├── access.ts            # Access control rules
├── containers.ts        # Container management functions
├── forms.ts             # Form builder logic
├── schema.ts           # Database schema
└── users.ts            # User management
```

## Getting Started

### Prerequisites

- Node.js 16+ and npm 8+
- Convex CLI (`npm install -g convex`)
- Convex account (sign up at [convex.dev](https://convex.dev))

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Update the environment variables in .env.local
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## API Documentation

### Authentication

All API endpoints require authentication. Include the authentication token in the `Authorization` header:
```
Authorization: Bearer <token>
```

### Core Endpoints

#### Containers
- `GET /api/containers` - List all containers
- `POST /api/containers` - Create a new container
- `GET /api/containers/:id` - Get container details
- `PUT /api/containers/:id` - Update container
- `DELETE /api/containers/:id` - Remove container

#### Orders
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status

#### Users
- `GET /api/users/me` - Get current user profile
- `GET /api/users` - List all users (Admin only)
- `POST /api/users` - Create new user (Admin only)

## Database Schema

### Collections

#### Users
```typescript
{
  _id: Id<"users">
  name: string
  email: string
  role: 'admin' | 'employee' | 'vendor' | 'transporter'
  createdAt: number
  updatedAt: number
}
```

#### Containers
```typescript
{
  _id: Id<"containers">
  containerNumber: string
  status: 'available' | 'in-transit' | 'maintenance' | 'out-of-service'
  location: string
  currentOrder?: Id<"orders">
  lastMaintenance?: number
  createdAt: number
  updatedAt: number
}
```

## Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test -- --watch
```

## Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy to Convex:
   ```bash
   npx convex deploy
   ```

3. Deploy the frontend to your preferred hosting service (Vercel, Netlify, etc.)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
