import React from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import AvailabilityScheduler from './AvailabilityScheduler';

export interface Schedule {
  showStartDate: boolean;
  showEndDate: boolean;
  limitAvailability: boolean;
  available_from: string;
  available_until: string;
  ical_url?: string;
  availability: {
    [key: string]: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
}

interface PropertyScheduleProps {
  schedule: Schedule;
  onScheduleChange: (schedule: Schedule) => void;
  onSave: () => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

const PropertySchedule: React.FC<PropertyScheduleProps> = ({
  schedule,
  onScheduleChange,
  onSave,
  loading = false,
  error = null,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex space-x-6">
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={schedule.showStartDate}
              onChange={() => onScheduleChange({
                ...schedule,
                showStartDate: !schedule.showStartDate,
                available_from: !schedule.showStartDate ? schedule.available_from : ''
              })}
              className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
            />
            <span className="ml-2 text-sm text-maroon-700">Indicate start date</span>
          </label>
          {schedule.showStartDate && (
            <input
              type="date"
              value={schedule.available_from}
              onChange={(e) => onScheduleChange({
                ...schedule,
                available_from: e.target.value
              })}
              className="mt-2 block w-full rounded-xl border-2 border-maroon-200 p-2 focus:ring-maroon-500 focus:border-maroon-500"
            />
          )}
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={schedule.showEndDate}
              onChange={() => onScheduleChange({
                ...schedule,
                showEndDate: !schedule.showEndDate,
                available_until: !schedule.showEndDate ? schedule.available_until : ''
              })}
              className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
            />
            <span className="ml-2 text-sm text-maroon-700">Indicate end date</span>
          </label>
          {schedule.showEndDate && (
            <input
              type="date"
              value={schedule.available_until}
              onChange={(e) => onScheduleChange({
                ...schedule,
                available_until: e.target.value
              })}
              className="mt-2 block w-full rounded-xl border-2 border-maroon-200 p-2 focus:ring-maroon-500 focus:border-maroon-500"
            />
          )}
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={schedule.limitAvailability}
              onChange={() => onScheduleChange({
                ...schedule,
                limitAvailability: !schedule.limitAvailability
                // Keep existing availability data regardless of checkbox state
              })}
              className="rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
            />
            <span className="ml-2 text-sm text-maroon-700">Limit availability by day/time</span>
          </label>
        </div>
      </div>

      {schedule.limitAvailability && (
        <AvailabilityScheduler
          value={schedule.availability}
          onChange={(availability) => onScheduleChange({ ...schedule, availability })}
        />
      )}

      {/* External iCal feed URL for blocking times (moved below Weekly Schedule) */}
      <div>
        <label className="block text-sm text-maroon-700 mb-1">External calendar (iCal URL)</label>
        <input
          type="url"
          placeholder="https://example.com/calendar.ics"
          value={schedule.ical_url || ''}
          onChange={(e) => onScheduleChange({ ...schedule, ical_url: e.target.value })}
          className="block w-full rounded-xl border-2 border-maroon-200 p-2 focus:ring-maroon-500 focus:border-maroon-500"
        />
        <p className="mt-1 text-xs text-maroon-600">Events from this feed will be treated as unavailable and block bookings.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="md"
          onClick={onSave}
          isLoading={loading}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Schedule'}
        </Button>
      </div>
    </div>
  );
};

export default PropertySchedule;