# API Documentation

## Table of Contents
- [Authentication](#authentication)
- [Users](#users)
- [Containers](#containers)
- [Orders](#orders)
- [Forms](#forms)
- [Photos](#photos)
- [Vendors](#vendors)
- [Transporters](#transporters)

## Authentication

### `signUp`
- **File**: `convex/users.ts`
- **Description**: Register a new user
- **Roles**: Public
- **Request**:
  ```typescript
  {
    email: string;
    name: string;
    password: string;
    role: 'admin' | 'employee' | 'vendor' | 'transporter';
  }
  ```
- **Response**: User object with authentication token

### `signIn`
- **File**: `convex/users.ts`
- **Description**: Authenticate user
- **Roles**: Public
- **Request**:
  ```typescript
  {
    email: string;
    password: string;
  }
  ```
- **Response**: User object with authentication token

## Users

### `getUsers`
- **File**: `convex/users.ts`
- **Description**: Get all users (Admin only)
- **Roles**: Admin
- **Response**: Array of user objects

### `getUser`
- **File**: `convex/users.ts`
- **Description**: Get current user profile
- **Roles**: Authenticated users
- **Response**: User object

## Containers

### `getContainers`
- **File**: `convex/containers.ts`
- **Description**: Get all containers
- **Roles**: Authenticated users
- **Query Parameters**:
  - `status`: Filter by status (optional)
  - `location`: Filter by location (optional)
- **Response**: Array of container objects

### `createContainer`
- **File**: `convex/containers.ts`
- **Description**: Create a new container
- **Roles**: Admin, Employee
- **Request**:
  ```typescript
  {
    containerNumber: string;
    status: 'available' | 'in-transit' | 'maintenance' | 'out-of-service';
    location: string;
  }
  ```
- **Response**: Created container object

## Orders

### `createOrder`
- **File**: `convex/forms.ts`
- **Description**: Create a new order
- **Roles**: Authenticated users
- **Request**: Form data based on form template
- **Response**: Created order object

### `getOrders`
- **File**: `convex/forms.ts`
- **Description**: Get orders with optional filters
- **Roles**: Authenticated users
- **Query Parameters**:
  - `status`: Filter by status (optional)
  - `userId`: Filter by user ID (optional, admin only)
- **Response**: Array of order objects

## Forms

### `createFormTemplate`
- **File**: `convex/forms.ts`
- **Description**: Create a new form template
- **Roles**: Admin
- **Request**: Form template definition
- **Response**: Created form template

### `getFormTemplates`
- **File**: `convex/forms.ts`
- **Description**: Get all form templates
- **Roles**: Authenticated users
- **Response**: Array of form templates

## Photos

### `uploadPhoto`
- **File**: `convex/photos.ts`
- **Description**: Upload a photo
- **Roles**: Authenticated users
- **Request**: FormData with photo file
- **Response**: Photo metadata

### `getPhotos`
- **File**: `convex/photos.ts`
- **Description**: Get photos by container ID
- **Roles**: Authenticated users
- **Parameters**:
  - `containerId`: ID of the container
- **Response**: Array of photo objects

## Vendors

### `getVendors`
- **File**: `convex/vendor.ts`
- **Description**: Get all vendors
- **Roles**: Admin, Employee
- **Response**: Array of vendor objects

## Transporters

### `getTransporters`
- **File**: `convex/transporters.ts`
- **Description**: Get all transporters
- **Roles**: Admin, Employee
- **Response**: Array of transporter objects

## Error Handling

All API errors follow the same format:
```typescript
{
  error: string;      // Error message
  code?: string;      // Error code (optional)
  status: number;     // HTTP status code
}
```

Common error codes:
- `UNAUTHORIZED`: User not authenticated
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request data

## Rate Limiting

API is rate limited to 1000 requests per minute per IP address. Exceeding this limit will result in a 429 status code.

## Versioning

API versioning is handled through the URL path (e.g., `/v1/containers`). The current version is `v1`.

## Pagination

List endpoints support pagination using `limit` and `offset` query parameters:

```
GET /api/containers?limit=20&offset=40
```

Response includes pagination metadata:
```typescript
{
  data: any[];        // Array of items
  total: number;      // Total number of items
  limit: number;      // Number of items per page
  offset: number;     // Current offset
}
```
