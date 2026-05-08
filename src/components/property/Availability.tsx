import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';

interface AvailabilityProps {
  propertyId: string;
  isVenueOwner?: boolean;
  schedule: {
    daily_schedule: {
      [key: string]: {
        enabled: boolean;
        start: string;
        end: string;
      };
    };
    available_from?: string | null;
    available_until?: string | null;
    limit_availability?: boolean;
  };
}

// Parse a date string as a local date (prevents UTC shift for YYYY-MM-DD)
const parseLocalDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  if (typeof dateStr === 'string' && dateStr.length === 10 && dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, (m - 1), d);
    }
  }
  const dt = new Date(dateStr as string);
  return isNaN(dt.getTime()) ? null : dt;
};

const formatLocalDate = (dateStr?: string | null): string => {
  const dt = parseLocalDate(dateStr);
  return dt ? dt.toLocaleDateString() : '';
};

// Convert 24h time to 12h time
const to12Hour = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes}${ampm}`;
};

// Define days in correct order
const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const WEEKEND_DAYS = ['saturday', 'sunday'];

function getAvailabilitySummary(schedule: AvailabilityProps['schedule']): string {
  if (!schedule.daily_schedule) {
    return 'No availability set';
  }
  
  // If limit_availability is false, show available all time
  if (schedule.limit_availability === false) {
    return 'Available 24/7';
  }

  // Check if available all week
  const allWeek = DAYS_ORDER.every(day => schedule.daily_schedule[day].enabled);
  if (allWeek) {
    return 'Available all week';
  }

  // Check weekdays only
  const weekdaysOnly = WEEKDAYS.every(day => schedule.daily_schedule[day].enabled) &&
    WEEKEND_DAYS.every(day => !schedule.daily_schedule[day].enabled);
  if (weekdaysOnly) {
    return 'Available on weekdays';
  }

  // Check weekends only
  const weekendsOnly = WEEKEND_DAYS.every(day => schedule.daily_schedule[day].enabled) &&
    WEEKDAYS.every(day => !schedule.daily_schedule[day].enabled);
  if (weekendsOnly) {
    return 'Available on weekends';
  }

  // List specific days
  const availableDays = DAYS_ORDER
    .filter(day => schedule.daily_schedule[day].enabled)
    .map(day => day.charAt(0).toUpperCase() + day.slice(1));

  return `Available on ${availableDays.join(', ')}`;
}

const Availability: React.FC<AvailabilityProps> = ({ schedule, propertyId, isVenueOwner }) => {
  const navigate = useNavigate();
  
  // If no schedule exists, show default message
  if (!schedule || !schedule.daily_schedule) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-[#121826]">
              <Calendar className="h-5 w-5 mr-2 text-[#EA6C56]" />
              Availability
            </CardTitle>
            {!isVenueOwner && (
              <Button
                onClick={() => navigate(`/property/${propertyId}/inquire`)}
                variant="outline"
                className="group"
              >
                Inquire or Book
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-medium text-[#121826]">
            Contact for availability
          </div>
          <p className="text-[#121826] mt-2 text-sm">
            No schedule has been set for this property. Please inquire for specific dates.
          </p>
        </CardContent>
      </Card>
    );
  }

  const summary = getAvailabilitySummary(schedule);
  const dateRange = schedule.available_from || schedule.available_until ? (
    <div className="text-[#620E28] mt-2 text-sm">
      {schedule.available_from && (
        <span>From {formatLocalDate(schedule.available_from)}</span>
      )}
      {schedule.available_from && schedule.available_until && ' - '}
      {schedule.available_until && (
        <span>Until {formatLocalDate(schedule.available_until)}</span>
      )}
    </div>
  ) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-[#121826]">
            <Calendar className="h-5 w-5 mr-2 text-[#EA6C56]" />
            Availability
          </CardTitle>
          {!isVenueOwner && (
            <a
              href="#inquire-or-book"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('inquire-or-book')?.scrollIntoView({ 
                  behavior: 'smooth',
                  block: 'start'
                });
              }}
            >
              <Button
                variant="outline" 
                size="sm"
                className="group text-xs"
              >
                Book Now
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-medium text-[#620E28]">
          {summary}
        </div>
        {dateRange}
        {schedule.limit_availability !== false && (
          <div className="mt-4 space-y-2">
            {DAYS_ORDER.map(day => {
              const value = schedule.daily_schedule[day];
              if (!value || !value.enabled) return null;
              
              return (
                <div key={day} className="text-sm flex justify-between items-center py-1 border-b border-maroon-100 last:border-0">
                  <span className="font-medium capitalize text-[#121826]">{day}</span>
                  <span className="text-[#EA6C56]">
                    {to12Hour(value.start)} - {to12Hour(value.end)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Availability;