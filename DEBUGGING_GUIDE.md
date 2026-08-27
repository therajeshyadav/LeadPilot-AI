# 🐛 LeadPilot AI - Debugging Guide

## Issues Reported:

### ❌ **Issue 1: WhatsApp Mid-Call Nahi Ja Raha Hai**
**Symptom:** Frontend se manual bhejne par WhatsApp ja raha hai, but calling ke time automatically nahi ja raha.

**Root Cause Options:**
1. Backend webhooks receive nahi ho rahe
2. Transcript length < 100 characters (minimum requirement)
3. AI "HOT" classification nahi kar raha
4. WhatsApp service fail ho raha hai

**How to Debug:**

#### Step 1: Check Backend Logs
Backend terminal mein call karte time ye messages aane chahiye:

```
✅ Expected logs:
📥 Webhook received: conversation-update for call call_xxx
✅ Conversation found: conv_xxx for lead lead_xxx
Lead qualification for lead_xxx: HOT (score: 85)
🔥 HOT LEAD DETECTED during live call for lead lead_xxx
Sending HOT lead WhatsApp for lead lead_xxx
✅ HOT lead WhatsApp sent successfully during live call: WA123
```

```
❌ If missing:
- No "📥 Webhook received" → Vapi webhook not configured properly
- No "🔥 HOT LEAD DETECTED" → AI classified as WARM/COLD, not HOT
- No "✅ WhatsApp sent" → WhatsApp service failing
```

#### Step 2: Check Ngrok Status
```bash
# Is ngrok still running?
# Check: https://expire-salad-lukewarm.ngrok-free.dev
curl https://expire-salad-lukewarm.ngrok-free.dev/api/health
```

**Expected:** `{"status":"ok"}`
**If fails:** Ngrok expired, restart it

#### Step 3: Check Vapi Webhook URL
1. Go to: https://dashboard.vapi.ai/assistants/3f72fb26-85e3-453d-880d-cedd3df88c93
2. Check "Server URL": Should be `https://expire-salad-lukewarm.ngrok-free.dev/api/webhooks/voice`
3. If wrong, update it

#### Step 4: Check Conversation Qualification
Add more debug logs to see WHY not HOT:

**File:** `apps/api/src/services/voice.service.ts` line 241

**Add this after qualification:**
```typescript
console.log(`🔍 QUALIFICATION DEBUG for lead ${leadId}:`);
console.log(`   Classification: ${qualification.classification}`);
console.log(`   Score: ${qualification.score}`);
console.log(`   Reasoning: ${qualification.reasoning}`);
console.log(`   Transcript: ${transcript.substring(0, 200)}...`);
```

This will show if AI is classifying correctly.

---

### ❌ **Issue 2: Language Mid-Call Switch Nahi Ho Raha**
**Symptom:** 
- Call starts English
- Customer bolta Hindi
- AI Hindi switch nahi karta, English me hi bolta rehta hai
- Customer ko bolna padta hai "Hindi mein bolo"

**Root Cause:**
Vapi's AI model (likely GPT-4 or similar) is NOT aggressively following language switching instructions in system prompt.

**Why This Happens:**
1. LLMs tend to "lock in" to initial language
2. System prompt language switching rules not aggressive enough
3. Vapi may need explicit language parameter updates

**Solutions:**

#### **Solution 1: Update Vapi System Prompt (MANDATORY)**

**Current file created:** `VAPI_SYSTEM_PROMPT_UPDATED.md`

**How to Update:**
1. Go to: https://dashboard.vapi.ai/assistants/3f72fb26-85e3-453d-880d-cedd3df88c93
2. Click "Edit"
3. Scroll to "System Prompt" section
4. **Replace entire prompt** with content from `VAPI_SYSTEM_PROMPT_UPDATED.md`
5. Click "Save"
6. Test new call

**Key Changes in Updated Prompt:**
```
OLD: "Detect the customer's language from their first meaningful response."
NEW: "AFTER THE FIRST CUSTOMER RESPONSE, IMMEDIATELY SWITCH TO THEIR LANGUAGE"

Added:
- "YOU MUST ADAPT YOUR LANGUAGE INSTANTLY"
- "If you detect even ONE word in Hindi/Telugu, switch ENTIRE response"
- "Never repeat same sentence in English after customer responds in Hindi"
- Explicit examples of language switching mid-sentence
```

#### **Solution 2: Vapi Model Parameters (Optional)**

Vapi may support language hints. Check Vapi docs for:
```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "languageHint": "auto-detect",  // If supported
  "responseLanguage": "match-user" // If supported
}
```

**Where to check:** Vapi Assistant Settings → Model Configuration

#### **Solution 3: Use Vapi's First Message Override**

In Vapi Assistant settings, you might be able to set:
- **Initial message language:** English
- **Follow-up behavior:** "Match user language"

**Where:** Vapi Dashboard → Assistant → Advanced Settings → Conversation Behavior

---

## 🧪 Testing Checklist:

### **Test 1: Backend Webhook Reception**
```bash
# Start backend
npm run dev

# Start ngrok (if not running)
ngrok http 4000

# Make test call
# Check backend terminal for "📥 Webhook received"
```

