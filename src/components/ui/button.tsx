import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      icon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = "inline-flex items-center justify-center rounded-3xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none font-display";
    
    const variants = {
      primary: "bg-[#EA6C56] text-white hover:bg-[#e85c44] active:bg-[#d85151] shadow-sm hover:shadow-md",
      secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300 border border-gray-300 shadow-sm hover:shadow transition-all duration-200",
      outline: "border-2 border-[#FFD2B3] bg-transparent hover:bg-[#fff5eb] active:bg-[#fff0e0] text-gray-800 transition-colors duration-200",
      ghost: "bg-transparent hover:bg-[#fbe9e9] active:bg-[#f7d4d4] text-maroon-700 transition-colors duration-200",
      link: "bg-transparent underline-offset-4 hover:underline text-maroon-600 hover:text-maroon-500",
      danger: "bg-red-600 text-white hover:bg-red-500 active:bg-red-700",
    };
    
    const sizes = {
      sm: "h-9 px-4 text-sm",
      md: "h-8 px-4 py-1.5 text-sm",
      lg: "h-14 px-8 text-lg",
    };
    
    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          isLoading && "opacity-70 cursor-not-allowed",
          className
        )}
        disabled={disabled || isLoading}
        ref={ref}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {children}
          </div>
        ) : icon ? (
          <div className="flex items-center justify-center">
            {icon}
            {children}
          </div>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };