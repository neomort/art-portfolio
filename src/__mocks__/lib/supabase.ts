// This is a complete mock replacement for the supabase module
// We're not importing anything from the actual module to avoid import.meta issues

// Mock Supabase client
export const supabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: jest.fn(),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    refreshSession: jest.fn(),
    onAuthStateChange: jest.fn((event, callback) => {
      // Simulate auth state change
      if (event === 'INITIAL_SESSION') {
        callback('INITIAL_SESSION', null);
      }
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
  },
};

// Mock auth functions
export const signIn = jest.fn().mockImplementation((email, password) => ({
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
}));

export const signUp = jest.fn().mockResolvedValue({ data: null, error: null });
export const getCurrentUser = jest.fn().mockResolvedValue({ user: null, error: null });
export const updateProfile = jest.fn().mockResolvedValue({ data: null, error: null });
export const fetchProfile = jest.fn().mockResolvedValue({ data: null, error: null });
export const createProfile = jest.fn().mockResolvedValue({ data: null, error: null });

export type Database = any;
