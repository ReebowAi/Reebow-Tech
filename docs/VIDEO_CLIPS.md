# Reebow TECH Platform — Video Clip Production & Integration Guide

**Version:** 2.0.0  
**Purpose:** Complete specs for recording, processing, and deploying persona video clips for the clip-injection video call system

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Required Clips](#required-clips)
3. [Recording Specifications](#recording-specifications)
4. [Persona Setup (D-ID, HeyGen, LivePortrait)](#persona-setup)
5. [Post-Processing](#post-processing)
6. [File Naming & Structure](#file-naming--structure)
7. [Manifest Generation](#manifest-generation)
8. [Quality Checklist](#quality-checklist)
9. [Testing & Validation](#testing--validation)
10. [Advanced: Custom Personas](#advanced-custom-personas)

---

## System Overview

The Reebow platform uses **pre-recorded video clips** instead of real-time GPU rendering:
Admin clicks "Live Call"
      │
      ▼
Selects persona (Annie/Craig) + clip (hello/listening/thinking/yes/no/goodbye)
      │
      ▼
Socket.io: 'inject-clip' { clipId, persona, loop }
      │
      ▼
Visitor receives event → Sets video.src = /clips/{persona}/{clipId}.mp4
      │
      ▼
Video plays with realism filters (grain, blur, warmth) applied via CSS
      │
      ▼
'listening' clip loops until next clip injected
**Why clips?**
- ✅ **$0 GPU cost** — no real-time rendering
- ✅ **Zero latency** — CDN cached, instant playback
- ✅ **Perfect lip-sync** — baked in during recording
- ✅ **Works everywhere** — mobile, desktop, low-end devices
- ✅ **Controllable** — admin directs conversation flow

---

## Required Clips

### Minimum Viable Set (Per Persona)

| Clip ID | Purpose | Duration | Loop? | Priority |
|---------|---------|----------|-------|----------|
| `hello` | Greeting when call starts | 3–5 sec | No | **Required** |
| `listening` | Idle state while admin types/thinks | 8–15 sec | **Yes** | **Required** |
| `thinking` | "Let me check..." pause | 4–6 sec | No | **Required** |
| `yes` | Positive response | 2–3 sec | No | **Required** |
| `no` | Negative response | 2–3 sec | No | **Required** |
| `goodbye` | Call end | 3–4 sec | No | **Required** |

### Extended Set (Recommended)

| Clip ID | Purpose | Duration | Loop? |
|---------|---------|----------|-------|
| `welcome` | Extended intro | 5–8 sec | No |
| `custom_1` | "Thanks for visiting" | 3–5 sec | No |
| `custom_2` | "Let me get that for you" | 3–4 sec | No |
| `custom_3` | "One moment please" | 2–3 sec | No |
| `laugh` | Light reaction | 2–3 sec | No |
| `nod` | Silent acknowledgment | 2–3 sec | **Yes** |
| `wait` | "Hold on" with hand gesture | 3–4 sec | No |

### Clip Flow Example
Call Start → [hello] → Admin types → [thinking] → Admin sends → [yes] →
Visitor asks → [listening] (loop) → Admin injects → [custom_1] →
Call End → [goodbye]
---

## Recording Specifications

### Video Settings

| Parameter | Specification | Notes |
|-----------|---------------|-------|
| **Resolution** | 1280×720 (720p) minimum, 1920×1080 (1080p) recommended | 4K optional but larger files |
| **Aspect Ratio** | 16:9 | Standard landscape |
| **Frame Rate** | 30 fps | 60 fps OK but larger |
| **Codec** | H.264 (AVC) | Main/High profile, Level 4.0+ |
| **Container** | MP4 (.mp4) | ISO Base Media Format |
| **Bitrate** | 2–5 Mbps (720p), 5–10 Mbps (1080p) | CBR or VBR max 2× avg |
| **Keyframe Interval** | 2 seconds (60 frames @ 30fps) | Critical for streaming |
| **Color Space** | Rec.709 (sRGB) | Standard |
| **Audio** | AAC-LC, 128 kbps, 44.1/48 kHz, stereo | Embedded in MP4 |

### Audio-Video Sync (Critical!)
┌─────────────────────────────────────────────────────────────┐
│  BAKED AUDIO = PERFECT LIP SYNC                             │
│                                                             │
│  DO: Record video + audio together in one take             │
│  DO: Use TTS → speaker → record webcam                     │
│  DON'T: Generate video first, add audio later              │
│  DON'T: Assume you can fix sync in post                    │
└─────────────────────────────────────────────────────────────┘
### Recording Environment

| Element | Recommendation |
|---------|----------------|
| **Lighting** | Soft, even, 45° angle (key), fill light opposite, no harsh shadows |
| **Background** | Clean, neutral (solid color or subtle gradient), no distractions |
| **Camera** | Eye level, head-and-shoulders framing, 10% headroom |
| **Audio** | Lavalier mic or close USB mic, pop filter, -18 to -12 dBFS peaks |
| **Persona** | Consistent expression, natural eye contact with camera lens |

---

## Persona Setup (D-ID, HeyGen, LivePortrait)

### Option 1: D-ID Studio (Easiest, Paid)

```bash
# 1. Create account: studio.d-id.com
# 2. Upload source photo (clean, front-facing, 512x512+)
# 3. Create presenter → Get presenter_id (e.g., "annie_x7k2m9")
# 4. Generate clips via API or UI:

# API Example:
curl -X POST https://api.d-id.com/talks \
  -H "Authorization: Basic YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "script": {
      "type": "text",
      "input": "Hello! Welcome to our support.",
      "provider": { "type": "microsoft", "voice_id": "en-US-JennyNeural" }
    },
    "presenter_id": "annie_x7k2m9",
    "config": { "fluent": true, "driver_url": "bank" }
  }'

# 5. Download each generated video → rename to clip ID
# 6. Cost: ~$0.04/second (free trial: 5 min)Option 2: HeyGen (Good Alternative)# 1. app.heygen.com → Create avatar from photo
# 2. Choose voice (Microsoft/Azure/ElevenLabs)
# 3. Generate videos per script
# 4. Download MP4s
# Cost: Credits-based (~$0.02/sec)Option 3: LivePortrait (Free, Self-Hosted GPU)# Requirements: NVIDIA GPU (6GB+ VRAM), Docker
# Best for: Unlimited clips, full control, zero cost per clip

# 1. RunPod / Vast.ai → Rent RTX 4090 ($0.30/hr)
# 2. Deploy LivePortrait container:
docker run -d --gpus all -p 8000:8000 \
  -v $(pwd)/models:/models \
  -v $(pwd)/inputs:/inputs \
  -v $(pwd)/outputs:/outputs \
  ghcr.io/kelingdingsun/liveportrait:latest

# 3. API usage:
curl -X POST http://localhost:8000/animate \
  -F "source_image=@annie.jpg" \
  -F "driving_video=@driving_speaking.mp4" \
  -F "output=annie_hello.mp4"

# 4. Create driving videos once (you speaking each script)
# 5. Generate unlimited clips for Annie/Craig/any persona
# Cost: ~$0.50 for 100 clips (vs $200+ on D-ID)Option 4: Local (If You Have GPU)# NVIDIA RTX 3080/3090/4080/4090 (8GB+ VRAM)
git clone https://github.com/kelingdingsun/LivePortrait
cd LivePortrait
pip install -r requirements.txt
python -m download_models

# Batch generate:
python batch_animate.py \
  --source_dir ./source_photos \
  --driving_dir ./driving_videos \
  --output_dir ./output_clipsDriving Videos (For LivePortrait)Record yourself speaking each script naturally:Driving ClipScriptDurationdriving_hello.mp4"Hello! Welcome to our support. How can I help you today?"4 secdriving_listening.mp4Nod slowly, maintain eye contact, slight smile12 sec (loop)driving_thinking.mp4Look up thoughtfully, "Hmm, let me think about that..."5 secdriving_yes.mp4"Yes, absolutely. That sounds perfect."3 secdriving_no.mp4"No, I don't think that will work."3 secdriving_goodbye.mp4"Thanks for chatting! Have a great day. Goodbye!"4 secTip: Record all driving videos in one session for consistent lighting/expression.Post-ProcessingFFmpeg Commands (Standardize All Clips)# 1. Normalize to 720p, 30fps, H.264, AAC, 2-sec keyframes
ffmpeg -i input.mp4 \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -profile:v high -level 4.0 -preset medium -crf 22 \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -movflags +faststart \
  output_standard.mp4

# 2. Batch process all clips
for f in *.mp4; do
  ffmpeg -i "$f" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30" \
    -c:v libx264 -preset medium -crf 22 -g 60 -keyint_min 60 \
    -c:a aac -b:a 128k -ar 48000 \
    -movflags +faststart "standardized/${f}"
done

# 3. Verify keyframe interval
ffprobe -select_streams v -show_frames -show_entries frame=key_frame,pkt_pts_time standardized/hello.mp4 | grep key_frame
# Should show key_frame=1 every ~2 seconds (60 frames @ 30fps)Quality Verification# Check all clips
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name,bit_rate -of csv=p=0 standardized/*.mp4

# Expected output:
# 1280,720,30/1,h264,~3000000
# 1280,720,30/1,h264,~2800000File Naming & StructureDirectory Layoutpublic/
└── clips/
    ├── manifest.json           # Auto-generated (see below)
    ├── annie/
    │   ├── hello.mp4
    │   ├── listening.mp4
    │   ├── thinking.mp4
    │   ├── yes.mp4
    │   ├── no.mp4
    │   ├── goodbye.mp4
    │   ├── welcome.mp4
    │   ├── custom_1.mp4
    │   ├── nod.mp4
    │   └── wait.mp4
    └── craig/
        ├── hello.mp4
        ├── listening.mp4
        ├── thinking.mp4
        ├── yes.mp4
        ├── no.mp4
        ├── goodbye.mp4
        └── ...Naming RulesRuleExampleLowercase, underscores onlycustom_1.mp4 ✓ Custom-1.MP4 ✗Clip ID = filename without extensionlistening.mp4 → clipId: "listening"Persona = directory nameannie/ → persona: "annie"Maximum 50 charsthis_clip_name_is_way_too_long.mp4 ✗Manifest GenerationAuto-Generate Manifest# Run in project root
node -e "
const fs = require('fs');
const path = require('path');

const base = '/clips';
const personas = ['annie', 'craig'];  // Add more as needed
const manifest = {};

personas.forEach(persona => {
  const personaDir = path.join('public', base, persona);
  manifest[persona] = {};
  
  if (fs.existsSync(personaDir)) {
    fs.readdirSync(personaDir)
      .filter(f => f.endsWith('.mp4'))
      .forEach(f => {
        const clipId = f.replace('.mp4', '');
        const fullPath = path.join(base, persona, f);
        
        // Get video metadata
        try {
          const { execSync } = require('child_process');
          const probe = execSync(\`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,r_frame_rate,bit_rate -of json \${personaDir}/\${f}\`).toString();
          const info = JSON.parse(probe).streams[0];
          
          manifest[persona][clipId] = {
            url: fullPath,
            width: info.width,
            height: info.height,
            duration: parseFloat(info.duration),
            fps: eval(info.r_frame_rate),  // e.g., '30/1' → 30
            bitrate: parseInt(info.bit_rate),
            loop: ['listening', 'nod'].includes(clipId)  // Known loop clips
          };
        } catch {
          manifest[persona][clipId] = { url: fullPath };
        }
      });
  }
});

const outPath = path.join('public', base, 'manifest.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log('Manifest written to', outPath);
console.log('Clips found:', Object.entries(manifest).flatMap(([p, c]) => Object.keys(c)).length);
"Manifest Output Example{
  "annie": {
    "hello": {
      "url": "/clips/annie/hello.mp4",
      "width": 1280,
      "height": 720,
      "duration": 4.2,
      "fps": 30,
      "bitrate": 3200000,
      "loop": false
    },
    "listening": {
      "url": "/clips/annie/listening.mp4",
      "width": 1280,
      "height": 720,
      "duration": 12.5,
      "fps": 30,
      "bitrate": 2800000,
      "loop": true
    },
    ...
  },
  "craig": { ... }
}Verify Manifest# Check all clips exist and are accessible
node -e "
const manifest = require('./public/clips/manifest.json');
let ok = 0, missing = 0;
Object.entries(manifest).forEach(([persona, clips]) => {
  Object.entries(clips).forEach(([id, clip]) => {
    const fs = require('fs');
    if (fs.existsSync('public' + clip.url)) {
      ok++;
    } else {
      console.log('MISSING:', clip.url);
      missing++;
    }
  });
});
console.log(\`✅ \${ok} clips present, ❌ \${missing} missing\`);
"Quality ChecklistPre-Deploy Checklist (Per Clip)CheckToolPass CriteriaResolutionffprobe1280×720 or 1920×1080Frame rateffprobe30 fps (or 60, consistent)CodecffprobeH.264 (libx264)Keyframe intervalffprobe2 sec (60 frames @ 30fps)Bitrateffprobe2–10 MbpsAudio codecffprobeAAC-LC, 128 kbps+DurationffprobeMatches spec ±1 secLip syncVisualPerfect (no drift)LightingVisualEven, no flickerBackgroundVisualClean, consistentFile sizels -lh< 50 MB (720p), < 100 MB (1080p)Faststart atomffprobe -show_formatmovflags=+faststartLoop seamlessnessVisualNo jump on loopBatch Quality Report# Generate CSV report
node -e "
const fs = require('fs'), path = require('path');
const manifest = JSON.parse(fs.readFileSync('public/clips/manifest.json'));
const rows = ['Persona,Clip ID,Width,Height,FPS,Duration(s),Bitrate(Kbps),Loop,File Size(MB)'];

Object.entries(manifest).forEach(([persona, clips]) => {
  Object.entries(clips).forEach(([id, clip]) => {
    const stats = fs.statSync('public' + clip.url);
    rows.push([persona, id, clip.width, clip.height, clip.fps, clip.duration, 
      Math.round(clip.bitrate/1000), clip.loop, (stats.size/1024/1024).toFixed(2)].join(','));
  });
});
fs.writeFileSync('clip-quality-report.csv', rows.join('\n'));
console.log('Report saved: clip-quality-report.csv');
"Testing & ValidationLocal Testing# 1. Start server
npm start

# 2. Open two browser tabs
# Tab 1: http://localhost:10000/admin.html (login)
# Tab 2: http://localhost:10000/visitor.html?email=test@example.com

# 3. Test flow:
# - Admin: Select visitor → "Live Call" → Choose persona "annie" → "hello"
# - Visitor: Should see Annie's hello clip play immediately
# - Admin: Inject "listening" (loop)
# - Visitor: Clip loops seamlessly
# - Admin: Inject "yes"
# - Visitor: Smooth transition
# - Admin: "Hang Up"
# - Both: Call ends cleanlyAutomated Clip Test (Headless)// test/clips.test.js
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Test each clip loads and plays
  const manifest = require('../public/clips/manifest.json');
  
  for (const [persona, clips] of Object.entries(manifest)) {
    for (const [clipId, clip] of Object.entries(clips)) {
      const response = await page.goto(`http://localhost:10000${clip.url}`, { 
        waitUntil: 'networkidle0' 
      });
      
      if (response.status() !== 200) {
        console.error(`❌ ${persona}/${clipId}: HTTP ${response.status()}`);
        continue;
      }
      
      // Verify video element
      const videoInfo = await page.evaluate(() => {
        const v = document.querySelector('video');
        return v ? { duration: v.duration, videoWidth: v.videoWidth, readyState: v.readyState } : null;
      });
      
      if (videoInfo && videoInfo.duration > 0) {
        console.log(`✅ ${persona}/${clipId}: ${videoInfo.duration.toFixed(1)}s @ ${videoInfo.videoWidth}px`);
      } else {
        console.error(`❌ ${persona}/${clipId}: Video failed to load`);
      }
    }
  }
  
  await browser.close();
})();Load Test (Concurrent Viewers)# Vegeta load test (100 concurrent for 30s)
echo "GET http://yourdomain.com/clips/annie/hello.mp4" | \
  vegeta attack -rate=100 -duration=30s | \
  vegeta report

# Expected: 99%+ success, p99 latency < 500msAdvanced: Custom PersonasAdding a 3rd Persona (e.g., "Jordan")# 1. Create directory
mkdir -p public/clips/jordan

# 2. Add clips (same IDs as annie/craig)
# jordan/hello.mp4, jordan/listening.mp4, etc.

# 3. Regenerate manifest (auto-detects new directories)

# 4. Update admin clip modal (admin.html):
# <select id="clipPersona">
#   <option value="annie">Annie</option>
#   <option value="craig">Craig</option>
#   <option value="jordan">Jordan</option>  <!-- ADD THIS -->
# </select>

# 5. Update visitor realism (visitor.js):
// Persona-specific filter presets
const personaFilters = {
  annie: { warmth: 105, saturation: 102 },
  craig: { warmth: 98, contrast: 103 },
  jordan: { warmth: 100, saturation: 100, brightness: 102 }  // Custom
};

# 6. Update default persona (env):
DEFAULT_PERSONA=annie  # or jordanPer-Tenant Personas (White-Label)// In server.js visitor schema:
metadata: new Map([
  ['persona', 'client_custom_avatar'],
  ['persona_clips_url', 'https://cdn.client.com/clips/']
]);

// Admin clip injector fetches from tenant config:
app.get('/api/admin/clips/:tenantId', async (req, res) => {
  const visitor = await Visitor.findOne({ tenantId: req.params.tenantId });
  res.json({ clips: visitor.metadata.get('persona_clips_url') });
});Dynamic Persona Switching Mid-Call// Admin clicks "Switch Persona" → emits:
socket.emit('inject-clip', { 
  clipId: 'hello', 
  persona: 'jordan', 
  loop: false,
  switchPersona: true  // New flag
});

// Visitor handles:
socket.on('clip-injected', ({ persona, clipId, switchPersona }) => {
  if (switchPersona) {
    currentPersona = persona;
    updatePersonaFilters(persona);  // Apply new realism preset
  }
  playClip(persona, clipId);
});CDN Deployment (Production Scale)Cloudflare R2 + Workers# 1. Upload clips to R2 bucket
wrangler r2 object put reebow-clips/clips/annie/hello.mp4 \
  --file=public/clips/annie/hello.mp4 \
  --content-type=video/mp4

# 2. Worker for signed URLs (optional)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/clips/')) {
      // Check referer/origin, sign if needed
      const object = await env.CLIPS_BUCKET.get(url.pathname.slice(1));
      if (!object) return new Response('Not found', { status: 404 });
      
      return new Response(object.body, {
        headers: {
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': 'https://yourdomain.com'
        }
      });
    }
    return fetch(request);
  }
};

