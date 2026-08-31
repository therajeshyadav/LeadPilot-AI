import type { CallbackService } from "../services/callback.service.js";

/**
 * Background worker that processes pending callbacks every minute.
 * 
 * This worker:
 * - Runs every 60 seconds
 * - Finds callbacks that are due (scheduledFor <= now)
 * - Triggers outbound calls through Vapi
 * - Updates callback status appropriately
 * - Prevents duplicate calls (status must be SCHEDULED)
 */
export class CallbackWorker {
  private intervalId?: NodeJS.Timeout;
  private isProcessing = false;
  private readonly intervalMs: number;

  constructor(
    private readonly callbackService: CallbackService,
    intervalSeconds: number = 60,
  ) {
    this.intervalMs = intervalSeconds * 1000;
  }

  /**
   * Start the background worker
   */
  start(): void {
    if (this.intervalId) {
      console.warn("⚠️  Callback worker already running");
      return;
    }

    console.log(`🚀 Starting callback worker (checking every ${this.intervalMs / 1000}s)`);

    // Run immediately on start
    this.processCallbacks().catch(error => {
      console.error("Error in initial callback processing:", error);
    });

    // Then run every interval
    this.intervalId = setInterval(() => {
      this.processCallbacks().catch(error => {
        console.error("Error in callback worker:", error);
      });
    }, this.intervalMs);
  }

  /**
   * Stop the background worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log("🛑 Callback worker stopped");
    }
  }

  /**
   * Process pending callbacks (called by the interval)
   */
  private async processCallbacks(): Promise<void> {
    // Prevent overlapping executions
    if (this.isProcessing) {
      console.log("⏭️  Skipping callback processing (previous run still in progress)");
      return;
    }

    this.isProcessing = true;

    try {
      const triggeredCount = await this.callbackService.processPendingCallbacks();

      if (triggeredCount > 0) {
        console.log(`✅ Callback worker: Triggered ${triggeredCount} callback(s)`);
      }
    } catch (error) {
      console.error("❌ Callback worker error:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get worker status
   */
  isRunning(): boolean {
    return this.intervalId !== undefined;
  }
}
