import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock Supabase client factory so src/lib/supabase uses our stubbed client
jest.mock('@supabase/supabase-js', () => {
  const mockFrom = jest.fn().mockReturnThis();
  const mockSelect = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });
  const mockInsert = jest.fn().mockResolvedValue({ data: [], error: null });
  const mockGetUser = jest.fn().mockResolvedValue({
    data: {
      user: {
        id: 'owner-user',
        user_metadata: { full_name: 'Property Owner' },
      },
    },
  });

  return {
    __esModule: true,
    createClient: jest.fn(() => ({
      from: mockFrom,
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      insert: mockInsert,
      auth: { getUser: mockGetUser },
    })),
    __mocks: { mockFrom, mockSelect, mockEq, mockOrder, mockInsert, mockGetUser },
  };
});

import ReviewManagement from '../../../../src/components/property/ReviewManagement';

// Mock the formatDate utility
jest.mock('../../../../src/lib/utils', () => ({
  __esModule: true,
  formatDate: (date: string) => `Formatted: ${date}`,
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}));

// Test data
const mockReview = {
  id: 'review-1',
  content: 'Great place to stay!',
  rating: 5,
  created_at: '2023-01-01T00:00:00.000Z',
  reviewer: {
    id: 'user-1',
    full_name: 'John Doe',
    avatar_url: 'https://example.com/avatar.jpg'
  },
  response: []
};

// Three reviews total; exactly one has a response -> 33.3% response rate
const mockReviews = [
  mockReview,
  {
    ...mockReview,
    id: 'review-2',
    content: 'Good experience overall',
    rating: 4,
    response: [{
      id: 'response-1',
      content: 'Thank you for your feedback!',
      created_at: '2023-01-02T00:00:00.000Z',
      responder: {
        id: 'owner-user',
        full_name: 'Property Owner'
      }
    }]
  },
  {
    ...mockReview,
    id: 'review-3',
    content: 'Decent stay',
    rating: 4,
    response: []
  }
];

// Get the mocks for test assertions and setup
const {
  mockFrom,
  mockOrder,
  mockInsert,
  mockGetUser,
} = require('@supabase/supabase-js').__mocks;

