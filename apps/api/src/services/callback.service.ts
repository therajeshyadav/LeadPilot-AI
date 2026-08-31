import type { CreateCallbackInput } from "@leadpilot/shared";

import type { CalendarProvider } from "../integrations/calendar/calendar-provider.js";
import type { VoiceProvider } from "../integrations/voice/voice-provider.js";
import type { CallbackRepository, LeadRepository } from "../repositories/contracts.js";
import type { CallbackRecord, PaginatedResult } from "../types/domain.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";

export interface ScheduledCallbackResult {
  callback: CallbackRecord;
  calendarSync: "created" | "not-configured" | "failed";
}

export class CallbackService {
  constructor(
    private readonly callbacks: CallbackRepository,
    private readonly leads: LeadRepository,
    private readonly calendar?: CalendarProvider,
    private readonly voiceProvider?: VoiceProvider,
    private readonly defaultAssistantId?: string,
  ) {}

  async schedule(leadId: string, input: CreateCallbackInput): Promise<ScheduledCallbackResult> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw new NotFoundError("Lead");
    if (input.scheduledFor.getTime() <= Date.now()) {
      throw new ValidationError("A callback must be scheduled in the future.");
    }
    if (!this.isIanaTimezone(input.timezone)) {
      throw new ValidationError("Callback timezone must be a valid IANA timezone, for example Asia/Kolkata.");
    }

    // PostgreSQL is the source of truth, even when optional Calendar sync fails.
    const callback = await this.callbacks.create({ ...input, leadId });
    if (!this.calendar) return { callback, calendarSync: "not-configured" };

    try {
      const event = await this.calendar.createEvent({
        title: `LeadPilot callback: ${lead.name ?? lead.phone}`,
        description: `Lead ID: ${lead.id}\nOriginal request: ${input.sourceText}`,
        scheduledFor: input.scheduledFor,
        timezone: input.timezone,
      });
      return { callback: await this.callbacks.attachCalendarEvent(callback.id, event.eventId), calendarSync: "created" };
    } catch {
      return { callback, calendarSync: "failed" };
    }
  }

  async list(input: { limit: number; offset: number; leadId?: string }): Promise<PaginatedResult<CallbackRecord>> {
    return this.callbacks.list(input);
  }

  async findByProviderCallId(providerCallId: string): Promise<CallbackRecord | null> {
    return this.callbacks.findByProviderCallId(providerCallId);
  }

  async markAsCompleted(id: string): Promise<CallbackRecord> {
    return this.callbacks.markAsCompleted(id);
  }

  /**
   * Process all pending callbacks that are due.
   * This should be called periodically (e.g., every minute) by a background worker.
   * 
   * Returns the number of callbacks successfully triggered.
   */
  async processPendingCallbacks(): Promise<number> {
    if (!this.voiceProvider || !this.defaultAssistantId) {
      console.warn("Voice provider or assistant ID not configured, skipping callback processing");
      return 0;
    }

    const now = new Date();
    const pendingCallbacks = await this.callbacks.findPendingCallbacks(now);

    if (pendingCallbacks.length === 0) {
      return 0;
    }

    console.log(`📞 Processing ${pendingCallbacks.length} pending callback(s)`);

    let successCount = 0;

    for (const callback of pendingCallbacks) {
      try {
        await this.triggerCallback(callback);
        successCount++;
      } catch (error) {
        console.error(`Failed to trigger callback ${callback.id}:`, error);
        // Continue processing other callbacks even if one fails
      }
    }

    return successCount;
  }

  /**
   * Trigger a single callback by creating an outbound call.
   * Updates the callback status appropriately.
   */
  private async triggerCallback(callback: CallbackRecord): Promise<void> {
    if (!this.voiceProvider || !this.defaultAssistantId) {
      throw new Error("Voice provider not configured");
    }

    // Get lead information
    const lead = await this.leads.findById(callback.leadId);
    if (!lead) {
      await this.callbacks.markAsFailed(callback.id, "Lead not found");
      throw new Error(`Lead ${callback.leadId} not found`);
    }

    // Convert scheduled time to lead's timezone for logging
    const scheduledTimeStr = callback.scheduledFor.toLocaleString("en-US", {
      timeZone: callback.timezone,
      dateStyle: "short",
      timeStyle: "short",
    });

    console.log(`📞 Triggering callback ${callback.id} for lead ${lead.name || lead.phone} (scheduled: ${scheduledTimeStr})`);

    try {
      // Create outbound call through Vapi
      const call = await this.voiceProvider.createOutboundCall({
        to: lead.phone,
        leadId: lead.id,
        assistantId: this.defaultAssistantId,
        metadata: {
          callbackId: callback.id,
          callbackScheduledFor: callback.scheduledFor.toISOString(),
          callbackSourceText: callback.sourceText,
        },
      });

      // Mark callback as processing with the provider call ID
      await this.callbacks.markAsProcessing(callback.id, call.providerCallId);

      console.log(`✅ Callback ${callback.id} triggered successfully (call: ${call.providerCallId})`);
    } catch (error: any) {
      // Mark as failed with error details
      const reason = error?.message || String(error);
      await this.callbacks.markAsFailed(callback.id, reason);
      
      console.error(`❌ Failed to trigger callback ${callback.id}:`, reason);
      throw error;
    }
  }

  private isIanaTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}
