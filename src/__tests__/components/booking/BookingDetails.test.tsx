import { render, screen, fireEvent, within } from '../../utils/test-utils';
import BookingDetails from '../../../components/booking/BookingDetails';
import { mockBooking } from '../../utils/test-utils';

// Mock the cancelBooking function
jest.mock('../../../lib/api/booking', () => ({
  cancelBooking: jest.fn().mockResolvedValue(undefined),
}));

// Mock the calendar module
jest.mock('../../../lib/calendar', () => ({
  generateCalendarEvent: jest.fn().mockReturnValue({
    title: 'Test Event',
    start: '2025-08-01T10:00:00.000Z',
    end: '2025-08-03T18:00:00.000Z',
    location: 'Test Location',
  }),
}));

describe('BookingDetails', () => {
  const mockOnClose = jest.fn();
  const mockOnBookingUpdated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders booking details correctly', () => {
    render(
      <BookingDetails 
        booking={mockBooking} 
        onClose={mockOnClose} 
        onBookingUpdated={mockOnBookingUpdated} 
      />
    );

    // Check property name
    expect(screen.getByText('Test Property')).toBeInTheDocument();
    
    // Check for status - case insensitive and might be part of a larger string
    const statusElement = screen.getByText(/confirmed/i, { exact: false });
    expect(statusElement).toBeInTheDocument();
    
    // Check booking dates - the component uses MM/DD/YYYY format
    // We'll look for dates in the format 08/01/2025 and 08/03/2025
    // The dates might be part of a larger string, so we'll use a more flexible approach
    const documentText = document.body.textContent || '';
    expect(documentText).toMatch(/08[/-]01[/-]2025/); // Start date
    expect(documentText).toMatch(/08[/-]03[/-]2025/); // End date
    
    // Check price - the component shows base price as $1,000.00
    // We'll look for the exact format used in the component
    expect(documentText).toMatch(/\$1,000\.00/);
  });

  it('displays property address', () => {
    render(
      <BookingDetails 
        booking={mockBooking} 
        onClose={mockOnClose} 
        onBookingUpdated={mockOnBookingUpdated} 
      />
    );

    // The address is split across multiple elements in the component
    // Check for the street address
    expect(screen.getByText('123 Test St')).toBeInTheDocument();
    
    // Check for city and state (they might be in the same element)
    expect(screen.getByText(/Test City/i)).toBeInTheDocument();
    
    // Check for the map pin icon which indicates the location
    const mapPin = screen.getByTestId('map-pin-icon');
    expect(mapPin).toBeInTheDocument();
  });

  it('displays contact information', () => {
    render(
      <BookingDetails 
        booking={mockBooking} 
        onClose={mockOnClose} 
        onBookingUpdated={mockOnBookingUpdated} 
      />
    );

    expect(screen.getByText('Property Owner')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('123-456-7890')).toBeInTheDocument();
  });

  it('displays view message thread button when inquiry is available', () => {
    // Create a test booking with an inquiry
    const testBooking = {
      ...mockBooking,
      inquiry: {
        id: 'inquiry-123',
        message: 'Test inquiry message'
      }
    };
    
    render(
      <BookingDetails 
        booking={testBooking} 
        onClose={mockOnClose} 
        onBookingUpdated={mockOnBookingUpdated} 
      />
    );

    // Look for the view message thread button
    const viewThreadButton = screen.getByRole('button', { 
      name: /view message thread/i,
      hidden: true // Include hidden elements in the search
    });
    
    expect(viewThreadButton).toBeInTheDocument();
    
    // Check that the button contains the message icon by its class
    const messageIcon = within(viewThreadButton).getByTestId('message-icon');
    expect(messageIcon).toBeInTheDocument();
    expect(messageIcon).toHaveClass('lucide-message-square');
  });
  
  it('shows no associated inquiry message when no inquiry exists', () => {
    // Create a test booking without an inquiry
    const testBooking = {
      ...mockBooking,
      inquiry: null
    };
    
    render(
      <BookingDetails 
        booking={testBooking} 
        onClose={mockOnClose} 
        onBookingUpdated={mockOnBookingUpdated} 
      />
    );
    
    // Check for the no associated inquiry message
    expect(screen.getByText('No associated inquiry')).toBeInTheDocument();
  });

  it('shows cancel booking button when booking is cancellable', () => {
    // Create a test booking that should show the cancel button
    const testBooking = {
      ...mockBooking,
      status: 'confirmed',
      start_date: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
      property: {
        ...mockBooking.property,
        venue_id: 'test-user-id' // Set venue_id to match the mock user ID
      }
    };
    
    render(
      <BookingDetails 
        booking={testBooking} 
        onClose={mockOnClose} 
        onBookingUpdated={mockOnBookingUpdated} 
      />
    );

    // Find the cancel button by test ID
    const cancelButton = screen.getByTestId('cancel-booking-button');
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toHaveTextContent('Cancel Booking');
  });

  it('shows cancel confirmation modal when cancel button is clicked', async () => {
    // Create a test booking that should show the cancel button
    const testBooking = {
      ...mockBooking,
      status: 'confirmed',
      start_date: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
      property: {
        ...mockBooking.property,
        venue_id: 'test-user-id' // Set venue_id to match the mock user ID
      }
    };
    
    render(
      <BookingDetails 
        booking={testBooking} 
        onClose={mockOnClose} 
        onBookingUpdated={mockOnBookingUpdated} 
      />
    );

    // Find and click the cancel button by test ID
    const cancelButton = screen.getByTestId('cancel-booking-button');
    fireEvent.click(cancelButton);

    // Find the modal by its content since there are multiple elements with 'Cancel Booking' text
    const modal = await screen.findByRole('heading', { 
      name: 'Cancel Booking',
      level: 3
    });
    
    // Get the dialog container by finding the closest parent with the expected class
    const dialogContainer = modal.closest('.fixed.inset-0.z-50');
    
    // Check for the confirmation text within the dialog
    const confirmationText = within(dialogContainer as HTMLElement).getByText(
      /are you sure you want to cancel this booking\?/i,
      { exact: false }
    );
    expect(confirmationText).toBeInTheDocument();
    
    // Check for the buttons within the dialog
    expect(within(dialogContainer as HTMLElement).getByRole('button', { 
      name: /keep booking/i 
    })).toBeInTheDocument();
    
    expect(within(dialogContainer as HTMLElement).getByRole('button', { 
      name: /confirm cancellation/i 
    })).toBeInTheDocument();
  });

  it('displays inquiry details when available', async () => {
    // Create a test booking with inquiry details
    const testBooking = {
      ...mockBooking,
      inquiry: {
        message: 'Space Requirements: 1000 sq ft\nAbout the Brand: Test Brand\nComments: Test comments'
      }
    };
    
    render(
      <BookingDetails 
        booking={testBooking} 
        onClose={mockOnClose} 
        onBookingUpdated={mockOnBookingUpdated} 
      />
    );

    // Check for the presence of inquiry details in the document
    // Using findAllByText to get all matching elements
    const spaceRequirementsLabels = await screen.findAllByText(/Space Requirements/i);
    expect(spaceRequirementsLabels.length).toBeGreaterThan(0);
    
    const spaceRequirementsValues = await screen.findAllByText(/1000 sq ft/i);
    expect(spaceRequirementsValues.length).toBeGreaterThan(0);
    
    const aboutBrandLabels = await screen.findAllByText(/About the Brand/i);
    expect(aboutBrandLabels.length).toBeGreaterThan(0);
    
    const brandValues = await screen.findAllByText(/Test Brand/i);
    expect(brandValues.length).toBeGreaterThan(0);
    
    const commentsLabels = await screen.findAllByText(/Comments/i);
    expect(commentsLabels.length).toBeGreaterThan(0);
    
    const commentsValues = await screen.findAllByText(/Test comments/i);
    expect(commentsValues.length).toBeGreaterThan(0);
    
    // Check that at least one of each label and value is in the document
    expect(spaceRequirementsLabels.some(el => el.textContent?.includes('Space Requirements'))).toBe(true);
    expect(spaceRequirementsValues.some(el => el.textContent?.includes('1000 sq ft'))).toBe(true);
    expect(aboutBrandLabels.some(el => el.textContent?.includes('About the Brand'))).toBe(true);
    expect(brandValues.some(el => el.textContent?.includes('Test Brand'))).toBe(true);
    expect(commentsLabels.some(el => el.textContent?.includes('Comments'))).toBe(true);
    expect(commentsValues.some(el => el.textContent?.includes('Test comments'))).toBe(true);
  });
});
