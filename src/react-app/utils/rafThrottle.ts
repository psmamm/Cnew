/**
 * RequestAnimationFrame Throttle
 * 
 * Throttles function calls to requestAnimationFrame rate (60 FPS).
 * Batches multiple rapid updates into a single frame.
 * 
 * Performance Benefits:
 * - Prevents excessive redraws
 * - Batches multiple WebSocket updates
 * - Maintains 60 FPS target
 */

export class RAFThrottle {
  private rafId: number | null = null;
  private pendingCallback: (() => void) | null = null;
  private lastFrameTime: number = 0;
  private readonly minFrameTime: number;

  constructor(targetFPS: number = 60) {
    this.minFrameTime = 1000 / targetFPS;
  }

  /**
   * Schedule a callback for the next animation frame
   * If multiple calls occur before the frame, only the latest callback is executed
   */
  schedule(callback: () => void): void {
    this.pendingCallback = callback;

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame((timestamp) => {
        this.execute(timestamp);
      });
    }
  }

  private execute(timestamp: number): void {
    const deltaTime = timestamp - this.lastFrameTime;

    // Throttle to target FPS
    if (deltaTime >= this.minFrameTime) {
      if (this.pendingCallback) {
        this.pendingCallback();
        this.pendingCallback = null;
      }
      this.lastFrameTime = timestamp;
    }

    // Schedule next frame if there's a pending callback
    if (this.pendingCallback) {
      this.rafId = requestAnimationFrame((timestamp) => {
        this.execute(timestamp);
      });
    } else {
      this.rafId = null;
    }
  }

  /**
   * Cancel any pending callbacks
   */
  cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingCallback = null;
  }

  /**
   * Execute pending callback immediately (if any)
   */
  flush(): void {
    if (this.pendingCallback) {
      this.pendingCallback();
      this.pendingCallback = null;
    }
    this.cancel();
  }
}
