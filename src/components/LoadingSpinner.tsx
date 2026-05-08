import React from 'react';

type LoadingSpinnerProps = {
  /** Custom class name for the spinner container */
  className?: string;
  /** Custom size classes (e.g., 'h-8 w-8') */
  size?: string;
  /** Custom loading text (set to null to hide text) */
  text?: string | null;
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  className = '',
  size = 'h-8 w-8',
  text = 'Loading...',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div role="status">
        <div
          className={`${size} animate-spin rounded-full border-4 border-solid border-primary-500 border-t-transparent`}
          data-testid="loading-spinner"
        >
          <span className="sr-only">Loading...</span>
        </div>
      </div>
      {text && (
        <span className="mt-2 text-sm text-gray-600" data-testid="loading-text">
          {text}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;
