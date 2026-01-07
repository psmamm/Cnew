/**
 * Ring Buffer for Orderbook Updates
 * 
 * Circular buffer implementation for efficient orderbook data management.
 * Prevents memory reallocation by overwriting oldest entries.
 * 
 * Performance Benefits:
 * - O(1) insert/update operations
 * - No memory reallocation
 * - Fixed memory footprint
 */

export interface RingBufferEntry<T> {
  data: T;
  timestamp: number;
}

export class RingBuffer<T> {
  private buffer: (RingBufferEntry<T> | null)[];
  private size: number;
  private writeIndex: number = 0;
  private count: number = 0;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Array(size).fill(null);
  }

  /**
   * Add an entry to the buffer
   * Overwrites oldest entry if buffer is full
   */
  push(data: T): void {
    this.buffer[this.writeIndex] = {
      data,
      timestamp: Date.now(),
    };
    
    this.writeIndex = (this.writeIndex + 1) % this.size;
    
    if (this.count < this.size) {
      this.count++;
    }
  }

  /**
   * Get all entries in chronological order
   */
  getAll(): T[] {
    const result: T[] = [];
    
    if (this.count === 0) {
      return result;
    }

    // Start from the oldest entry
    const startIndex = this.count < this.size 
      ? 0 
      : this.writeIndex;

    for (let i = 0; i < this.count; i++) {
      const index = (startIndex + i) % this.size;
      const entry = this.buffer[index];
      if (entry) {
        result.push(entry.data);
      }
    }

    return result;
  }

  /**
   * Get the most recent entry
   */
  getLatest(): T | null {
    if (this.count === 0) {
      return null;
    }

    const index = this.writeIndex === 0 
      ? this.size - 1 
      : this.writeIndex - 1;
    
    const entry = this.buffer[index];
    return entry ? entry.data : null;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer.fill(null);
    this.writeIndex = 0;
    this.count = 0;
  }

  /**
   * Get current count of entries
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Get buffer capacity
   */
  getCapacity(): number {
    return this.size;
  }
}
