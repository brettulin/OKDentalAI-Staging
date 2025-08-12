# Phase 1 - ElevenLabs Voice Pipeline Test Script

## 🎯 Objective
Verify that the ElevenLabs voice synthesis and transcription pipeline works end-to-end with proper error handling, latency targets, and graceful fallbacks.

## 📋 Prerequisites
- ✅ ELEVENLABS_API_KEY configured in Supabase secrets
- ✅ OPENAI_API_KEY configured in Supabase secrets  
- ✅ User has completed clinic setup
- ✅ Chrome/Edge browser with microphone access

## 🧪 Test Sequence

### Test 1: AI Settings Configuration
**Expected Time: 2 minutes**

1. **Navigate to Settings**
   - Go to **Settings → AI Settings**
   - Verify page loads without errors

2. **Configure Voice Settings**
   - Set Voice Provider: `ElevenLabs`
   - Set Voice Model: `ElevenLabs Multilingual v2`
   - Set Voice: `Aria (Female)` or any preferred voice
   - Set Language: `English`
   - Add custom greeting: `"Hello! Thank you for calling our dental office. How can I assist you today?"`

3. **Enable Voice Interface**
   - Scroll to "Booking Policies" section
   - Toggle **"Enable Voice Interface"** to ON
   - Click **"Save Settings"**
   - ✅ **Expected**: Green toast "Settings saved"

4. **Test Voice Synthesis**
   - Click **"Test Voice"** button
   - ✅ **Expected**: Audio plays using selected voice
   - ✅ **Expected**: Toast shows "Voice test successful" with voice ID

### Test 2: Voice Latency Testing  
**Expected Time: 1 minute**

1. **Run Latency Test**
   - In AI Settings, find "Voice Latency Test" section
   - Click **"Run Test"** button
   - ✅ **Expected**: Latency displayed (target: <1200ms)
   - ✅ **Expected**: Badge shows "Excellent" (<800ms), "Good" (<1200ms), or "Slow" (>1200ms)
   - ✅ **Expected**: Test audio plays automatically

2. **Check Console Logs**
   - Open browser DevTools → Console
   - Look for: `Voice synthesis latency test: XXXms`
   - ✅ **Expected**: No error messages in console

### Test 3: Call Simulator Voice Integration
**Expected Time: 3 minutes**

1. **Start Voice-Enabled Call**
   - Navigate to **Index page**
   - Find "AI Call Simulator" section
   - Click **"Start Call"**
   - ✅ **Expected**: AI greeting plays as audio
   - Click **"Voice On"** button
   - ✅ **Expected**: Button shows "Voice On" and is enabled

2. **Test Voice Input (Transcription)**
   - Click and hold **microphone button** (🎤)
   - Say: *"I'd like to book a cleaning appointment for next week"*
   - Release microphone button
   - ✅ **Expected**: Text appears in chat showing transcription
   - ✅ **Expected**: AI responds with text AND audio

3. **Test Text Fallback**
   - Type a text message: *"What are your hours?"*
   - Press Enter or click Send
   - ✅ **Expected**: AI responds with both text and synthesized audio

4. **End Call**
   - Click **"End Call"**
   - ✅ **Expected**: Call ends cleanly, conversation clears

### Test 4: Error Handling & Fallbacks
**Expected Time: 2 minutes**

1. **Test Voice Disabled State**
   - Go back to **Settings → AI Settings**
   - Toggle **"Enable Voice Interface"** to OFF
   - Click **"Save Settings"**
   - Return to **Index page → Call Simulator**
   - ✅ **Expected**: "Voice On" button is disabled
   - ✅ **Expected**: Shows "Voice disabled in settings"

2. **Test Text-Only Mode**
   - Start a call with voice disabled
   - Send text messages
   - ✅ **Expected**: Everything works in text-only mode
   - ✅ **Expected**: No audio synthesis attempted

3. **Re-enable Voice**
   - Return to AI Settings
   - Toggle **"Enable Voice Interface"** back to ON
   - Save settings

### Test 5: Performance & Rate Limiting
**Expected Time: 1 minute**

1. **Rapid-Fire Testing**
   - Start a voice-enabled call
   - Send 3-4 messages quickly using voice or text
   - ✅ **Expected**: All messages process without errors
   - ✅ **Expected**: Audio responses play sequentially (not overlapping)

2. **Check Error Recovery**
   - Monitor console logs during testing
   - ✅ **Expected**: No unhandled promise rejections
   - ✅ **Expected**: Any 429 errors should show retry attempts

## 🔍 Verification Checklist

### Functional Requirements
- [ ] Voice synthesis uses clinic-configured voice settings
- [ ] Voice transcription converts speech to text accurately
- [ ] AI responses are both displayed as text AND played as audio
- [ ] Voice interface can be enabled/disabled in settings
- [ ] Text-only mode works when voice is disabled
- [ ] Call simulator integrates voice seamlessly

### Performance Requirements  
- [ ] Voice synthesis latency < 1200ms (target: < 800ms)
- [ ] Audio playback starts within 2 seconds of AI response
- [ ] No audio overlapping or queue issues
- [ ] Microphone recording starts/stops cleanly

### Error Handling
- [ ] Graceful fallback to text when voice synthesis fails
- [ ] User-friendly error messages (no raw API errors)
- [ ] Rate limiting handled with exponential backoff
- [ ] Missing API keys handled gracefully

### Security & Audit
- [ ] All voice requests are authenticated
- [ ] No PII exposure beyond necessary text/audio
- [ ] Console logs show audio processing metrics
- [ ] No secrets exposed in client-side code

## 🚨 Common Issues & Solutions

### Issue: "Voice test failed" 
**Solution**: Check ELEVENLABS_API_KEY in Supabase secrets

### Issue: Microphone access denied
**Solution**: Enable microphone permissions in browser settings

### Issue: Audio doesn't play
**Solution**: Check browser audio permissions, try different browser

### Issue: High latency (>2000ms)
**Solution**: Check network connection, ElevenLabs service status

### Issue: "Voice disabled in settings"
**Solution**: Enable "Voice Interface" toggle in AI Settings → Booking Policies

## ✅ Success Criteria

**Phase 1 is complete when:**
1. ✅ All voice synthesis tests pass with clinic settings
2. ✅ Latency test shows <1200ms performance  
3. ✅ Voice transcription works in call simulator
4. ✅ Error handling provides user-friendly messages
5. ✅ Voice can be toggled on/off without breaking functionality
6. ✅ Text-only fallback mode works perfectly

## 📊 Expected Performance Metrics

- **Voice Synthesis Latency**: 400-800ms (excellent), 800-1200ms (good)
- **Audio File Size**: ~50-200KB for 30-word responses
- **Transcription Accuracy**: >95% for clear speech
- **Error Recovery**: <3 retry attempts for rate limits
- **Memory Usage**: No memory leaks during extended testing

---

**🎉 Phase 1 Complete!** 
Ready to proceed to Phase 2 (Real-time updates hardening) once all tests pass.