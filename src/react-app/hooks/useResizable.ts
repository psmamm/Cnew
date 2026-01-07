/**
 * Custom Resizable Hook
 * 
 * Implements resizable panels without external dependencies.
 * Uses mouse events to resize panels by dragging borders.
 */

import { useRef, useState, useEffect, useCallback } from 'react';

interface UseResizableOptions {
  direction: 'horizontal' | 'vertical';
  minSize?: number;
  maxSize?: number;
  onResize?: (size: number) => void;
}

export function useResizable({ direction, minSize = 0, maxSize = 100, onResize }: UseResizableOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState(50); // Default 50%
  const startPosRef = useRef<number>(0);
  const startSizeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSizeRef.current = size;
  }, [direction, size]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerSize = direction === 'horizontal' ? containerRect.width : containerRect.height;
      const delta = direction === 'horizontal' 
        ? e.clientX - startPosRef.current 
        : e.clientY - startPosRef.current;
      
      const deltaPercent = (delta / containerSize) * 100;
      let newSize = startSizeRef.current + deltaPercent;

      // Clamp to min/max
      newSize = Math.max(minSize, Math.min(maxSize, newSize));
      
      setSize(newSize);
      onResize?.(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, direction, minSize, maxSize, onResize]);

  return {
    size,
    setSize,
    isResizing,
    handleMouseDown,
    containerRef,
  };
}
