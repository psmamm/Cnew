import * as React from "react"
import { cn } from "@/react-app/lib/utils"

// Basic Skeleton
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circular" | "text"
}

function Skeleton({
  className,
  variant = "default",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "skeleton animate-shimmer",
        variant === "circular" && "rounded-full",
        variant === "text" && "h-4 rounded",
        className
      )}
      {...props}
    />
  )
}

// Skeleton Card
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-dark-elevated rounded-2xl border border-white/6 p-6", className)}>
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="circular" className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}

// Skeleton Table Row
function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-white/6">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-8" : "flex-1"
          )}
        />
      ))}
    </div>
  )
}

// Skeleton Stats Card
function SkeletonStats({ className }: { className?: string }) {
  return (
    <div className={cn("bg-dark-elevated rounded-2xl border border-white/6 p-6", className)}>
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

// Skeleton Chart
function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("bg-dark-elevated rounded-2xl border border-white/6 p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
      <div className="h-64 flex items-end gap-1">
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${Math.random() * 80 + 20}%` }}
          />
        ))}
      </div>
    </div>
  )
}

// Spinner Component
interface SpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  }

  return (
    <div
      className={cn(
        "spinner-glow",
        sizeClasses[size],
        className
      )}
    />
  )
}

// Loading Overlay
interface LoadingOverlayProps {
  isLoading: boolean
  children: React.ReactNode
  text?: string
  blur?: boolean
}

function LoadingOverlay({
  isLoading,
  children,
  text,
  blur = true,
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center bg-dark-base/80 rounded-2xl z-10",
            blur && "backdrop-blur-sm"
          )}
        >
          <Spinner size="lg" />
          {text && (
            <p className="mt-4 text-sm text-muted-foreground">{text}</p>
          )}
        </div>
      )}
    </div>
  )
}

// Progress Bar
interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
  variant?: "default" | "success" | "danger" | "warning"
}

function ProgressBar({
  value,
  max = 100,
  className,
  showLabel = false,
  variant = "default",
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const variantClasses = {
    default: "bg-gradient-premium shadow-glow-sm",
    success: "bg-gradient-profit shadow-glow-success",
    danger: "bg-gradient-loss shadow-glow-danger",
    warning: "bg-warning shadow-glow-warning",
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="progress-bar">
        <div
          className={cn("progress-bar-fill", variantClasses[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {Math.round(percentage)}%
        </p>
      )}
    </div>
  )
}

// Pulse Dot (for status indicators)
interface PulseDotProps {
  color?: "default" | "success" | "danger" | "warning"
  className?: string
}

function PulseDot({ color = "default", className }: PulseDotProps) {
  const colorClasses = {
    default: "bg-primary-500",
    success: "bg-success",
    danger: "bg-danger",
    warning: "bg-warning",
  }

  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span
        className={cn(
          "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
          colorClasses[color]
        )}
      />
      <span
        className={cn(
          "relative inline-flex rounded-full h-2 w-2",
          colorClasses[color]
        )}
      />
    </span>
  )
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonStats,
  SkeletonChart,
  Spinner,
  LoadingOverlay,
  ProgressBar,
  PulseDot,
}
