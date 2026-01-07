import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface DraggableCardProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function DraggableCard({ id, children, className = '' }: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${className}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-1.5 top-1.5 z-10 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity bg-[#1E2232] border border-white/10 rounded p-0.5 sm:p-1 hover:bg-[#2A2F42]"
      >
        <GripVertical className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white/60" />
      </div>
      {children}
    </div>
  );
}
