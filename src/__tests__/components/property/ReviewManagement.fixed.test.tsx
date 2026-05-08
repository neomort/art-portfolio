import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ReviewManagement from '../../../../src/components/property/ReviewManagement';

// Mock the Supabase client with a module-exposed singleton to avoid TDZ
jest.mock('@supabase/supabase-js', () => {
  const client = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      }),
    },
  };
  return { __esModule: true, createClient: jest.fn(() => client), __mockClient: client };
});

// Bind the singleton mock client once to avoid redeclarations
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
  rating: 5,
  content: 'Great place to stay!',
  created_at: '2023-01-01T00:00:00.000Z',
  reviewer_id: 'user-1',
  reviewer: {
    full_name: 'John Doe',
    avatar_url: 'https://example.com/avatar.jpg'
  },
  response: []
};

describe('ReviewManagement', () => {
  const renderComponent = () => {
    return render(<ReviewManagement propertyId="test-property" />);
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    supabaseMock.from.mockReturnThis();
    supabaseMock.select.mockReturnThis();
    supabaseMock.eq.mockReturnThis();
    supabaseMock.order.mockResolvedValue({ data: [mockReview], error: null });
  });

  test('renders review management component', async () => {
    renderComponent();
    
    // Wait for data to load and content to appear
    await screen.findByText(mockReview.content);
  });

  test('displays review statistics', async () => {
    // Mock the reviews data with multiple ratings
    const mockReviews = [
      { ...mockReview, id: '1', rating: 5 },
      { ...mockReview, id: '2', rating: 4 },
      { ...mockReview, id: '3', rating: 5, response: [{}] } // Has a response
    ];
    
    supabaseMock.order.mockResolvedValueOnce({ 
      data: mockReviews, 
      error: null 
    });
    
    renderComponent();
    
    // Check if statistics are displayed
    await waitFor(() => {
      // Average rating rounded to one decimal (4.7)
      expect(screen.getByText(/4.7/)).toBeInTheDocument();
      // Total Reviews card should show numeric 3
      const totalReviewsCard = screen.getByText('Total Reviews').closest('.p-6');
      expect(totalReviewsCard).toBeInTheDocument();
      expect(within(totalReviewsCard as HTMLElement).getByText('3')).toBeInTheDocument();
      // Response rate percentage shows one decimal (33.3%)
      expect(screen.getByText(/33.3%/)).toBeInTheDocument();
    });
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
        id: 'new-response-1',
        content: 'Thank you for your feedback!',
        created_at: new Date().toISOString(),
        responder_id: 'test-user-id',
        review_id: testReview.id
      }], 
      error: null 
    });
    
    renderComponent();
    
    // Wait for the test review to load
    const reviewContent = await screen.findByText(testReview.content);
    const reviewCard = reviewContent.closest('.p-6');
    expect(reviewCard).toBeInTheDocument();
    
    // Find and click the respond button
    const respondButton = within(reviewCard as HTMLElement).getByRole('button', { name: 'Respond to Review' });
    await userEvent.click(respondButton);
    
    // Verify the modal is open
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
        responder_id: 'test-user-id',
        review_id: testReview.id,
        content: 'Thank you for your feedback!'
      });
    });
  });

  test('handles API errors gracefully', async () => {
    // Mock an error when loading reviews
    supabaseMock.order.mockRejectedValueOnce(new Error('Failed to load reviews'));
    
    renderComponent();
    
    // Should show empty state when error occurs
    await waitFor(() => {
      expect(screen.getByText('No Reviews Found')).toBeInTheDocument();
    });
  });
});
