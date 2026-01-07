/**
 * WebGL Object Pool
 * 
 * Reuses WebGL objects (buffers, textures) to minimize memory allocations
 * and reduce garbage collection overhead.
 * 
 * Performance Benefits:
 * - Reduces GC pauses
 * - Minimizes memory fragmentation
 * - Faster object creation (reuse vs. allocation)
 */

interface PooledBuffer {
  buffer: WebGLBuffer | null;
  size: number;
  inUse: boolean;
}

interface PooledTexture {
  texture: WebGLTexture | null;
  width: number;
  height: number;
  inUse: boolean;
}

export class WebGLObjectPool {
  private gl: WebGLRenderingContext;
  private buffers: PooledBuffer[] = [];
  private textures: PooledTexture[] = [];
  private maxBuffers = 10;
  private maxTextures = 5;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  /**
   * Get or create a WebGL buffer
   */
  getBuffer(size: number): WebGLBuffer | null {
    // Try to find an unused buffer of the right size
    const buffer = this.buffers.find(b => !b.inUse && b.size >= size);
    
    if (buffer) {
      buffer.inUse = true;
      return buffer.buffer;
    }

    // Create new buffer if pool not full
    if (this.buffers.length < this.maxBuffers) {
      const newBuffer = this.gl.createBuffer();
      if (newBuffer) {
        this.buffers.push({
          buffer: newBuffer,
          size,
          inUse: true,
        });
        return newBuffer;
      }
    }

    // Pool full, create temporary buffer
    return this.gl.createBuffer();
  }

  /**
   * Release a buffer back to the pool
   */
  releaseBuffer(buffer: WebGLBuffer | null): void {
    const pooled = this.buffers.find(b => b.buffer === buffer);
    if (pooled) {
      pooled.inUse = false;
    }
  }

  /**
   * Get or create a WebGL texture
   */
  getTexture(width: number, height: number): WebGLTexture | null {
    // Try to find an unused texture of the right size
    const texture = this.textures.find(t => !t.inUse && t.width === width && t.height === height);
    
    if (texture) {
      texture.inUse = true;
      return texture.texture;
    }

    // Create new texture if pool not full
    if (this.textures.length < this.maxTextures) {
      const newTexture = this.gl.createTexture();
      if (newTexture) {
        this.textures.push({
          texture: newTexture,
          width,
          height,
          inUse: true,
        });
        return newTexture;
      }
    }

    // Pool full, create temporary texture
    return this.gl.createTexture();
  }

  /**
   * Release a texture back to the pool
   */
  releaseTexture(texture: WebGLTexture | null): void {
    const pooled = this.textures.find(t => t.texture === texture);
    if (pooled) {
      pooled.inUse = false;
    }
  }

  /**
   * Clean up all pooled objects
   */
  dispose(): void {
    this.buffers.forEach(b => {
      if (b.buffer) {
        this.gl.deleteBuffer(b.buffer);
      }
    });
    this.textures.forEach(t => {
      if (t.texture) {
        this.gl.deleteTexture(t.texture);
      }
    });
    this.buffers = [];
    this.textures = [];
  }
}
