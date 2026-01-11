import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/react-app/lib/utils"

/**
 * Card Component - Bitget Style (2026)
 *
 * Backgrounds:
 * - Default: #141416 (elevated)
 * - Surface: #1A1A1E
 * - Border: #2A2A2E
 * - Border radius: 12px
 */

const cardVariants = cva(
  "rounded-xl transition-all duration-200",
  {
    variants: {
      variant: {
        // Default - Bitget card style
        default: "bg-[#141416] border border-[#2A2A2E] shadow-card",

        // Glass - Glassmorphism with blur
        glass: "bg-[#141416]/80 backdrop-blur-xl border border-[#2A2A2E]",

        // Ghost - Minimal, just for grouping
        ghost: "bg-transparent",

        // Outline - Border only
        outline: "bg-transparent border border-[#2A2A2E]",

        // Surface - Slightly elevated (input background)
        surface: "bg-[#1A1A1E] border border-[#2A2A2E]",

        // Interactive - Hover effects
        interactive: "bg-[#141416] border border-[#2A2A2E] shadow-card hover:shadow-card-hover hover:border-[#3A3A3E] hover:-translate-y-0.5 cursor-pointer",

        // Promo - For recommendation/promo cards (Bitget style)
        promo: "bg-gradient-to-br from-[#1A1A1E] to-[#141416] border border-[#2A2A2E] relative overflow-hidden",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        default: "p-5",
        lg: "p-6",
        xl: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-white",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[#9CA3AF]", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }

