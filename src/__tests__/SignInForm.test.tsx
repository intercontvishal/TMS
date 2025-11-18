import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignInForm } from '../SignInForm';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';

// Mock the dependencies
jest.mock('@convex-dev/auth/react');
jest.mock('convex/react');
jest.mock('sonner');

const mockSignIn = jest.fn();
const mockSetMyName = jest.fn();

beforeEach(() => {
  (useAuthActions as jest.Mock).mockReturnValue({
    signIn: mockSignIn,
  });
  
  (useMutation as jest.Mock).mockReturnValue(mockSetMyName);
  
  mockSignIn.mockResolvedValue(undefined);
  mockSetMyName.mockResolvedValue(undefined);
  
  // Clear all mocks before each test
  jest.clearAllMocks();
});

describe('SignInForm', () => {
  it('renders sign in form by default', () => {
    render(<SignInForm />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account\?/i)).toBeInTheDocument();
  });

  it('switches to sign up form when clicking sign up link', () => {
    render(<SignInForm />);
    
    const signUpLink = screen.getByText(/sign up/i);
    fireEvent.click(signUpLink);
    
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('submits sign in form with email and password', async () => {
    render(<SignInForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('password', expect.any(FormData));
    });
  });

  it('shows loading state when submitting', async () => {
    // Make the signIn promise take some time to resolve
    mockSignIn.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );
    
    render(<SignInForm />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);
    
    expect(screen.getByRole('button', { name: /signing in.../i })).toBeDisabled();
    
    // Clean up
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled();
    });
  });

  it('shows error message when sign in fails', async () => {
    const errorMessage = 'Invalid credentials';
    mockSignIn.mockRejectedValue(new Error(errorMessage));
    
    render(<SignInForm />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Invalid email or password'));
    });
  });

  it('submits sign up form with name, email, and password', async () => {
    render(<SignInForm />);
    
    // Switch to sign up form
    const signUpLink = screen.getByText(/sign up/i);
    fireEvent.click(signUpLink);
    
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('password', expect.any(FormData));
      expect(mockSetMyName).toHaveBeenCalledWith({ name: 'Test User' });
    });
  });
});
