import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/react-app/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-lg text-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // Default input
        default: "bg-white/3 border border-white/10 text-foreground focus:border-[#A855F7]/50 focus:ring-2 focus:ring-[#A855F7]/10 focus:outline-none",

        // Ghost - No border until focus
        ghost: "bg-transparent border-transparent text-foreground focus:bg-white/3 focus:border-white/10 focus:outline-none",

        // Filled - Solid background
        filled: "bg-dark-surface border border-transparent text-foreground focus:border-[#A855F7]/50 focus:ring-2 focus:ring-[#A855F7]/10 focus:outline-none",

        // Outline - Border only
        outline: "bg-transparent border border-white/10 text-foreground focus:border-[#A855F7]/50 focus:outline-none",

        // Error state
        error: "bg-white/3 border border-danger/50 text-foreground focus:border-danger focus:ring-2 focus:ring-danger/10 focus:outline-none",

        // Success state
        success: "bg-white/3 border border-success/50 text-foreground focus:border-success focus:ring-2 focus:ring-success/10 focus:outline-none",
      },
      inputSize: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  icon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, inputSize, type, icon, rightIcon, ...props }, ref) => {
    if (icon || rightIcon) {
      return (
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ variant, inputSize, className }),
              icon && "pl-10",
              rightIcon && "pr-10"
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
      )
    }

    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

// Textarea component
const textareaVariants = cva(
  "flex w-full rounded-lg text-sm transition-all duration-200 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-none",
  {
    variants: {
      variant: {
        default: "bg-white/3 border border-white/10 text-foreground focus:border-[#A855F7]/50 focus:ring-2 focus:ring-[#A855F7]/10 focus:outline-none",
        ghost: "bg-transparent border-transparent text-foreground focus:bg-white/3 focus:border-white/10 focus:outline-none",
        filled: "bg-dark-surface border border-transparent text-foreground focus:border-[#A855F7]/50 focus:ring-2 focus:ring-[#A855F7]/10 focus:outline-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          textareaVariants({ variant, className }),
          "min-h-[80px] p-4"
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

// Label component
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"

export { Input, Textarea, Label, inputVariants, textareaVariants }
