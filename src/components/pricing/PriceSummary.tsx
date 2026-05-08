import React from 'react';
import { formatCurrency } from '../../lib/utils';

interface PriceSummaryProps {
  basePrice: number;
  subtotal: number;
  total: number;
  currency: string;
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
  };
  fee?: {
    description?: string;
    type: 'percentage' | 'fixed';
    value: number;
  };
  taxRate?: number;
  basePriceBreakdown?: string;
  adjustments?: Array<{
    label: string;
    amount: number;
    type?: 'discount' | 'surcharge';
  }>;
  className?: string;
}

export const PriceSummary: React.FC<PriceSummaryProps> = ({
  basePrice,
  subtotal,
  total,
  currency,
  discount,
  fee,
  taxRate,
  basePriceBreakdown,
  adjustments = [],
  className = "bg-gray-50 p-4 rounded-lg"
}) => {
  return (
    <div className={className}>
      <h3 className="font-semibold text-gray-900 mb-2">Price Summary</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>
            Base Price:{' '}
            {basePriceBreakdown && (
              <span className="text-current">{basePriceBreakdown}</span>
            )}
          </span>
          <span>{formatCurrency(basePrice, currency)}</span>
        </div>

        {/* Adjustments */}
        {adjustments.map((adjustment, index) => (
          <div key={index} className={`flex justify-between ${adjustment.type === 'discount' ? 'text-green-600' : ''}`}>
            <span>{adjustment.label}</span>
            <span>{formatCurrency(adjustment.amount, currency)}</span>
          </div>
        ))}

        {/* Discount */}
        {discount && discount.value > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount:</span>
            <span>
              {discount.type === 'percentage' 
                ? `-${discount.value}%`
                : `-${formatCurrency(discount.value, currency)}`
              }
            </span>
          </div>
        )}

        {/* Fee */}
        {fee && fee.value > 0 && (
          <div className="flex justify-between">
            <span>Fee: {fee.description || 'Fee'}</span>
            <span>
              {fee.type === 'percentage' 
                ? formatCurrency(basePrice * (fee.value / 100), currency)
                : formatCurrency(fee.value, currency)
              }
            </span>
          </div>
        )}

        {/* Subtotal */}
        <div className="border-t pt-2 flex justify-between font-semibold">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>

        {/* Tax */}
        {taxRate && taxRate > 0 && (
          <div className="flex justify-between">
            <span>Tax ({taxRate}%):</span>
            <span>{formatCurrency(subtotal * (taxRate / 100), currency)}</span>
          </div>
        )}

        {/* Total */}
        <div className="border-t pt-2 flex justify-between font-semibold text-lg">
          <span>Total:</span>
          <span>{formatCurrency(total, currency)}</span>
        </div>
      </div>
    </div>
  );
};

export default PriceSummary;
