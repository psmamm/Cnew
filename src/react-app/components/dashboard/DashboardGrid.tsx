import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import React, { ReactNode, useState, useEffect } from 'react';
import { DraggableCard } from './DraggableCard';

interface DashboardGridProps {
  children: ReactNode[];
  storageKey: string;
  defaultOrder?: string[];
}

export function DashboardGrid({ children, storageKey, defaultOrder }: DashboardGridProps) {
  const [items, setItems] = useState<string[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultOrder || children.map((_, i) => `item-${i}`);
      }
    }
    return defaultOrder || children.map((_, i) => `item-${i}`);
  });

  useEffect(() => {
    // Ensure items array matches children length
    const childrenArray = Array.isArray(children) ? children : [children];
    if (items.length !== childrenArray.length) {
      const newItems = defaultOrder || childrenArray.map((_, i) => `item-${i}`);
      setItems(newItems);
      localStorage.setItem(storageKey, JSON.stringify(newItems));
    }
  }, [children, storageKey, defaultOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newItems = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem(storageKey, JSON.stringify(newItems));
        return newItems;
      });
    }
  }

  // Create a map of children by their key or index
  const childrenArray = Array.isArray(children) ? children : [children];
  const childrenMap: Record<string, ReactNode> = {};
  
  childrenArray.forEach((child, index) => {
    // Extract key from React element
    let childKey: string;
    if (React.isValidElement(child) && child.key) {
      childKey = String(child.key);
    } else if (defaultOrder && defaultOrder[index]) {
      childKey = defaultOrder[index];
    } else {
      childKey = `item-${index}`;
    }
    childrenMap[childKey] = child;
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
          {items.map((itemId) => (
            <DraggableCard key={itemId} id={itemId}>
              {childrenMap[itemId]}
            </DraggableCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