**Expected:** Webhook logs appear within 5-10 seconds of call starting

---

### **Test 2: HOT Lead Detection**
**Test Scenario:** Say this EXACTLY in Hindi:
```
"Namaste, mujhe e-commerce website chahiye.
 Mera budget 50,000 rupees hai.
 Main kapde bechta hoon.
 Urgent chahiye ek mahine mein."
```

**Expected Backend Logs:**
```
Lead qualification for lead_xxx: HOT (score: 80+)
🔥 HOT LEAD DETECTED
✅ HOT lead WhatsApp sent
```

**If classified as WARM/COLD:**
- Check qualification reasoning in logs
- AI might need stronger buying signals
- Try adding: "Kab start kar sakte ho?" (When can you start?)

---

### **Test 3: Language Switching**
**Test Scenario:**
```
AI: "Hello! I'm calling from Null Syntax..."
YOU: "Namaste, Hindi mein bolo."
AI: [Should respond in Hindi immediately]
```

**If AI stays in English:**
- System prompt not updated properly
- Check Vapi dashboard for correct prompt
- Try creating NEW assistant with updated prompt

**Alternative Test:**
```
AI: "What products do you sell?"
YOU: "Kapde bechte hain."
AI: [Should switch to Hindi: "Achha! Kitne products hain?"]
```

---

### **Test 4: End-to-End Flow**
1. Frontend: Create lead with phone `+919373822203`
2. Click "Call" button
3. Backend logs: `📥 Webhook received: call_started`
4. Speak in Hindi with strong intent
5. Backend logs: `🔥 HOT LEAD DETECTED`
6. Backend logs: `✅ WhatsApp sent successfully`
7. Check WhatsApp on phone `+919373822203`

**Success Criteria:**
- ✅ Call connects
- ✅ AI responds in Hindi after you speak Hindi
- ✅ Backend detects HOT
- ✅ WhatsApp received mid-call
- ✅ Message references actual conversation

---

## 🔧 Quick Fixes:

### **Fix 1: Restart Ngrok**
```bash
# Kill existing ngrok
Ctrl+C

# Start new ngrok
ngrok http 4000

# Copy new URL
# Update in Vapi dashboard
```

### **Fix 2: Check Transcript Length**
Minimum 100 characters needed for HOT detection.

**File:** `apps/api/src/services/voice.service.ts` line 129
```typescript
if (this.intelligence && this.whatsapp && event.transcript.length > 100) {
```

If transcript too short, say more things!

### **Fix 3: Force HOT for Testing**
Temporarily override classification for testing:

**File:** `apps/api/src/services/voice.service.ts` line 245
```typescript
// TEMPORARY: Force HOT for testing
const qualification = {
  classification: "HOT" as const,
  score: 90,
  reasoning: "Test override",
  signals: { buyingIntent: "Test", budget: "Test", timeline: "Test", requirements: "Test" }
};

// Comment out real AI call:
// const qualification = await this.intelligence.qualifyConversation({
//   transcript,
//   currentLead
// });
```

**REMOVE THIS AFTER TESTING!**

---

## 📊 Diagnostic Commands:

### **Check Database:**
```bash
# See latest conversations
npm run prisma:studio

# Go to "Conversation" table
# Check: transcript field populated?
# Check: detectedLanguage field correct?
```

### **Check WhatsApp Messages:**
```bash
# In prisma studio
# Go to "WhatsAppMessage" table
# Check: type = "HOT_LEAD"?
# Check: status = "SENT"?
# Check: message content correct?
```

### **Check Vapi Call Status:**
```bash
# Use Vapi dashboard
# https://dashboard.vapi.ai/calls
# Find your call
# Check: Webhooks sent?
# Check: Transcript captured?
```

---

## 🚨 Common Errors & Solutions:

### Error: "No conversation found for call ID"
**Cause:** Call started but conversation not created in database
**Fix:** Check `createOutboundCall` in voice.service.ts creates conversation record

### Error: "Transcript received for call: xxx" but no HOT detection
**Cause 1:** Transcript < 100 characters
**Fix:** Speak more, give complete information

**Cause 2:** AI classified as WARM/COLD
**Fix:** Use stronger buying intent language (see Test 2)

**Cause 3:** Intelligence provider not configured
**Fix:** Check .env has valid `OPENAI_API_KEY`

### Error: "HOT lead WhatsApp failed"
**Cause:** Twilio credentials wrong or trial restrictions
**Fix:** 
- Check .env has correct Twilio credentials
- Ensure phone joined WhatsApp sandbox
- Check Twilio account not suspended

### AI Not Switching Language
**Cause:** System prompt not aggressive enough
**Fix:** Use `VAPI_SYSTEM_PROMPT_UPDATED.md` (already created)

---

## 📝 Next Steps:

1. **Update Vapi System Prompt** → Use `VAPI_SYSTEM_PROMPT_UPDATED.md`
2. **Test Backend Logs** → Make call, watch terminal
3. **Debug Qualification** → Add extra logs if needed
4. **Test Language Switch** → Verify AI responds in Hindi
5. **End-to-End Test** → Complete flow with WhatsApp delivery

---

**Last Updated:** 2026-08-27
**Status:** Ready for Testing
