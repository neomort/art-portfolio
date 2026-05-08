import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from '../../components/Checkbox';

describe('Checkbox', () => {
  test('renders with default props', () => {
    render(<Checkbox aria-label="Test checkbox" />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveClass('h-4 w-4');
    expect(checkbox).not.toBeChecked();
  });

  test('applies custom className', () => {
    render(<Checkbox className="custom-class" aria-label="Test checkbox" />);
    
    // The className is applied to the root div that wraps the checkbox
    const rootDiv = screen.getByRole('checkbox').closest('div.space-y-1');
    expect(rootDiv).toHaveClass('custom-class');
  });

  test('handles checked state', () => {
    const handleChange = jest.fn();
    render(
      <Checkbox 
        checked={false} 
        onChange={handleChange} 
        aria-label="Test checkbox"
      />
    );
    
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  test('renders with label', () => {
    render(<Checkbox label="I agree to terms" id="terms" />);
    
    const checkbox = screen.getByRole('checkbox');
    const label = screen.getByText('I agree to terms');
    
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', checkbox.id);
  });

  test('shows error state and message', () => {
    render(
      <Checkbox 
        error 
        errorMessage="You must agree to the terms" 
        label="I agree to terms"
      />
    );
    
    const checkbox = screen.getByRole('checkbox');
    const errorMessage = screen.getByText('You must agree to the terms');
    const label = screen.getByText('I agree to terms');
    
    expect(checkbox).toHaveClass('border-red-500');
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveAttribute('role', 'alert');
    expect(label).toHaveClass('text-red-600');
  });

  test('renders with description', () => {
    render(
      <Checkbox 
        label="Subscribe to newsletter"
        description="Get the latest news and updates"
      />
    );
    
    const description = screen.getByText('Get the latest news and updates');
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass('text-gray-500');
  });

  test('applies disabled state', () => {
    render(
      <Checkbox 
        label="Disabled checkbox"
        disabled 
      />
    );
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveClass('opacity-50');
    expect(checkbox).toHaveClass('cursor-not-allowed');
  });

  test('sets indeterminate state', () => {
    const { rerender } = render(
      <Checkbox 
        label="Indeterminate checkbox"
        indeterminate={false}
      />
    );
    
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    
    // Mock the indeterminate property
    Object.defineProperty(checkbox, 'indeterminate', {
      get() { return this._indeterminate; },
      set(value) { this._indeterminate = value; },
      configurable: true,
    });
    
    // Test setting indeterminate to true
    rerender(
      <Checkbox 
        label="Indeterminate checkbox"
        indeterminate={true}
      />
    );
    
    expect(checkbox.indeterminate).toBe(true);
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <Checkbox 
        ref={ref} 
        aria-label="Test checkbox"
      />
    );
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.type).toBe('checkbox');
  });

  test('generates unique id when none provided', () => {
    render(
      <>
        <Checkbox label="First checkbox" />
        <Checkbox label="Second checkbox" />
      </>
    );
    
    const checkboxes = screen.getAllByRole('checkbox');
    const labels = screen.getAllByText(/checkbox$/);
    
    // Ensure each checkbox has a unique ID
    expect(checkboxes[0].id).not.toBe(checkboxes[1].id);
    
    // Ensure labels are properly associated with checkboxes
    expect(labels[0]).toHaveAttribute('for', checkboxes[0].id);
    expect(labels[1]).toHaveAttribute('for', checkboxes[1].id);
  });

  test('associates error message with input for screen readers', () => {
    render(
      <Checkbox 
        label="Agree to terms"
        error
        errorMessage="You must agree to the terms"
      />
    );
    
    const checkbox = screen.getByRole('checkbox');
    const errorMessage = screen.getByText('You must agree to the terms');
    
    expect(checkbox).toHaveAttribute('aria-describedby', errorMessage.id);
  });
});
