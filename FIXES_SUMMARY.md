# Fix Summary - Post-Call WhatsApp & Callback Detection

## Changes Made (August 22, 2026)

### Issue 1: Post-Call WhatsApp Message Fix

**Problem:**
- Post-call WhatsApp messages had empty body (`body: ""`)
- Missing contact/mobile number
- No proper conversation context
- Missing comprehensive logging

**Solution Implemented:**

#### 1. Updated All AI Intelligence Providers (Gemini, Groq, OpenAI)
**Files Modified:**
- `apps/api/src/integrations/openai/gemini-intelligence-provider.ts`
- `apps/api/src/integrations/openai/groq-intelligence-provider.ts`
- `apps/api/src/integrations/openai/openai-intelligence-provider.ts`

**Changes:**
- Enhanced `generateFollowUp()` prompt to include:
  - Explicit instruction to reference conversation context (product, budget, timeline, requirements, concerns)
  - Mandatory contact number inclusion: `process.env.SALES_CONTACT_PHONE || "+91-9876543210"`
  - Natural human follow-up format (not table/list)
  - Length increased to 2-4 sentences for better context
  - Validation to ensure message is never empty (minimum 10 chars)
- Added `getFallbackFollowUpMessage()` helper method with proper contact numbers in all languages
- Added empty message validation before returning

#### 2. Enhanced Voice Service Post-Call Processing
**File Modified:** `apps/api/src/services/voice.service.ts`

**Changes:**
- Added comprehensive logging:
  - `🔄 Starting post-call processing...`
  - `📝 Generating post-call WhatsApp message...`
  - `✅ Generated post-call WhatsApp message (N chars)`
  - `📱 Message body: [full message preview]`
  - Logs Message SID and delivery status after sending
- Added validation to check if generated message is empty
- If message is empty, uses fallback with contact number
- Added `getMediaUrls()` helper to prepare architecture image and resume attachments
- Comprehensive error logging with error details

#### 3. Enhanced WhatsApp Service
**File Modified:** `apps/api/src/services/whatsapp.service.ts`

**Changes:**
- Added validation in `sendFollowUpMessage()` to reject empty message bodies
- Added detailed logging:
  - `📤 Preparing to send follow-up WhatsApp to [phone]`
  - `Message length: N chars`
  - `Media attachments: N`
  - `📎 Sending message with media attachment: [url]`
  - `✅ Primary message sent - SID: [sid]`
  - Logs for each additional media attachment
- Enhanced error handling with detailed error messages

#### 4. Enhanced Twilio WhatsApp Provider
**File Modified:** `apps/api/src/integrations/whatsapp/twilio-whatsapp-provider.ts`

**Changes:**
- Added detailed logging in `sendText()`:
  - Logs recipient, body length, body preview
  - Logs success with SID and status
- Added detailed logging in `sendMedia()`:
  - Logs recipient, body length, body preview, media URL
  - Logs success with SID and status
- Enhanced error logging

**Result:**
✅ Post-call WhatsApp now:
1. Always has a non-empty text body
2. Includes conversation context (product, budget, timeline, requirements, concerns)
3. Written as natural human follow-up
4. Includes contact number: `process.env.SALES_CONTACT_PHONE`
5. Attaches architecture image if `ARCHITECTURE_IMAGE_URL` is set
6. Attaches resume if `RESUME_DOCUMENT_URL` is set
7. Logs the exact generated message body before sending
8. Logs the Twilio Message SID and delivery status
9. Falls back to valid message if AI generation fails
10. Never sends empty body even if image attachment fails

---

### Issue 2: Callback Detection Fix

**Problem:**
- AI providers returning JavaScript `undefined` instead of `null` in JSON, causing parse errors: `Unexpected token 'u'`
- Callbacks being automatically scheduled for WARM leads without explicit request
- False positive detections for normal conversation statements

**Solution Implemented:**

#### 1. Updated All AI Intelligence Providers (Gemini, Groq, OpenAI)
**Files Modified:**
- `apps/api/src/integrations/openai/gemini-intelligence-provider.ts`
- `apps/api/src/integrations/openai/groq-intelligence-provider.ts`
- `apps/api/src/integrations/openai/openai-intelligence-provider.ts`

**Changes in `detectCallbackIntent()`:**