# 3. Update manifest URLs to CDN:
"url": "https://clips.yourdomain.com/clips/annie/hello.mp4"CloudFront (AWS)# S3 Bucket → CloudFront Distribution
# Origin: S3 bucket (private)
# Origin Access Identity: Yes
# Viewer Protocol: HTTPS Only
# Cache TTL: 1 year (clips never change)
# Compress: No (already compressed)
# Query String: None
# Headers: None (except Origin for CORS)Cost Analysis| Provider | Cost per 100 Clips (720p, ~5 sec avg
| Provider | Cost per 100 Clips (720p, ~5 sec avg) | Setup Time | Best For |
|----------|--------------------------------------|------------|----------|
| **D-ID** | ~$200 (100 clips × 4 sec × $0.50/sec) | 10 min | Quick start, no GPU |
| **HeyGen** | ~$100 (credits-based) | 15 min | Good voices, easy UI |
| **LivePortrait (RunPod)** | **~$2** (1 hr RTX 4090 @ $0.30/hr) | 30 min | **Unlimited clips, zero marginal cost** |
| **LivePortrait (Local)** | **$0** (electricity only) | 1 hr | Full control, batch thousands |

**Recommendation:** Use **LivePortrait on RunPod** for production — generate all clips in one $2 session, own them forever.

