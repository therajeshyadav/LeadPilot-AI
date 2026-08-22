import { describe, it, expect, vi, beforeEach } from "vitest";
import { TwilioWhatsAppProvider } from "../src/integrations/whatsapp/twilio-whatsapp-provider.js";

describe("TwilioWhatsAppProvider", () => {
  let provider: TwilioWhatsAppProvider;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    
    provider = new TwilioWhatsAppProvider({
      accountSid: "test_account_sid",
      authToken: "test_auth_token",
      fromNumber: "whatsapp:+14155238886",
    });
  });

  describe("sendText", () => {
    it("should send WhatsApp text message successfully", async () => {
      const mockResponse = {
        sid: "SMtest123",
        status: "queued",
      };

      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await provider.sendText({
        to: "+919876543210",
        body: "Test message",
        idempotencyKey: "test_key",
      });

      expect(result.providerMessageId).toBe("SMtest123");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("Messages.json"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Authorization": expect.stringContaining("Basic "),
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        })
      );
    });

    it("should handle Twilio API errors", async () => {
      const errorResponse = {
        error_code: "21614",
        error_message: "Invalid phone number",
      };

      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(errorResponse)),
      });

      await expect(provider.sendText({
        to: "invalid",
        body: "Test message",
        idempotencyKey: "test_key",
      })).rejects.toThrow("Twilio error 21614: Invalid phone number");
    });

    it("should handle HTTP errors", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
      });

      await expect(provider.sendText({
        to: "+919876543210",
        body: "Test message", 
        idempotencyKey: "test_key",
      })).rejects.toThrow("Failed to send WhatsApp message: Bad Request");
    });

    it("should format Indian phone numbers correctly", async () => {
      const mockResponse = { sid: "SMtest123", status: "queued" };
      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      await provider.sendText({
        to: "9876543210",
        body: "Test message",
        idempotencyKey: "test_key",
      });

      const callArgs = fetchMock.mock.calls[0];
      const formData = callArgs[1].body as URLSearchParams;
      expect(formData.get("To")).toBe("whatsapp:+919876543210");
    });
  });

  describe("sendMedia", () => {
    it("should send WhatsApp media message successfully", async () => {
      const mockResponse = {
        sid: "SMmedia123",
        status: "queued",
      };

      fetchMock.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await provider.sendMedia({
        to: "+919876543210",
        body: "Check this out",
        mediaUrl: "https://example.com/image.jpg",
        idempotencyKey: "test_media_key",
      });

      expect(result.providerMessageId).toBe("SMmedia123");
      
      const callArgs = fetchMock.mock.calls[0];
      const formData = callArgs[1].body as URLSearchParams;
      expect(formData.get("MediaUrl")).toBe("https://example.com/image.jpg");
      expect(formData.get("Body")).toBe("Check this out");
    });
  });
});