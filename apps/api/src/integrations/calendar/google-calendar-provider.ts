import type { CalendarProvider, CalendarEventRequest } from "./calendar-provider.js";

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  calendarId: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "google-calendar";
  private readonly baseURL = "https://www.googleapis.com/calendar/v3";
  private readonly tokenURL = "https://oauth2.googleapis.com/token";
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private readonly config: GoogleCalendarConfig) {}

  async createEvent(request: CalendarEventRequest): Promise<{ eventId: string }> {
    const token = await this.getAccessToken();

    // Event duration: 30 minutes
    const startTime = new Date(request.scheduledFor);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

    const event: GoogleCalendarEvent = {
      id: "",
      summary: request.title,
      description: request.description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: request.timezone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: request.timezone,
      },
    };

    const response = await fetch(
      `${this.baseURL}/calendars/${encodeURIComponent(this.config.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
    }

    const createdEvent = (await response.json()) as GoogleCalendarEvent;
    return { eventId: createdEvent.id };
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 5 * 60 * 1000) {
      return this.accessToken;
    }

    // Refresh the access token
    const response = await fetch(this.tokenURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh Google token: ${response.status} - ${errorText}`);
    }

    const tokenData = (await response.json()) as GoogleTokenResponse;
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;

    return this.accessToken;
  }
}
