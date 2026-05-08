import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../../components/Select';

describe('Select', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3', disabled: true },
  ];

  test('renders with default props', () => {
    render(<Select options={options} aria-label="Test select" />);
    
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveClass('h-10');
    expect(select).toHaveClass('w-full');
    
    // Check options are rendered
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(<Select options={options} className="custom-class" aria-label="Test select" />);
    
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('custom-class');
  });

  test('handles value and onChange', () => {
    const handleChange = jest.fn();
    render(
      <Select 
        options={options} 
        value="option1" 
        onChange={handleChange} 
        aria-label="Test select"
      />
    );
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'option2' } });
    
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  test('renders with label', () => {
    render(
      <Select 
        options={options} 
        label="Category" 
        id="category" 
        aria-label="Test select"
      />
    );
    
    const label = screen.getByText('Category');
    const select = screen.getByRole('combobox');
    
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'category');
    expect(select).toHaveAttribute('id', 'category');
  });

  test('shows error state and message', () => {
    render(
      <Select 
        options={options}
        error 
        errorMessage="Please select an option" 
        aria-label="Test select"
      />
    );
    
    const select = screen.getByRole('combobox');
    const errorMessage = screen.getByText('Please select an option');
    
    expect(select).toHaveClass('border-red-500');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });

  test('renders with description', () => {
    render(
      <Select 
        options={options}
        description="Select an option from the list" 
        aria-label="Test select"
      />
    );
    
    const description = screen.getByText('Select an option from the list');
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass('text-gray-500');
  });

  test('applies disabled state', () => {
    render(
      <Select 
        options={options}
        disabled 
        aria-label="Test select"
      />
    );
    
    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
    // The disabled classes are prefixed with 'disabled:' in the actual implementation
    expect(select).toHaveClass('disabled:opacity-50');
    expect(select).toHaveClass('disabled:cursor-not-allowed');
  });

  test('disables individual options', () => {
    render(
      <Select 
        options={options}
        aria-label="Test select"
      />
    );
    
    const option3 = screen.getByRole('option', { name: 'Option 3' });
    expect(option3).toBeDisabled();
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLSelectElement>();
    render(
      <Select 
        options={options}
        ref={ref} 
        aria-label="Test select"
      />
    );
    
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  test('generates unique id when none provided', () => {
    render(
      <>
        <Select options={options} label="First Select" />
        <Select options={options} label="Second Select" />
      </>
    );
    
    const selects = screen.getAllByRole('combobox');
    const labels = screen.getAllByText(/Select$/);
    
    // Ensure each select has a unique ID
    expect(selects[0].id).not.toBe(selects[1].id);
    
    // Ensure labels are properly associated with selects
    expect(labels[0]).toHaveAttribute('for', selects[0].id);
    expect(labels[1]).toHaveAttribute('for', selects[1].id);
  });
});