---

## Quick Reference: Clip Commands

```bash
# Standardize all clips
for f in *.mp4; do
  ffmpeg -i "$f" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30" \
    -c:v libx264 -preset medium -crf 22 -g 60 -keyint_min 60 -sc_threshold 0 \
    -c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart "standardized/${f}"
done

# Generate manifest
node -e "
const fs = require('fs'), path = require('path');
const base = '/clips', personas = ['annie','craig'];
const m = {};
personas.forEach(p => { m[p] = {}; 
  fs.readdirSync('public'+base+'/'+p).filter(f=>f.endsWith('.mp4')).forEach(f => {
    m[p][f.replace('.mp4','')] = { url: path.join(base,p,f) };
  }); 
});
fs.writeFileSync('public/clips/manifest.json', JSON.stringify(m, null, 2));
"

# Verify
curl -fsS https://yourdomain.com/api/clips/manifest | jq '.annie | keys'TroubleshootingIssueCauseFixClip won't play on mobileNo movflags=+faststartRe-encode with -movflags +faststartStutter on loopKeyframes not alignedEnsure -g 60 -keyint_min 60Audio out of syncGenerated separatelyRecord video+audio togetherLarge file sizeBitrate too highLower -crf 22 to -crf 24Manifest 404Wrong path in manifestCheck url starts with /clips/CORS on video loadMissing headersNginx: add_header Access-Control-Allow-Origin *;Visitor sees black screenVideo codec not supportedEnsure H.264 baseline/main/high profileEnd of Video Clips Guide
See also: Client Handover, Deployment, Architecture
---