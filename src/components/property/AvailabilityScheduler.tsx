import React, { useState } from 'react';
import { Clock } from 'lucide-react';

interface TimeSlot {
  enabled: boolean;
  start: string;
  end: string;
}

interface DailySchedule {
  [key: string]: TimeSlot;
}

interface AvailabilitySchedulerProps {
  value: DailySchedule;
  onChange: (schedule: DailySchedule) => void;
}

const days = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const AvailabilityScheduler: React.FC<AvailabilitySchedulerProps> = ({
  value,
  onChange,
}) => {
  // Keep a local editing buffer so users can type partial values (e.g., "5:0p")
  const [editing, setEditing] = useState<Record<string, { start?: string; end?: string }>>({});

  const handleDayToggle = (day: string) => {
    onChange({
      ...value,
      [day]: {
        ...value[day],
        enabled: !value[day].enabled,
      },
    });
  };

  const handleTimeChange = (day: string, field: 'start' | 'end', time: string) => {
    onChange({
      ...value,
      [day]: {
        ...value[day],
        [field]: time,
      },
    });
  };

  // Convert 24h time to 12h time
  const to12Hour = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes}${ampm}`;
  };

  // Convert 12h time to 24h time
  const to24Hour = (time: string) => {
    const [timeStr, period] = time.match(/(\d+:\d+)(am|pm)/)?.slice(1) || [];
    if (!timeStr || !period) return '09:00';
    
    let [hours, minutes] = timeStr.split(':');
    let hour = parseInt(hours);
    
    if (period.toLowerCase() === 'pm' && hour !== 12) {
      hour += 12;
    } else if (period.toLowerCase() === 'am' && hour === 12) {
      hour = 0;
    }
    
    return `${hour.toString().padStart(2, '0')}:${minutes}`;
  };

  const timeRegex = /^(1[0-2]|0?[1-9]):[0-5][0-9](am|pm)$/i;

  const handleInputChange = (day: string, field: 'start' | 'end', val: string) => {
    setEditing((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: val },
    }));
  };

  const handleInputBlur = (day: string, field: 'start' | 'end') => {
    const draft = editing[day]?.[field];
    if (draft && timeRegex.test(draft.trim().toLowerCase())) {
      handleTimeChange(day, field, to24Hour(draft.trim().toLowerCase()));
    }
    // Clear editing buffer to re-sync with canonical value
    setEditing((prev) => ({ ...prev, [day]: { ...prev[day], [field]: undefined } }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center mb-4">
        <Clock className="h-5 w-5 text-maroon-500 mr-2" />
        <h3 className="text-lg font-medium text-maroon-800">Weekly Schedule</h3>
      </div>
      
      <div className="space-y-3">
        {days.map((day) => (
          <div
            key={day}
            className={`p-4 rounded-xl border-2 transition-colors ${
              value[day].enabled
                ? 'border-maroon-200 bg-white'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={value[day].enabled}
                  onChange={() => handleDayToggle(day)}
                  className="h-4 w-4 rounded border-maroon-300 text-maroon-600 focus:ring-maroon-500"
                />
                <span className="ml-2 text-sm font-medium capitalize">
                  {day}
                </span>
              </label>
              
              {value[day].enabled && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={(editing[day]?.start ?? to12Hour(value[day].start))}
                    onChange={(e) => handleInputChange(day, 'start', e.target.value)}
                    onBlur={() => handleInputBlur(day, 'start')}
                    pattern="(1[0-2]|0?[1-9]):[0-5][0-9](am|pm)"
                    placeholder="9:00am"
                    className="w-20 sm:w-16 md:w-24 rounded-lg border-maroon-200 text-sm focus:ring-maroon-500 focus:border-maroon-500 text-center"
                  />
                  <span className="text-maroon-500">to</span>
                  <input
                    type="text"
                    value={(editing[day]?.end ?? to12Hour(value[day].end))}
                    onChange={(e) => handleInputChange(day, 'end', e.target.value)}
                    onBlur={() => handleInputBlur(day, 'end')}
                    pattern="(1[0-2]|0?[1-9]):[0-5][0-9](am|pm)"
                    placeholder="5:00pm"
                    className="w-20 sm:w-16 md:w-24 rounded-lg border-maroon-200 text-sm focus:ring-maroon-500 focus:border-maroon-500 text-center"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AvailabilityScheduler;