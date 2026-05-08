import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../../components/Input';
import { Search } from 'lucide-react';

describe('Input', () => {
  test('renders with default props', () => {
    render(<Input placeholder="Enter text" />);
    
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('h-10');
    expect(input).toHaveClass('w-full');
    expect(input).toHaveClass('rounded-md');
    expect(input).toHaveAttribute('type', 'text');
  });

  test('applies custom className', () => {
    render(<Input className="custom-class" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
  });

  test('handles value and onChange', () => {
    const handleChange = jest.fn();
    render(<Input value="test" onChange={handleChange} />);
    
    const input = screen.getByDisplayValue('test');
    fireEvent.change(input, { target: { value: 'new value' } });
    
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  test('renders with label', () => {
    render(<Input label="Username" id="username" />);
    
    const label = screen.getByText('Username');
    const input = screen.getByRole('textbox');
    
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'username');
    expect(input).toHaveAttribute('id', 'username');
  });

  test('shows error state and message', () => {
    render(
      <Input 
        error 
        errorMessage="This field is required" 
        aria-label="Test input"
      />
    );
    
    const input = screen.getByRole('textbox');
    const errorMessage = screen.getByText('This field is required');
    
    expect(input).toHaveClass('border-red-500');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });

  test('renders with description', () => {
    render(<Input description="Enter your full name" aria-label="Name" />);
    
    const description = screen.getByText('Enter your full name');
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass('text-gray-500');
  });

  test('renders with start icon', () => {
    const icon = <span data-testid="start-icon">@</span>;
    render(<Input startIcon={icon} aria-label="Input with start icon" />);
    
    const startIcon = screen.getByTestId('start-icon');
    const input = screen.getByRole('textbox');
    
    expect(startIcon).toBeInTheDocument();
    expect(input).toHaveClass('pl-10');
  });

  test('renders with end icon', () => {
    const icon = <span data-testid="end-icon">🔍</span>;
    render(<Input endIcon={icon} aria-label="Input with end icon" />);
    
    const endIcon = screen.getByTestId('end-icon');
    const input = screen.getByRole('textbox');
    
    expect(endIcon).toBeInTheDocument();
    expect(input).toHaveClass('pr-10');
  });

  test('applies disabled state', () => {
    render(<Input disabled aria-label="Disabled input" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    // The disabled classes are prefixed with 'disabled:' in the actual implementation
    expect(input).toHaveClass('disabled:opacity-50');
    expect(input).toHaveClass('disabled:cursor-not-allowed');
  });

  test('renders with custom type', () => {
    render(<Input type="email" placeholder="test@example.com" />);
    
    const input = screen.getByPlaceholderText('test@example.com');
    expect(input).toHaveAttribute('type', 'email');
  });

  test('handles ref forwarding', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} placeholder="Test ref" />);
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.placeholder).toBe('Test ref');
  });

  test('generates unique id when not provided', () => {
    render(
      <>
        <Input label="First" />
        <Input label="Second" />
      </>
    );
    
    const inputs = screen.getAllByRole('textbox');
    const labels = screen.getAllByText(/First|Second/);
    
    // Verify each input has a unique ID
    expect(inputs[0].id).not.toBe(inputs[1].id);
    
    // Verify labels are properly associated with inputs
    expect(labels[0]).toHaveAttribute('for', inputs[0].id);
    expect(labels[1]).toHaveAttribute('for', inputs[1].id);
  });

  test('applies custom id when provided', () => {
    render(<Input id="custom-id" label="Custom ID" />);
    
    const input = screen.getByLabelText('Custom ID');
    expect(input).toHaveAttribute('id', 'custom-id');
  });

  test('shows description when there is no error', () => {
    render(
      <Input 
        description="This is a description" 
        error={false} 
        errorMessage="This error should not show" 
      />
    );
    
    expect(screen.getByText('This is a description')).toBeInTheDocument();
    expect(screen.queryByText('This error should not show')).not.toBeInTheDocument();
  });

  test('shows error message instead of description when error is true', () => {
    render(
      <Input 
        description="This is a description" 
        error={true}
        errorMessage="This is an error" 
      />
    );
    
    expect(screen.getByText('This is an error')).toBeInTheDocument();
    expect(screen.queryByText('This is a description')).not.toBeInTheDocument();
  });

  test('renders with Lucide icon', () => {
    render(<Input startIcon={<Search data-testid="search-icon" />} aria-label="Search" />);
    
    const icon = screen.getByTestId('search-icon');
    const input = screen.getByLabelText('Search');
    
    expect(icon).toBeInTheDocument();
    expect(icon.tagName).toBe('svg');
    expect(input).toHaveClass('pl-10');
  });

  test('applies custom class names', () => {
    render(<Input className="custom-class" data-testid="test-input" />);
    
    const input = screen.getByTestId('test-input');
    expect(input).toHaveClass('custom-class');
  });

  test('forwards all input props', () => {
    render(
      <Input 
        data-testid="test-input"
        name="username"
        autoComplete="username"
        required
        minLength={3}
      />
    );
    
    const input = screen.getByTestId('test-input');
    expect(input).toHaveAttribute('name', 'username');
    expect(input).toHaveAttribute('autocomplete', 'username');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('minLength', '3');
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Test input" />);
    
    const input = screen.getByLabelText('Test input');
    expect(ref.current).toBe(input);
  });

  test('generates unique id when none provided', () => {
    render(
      <>
        <Input label="First Name" />
        <Input label="Last Name" />
      </>
    );
    
    const inputs = screen.getAllByRole('textbox');
    const labels = screen.getAllByText(/Name$/);
    
    // Ensure each input has a unique ID
    expect(inputs[0].id).not.toBe(inputs[1].id);
    
    // Ensure labels are properly associated with inputs
    expect(labels[0]).toHaveAttribute('for', inputs[0].id);
    expect(labels[1]).toHaveAttribute('for', inputs[1].id);
  });
});
