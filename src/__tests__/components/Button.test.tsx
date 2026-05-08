import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../components/ui/button';

describe('Button', () => {
  test('renders with default props', () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    // Default variant is primary in ui/button.tsx
    expect(button).toHaveClass('bg-[#EA6C56]');
    expect(button).toHaveClass('text-white');
    // Check size classes
    expect(button).toHaveClass('rounded-3xl');
    expect(button).toHaveClass('font-medium');
  });

  test('applies custom className', () => {
    render(<Button className="custom-class">Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  test('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('renders as disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    // The disabled classes are applied through baseStyles
    expect(button).toHaveClass('disabled:opacity-50');
    expect(button).toHaveClass('disabled:pointer-events-none');
  });

  test('shows loading spinner when isLoading is true', () => {
    render(<Button isLoading>Loading...</Button>);
    
    const button = screen.getByRole('button');
    // Check if there's an SVG that's animating (spinner)
    const spinner = screen.getByText('Loading...');
    expect(button).toHaveClass('opacity-70');
    expect(button).toHaveClass('cursor-not-allowed');
    // Component does not set aria-busy; it disables button and applies styles
    expect(button).toBeDisabled();
    expect(spinner).toBeInTheDocument();
  });

  test('applies correct variant classes', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>);
    
    let button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gray-100');
    expect(button).toHaveClass('text-gray-800');
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('border-gray-300');
    
    rerender(<Button variant="danger">Danger</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-600');
    expect(button).toHaveClass('text-white');
    
    rerender(<Button variant="outline">Outline</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('border-2');
    expect(button).toHaveClass('border-[#FFD2B3]');
    
    rerender(<Button variant="ghost">Ghost</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-transparent');
    
    rerender(<Button variant="link">Link</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('underline-offset-4');
  });

  test('applies correct size classes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    
    let button = screen.getByRole('button');
    expect(button).toHaveClass('h-9');
    expect(button).toHaveClass('px-4');
    
    rerender(<Button size="lg">Large</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-14');
    expect(button).toHaveClass('px-8');
    
    // Standard Button component doesn't have 'icon' size, using md instead
    rerender(<Button size="md">Medium</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-8');
    expect(button).toHaveClass('px-4');
  });

  test('handles icon prop correctly', () => {
    render(
      <Button 
        icon={
          <svg data-testid="test-icon" className="w-4 h-4" viewBox="0 0 16 16">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 14A6 6 0 1 1 8 2a6 6 0 0 1 0 12z" />
          </svg>
        }
      >
        With Icon
      </Button>
    );
    
    const button = screen.getByRole('button', { name: /with icon/i });
    const icon = screen.getByTestId('test-icon');
    expect(button).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
  });
});
