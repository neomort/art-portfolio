import React from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export function Dialog({ 
  open, 
  onClose, 
  onConfirm, 
  title, 
  children, 
  size = 'md',
}: DialogProps) {
  if (!open) return null;

  // Size classes
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    '2xl': "max-w-2xl", // ~40rem, about 25% wider than lg
    '3xl': "max-w-3xl", // ~48rem, about 50% wider than lg
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={handleBackdropClick}>
      <div 
        className={`bg-white rounded-2xl w-full ${sizeClasses[size]} shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
        
        {onConfirm && (
          <div className="flex justify-end space-x-3 p-6 pt-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-maroon-600 hover:bg-maroon-700 rounded-xl transition-colors"
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Add a function to handle backdrop clicks
function handleBackdropClick(e: React.MouseEvent) {
  // Only close if the click was directly on the backdrop
  if (e.target === e.currentTarget) {
    const onClose = (e.currentTarget as any).onClose;
    if (typeof onClose === 'function') {
      onClose();
    }
  }
}