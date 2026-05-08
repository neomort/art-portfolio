import React from 'react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';

interface Property {
  id: string;
  title: string;
  price_per_day?: number;
  price_per_hour?: number;
  currency: string;
  fee_description?: string;
  fee_type?: string;
  fee_value?: number;
  tax_rate?: number | string;
  capacity?: number;
  applied_adjustment_ids?: string[];
}

interface OpenProposalFormProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property;
  initialDates?: {
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
  };
  onSuccess?: () => void;
}

const OpenProposalForm: React.FC<OpenProposalFormProps> = ({ 
  isOpen, 
  onClose, 
  property, 
  initialDates,
  onSuccess 
}) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const feeValue = Number(property.fee_value || 0);
  const taxRate = Number(property.tax_rate || 0);
  const [formData, setFormData] = React.useState({
    startDate: initialDates?.startDate || '',
    endDate: initialDates?.endDate || '',
    startTime: initialDates?.startTime || '',
    endTime: initialDates?.endTime || '',
    message: '',
    price_total: property.price_per_day || property.price_per_hour || 0,
    currency: property.currency,
    selected_adjustment_ids: [] as string[],
    discount_type: 'percentage' | 'fixed' | '',
    discount_value: 0,
    headcount: 1,
    capacity_surcharge_applied: false,
    off_hours_surcharge_applied: false,
  });

  // Check if property has capacity surcharge adjustment
  const hasCapacitySurcharge = (property.applied_adjustment_ids?.length || 0) > 0;

  // Check if property has off-hours adjustment
  const hasOffHoursAdjustment = (property.applied_adjustment_ids?.length || 0) > 0;

  // Calculate base price based on dates
  const calculateBasePrice = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine if hourly or daily pricing based on available data
    if (property.price_per_hour && formData.startTime && formData.endTime) {
      // For hourly pricing
      const startTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endTime = new Date(`${formData.endDate}T${formData.endTime}`);
      const hours = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
      return property.price_per_hour * hours;
    } else {
      // For daily pricing
      return (property.price_per_day || 0) * Math.max(days, 1);
    }
  };

  // Calculate total with adjustments
  const calculateTotal = () => {
    let total = calculateBasePrice();
    
    // Apply fee if exists
    if (feeValue > 0) {
      if (property.fee_type === 'percentage') {
        total += total * (feeValue / 100);
      } else {
        total += feeValue;
      }
    }
    
    // Apply tax if exists
    if (taxRate > 0) {
      total += total * (taxRate / 100);
    }
    
    // Apply capacity surcharge if applicable
    if (hasCapacitySurcharge && property.capacity && formData.headcount > property.capacity) {
      // For now, we'll use a simple capacity surcharge calculation
      // In a real implementation, this would fetch the adjustment details
      const capacitySurchargeFee = 10; // Placeholder - would come from adjustment data
      total += capacitySurchargeFee;
    }
    
    // Apply off-hours adjustment if applicable
    if (hasOffHoursAdjustment && formData.startTime && formData.endTime) {
      // For now, we'll use a simple off-hours surcharge
      // In a real implementation, this would check time ranges and apply rates
      const offHoursSurcharge = 15; // Placeholder - would come from adjustment data
      total += offHoursSurcharge;
    }
    
    // Apply discount
    if (formData.discount_type && formData.discount_value > 0) {
      if (formData.discount_type === 'percentage') {
        total -= total * (formData.discount_value / 100);
      } else {
        total -= formData.discount_value;
      }
    }
    
    return Math.max(total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startDate || !formData.endDate || !formData.message.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create a new inquiry first
      const { data: inquiry, error: inquiryError } = await supabase
        .from('inquiries')
        .insert({
          property_id: property.id,
          user_id: null, // Will be set when guest accepts
          start_date: formData.startDate,
          end_date: formData.endDate,
          start_at: formData.startTime ? `${formData.startDate}T${formData.startTime}` : null,
          end_at: formData.endTime ? `${formData.endDate}T${formData.endTime}` : null,
          message: formData.message,
          status: 'pending',
          headcount: 1, // Will be updated based on actual needs
          selected_adjustment_ids: formData.selected_adjustment_ids,
          type: property.price_per_hour ? 'hourly' : 'daily'
        })
        .select()
        .single();

      if (inquiryError) throw inquiryError;

      // Create proposal linked to the inquiry
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .insert({
          inquiry_id: inquiry.id,
          price_total: calculateTotal(),
          currency: formData.currency,
          message: formData.message,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        })
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Send email notification (this would be handled by a database trigger or edge function)
      console.log('Open proposal created:', { inquiry, proposal });

      onSuccess?.();
      onClose();
      
    } catch (err) {
      console.error('Error creating proposal:', err);
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} size="2xl">
      <div className="p-6">
        <h2 className="text-2xl font-semibold text-maroon-800 mb-6">Open Proposal</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property Info */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">{property.title}</h3>
            <p className="text-sm text-gray-600">
              Base Price: {formatCurrency(property.price_per_day || property.price_per_hour || 0, property.currency)} per {property.price_per_hour ? 'hour' : 'day'}
            </p>
          </div>

          {/* Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full rounded-xl border-2 border-maroon-200 p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full rounded-xl border-2 border-maroon-200 p-2"
                required
              />
            </div>
          </div>

          {/* Time Selection for Hourly */}
          {property.price_per_hour && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  step="900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  step="900"
                />
              </div>
            </div>
          )}

          {/* Pricing Adjustments */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Pricing Adjustments</h3>
            
            {/* Discount */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Type
                </label>
                <select
                  value={formData.discount_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value as any }))}
                  className="w-full rounded-xl border-2 border-maroon-200 p-2"
                >
                  <option value="">No Discount</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Value
                </label>
                <input
                  type="number"
                  value={formData.discount_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
                  className="w-full rounded-xl border-2 border-maroon-200 p-2"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
              </div>
            </div>

            {/* Headcount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Headcount *
              </label>
              <input
                type="number"
                value={formData.headcount}
                onChange={(e) => setFormData(prev => ({ ...prev, headcount: Number(e.target.value) }))}
                className="w-full rounded-xl border-2 border-maroon-200 p-2"
                min="1"
                step="1"
              />
            </div>

            {/* Off-Hours Adjustment */}
            {hasOffHoursAdjustment && (
              <div>
                <label className="flex items-center text-sm text-gray-700 mb-1">
                  <input
                    type="checkbox"
                    checked={formData.off_hours_surcharge_applied}
                    onChange={(e) => setFormData(prev => ({ ...prev, off_hours_surcharge_applied: e.target.checked }))}
                    className="mr-2"
                  />
                  Apply Off-Hours Surcharge
                </label>
              </div>
            )}

            {/* Capacity Surcharge */}
            {hasCapacitySurcharge && (
              <div>
                <label className="flex items-center text-sm text-gray-700 mb-1">
                  <input
                    type="checkbox"
                    checked={formData.capacity_surcharge_applied}
                    onChange={(e) => setFormData(prev => ({ ...prev, capacity_surcharge_applied: e.target.checked }))}
                    className="mr-2"
                  />
                  Apply Capacity Surcharge
                </label>
                {property.capacity && (
                  <span className="ml-1 text-xs text-gray-500">
                    (+{formatCurrency(property.capacity, property.currency)})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message to Guest *
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              className="w-full rounded-xl border-2 border-maroon-200 p-3"
              rows={4}
              placeholder="Please provide details about your proposal..."
              required
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? 'Sending Proposal...' : 'Send Proposal'}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};

export default OpenProposalForm;
