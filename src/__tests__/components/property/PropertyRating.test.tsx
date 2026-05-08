import React from 'react';
import { render, screen } from '@testing-library/react';
import PropertyRating from '../../../components/property/PropertyRating';

// Mock the Star icon component
jest.mock('lucide-react', () => ({
  Star: jest.fn(({ className }) => (
    <svg className={className} data-testid="star-icon" />
  )),
}));

describe('PropertyRating', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when rating is 0', () => {
    const { container } = render(<PropertyRating rating={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders rating with default size (md)', () => {
    render(<PropertyRating rating={4.5} />);
    
    const starIcon = screen.getByTestId('star-icon');
    const ratingText = screen.getByText('4.5');
    
    expect(starIcon).toHaveClass('h-5 w-5');
    expect(ratingText).toHaveClass('text-base');
  });

  it('renders with small size when size="sm"', () => {
    render(<PropertyRating rating={4.5} size="sm" />);
    
    const starIcon = screen.getByTestId('star-icon');
    const ratingText = screen.getByText('4.5');
    
    expect(starIcon).toHaveClass('h-4 w-4');
    expect(ratingText).toHaveClass('text-sm');
  });

  it('renders with large size when size="lg"', () => {
    render(<PropertyRating rating={4.5} size="lg" />);
    
    const starIcon = screen.getByTestId('star-icon');
    const ratingText = screen.getByText('4.5');
    
    expect(starIcon).toHaveClass('h-6 w-6');
    expect(ratingText).toHaveClass('text-lg');
  });

  it('shows review count when totalReviews is provided and greater than 0', () => {
    render(<PropertyRating rating={4.5} totalReviews={10} />);
    
    expect(screen.getByText('(10)')).toBeInTheDocument();
    expect(screen.getByText('(10)')).toHaveClass('text-base');
  });

  it('does not show review count when showCount is false', () => {
    render(<PropertyRating rating={4.5} totalReviews={10} showCount={false} />);
    
    expect(screen.queryByText('(10)')).not.toBeInTheDocument();
  });

  it('does not show review count when totalReviews is 0', () => {
    render(<PropertyRating rating={4.5} totalReviews={0} />);
    
    expect(screen.queryByText('(0)')).not.toBeInTheDocument();
  });

  it('renders correct star color and fill', () => {
    render(<PropertyRating rating={4.5} />);
    
    const starIcon = screen.getByTestId('star-icon');
    
    expect(starIcon).toHaveClass('text-amber-500');
    expect(starIcon).toHaveClass('fill-amber-500');
  });

  it('renders correct text color', () => {
    render(<PropertyRating rating={4.5} totalReviews={5} />);
    
    const ratingText = screen.getByText('4.5');
    const reviewCount = screen.getByText('(5)');
    
    expect(ratingText).toHaveClass('text-[#121826]');
    expect(reviewCount).toHaveClass('text-maroon-500');
  });
});
