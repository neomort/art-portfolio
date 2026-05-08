import { render, act, waitFor, fireEvent, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Mock user data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' },
};

// Mock the supabase module
jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn(),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      refreshSession: jest.fn(),
      onAuthStateChange: jest.fn((event, callback) => {
        if (event === 'INITIAL_SESSION') {
          callback('INITIAL_SESSION', null);
        }
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
  },
  fetchProfile: jest.fn().mockResolvedValue({
    data: {
      id: 'test-user-id',
      email: 'test@example.com',
      full_name: 'Test User',
      is_admin: false
    },
    error: null
  }),
  createProfile: jest.fn().mockResolvedValue({
    data: {
      id: 'test-user-id',
      email: 'test@example.com',
      full_name: 'Test User',
      is_admin: false
    },
    error: null
  }),
  signIn: jest.fn().mockImplementation((email: string) => ({
    data: { 
      user: { 
        id: 'test-user-id', 
        email, 
        user_metadata: { full_name: 'Test User' } 
      }, 
      session: { 
        user: { 
          id: 'test-user-id', 
          email, 
          user_metadata: { full_name: 'Test User' } 
        } 
      } 
    },
    error: null
  })),
  signUp: jest.fn(),
  getCurrentUser: jest.fn().mockResolvedValue({ user: null, error: null }),
  updateProfile: jest.fn(),
}));

// Import the mock after setting it up
import { supabase, signIn } from '../../lib/supabase';

// Test component that uses the auth context
const TestComponent = () => {
  const { user, loading, signIn, signOut } = useAuth();
  return (
    <div>
      <div data-testid="user-email">{user?.email || 'no-user'}</div>
      <div data-testid="loading">{loading.toString()}</div>
      <button onClick={() => signIn('test@example.com', 'password')} data-testid="signin">
        Sign In
      </button>
      <button onClick={signOut} data-testid="signout">
        Sign Out
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with loading state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    expect(screen.getByTestId('loading').textContent).toBe('true');
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('handles sign in flow', async () => {
    // Set up the auth state change mock first
    let authStateCallback: any;
    const mockUnsubscribe = jest.fn();
    
    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    // Mock the sign in response
    const signInResponse = {
      data: { 
        user: mockUser, 
        session: { 
          user: mockUser,
          access_token: 'test-token',
        }
      },
      error: null,
    };
    
    const signInMock = jest.fn().mockResolvedValue(signInResponse);
    (supabase.auth.signInWithPassword as jest.Mock) = signInMock;

    // Create a test component that shows the current auth state
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial load to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Click the sign in button
    const signInButton = screen.getByTestId('signin');
    await act(async () => {
      fireEvent.click(signInButton);
    });

    // Verify the sign in was called with correct credentials
    expect(signIn).toHaveBeenCalledWith('test@example.com', 'password');

    // Simulate auth state change after sign in
    await act(async () => {
      authStateCallback('SIGNED_IN', {
        user: mockUser,
        session: { access_token: 'test-token' },
      });
    });

    // Wait for the user state to update
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });
  });

  it('handles sign out', async () => {
    // Set up the auth state change mock
    let authStateCallback: any;
    const mockUnsubscribe = jest.fn();
    
    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
      authStateCallback = callback;
      // Simulate initial auth state
      setTimeout(() => {
        callback('SIGNED_IN', {
          user: { 
            id: 'test-user-id', 
            email: 'test@example.com', 
            user_metadata: { full_name: 'Test User' } 
          },
          session: { access_token: 'test-token' }
        });
      }, 0);
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });
    
    // Mock sign out
    const signOutMock = jest.fn().mockResolvedValue({ error: null });
    (supabase.auth.signOut as jest.Mock) = signOutMock;

    // Mock fetchProfile to return a valid profile
    const { fetchProfile } = require('../../lib/supabase');
    (fetchProfile as jest.Mock).mockResolvedValueOnce({
      data: {
        id: 'test-user-id',
        email: 'test@example.com',
        full_name: 'Test User',
        is_admin: false
      },
      error: null
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial render and auth state to be set
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    // Click the sign out button
    await act(async () => {
      fireEvent.click(screen.getByTestId('signout'));
    });

    // Verify sign out was called
    expect(signOutMock).toHaveBeenCalled();
    
    // Simulate auth state change after sign out
    await act(async () => {
      authStateCallback('SIGNED_OUT', null);
    });
    
    // Verify user is signed out
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('no-user');
    });
  });
});