1. **Enhanced Prompt with Critical Rules:**
   ```
   CRITICAL RULES:
   - ONLY set requested=true if the customer EXPLICITLY asks to be called back
   - Normal conversation, questions, or interest do NOT count as callback requests
   - The customer must use phrases that request a future call
   ```

2. **Clear Examples of What IS a Callback Request:**
   - "Call me tomorrow" / "kal call karna" / "రేపు కాల్ చేయండి"
   - "Call me at 5 PM" / "5 baje call karo"
   - "Call me back tomorrow morning"

3. **Clear Examples of What is NOT a Callback Request:**
   - "I need a website" / "mujhe website chahiye"
   - "My budget is 20k" / "mera budget 20k hai"
   - "Send me details" / "details bhejo"
   - "I will think about it" / "sochke bataunga"
   - "I need to discuss with my brother"
   - "Okay, thank you"
   - Normal questions about features

4. **JSON Safety:**
   - Updated prompt to explicitly request: "Use null (NOT undefined) for missing values"
   - Added sanitization: `cleaned.replace(/:\s*undefined/g, ': null')` to handle any `undefined` in response
   - OpenAI version explicitly states in prompt: "IMPORTANT: Use null for missing values, NOT undefined"

5. **Enhanced Error Handling:**
   - Added detailed error logging with error message
   - Always returns safe fallback: `{ requested: false, originalText: "" }`
   - Added `console.error("Error details:", ...)` for debugging

**Result:**
✅ Callback detection now:
1. Only triggers when customer EXPLICITLY requests a callback
2. Does NOT trigger for normal conversation like:
   - "I need a website"
   - "My budget is 20k"
   - "Send me details"
   - "I will think about it"
   - "I need to discuss with my brother"
3. Always returns valid JSON (never has JavaScript `undefined`)
4. Uses `null` for missing date/time values
5. Returns structured CallbackIntent:
   ```typescript
   {
     requested: false,  // or true if explicitly requested
     date: null,        // or "YYYY-MM-DD"
     timeOfDay: null,   // or "morning" | "afternoon" | "evening" | "specific"
     specificTime: null, // or "HH:MM"
     originalText: ""   // or the exact phrase
   }
   ```
6. No more "Unexpected token 'u'" errors

---

## Files Changed

### Intelligence Providers (3 files):
1. `apps/api/src/integrations/openai/gemini-intelligence-provider.ts`
2. `apps/api/src/integrations/openai/groq-intelligence-provider.ts`
3. `apps/api/src/integrations/openai/openai-intelligence-provider.ts`

### Services (2 files):
4. `apps/api/src/services/voice.service.ts`
5. `apps/api/src/services/whatsapp.service.ts`

### Providers (1 file):
6. `apps/api/src/integrations/whatsapp/twilio-whatsapp-provider.ts`

**Total: 6 files modified**

---

## Test Results

### All Tests Passing ✅
```
Test Files  9 passed (9)
Tests      53 passed (53)
Duration   1.20s
```

### Specific Test Coverage:
- ✅ Calendar & Callback Integration (12 tests)
  - Callback intent detection
  - Explicit date/time handling
  - Morning/afternoon/evening time defaults
  - Hindi/Telugu callback requests
  - NO callback on normal conversation
  - Calendar API failure handling
  
- ✅ HOT Lead WhatsApp Integration (11 tests)
  - Mid-call HOT detection
  - Post-call follow-up with media
  - Idempotency
  - Multi-language support
  - Error handling

---

## Verification Checklist

### Issue 1 - Post-Call WhatsApp ✅
- [x] Message body is always non-empty
- [x] Uses actual conversation context (product, budget, timeline, requirements, concerns)
- [x] Natural human follow-up format (not table/list)
- [x] Includes contact/mobile number
- [x] Attaches architecture/build image
- [x] Attaches resume (if supported)
- [x] Never invents discounts, urgency, offers, deadlines, prices
- [x] Falls back to valid message if AI generation fails
- [x] Still sends text even if image attachment fails
- [x] Logs exact generated message body before sending
- [x] Logs Twilio Message SID and delivery status