describe('ReviewManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    mockFrom.mockImplementation((_table?: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ 
        data: mockReviews, 
        error: null 
      }),
      insert: mockInsert,
    }));
    
    mockGetUser.mockResolvedValue({ 
      data: { 
        user: { 
          id: 'owner-user',
          email: 'owner@example.com'
        } 
      } 
    });
  });

  test('renders loading state initially', async () => {
    // Mock a pending promise to test loading state
    let resolvePromise: any;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    mockOrder.mockImplementationOnce(() => pendingPromise as any);
    
    render(<ReviewManagement propertyId="test-property" />);
    
    // Check for loading state
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    
    // Resolve the promise to avoid warnings
    resolvePromise({ data: mockReviews, error: null });
    await screen.findByText(mockReview.content);
  });

  test('displays reviews when loaded', async () => {
    render(<ReviewManagement propertyId="test-property" />);
    
    // Check for review content
    await waitFor(() => {
      expect(screen.getByText(mockReview.content)).toBeInTheDocument();
      expect(screen.getByText('Good experience overall')).toBeInTheDocument();
    });
    
    // Check for reviewer names (there may be multiple occurrences)
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    
    // Wait for data to load and find the first review
    const reviewContents = await screen.findAllByText(mockReview.content);
    expect(reviewContents.length).toBeGreaterThan(0);
    
    // Check that the first review's content is displayed
    expect(reviewContents[0]).toBeInTheDocument();
    
    // Check response rate (33.3%)
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });

  test('displays analytics cards with correct data', async () => {
    render(<ReviewManagement propertyId="test-property" />);
    
    // Wait for data to load
    await screen.findByText(mockReview.content);
    
    // Check average rating
    expect(screen.getByText('4.3')).toBeInTheDocument();
    
    // Check total reviews (scope within the card)
    const totalCard = screen.getByText('Total Reviews').closest('.p-6');
    expect(totalCard).toBeInTheDocument();
    expect(within(totalCard as HTMLElement).getByText('3')).toBeInTheDocument();
    
    // Check response rate (33.3%)
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });

  test('allows searching reviews', async () => {
    render(<ReviewManagement propertyId="test-property" />);
    
    // Wait for data to load
    await screen.findAllByText(mockReview.content);
    
    // Type in search input
    const searchInput = screen.getByPlaceholderText('Search reviews...');
    await userEvent.type(searchInput, 'great');
    
    // Verify the search is applied
    await waitFor(() => {
      expect(searchInput).toHaveValue('great');
    });
    
    // Clear search by clearing input
    await userEvent.clear(searchInput);
    
    // Verify search is cleared
    await waitFor(() => {
      expect(searchInput).toHaveValue('');
    });
  });

  test('allows sorting reviews', async () => {
    render(<ReviewManagement propertyId="test-property" />);
    
    // Wait for data to load
    await screen.findAllByText(mockReview.content);
    
    // Click sort by rating
    const sortButton = screen.getByText('Sort by Rating');
    await userEvent.click(sortButton);
    
    // Verify the sort direction changes
    await waitFor(() => {
      expect(sortButton).toHaveTextContent('Sort by Date');
    });
    
    // Click again to sort by newest
    await userEvent.click(sortButton);
    await waitFor(() => {
      expect(sortButton).toHaveTextContent('Sort by Rating');
    });
  });

  test('allows responding to a review', async () => {
    // Create a test review with a unique ID and content
    const testReview = {
      ...mockReview,
      id: 'test-review-123',
      content: 'This is a test review for response testing',
      response: []
    };
    
    // Mock the initial data load with our test review
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [testReview],
        error: null
      })
    }));
    
    // Mock the insert response
    mockInsert.mockResolvedValueOnce({ 
      data: [{
        ...testReview,
        response: [{
          id: 'new-response-1',
          content: 'Thank you for your feedback!',
          created_at: new Date().toISOString(),
          responder: {
            id: 'owner-user',
            full_name: 'Property Owner'
          }
        }]
      }], 
      error: null 
    });
    
    render(<ReviewManagement propertyId="test-property" />);
    
    // Wait for our specific test review to load
    const reviewContent = await screen.findByText(testReview.content);
    const reviewCard = reviewContent.closest('.p-6');
    expect(reviewCard).toBeInTheDocument();
    
    // Find and click the respond button on our test review
    const respondButton = within(reviewCard as HTMLElement).getByText('Respond to Review');
    await userEvent.click(respondButton);
    
    // Verify the modal is open by checking the heading
    expect(screen.getByRole('heading', { name: 'Respond to Review' })).toBeInTheDocument();
    
    // Type a response
    const textarea = screen.getByPlaceholderText('Write your response...');
    await userEvent.type(textarea, 'Thank you for your feedback!');
    
    // Click the submit button
    const submitButton = screen.getByRole('button', { name: /post response/i });
    await userEvent.click(submitButton);
    
    // Verify the API was called with the correct parameters
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        responder_id: 'owner-user',
        review_id: testReview.id,
        content: 'Thank you for your feedback!'
      });
    });
  });

  test('displays existing responses', async () => {
    // Create a test review with a response
    const testReview = {
      ...mockReview,
      id: 'test-review-with-response',
      content: 'This review has a response',
      response: [{
        id: 'test-response-1',
        content: 'Thank you for your feedback!',
        created_at: new Date().toISOString(),
        responder: {
          id: 'owner-user',
          full_name: 'Property Owner'
        }
      }]
    };
    
    // Mock the data load with our test review
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [testReview],
        error: null
      })
    }));
    
    render(<ReviewManagement propertyId="test-property" />);
    
    // Wait for our specific test review to load
    const reviewContent = await screen.findByText(testReview.content);
    const reviewCard = reviewContent.closest('.p-6');
    expect(reviewCard).toBeInTheDocument();
    
    // Check that the response is displayed within this review card
    const responseSectionHeading = within(reviewCard as HTMLElement).getByText('Your Response');
    expect(responseSectionHeading).toBeInTheDocument();
    expect(within(reviewCard as HTMLElement).getByText('Thank you for your feedback!')).toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    // Mock an error when loading reviews
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockRejectedValue(new Error('Failed to load reviews'))
    }));
    
    render(<ReviewManagement propertyId="test-property" />);
    
    // Should show loading state first
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    
    // Then show empty state after error
    await waitFor(() => {
      expect(screen.getByText(/no reviews found/i)).toBeInTheDocument();
    });
  });
});
