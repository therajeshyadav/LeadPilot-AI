import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleCalendarProvider } from "../src/integrations/calendar/google-calendar-provider.js";

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("GoogleCalendarProvider", () => {
  let provider: GoogleCalendarProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    provider = new GoogleCalendarProvider({
      clientId: "test_client_id",
      clientSecret: "test_client_secret",
      redirectUri: "http://localhost:4000/oauth/callback",
      refreshToken: "test_refresh_token",
      calendarId: "primary",
    });
  });

  describe("createEvent", () => {
    it("should create calendar event successfully", async () => {
      // Mock token refresh
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: "new_access_token",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/calendar",
          token_type: "Bearer",
        }),
      });

      // Mock calendar event creation
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: "event_123456",
          summary: "LeadPilot callback: Test Customer",
          description: "Lead ID: lead_123",
          start: {
            dateTime: "2026-08-23T10:00:00+05:30",
            timeZone: "Asia/Kolkata",
          },
          end: {
            dateTime: "2026-08-23T10:30:00+05:30",
            timeZone: "Asia/Kolkata",
          },
        }),
      });

      const scheduledFor = new Date("2026-08-23T10:00:00+05:30");
      const result = await provider.createEvent({
        title: "LeadPilot callback: Test Customer",
        description: "Lead ID: lead_123\nPhone: +919876543210",
        scheduledFor,
        timezone: "Asia/Kolkata",
      });

      expect(result.eventId).toBe("event_123456");
      expect(fetchMock).toHaveBeenCalledTimes(2); // Token refresh + event creation
    });

    it("should refresh access token before creating event", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: "refreshed_token",
          expires_in: 3600,
        }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: "event_456",
          summary: "Test Event",
        }),
      });

      await provider.createEvent({
        title: "Test Event",
        description: "Test Description",
        scheduledFor: new Date(),
        timezone: "Asia/Kolkata",
      });

      // First call should be token refresh
      const tokenCall = fetchMock.mock.calls[0];
      expect(tokenCall[0]).toContain("oauth2.googleapis.com/token");
    });

    it("should handle Google Calendar API errors", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "token", expires_in: 3600 }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Invalid calendar ID"),
      });

      await expect(
        provider.createEvent({
          title: "Test",
          description: "Test",
          scheduledFor: new Date(),
          timezone: "Asia/Kolkata",
        })
      ).rejects.toThrow("Google Calendar API error: 400");
    });

    it("should handle token refresh failures", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Invalid refresh token"),
      });

      await expect(
        provider.createEvent({
          title: "Test",
          description: "Test",
          scheduledFor: new Date(),
          timezone: "Asia/Kolkata",
        })
      ).rejects.toThrow("Failed to refresh Google token: 401");
    });

    it("should set event duration to 30 minutes", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "token", expires_in: 3600 }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "event_123" }),
      });

      const startTime = new Date("2026-08-25T15:00:00+05:30");
      await provider.createEvent({
        title: "30-minute callback",
        description: "Test",
        scheduledFor: startTime,
        timezone: "Asia/Kolkata",
      });

      // Check the calendar API call
      const calendarCall = fetchMock.mock.calls[1];
      const requestBody = JSON.parse(calendarCall[1].body);

      const expectedEndTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      expect(requestBody.end.dateTime).toBe(expectedEndTime.toISOString());
    });

    it("should use correct timezone in event", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "token", expires_in: 3600 }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "event_123" }),
      });

      await provider.createEvent({
        title: "Timezone Test",
        description: "Test",
        scheduledFor: new Date(),
        timezone: "Asia/Kolkata",
      });

      const calendarCall = fetchMock.mock.calls[1];
      const requestBody = JSON.parse(calendarCall[1].body);

      expect(requestBody.start.timeZone).toBe("Asia/Kolkata");
      expect(requestBody.end.timeZone).toBe("Asia/Kolkata");
    });

    it("should cache access token and reuse it", async () => {
      // First request - token refresh
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: "cached_token",
          expires_in: 3600,
        }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "event_1" }),
      });

      await provider.createEvent({
        title: "First Event",
        description: "Test",
        scheduledFor: new Date(),
        timezone: "Asia/Kolkata",
      });

      // Second request - should reuse token (no refresh call)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "event_2" }),
      });

      await provider.createEvent({
        title: "Second Event",
        description: "Test",
        scheduledFor: new Date(),
        timezone: "Asia/Kolkata",
      });

      // Should have 3 calls total: 1 token refresh + 2 event creations
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });
});
