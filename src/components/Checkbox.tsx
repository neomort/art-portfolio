import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: boolean;
  errorMessage?: string;
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({
    className,
    label,
    description,
    error = false,
    errorMessage,
    disabled = false,
    indeterminate = false,
    id,
    ...props
  }, ref) => {
    const checkboxId = id || React.useId();
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Handle both forwarded ref and local ref
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // Set indeterminate state when prop changes
    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    return (
      <div className={cn('space-y-1', className)}>
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id={checkboxId}
              type="checkbox"
              ref={inputRef}
              className={cn(
                'h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500',
                {
                  'border-red-500 text-red-600 focus:ring-red-500': error,
                  'opacity-50 cursor-not-allowed': disabled,
                }
              )}
              disabled={disabled}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={
                error && errorMessage 
                  ? `${checkboxId}-error` 
                  : description 
                    ? `${checkboxId}-description`
                    : undefined
              }
              {...props}
            />
          </div>
          
          {(label || description) && (
            <div className="ml-3 text-sm">
              {label && (
                <label 
                  htmlFor={checkboxId} 
                  className={cn(
                    'font-medium text-gray-700',
                    { 'text-red-600': error }
                  )}
                >
                  {label}
                </label>
              )}
              
              {description && !error && (
                <p 
                  id={`${checkboxId}-description`}
                  className="text-gray-500"
                >
                  {description}
                </p>
              )}
              
              {error && errorMessage && (
                <p 
                  id={`${checkboxId}-error`}
                  className="mt-1 text-sm text-red-600"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
