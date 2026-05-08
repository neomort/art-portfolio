import { render, screen, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PropertyCard from '../../../components/property/PropertyCard';
import type { Property } from '../../../types';
import { addDays } from 'date-fns';
import type { RenderResult } from '@testing-library/react';

// Create a custom render function with Router
const renderWithRouter = (
  ui: React.ReactElement, 
  { route = '/' } = {}
): { router: ReturnType<typeof createMemoryRouter> } & RenderResult => {
  // Create a memory router with the future flags
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: ui,
      },
      {
        path: '/properties/:id',
        element: <div data-testid="property-detail">Property Detail</div>,
      },
    ],
    {
      initialEntries: [route],
      future: {
        // Use only the flags that are actually supported
        v7_relativeSplatPath: true,
      },
    }
  );

  return {
    ...render(<RouterProvider router={router} />),
    router,
  };
};

describe('PropertyCard', () => {
  const createMockProperty = (overrides: Partial<Property> = {}): Property => ({
    id: '1',
    title: 'Test Property',
    description: 'Test Description',
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'TS',
      postal_code: '12345',
      country: 'Test Country',
      latitude: 0,
      longitude: 0,
    },
    images: ['image1.jpg', 'image2.jpg', 'image3.jpg'],
    price_per_day: 100,
    inquire_for_pricing: false,
    square_feet: 1500,
    amenities: [],
    property_type: 'storefront',
    availability: [],
    weekly_rate_type: 'percentage',
    weekly_rate_value: 10,
    monthly_rate_type: 'percentage',
    monthly_rate_value: 15,
    yearly_rate_type: 'percentage',
    yearly_rate_value: 20,
    venue_id: 'venue1',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    featured: false,
    published: true,
    ...overrides,
  });
  
  let mockProperty: Property;

  const renderComponent = (props = {}) => {
    mockProperty = createMockProperty();
    const defaultProps = {
      property: mockProperty,
      rating: 4.5,
      totalReviews: 10,
      isFavorited: false,
      onToggleFavorite: jest.fn(),
      ...props,
    };
    
    return renderWithRouter(
      <PropertyCard {...defaultProps} />,
      { route: '/' }
    );
  };
  
  // Helper to find the current image (commented out as it's not currently used)
  // const getCurrentImage = () => screen.getByRole('img', { name: /test property/i });

  test('renders property title and basic info', () => {
    renderComponent();
    
    expect(screen.getByText('Test Property')).toBeInTheDocument();
    expect(screen.getByText('Test City, TS')).toBeInTheDocument();
    expect(screen.getByText('1,500 sq ft')).toBeInTheDocument();
    expect(screen.getByText('Storefront')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  test('displays price per day by default', () => {
    renderComponent();
    expect(screen.getByText(/\$100/)).toBeInTheDocument();
    expect(screen.getByText('/ day')).toBeInTheDocument();
  });

  test('displays discounted weekly rate when applicable', () => {
    const startDate = new Date();
    const endDate = addDays(startDate, 7);
    
    renderComponent({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      property: {
        ...mockProperty,
        weekly_rate_type: 'percentage',
        weekly_rate_value: 10 // 10% off
      }
    });
    
    // Should show discounted price (100 - 10% = 90)
    expect(screen.getByText(/\$90/)).toBeInTheDocument();
    expect(screen.getByText(/\/ day/)).toBeInTheDocument();
    
    // Check for the discount indicator (diamond icon)
    const discountIcon = screen.getByTestId('discount-icon');
    expect(discountIcon).toBeInTheDocument();
  });

  test('displays inquire for pricing when enabled', () => {
    renderComponent({
      property: { ...mockProperty, inquire_for_pricing: true }
    });
    expect(screen.getByText('Inquire for pricing')).toBeInTheDocument();
  });

  test('calls onToggleFavorite when favorite button is clicked', () => {
    const mockToggleFavorite = jest.fn();
    renderComponent({ onToggleFavorite: mockToggleFavorite });
    
    const favoriteButton = screen.getByRole('button', { name: /add to favorites/i });
    fireEvent.click(favoriteButton);
    
    expect(mockToggleFavorite).toHaveBeenCalledWith('1');
  });

  test('displays favorite button as filled when isFavorited is true', () => {
    renderComponent({ isFavorited: true });
    const favoriteButton = screen.getByRole('button', { name: /remove from favorites/i });
    expect(favoriteButton).toBeInTheDocument();
  });

  it('has correct link to property details', () => {
    renderWithRouter(
      <PropertyCard 
        property={mockProperty} 
        rating={4.5} 
        totalReviews={10} 
        onToggleFavorite={jest.fn()} 
      />
    );
    
    const card = screen.getByRole('link');
    expect(card).toHaveAttribute('href', '/property/1');
  });

  test('displays rating when provided', () => {
    renderComponent({ rating: 4.5, totalReviews: 10 });
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(10)')).toBeInTheDocument();
  });

  test('handles single image without navigation', () => {
    renderComponent({
      property: {
        ...mockProperty,
        images: ['single-image.jpg']
      }
    });
    
    // Should not show navigation buttons with only one image
    expect(screen.queryByLabelText(/next image/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/previous image/i)).not.toBeInTheDocument();
    
    // Should still show the single image
    expect(screen.getByRole('img', { name: /test property/i })).toHaveAttribute('src', 'single-image.jpg');
  });

  test('shows image indicators for multiple images', () => {
    renderComponent({
      property: {
        ...mockProperty,
        images: ['img1.jpg', 'img2.jpg', 'img3.jpg']
      }
    });
    
    // Look for the indicators container and then its children
    const indicatorsContainer = document.querySelector('.absolute.bottom-2.left-0.right-0.flex.justify-center.space-x-1');
    expect(indicatorsContainer).toBeInTheDocument();
    
    // Check that there are 3 indicator dots (one for each image)
    if (indicatorsContainer) {
      const indicators = indicatorsContainer.querySelectorAll('span');
      expect(indicators).toHaveLength(3);
    }
  });
  
  test('handles empty image array gracefully', () => {
    renderComponent({
      property: {
        ...mockProperty,
        images: []
      }
    });
    
    // Should not throw errors or show navigation
    expect(screen.queryByLabelText(/next image/i)).not.toBeInTheDocument();
  });
  
  test('renders with minimal required props', () => {
    const minimalProps = {
      property: {
        id: 'min-1',
        title: 'Minimal Property',
        description: '', // Add empty description
        address: {
          city: 'Test City',
          state: 'TS',
          street: '',
          postal_code: '',
          country: '',
          latitude: 0,
          longitude: 0,
        },
        images: [],
        price_per_day: 0,
        inquire_for_pricing: true, // Set to true to test the "Inquire for pricing" text
        square_feet: 0,
        amenities: [],
        property_type: 'storefront' as const, // Use a valid property type from the PropertyType union
        availability: [],
        weekly_rate_type: 'percentage' as const,
        weekly_rate_value: 0,
        monthly_rate_type: 'percentage' as const,
        monthly_rate_value: 0,
        yearly_rate_type: 'percentage' as const,
        yearly_rate_value: 0,
        venue_id: 'venue1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        featured: false,
      },
      rating: 0,
      totalReviews: 0
    };
    
    const { container } = renderWithRouter(
      <PropertyCard {...minimalProps} />
    );
    
    expect(container).toBeInTheDocument();
    expect(screen.getByText('Minimal Property')).toBeInTheDocument();
    expect(screen.getByText('Inquire for pricing')).toBeInTheDocument();
  });
});
