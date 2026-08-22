export interface CalendarEventRequest {
  title: string;
  description: string;
  scheduledFor: Date;
  timezone: string;
}

export interface CalendarProvider {
  readonly name: string;
  createEvent(request: CalendarEventRequest): Promise<{ eventId: string }>;
}
