Reebow TECH Platform — Video Clip Production & Integration Guide
Version: 2.0.0
Purpose: Complete specifications for recording, processing, and deploying persona video clips for the clip-injection video call system.
Table of Contents
 * System Overview
 * Required Clips
 * Recording Specifications
 * Persona Setup Tools
 * Post-Processing
 * File Naming & Structure
 * Manifest Generation
 * Quality Checklist
 * Testing & Validation
 * Advanced Customization
System Overview
The Reebow platform uses pre-recorded video clips instead of resource-heavy real-time rendering:
 * Admin clicks "Live Call" → Selects persona (Annie/Craig) and clip (hello, listening, etc.)
 * Socket.io trigger: Dispatches inject-clip event containing target parameters.
 * Visitor playback: Receives the event and assigns video.src = /clips/{persona}/{clipId}.mp4.
 * Realism filters: CSS layers apply subtle film grain, blur, and warmth for a natural look.
 * Seamless loops: The listening clip loops automatically until the admin injects a new response.
Why Pre-Recorded Clips?
 * $0 GPU cost — avoids expensive live rendering.
 * Zero latency — cached via CDN for instant playback.
 * Perfect lip-sync — perfectly synchronized during recording.
 * Universal compatibility — works smoothly across mobile devices, desktops, and low-end hardware.
Required Clips
Minimum Viable Set (Per Persona)
| Clip ID | Purpose | Duration | Loop? | Priority |
|---|---|---|---|---|
| hello | Greeting when call starts | 3–5 sec | No | Required |
| listening | Idle state while admin types or thinks | 8–15 sec | Yes | Required |
| thinking | "Let me check..." pause | 4–6 sec | No | Required |
| yes | Positive response | 2–3 sec | No | Required |
| no | Negative response | 2–3 sec | No | Required |
| goodbye | Call end sequence | 3–4 sec | No | Required |
Extended Set (Recommended)
 * welcome (Extended intro, 5–8 sec)
 * custom_1 ("Thanks for visiting", 3–5 sec)
 * custom_2 ("Let me get that for you", 3–4 sec)
 * laugh (Light reaction, 2–3 sec)
 * nod (Silent acknowledgment, 2–3 sec, Looping)
Recording Specifications
Video Settings
| Parameter | Specification |
|---|---|
| Resolution | 1280×720 (720p) minimum, 1920×1080 (1080p) recommended |
| Aspect Ratio | 16:9 Landscape |
| Frame Rate | 30 fps |
| Codec | H.264 (AVC) |
| Container | MP4 (.mp4) |
| Bitrate | 2–5 Mbps (720p), 5–10 Mbps (1080p) |
| Audio | AAC-LC, 128 kbps, stereo |
> [!NOTE]
> Audio-Video Synchronization: Always record video and audio together in a single take. Never generate video first and add audio in post-production to avoid sync drift.
> 
Persona Setup Tools
Option 1: D-ID Studio / HeyGen (Cloud Tools)
 * Generate presenter profiles and render custom scripts via web interface or API keys.
 * Cost: Credit-based pricing model (~$0.02 to $0.05 per generated second).
Option 2: LivePortrait (Self-Hosted GPU)
 * Best option for unlimited, cost-effective batch generation using an NVIDIA GPU.
 * Cost: ~$2.00 total to generate 100+ production clips via cloud rental (e.g., RunPod RTX 4090).
Post-Processing
Standardize All Clips via FFmpeg
Run the following script to optimize clips for web streaming with correct keyframes and faststart atoms:
for f in *.mp4; do
  ffmpeg -i "$f" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30" \
    -c:v libx264 -preset medium -crf 22 -g 60 -keyint_min 60 -sc_threshold 0 \
    -c:a aac -b:a 128k -ar 48000 -ac 2 \
    -movflags +faststart "standardized/${f}"
done

File Naming & Structure
public/
└── clips/
    ├── manifest.json           # Auto-generated index
    ├── annie/
    │   ├── hello.mp4
    │   ├── listening.mp4
    │   ├── thinking.mp4
    │   ├── yes.mp4
    │   ├── no.mp4
    │   └── goodbye.mp4
    └── craig/
        ├── hello.mp4
        ├── listening.mp4
        └── ...

 * Naming Rules: Use lowercase characters and underscores only (e.g., custom_1.mp4).
Manifest Generation
Auto-generate the client manifest file by running:
node -e "
const fs = require('fs'), path = require('path');
const base = '/clips', personas = ['annie','craig'];
const m = {};
personas.forEach(p => { m[p] = {}; 
  try {
    fs.readdirSync('public'+base+'/'+p).filter(f=>f.endsWith('.mp4')).forEach(f => {
      m[p][f.replace('.mp4','')] = { url: path.join(base,p,f) };
    }); 
  } catch {}
});
fs.writeFileSync('public/clips/manifest.json', JSON.stringify(m, null, 2));
console.log('manifest.json updated successfully.');
"

Quality Checklist
 * [ ] Resolution: Verified 720p or 1080p.
 * [ ] Frame Rate: Steady 30 fps.
 * [ ] Codec: H.264 container format with AAC audio.
 * [ ] Faststart Atom: -movflags +faststart applied for instant web playback.
 * [ ] Looping: Seamless transition confirmed on loop-enabled clips (listening, nod).
Troubleshooting Common Issues
| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| Clip won't play on mobile browsers | Missing web optimization atoms | Re-encode with -movflags +faststart |
| Stuttering on looped playback | Misaligned keyframe intervals | Ensure -g 60 -keyint_min 60 during encoding |
| Audio out of sync | Audio processed independently | Re-record source files in a single unified take |
| Black screen on visitor view | Unsupported video codec profile | Ensure standard H.264 main/high profile encoding |
End of Video Clips Guide — See also: Client Handover, Deployment Guide, Architecture
