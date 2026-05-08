import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DateRangePicker.css';

export interface DateRangePickerProps {
  value: [Date | null, Date | null];
  onChange: (dates: [Date | null, Date | null]) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
}) => {
  return (
    <DatePicker
      selectsRange
      startDate={value[0]}
      endDate={value[1]}
      onChange={onChange}
      minDate={minDate}
      maxDate={maxDate}
      isClearable
      disabled={disabled}
      placeholderText="Select date range"
      className="date-range-picker-input rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
      calendarClassName="rounded-lg shadow-lg"
      popperClassName="date-range-picker-popper"

    />
  );
};

export interface SingleDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  placeholderText?: string;
}

export const SingleDatePicker: React.FC<SingleDatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  placeholderText = 'Select a date',
}) => {
  return (
    <DatePicker
      selected={value}
      onChange={onChange}
      minDate={minDate}
      maxDate={maxDate}
      disabled={disabled}
      placeholderText={placeholderText}
      className="date-range-picker-input rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
      calendarClassName="rounded-lg shadow-lg"
      popperClassName="date-range-picker-popper"
      shouldCloseOnSelect
    />
  );
};
