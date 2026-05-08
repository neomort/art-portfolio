import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../../components/LoadingSpinner';

describe('LoadingSpinner', () => {
  test('renders with default props', () => {
    render(<LoadingSpinner />);
    
    // Check if the spinner is rendered
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    
    // Check if the spinner has the default size class
    expect(spinner.firstChild).toHaveClass('h-8 w-8');
    
    // Check if the screen reader text is present
    const loadingTexts = screen.getAllByText('Loading...');
    expect(loadingTexts.length).toBe(2); // One for screen reader, one for visible text
  });

  test('applies custom size class', () => {
    const customSize = 'h-16 w-16';
    render(<LoadingSpinner size={customSize} />);
    
    const spinner = screen.getByRole('status');
    expect(spinner.firstChild).toHaveClass(customSize);
  });

  test('applies custom className', () => {
    const customClass = 'custom-class';
    const { container } = render(<LoadingSpinner className={customClass} />);
    
    // The custom class should be on the outer div
    const outerDiv = container.firstChild;
    expect(outerDiv).toHaveClass(customClass);
  });

  test('applies custom text', () => {
    const customText = 'Custom loading text';
    render(<LoadingSpinner text={customText} />);
    
    // Should find the custom text in the visible text element
    const visibleText = screen.getByTestId('loading-text');
    expect(visibleText).toHaveTextContent(customText);
  });

  test('hides visible text when text prop is null', () => {
    render(<LoadingSpinner text={null} />);
    
    // The visible text should be hidden
    const visibleText = screen.queryByTestId('loading-text');
    expect(visibleText).not.toBeInTheDocument();
    
    // But the spinner and screen reader text should still be present
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument(); // Screen reader text
  });
});
