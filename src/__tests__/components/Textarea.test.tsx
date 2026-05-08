import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '../../components/Textarea';

describe('Textarea', () => {
  test('renders with default props', () => {
    render(<Textarea placeholder="Enter your message" />);
    
    const textarea = screen.getByPlaceholderText('Enter your message');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveClass('min-h-[80px]');
    expect(textarea).toHaveClass('w-full');
    expect(textarea).toHaveClass('resize-y'); // Default resize
  });

  test('applies custom className', () => {
    render(<Textarea className="custom-class" />);
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('custom-class');
  });

  test('handles value and onChange', () => {
    const handleChange = jest.fn();
    render(<Textarea value="test" onChange={handleChange} />);
    
    const textarea = screen.getByDisplayValue('test');
    fireEvent.change(textarea, { target: { value: 'new value' } });
    
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  test('renders with label', () => {
    render(<Textarea label="Description" id="description" />);
    
    const label = screen.getByText('Description');
    const textarea = screen.getByRole('textbox');
    
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'description');
    expect(textarea).toHaveAttribute('id', 'description');
  });

  test('shows error state and message', () => {
    render(
      <Textarea 
        error 
        errorMessage="This field is required" 
        aria-label="Test textarea"
      />
    );
    
    const textarea = screen.getByRole('textbox');
    const errorMessage = screen.getByText('This field is required');
    
    expect(textarea).toHaveClass('border-red-500');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });

  test('renders with description', () => {
    render(<Textarea description="Enter a detailed description" aria-label="Description" />);
    
    const description = screen.getByText('Enter a detailed description');
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass('text-gray-500');
  });

  test('applies resize classes correctly', () => {
    const { rerender } = render(<Textarea resize="none" aria-label="No resize" />);
    expect(screen.getByRole('textbox')).toHaveClass('resize-none');
    
    rerender(<Textarea resize="vertical" aria-label="Vertical resize" />);
    expect(screen.getByRole('textbox')).toHaveClass('resize-y');
    
    rerender(<Textarea resize="horizontal" aria-label="Horizontal resize" />);
    expect(screen.getByRole('textbox')).toHaveClass('resize-x');
    
    rerender(<Textarea resize="both" aria-label="Both resize" />);
    expect(screen.getByRole('textbox')).toHaveClass('resize');
  });

  test('applies disabled state', () => {
    render(<Textarea disabled aria-label="Disabled textarea" />);
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveClass('disabled:opacity-50');
    expect(textarea).toHaveClass('disabled:cursor-not-allowed');
  });

  test('forwards ref', () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} aria-label="Test textarea" />);
    
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  test('generates unique id when none provided', () => {
    render(
      <>
        <Textarea label="First Textarea" />
        <Textarea label="Second Textarea" />
      </>
    );
    
    const textareas = screen.getAllByRole('textbox');
    const labels = screen.getAllByText(/Textarea$/);
    
    // Ensure each textarea has a unique ID
    expect(textareas[0].id).not.toBe(textareas[1].id);
    
    // Ensure labels are properly associated with textareas
    expect(labels[0]).toHaveAttribute('for', textareas[0].id);
    expect(labels[1]).toHaveAttribute('for', textareas[1].id);
  });
});
