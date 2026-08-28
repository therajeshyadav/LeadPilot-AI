# 🚀 Gemini AI Setup (FREE Alternative to OpenAI)

## ✅ Why Gemini?

- **FREE:** 1500 requests/day (vs OpenAI's paid-only service)
- **Fast:** Gemini 1.5 Flash is optimized for speed
- **Powerful:** Supports Hindi, Telugu, English natively
- **No Credit Card:** Get started instantly

---

## 📝 Step-by-Step Setup

### **1. Get FREE Gemini API Key**

1. Go to: **https://aistudio.google.com/app/apikey**
2. Click: **"Create API Key"**
3. Select: **"Create API key in new project"** (or use existing)
4. **Copy** the API key (looks like: `AIzaSy...`)

---

### **2. Add to .env File**

Open: `c:\Users\Rajesh Yadav\Desktop\LeadPilot-AI\.env`

Add your Gemini key:

```env
# Gemini (FREE - 1500 requests/day!)
GEMINI_API_KEY=AIzaSy_YOUR_KEY_HERE
GEMINI_MODEL=gemini-1.5-flash
```

**Note:** System automatically uses Gemini if `GEMINI_API_KEY` is set. It falls back to OpenAI only if Gemini key is missing.

---

### **3. Restart Backend**

```powershell
# Backend terminal me Ctrl+C karke phir:
npm run dev
```

---

### **4. Verify It's Working**

You should see in backend logs:
```
✅ Using Gemini AI (gemini-1.5-flash)
```

When webhooks come in, you'll see:
```
📥 Webhook received: conversation-update
✅ Conversation found
🔥 Lead qualification: HOT (score: 85)
```

**No more 429 errors!** 🎉

---

## 🔄 Switching Between Gemini and OpenAI

**Use Gemini (FREE):**
```env
GEMINI_API_KEY=AIzaSy_YOUR_KEY_HERE
OPENAI_API_KEY=  # Leave empty or comment out
```

**Use OpenAI (Paid):**
```env
GEMINI_API_KEY=  # Leave empty or comment out
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```

**Priority:** System checks `GEMINI_API_KEY` first, then `OPENAI_API_KEY`.

---

## 📊 Gemini Free Tier Limits

| Feature | Limit |
|---------|-------|
| **Requests/Day** | 1500 |
| **Requests/Minute** | 15 |
| **Tokens/Minute** | 1 million |
| **Cost** | **FREE** |

**Compare to OpenAI:**
- GPT-4o-mini: $0.15 per 1M input tokens
- 1500 requests = ~$15-30 monthly (depending on usage)

---

## 🧪 Test After Setup

1. **Start backend:** `npm run dev`
2. **Make a test call** from frontend
3. **Check backend logs:**
   - Should see: `Lead qualification for ...`
   - Should NOT see: `429 quota exceeded`
4. **Check WhatsApp** - message should arrive for HOT leads!

---

## 🆘 Troubleshooting

### ❌ Still seeing OpenAI errors?

**Check `.env` file:**
```powershell
Get-Content .env | Select-String "GEMINI"
```

Should show:
```
GEMINI_API_KEY=AIzaSy...
```

### ❌ "GEMINI_API_KEY is not set"

1. Make sure key is in `.env` file
2. **No spaces** around `=` sign
3. **No quotes** around the key
4. Restart backend: `Ctrl+C` then `npm run dev`

### ❌ "API key not valid"

1. Go back to: https://aistudio.google.com/app/apikey
2. Click **"Show"** next to your key
3. Copy again and paste in `.env`
4. Make sure you copied the ENTIRE key

---

## 🎯 Next Steps

After Gemini is working:

1. ✅ Test voice calls - lead qualification should work
2. ✅ Test HOT lead detection - WhatsApp messages should send
3. ✅ Test language detection - Hindi/Telugu should be detected correctly
4. ✅ Test callback scheduling - should extract time preferences

---

## 📞 Support

Issues? Check:
- Backend terminal for error logs
- `.env` file for correct GEMINI_API_KEY
- API key dashboard: https://aistudio.google.com/app/apikey

**Gemini FREE tier is perfect for development and small production workloads!** 🚀
