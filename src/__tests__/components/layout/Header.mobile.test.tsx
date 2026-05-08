import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import Header from '../../../components/layout/Header';

// Mock the AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));

// Mock the Logo component
jest.mock('../../../components/layout/Logo', () => ({
  __esModule: true,
  default: () => <div data-testid="logo" />,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Building2: () => <div data-testid="building-icon" />,
  Menu: () => <div data-testid="menu-icon" />,
  X: () => <div data-testid="close-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  User: () => <div data-testid="user-icon" />,
}));

// Mock user data
const mockUser = {
  id: '123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  is_admin: false,
};

const mockAdminUser = {
  ...mockUser,
  is_admin: true,
};

describe('Header Mobile Menu', () => {
  const mockAuth = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
    register: jest.fn().mockResolvedValue(undefined),
    checkSessionStatus: jest.fn().mockResolvedValue(undefined),
  };

  const renderHeader = (user: any = null, isAuthenticated = false) => {
    mockAuth.user = user;
    mockAuth.isAuthenticated = isAuthenticated;
    (useAuth as jest.Mock).mockReturnValue(mockAuth);

    return render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.user = null;
    mockAuth.isAuthenticated = false;
    // Mock window.matchMedia for mobile view
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: true, // Simulate mobile view
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  test('shows mobile menu items for authenticated user', () => {
    renderHeader(mockUser, true);
    
    // Open mobile menu
    fireEvent.click(screen.getByTestId('menu-icon'));
    
    // Check for mobile menu items within the mobile menu container
    const mobileMenu = screen.getByTestId('mobile-menu');
    expect(within(mobileMenu).getByText('Dashboard')).toBeInTheDocument();
    expect(within(mobileMenu).getByText('Favorites')).toBeInTheDocument();
    expect(within(mobileMenu).getByText('Messages')).toBeInTheDocument();
    expect(within(mobileMenu).getByText('Profile')).toBeInTheDocument();
    expect(within(mobileMenu).getByText('Sign Out')).toBeInTheDocument();
  });

  test('shows admin link for admin users in mobile menu', () => {
    renderHeader(mockAdminUser, true);
    
    // Open mobile menu
    fireEvent.click(screen.getByTestId('menu-icon'));
    
    // Check for admin link within the mobile menu
    const mobileMenu = screen.getByTestId('mobile-menu');
    expect(within(mobileMenu).getByText('Admin')).toBeInTheDocument();
  });

  test('calls signOut when clicking sign out in mobile menu', async () => {
    const signOutSpy = jest.spyOn(mockAuth, 'signOut');
    renderHeader(mockUser, true);
    
    // Open mobile menu
    fireEvent.click(screen.getByTestId('menu-icon'));
    
    // Click sign out
    const mobileMenu = screen.getByTestId('mobile-menu');
    const signOutButton = within(mobileMenu).getByRole('button', { name: 'Sign Out' });
    fireEvent.click(signOutButton);
    
    await waitFor(() => expect(signOutSpy).toHaveBeenCalledTimes(1));
    signOutSpy.mockRestore();
  });

  test('closes mobile menu when clicking a link', async () => {
    renderHeader(mockUser, true);
    
    // Open mobile menu
    fireEvent.click(screen.getByTestId('menu-icon'));
    
    // Click the anchor link 'Dashboard' inside the mobile menu
    const mobileMenu = screen.getByTestId('mobile-menu');
    const dashboardLink = within(mobileMenu).getByRole('link', { name: 'Dashboard' });
    fireEvent.click(dashboardLink);
    
    // Menu should be closed (close icon should not be visible)
    await waitFor(() => expect(screen.queryByTestId('close-icon')).not.toBeInTheDocument());
  });

  test('shows sign in link when not authenticated', () => {
    renderHeader();
    
    // Open mobile menu
    fireEvent.click(screen.getByTestId('menu-icon'));
    
    // Should show sign in link
    // Component label is 'Sign in' (lowercase i)
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });
});
