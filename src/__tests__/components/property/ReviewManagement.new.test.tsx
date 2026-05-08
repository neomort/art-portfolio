import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ReviewManagement from '../../../../src/components/property/ReviewManagement';

// Supabase mock singleton to avoid TDZ
jest.mock('@supabase/supabase-js', () => {
  const client = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'owner-user', user_metadata: { full_name: 'Property Owner' } } },
      }),
    },
  };
  return { __esModule: true, createClient: jest.fn(() => client), __mockClient: client };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mockClient: supabaseMock } = require('@supabase/supabase-js');

// Mock the formatDate utility
jest.mock('../../../../src/lib/utils', () => ({
  __esModule: true,
  formatDate: (date: string) => `Formatted: ${date}`,
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}));

// Test data
const mockReview = {
  id: 'review-1',
  property_id: 'test-property',
  content: 'Great place to stay!',
  rating: 5,
  created_at: '2023-01-01T00:00:00.000Z',
  reviewer_id: 'user-1',
  reviewer: {
    full_name: 'John Doe',
    avatar_url: 'https://example.com/avatar.jpg'
  },
  response: []
};

describe('ReviewManagement', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementation
    supabaseMock.from.mockReturnThis();
    supabaseMock.select.mockReturnThis();
    supabaseMock.eq.mockReturnThis();
    supabaseMock.order.mockResolvedValue({ 
      data: [mockReview], 
      error: null 
    });
  });

  test('renders review management component', async () => {
    render(<ReviewManagement propertyId="test-property" />);
    
    // Wait for data to load and content to appear
    await screen.findByText(mockReview.content);
    
    // Check if the review content is displayed
    expect(screen.getByText(mockReview.content)).toBeInTheDocument();
  });

  test('allows responding to a review', async () => {
    // Setup test review with a unique ID and content
    const testReview = {
      ...mockReview,
      id: 'test-review-123',
      content: 'This is a test review for response testing',
    };
    
    // Mock the initial data load
    supabaseMock.order.mockResolvedValueOnce({ 
      data: [testReview], 
      error: null 
    });
    
    // Mock the insert response
    supabaseMock.insert.mockResolvedValueOnce({ 
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
    
    // Find and click the respond button
    const respondButton = within(reviewCard as HTMLElement).getByText('Respond to Review');
    await userEvent.click(respondButton);
    
    // Verify the modal is open (title heading)
    expect(screen.getByRole('heading', { name: 'Respond to Review' })).toBeInTheDocument();
    
    // Type a response
    const textarea = screen.getByPlaceholderText('Write your response...');
    await userEvent.type(textarea, 'Thank you for your feedback!');
    
    // Click the submit button
    const submitButton = screen.getByRole('button', { name: /post response/i });
    await userEvent.click(submitButton);
    
    // Verify the API was called with the correct parameters
    await waitFor(() => {
      expect(supabaseMock.insert).toHaveBeenCalledWith({
        responder_id: 'owner-user',
        review_id: testReview.id,
        content: 'Thank you for your feedback!'
      });
    });
  });

  test('handles API errors gracefully', async () => {
    // Mock an error when loading reviews
    supabaseMock.order.mockRejectedValueOnce(new Error('Failed to load reviews'));
    
    render(<ReviewManagement propertyId="test-property" />);
    
    // Should show loading state first
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    
    // Then show error state
    await waitFor(() => {
      expect(screen.getByText(/no reviews found/i)).toBeInTheDocument();
    });
  });
});
