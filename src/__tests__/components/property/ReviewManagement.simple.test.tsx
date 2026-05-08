/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Component under test
import ReviewManagement from '../../../../src/components/property/ReviewManagement';

// Create a type for our mock Supabase instance
type MockSupabase = {
  from: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  data: any[];
  error: Error | null;
  then: (resolve: (value: { data: any; error: Error | null }) => void) => MockSupabase;
};

// Mock the Supabase client
const createMockSupabase = (): { supabase: MockSupabase } => {
  const mockSupabase: MockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    data: [],
    error: null,
    then: function(resolve) {
      // Use process.nextTick to simulate async behavior
      process.nextTick(() => {
        resolve({ data: this.data, error: this.error });
      });
      return this;
    },
  };
  
  return { supabase: mockSupabase };
};

// Mock the Supabase module
jest.mock('../../../../src/lib/supabase', () => createMockSupabase());

// Mock the utils module
jest.mock('../../../../src/lib/utils', () => ({
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

// Mock the lucide-react icons
jest.mock('lucide-react', () => ({
  Star: () => <div data-testid="star-icon">Star</div>,
  Search: () => <div data-testid="search-icon">Search</div>,
  Filter: () => <div data-testid="filter-icon">Filter</div>,
  ArrowUpDown: () => <div data-testid="arrow-up-down-icon">ArrowUpDown</div>,
  BarChart2: () => <div data-testid="bar-chart-icon">BarChart2</div>,
}));

// Mock the UI components
jest.mock('../../../../src/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="card">{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h3 data-testid="card-title">{children}</h3>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="card-content">{children}</div>
  ),
}));

jest.mock('../../../../src/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
    <button {...props} data-testid="button">{children}</button>
  ),
}));

jest.mock('../../../../src/components/ui/input', () => ({
  Input: ({ icon, ...props }: { icon: React.ReactNode; [key: string]: any }) => (
    <div className="relative">
      {icon && <div data-testid="input-icon">{icon}</div>}
      <input {...props} data-testid="input" />
    </div>
  ),
}));

describe('ReviewManagement', () => {
  let mockSupabase: MockSupabase;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Get a fresh mock instance
    const { supabase } = require('../../../../src/lib/supabase');
    mockSupabase = supabase;
    
    // Default mock data
    mockSupabase.data = [];
    mockSupabase.error = null;
  });

  it('should display loading spinner on initial render', () => {
    // Act
    render(<ReviewManagement propertyId="test-property" />);
    
    // Assert
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('should handle errors gracefully without showing error messages to users', async () => {
    // Arrange
    const errorMessage = 'Failed to load reviews';
    mockSupabase.error = new Error(errorMessage);
    
    // Act
    render(<ReviewManagement propertyId="test-property" />);
    
    // Assert - Initial loading state
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    
    // Verify no error message is shown to users
    expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('should display reviews when data is loaded successfully', async () => {
    // Arrange
    const mockReview = {
      id: '1',
      rating: 5,
      content: 'Great place!',
      created_at: '2023-01-01T00:00:00.000Z',
      reviewer: {
        full_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
      },
      response: [],
      verified_booking: true,
    };
    mockSupabase.data = [mockReview];
    
    // Act
    render(<ReviewManagement propertyId="test-property" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      expect(screen.getByText(mockReview.content)).toBeInTheDocument();
    });
    
    // Assert
    expect(screen.getByText(mockReview.reviewer.full_name)).toBeInTheDocument();
    expect(screen.getByText('Verified Booking')).toBeInTheDocument();
  });

  it('should display empty state when there are no reviews', async () => {
    // Arrange
    mockSupabase.data = [];
    
    // Act
    render(<ReviewManagement propertyId="test-property" />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    
    // Assert
    expect(screen.getByText('No Reviews Found')).toBeInTheDocument();
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
  });

  it('should filter reviews when searching', async () => {
    // Arrange
    const mockReviews = [
      {
        id: '1',
        rating: 5,
        content: 'Great place!',
        created_at: '2023-01-01T00:00:00.000Z',
        reviewer: { full_name: 'Test User' },
        response: [],
      },
      {
        id: '2',
        rating: 3,
        content: 'Average experience',
        created_at: '2023-01-02T00:00:00.000Z',
        reviewer: { full_name: 'Another User' },
        response: [],
      },
    ];
    mockSupabase.data = mockReviews;

    // Act - Render component
    render(<ReviewManagement propertyId="test-property" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Act - Search for a specific review
    const searchTerm = 'average';
    const searchInput = screen.getByPlaceholderText('Search reviews...');
    await userEvent.type(searchInput, searchTerm);

    // Assert
    expect(screen.queryByText('Great place!')).not.toBeInTheDocument();
    expect(screen.getByText('Average experience')).toBeInTheDocument();
  });
});
