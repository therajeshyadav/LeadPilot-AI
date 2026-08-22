import type { CreateCallbackInput } from "@leadpilot/shared";

import type { CalendarProvider } from "../integrations/calendar/calendar-provider.js";
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

  private isIanaTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}
