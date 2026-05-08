import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  errorMessage?: string;
  label?: string;
  description?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type = 'text',
    error = false,
    errorMessage,
    label,
    description,
    startIcon,
    endIcon,
    id,
    ...props
  }, ref) => {
    const inputId = id || React.useId();
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId} 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
          </label>
        )}
        
        <div className="relative rounded-md shadow-sm">
          {startIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {startIcon}
            </div>
          )}
          
          <input
            type={type}
            id={inputId}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              {
                'border-red-500 focus-visible:ring-red-200': error,
                'pl-10': startIcon,
                'pr-10': endIcon,
              },
              className
            )}
            ref={ref}
            {...props}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error && errorMessage ? `${inputId}-error` : undefined}
          />
          
          {endIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {endIcon}
            </div>
          )}
        </div>
        
        {error && errorMessage && (
          <p 
            id={`${inputId}-error`} 
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
        
        {description && !error && (
          <p className="mt-1 text-sm text-gray-500">
            {description}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
