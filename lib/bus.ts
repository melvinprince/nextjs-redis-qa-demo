import { EventEmitter } from "events";

class Bus extends EventEmitter {
  private isInitialized = false;

  private async init() {
    if (this.isInitialized) return;

    console.log("Local event bus initialized");
    this.isInitialized = true;
  }

  async emitAsync(event: string, payload: any): Promise<boolean> {
    await this.init();

    // Emit locally for SSE clients
    const result = super.emit(event, payload);

    // Note: For production with multiple server instances,
    // you would implement Redis pub/sub or use a service like Pusher/Ably
    // For this demo, local events work perfectly for single instance

    return result;
  }

  // Override emit to be synchronous for compatibility
  emit(event: string | symbol, ...args: any[]): boolean {
    // For async operations, use emitAsync instead
    if (typeof event === "string" && args.length === 1) {
      // Fire and forget async operation
      this.emitAsync(event, args[0]).catch(console.error);
    }
    return super.emit(event, ...args);
  }

  async cleanup() {
    this.isInitialized = false;
  }
}

export const bus = new Bus();

// Cleanup on process exit
process.on("SIGTERM", () => bus.cleanup());
process.on("SIGINT", () => bus.cleanup());
