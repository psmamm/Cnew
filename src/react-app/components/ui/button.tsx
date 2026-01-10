import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/react-app/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary - Premium gradient with glow
        default: "bg-gradient-premium text-white shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 active:translate-y-0",

        // Destructive - Soft rose
        destructive: "bg-danger text-white hover:bg-danger-dark shadow-glow-danger/50 hover:shadow-glow-danger",

        // Outline - Subtle border
        outline: "border border-white/10 bg-transparent text-foreground hover:bg-white/5 hover:border-white/15",

        // Secondary - Surface color
        secondary: "bg-white/5 text-foreground border border-white/10 hover:bg-white/10 hover:border-white/15",

        // Ghost - No background
        ghost: "text-muted-foreground hover:bg-white/5 hover:text-foreground",

        // Link style
        link: "text-primary-500 underline-offset-4 hover:underline hover:text-primary-400",

        // Success variant
        success: "bg-success text-white hover:bg-success-dark shadow-glow-success/50 hover:shadow-glow-success",

        // Premium - Extra fancy with border gradient
        premium: "bg-gradient-premium text-white shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 active:translate-y-0 border border-primary-400/20",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
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
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
