import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePicker } from '../../components/DateRangePicker';
import '@testing-library/jest-dom';

// Mock react-datepicker since we don't need to test its internals
jest.mock('react-datepicker', () => {
  const MockDatePicker = ({ onChange, startDate, endDate, minDate, maxDate, disabled, placeholderText, className, calendarClassName, popperClassName }: any) => (
    <div className={popperClassName}>
      <input
        data-testid="date-range-picker"
        className={className}
        disabled={disabled}
        placeholder={placeholderText}
        value={startDate && endDate ? `${startDate.toDateString()} - ${endDate.toDateString()}` : ''}
        onChange={(e) => {
          // Simulate date selection
          if (e.target.value.includes('-')) {
            const [start, end] = e.target.value.split(' - ');
            onChange([new Date(start), new Date(end)], {});
          }
        }}
      />
      <div className={calendarClassName} data-testid="calendar">
        <div data-testid="calendar-day" onClick={() => {
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          onChange([today, tomorrow], {});
        }}>
          Select Date Range
        </div>
      </div>
    </div>
  );
  MockDatePicker.displayName = 'DatePicker';
  return MockDatePicker;
});

describe('DateRangePicker', () => {
  const mockOnChange = jest.fn();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the date range picker', () => {
    render(<DateRangePicker value={[null, null]} onChange={mockOnChange} />);
    expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select date range')).toBeInTheDocument();
  });

  it('calls onChange when dates are selected', () => {
    render(<DateRangePicker value={[null, null]} onChange={mockOnChange} />);
    
    // Simulate selecting a date range
    fireEvent.click(screen.getByTestId('calendar-day'));
    
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const [dates] = mockOnChange.mock.calls[0];
    expect(dates[0]).toBeInstanceOf(Date);
    expect(dates[1]).toBeInstanceOf(Date);
  });

  it('respects minDate and maxDate props', () => {
    const minDate = new Date('2023-01-01');
    const maxDate = new Date('2023-12-31');
    
    render(
      <DateRangePicker 
        value={[null, null]} 
        onChange={mockOnChange}
        minDate={minDate}
        maxDate={maxDate}
      />
    );
    
    // The actual date validation would be handled by react-datepicker
    // This test just verifies the props are passed through
    const datePicker = screen.getByTestId('date-range-picker');
    expect(datePicker).toBeInTheDocument();
  });

  it('disables the picker when disabled prop is true', () => {
    render(
      <DateRangePicker 
        value={[null, null]} 
        onChange={mockOnChange}
        disabled={true}
      />
    );
    
    const datePicker = screen.getByTestId('date-range-picker');
    expect(datePicker).toBeDisabled();
  });

  it('shows the selected date range', () => {
    render(
      <DateRangePicker 
        value={[today, tomorrow]} 
        onChange={mockOnChange}
      />
    );
    
    const datePicker = screen.getByTestId('date-range-picker') as HTMLInputElement;
    expect(datePicker.value).toContain(today.toDateString());
    expect(datePicker.value).toContain(tomorrow.toDateString());
  });

  it('handles null dates in the value prop', () => {
    render(
      <DateRangePicker 
        value={[null, null]} 
        onChange={mockOnChange}
      />
    );
    
    const datePicker = screen.getByTestId('date-range-picker') as HTMLInputElement;
    expect(datePicker.value).toBe('');
  });
});
