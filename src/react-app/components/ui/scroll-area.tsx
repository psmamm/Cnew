import * as React from "react"
import { cn } from "@/react-app/lib/utils"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div className="h-full w-full overflow-auto scrollbar-thin scrollbar-thumb-[#2B2F36] scrollbar-track-transparent">
        {children}
      </div>
    </div>
  )
)
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
