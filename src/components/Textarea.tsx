import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  errorMessage?: string;
  label?: string;
  description?: string;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    className,
    error = false,
    errorMessage,
    label,
    description,
    resize = 'vertical',
    id,
    ...props
  }, ref) => {
    const textareaId = id || React.useId();
    
    const resizeClasses = {
      'none': 'resize-none',
      'vertical': 'resize-y',
      'horizontal': 'resize-x',
      'both': 'resize',
    };
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={textareaId} 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
          </label>
        )}
        
        <div className="relative rounded-md shadow-sm">
          <textarea
            id={textareaId}
            className={cn(
              'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              resizeClasses[resize],
              {
                'border-red-500 focus-visible:ring-red-200': error,
              },
              className
            )}
            ref={ref}
            {...props}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error && errorMessage ? `${textareaId}-error` : undefined}
          />
        </div>
        
        {error && errorMessage && (
          <p 
            id={`${textareaId}-error`} 
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

Textarea.displayName = 'Textarea';

export { Textarea };
