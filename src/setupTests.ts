import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Add TextEncoder and TextDecoder for JSDOM
Object.assign(global, { TextEncoder, TextDecoder });

// Mock Convex
jest.mock('../convex/_generated/api', () => ({
  api: {
    users: {
      getCurrentUser: { withArgs: jest.fn().mockReturnValue('mockedQuery') },
      listUsersWithRoles: { withArgs: jest.fn().mockReturnValue('mockedQuery') },
      assignRole: jest.fn().mockReturnValue('mockedMutation'),
      adminSetVendorPassword: jest.fn().mockReturnValue('mockedAction'),
    },
    forms: {
      listForms: { withArgs: jest.fn().mockReturnValue('mockedQuery') },
    },
    audit: {
      getRecentActivity: { withArgs: jest.fn().mockReturnValue('mockedQuery') },
    },
  },
}));

// Mock Convex hooks
jest.mock('convex/react', () => ({
  ...jest.requireActual('convex/react'),
  useQuery: jest.fn((query) => {
    if (query === 'mockedQuery') return [];
    return null;
  }),
  useMutation: jest.fn(() => jest.fn()),
  useAction: jest.fn(() => jest.fn()),
  useConvex: jest.fn(() => ({})),
  usePaginatedQuery: jest.fn(() => ({ results: [], status: 'LoadingFirstPage' })),
  usePaginatedQuery2: jest.fn(() => ({ results: [], status: 'LoadingFirstPage' })),
}));