### Issue 2 - Callback Detection ✅
- [x] Only detects when customer EXPLICITLY asks for callback
- [x] "Call me tomorrow" → triggers callback ✅
- [x] "I need a website" → does NOT trigger ✅
- [x] "My budget is 20k" → does NOT trigger ✅
- [x] "Send me details" → does NOT trigger ✅
- [x] "I will think about it" → does NOT trigger ✅
- [x] Returns valid JSON (never `undefined`)
- [x] Uses `null` for missing values
- [x] No "Unexpected token 'u'" errors
- [x] Enhanced error logging

### Existing Functionality Preserved ✅
- [x] HOT mid-call WhatsApp still works
- [x] HOT/WARM/COLD classification unchanged
- [x] Language detection/switching unchanged
- [x] Vapi call flow unchanged
- [x] Twilio configuration unchanged
- [x] Callback scheduling/automatic Vapi call unchanged

---

## Environment Variables Used

```bash
# Required for post-call WhatsApp
SALES_CONTACT_PHONE="+91-9876543210"  # Your contact number

# Optional media attachments
ARCHITECTURE_IMAGE_URL="https://example.com/architecture.jpg"
RESUME_DOCUMENT_URL="https://example.com/resume.pdf"

# Callback time defaults
DEFAULT_CALLBACK_MORNING_HOUR="10"    # Default: 10 AM
DEFAULT_CALLBACK_AFTERNOON_HOUR="15"  # Default: 3 PM
DEFAULT_CALLBACK_EVENING_HOUR="18"    # Default: 6 PM
DEFAULT_TIMEZONE="Asia/Kolkata"        # Default timezone
```

---

## Sample Logs

### Post-Call WhatsApp Success:
```
🔄 Starting post-call processing for lead: abc123, conversation: conv456
✅ Discovery updated for lead abc123: { budget: "20k", productType: "e-commerce" }
📝 Generating post-call WhatsApp message for lead abc123...
✅ Generated post-call WhatsApp message (142 chars):
📱 Message body: Hi Rajesh! Great speaking with you about your e-commerce website needs for electronics. We'll prepare a detailed proposal for your 20k budget and send it over shortly.

📞 Contact: +91-9876543210
📤 Preparing to send follow-up WhatsApp to +919876543210
   Message length: 142 chars
   Media attachments: 2
📎 Sending message with media attachment: https://example.com/architecture.jpg
✅ Primary message sent - SID: SM1234567890
📎 Sending additional media 1: https://example.com/resume.pdf
✅ Additional media 1 sent - SID: SM1234567891
✅ Post-call WhatsApp sent successfully!
   Message SID: SM1234567890
   Status: sent
   Idempotent: false
✅ Post-call processing completed for lead: abc123
```

### Callback Detection (Explicit Request):
```
📅 Callback requested for lead abc123: Call me tomorrow at 5 PM
✅ Callback scheduled for lead abc123 on 2026-08-23T11:30:00.000Z (Asia/Kolkata)
   Calendar sync status: created
```

### Callback Detection (No Request):
```
# Customer says: "I need to discuss with my brother"
# NO callback scheduled (as expected)
```

---

## Notes

1. **Backward Compatibility:** All existing functionality remains unchanged. This is a surgical fix addressing only the two specific issues.

2. **Fallback Safety:** Multiple layers of fallback ensure messages are never empty:
   - AI generation → Fallback message with contact → Validation → Error if still empty

3. **Idempotency:** Both HOT and post-call WhatsApp use conversation-based idempotency to prevent duplicates.

4. **TypeScript Errors:** Pre-existing type errors in vapi-provider.ts and dependency packages are unrelated to these changes.

5. **All Tests Passing:** 53 tests pass, including comprehensive callback and WhatsApp integration tests.

---

## Deployment Checklist

Before deploying to production:

1. [ ] Set `SALES_CONTACT_PHONE` environment variable
2. [ ] Set `ARCHITECTURE_IMAGE_URL` if you have an architecture/build image
3. [ ] Set `RESUME_DOCUMENT_URL` if you want to attach resume
4. [ ] Verify callback time defaults match your business hours
5. [ ] Test with sample call to verify post-call WhatsApp content and attachments
6. [ ] Test callback detection with phrases like "call me tomorrow" vs "I'll think about it"
7. [ ] Monitor logs for Message SIDs and delivery status

---

**Fixes completed by:** Kiro AI Agent  
**Date:** August 22, 2026  
**Status:** ✅ All tests passing, ready for deployment
