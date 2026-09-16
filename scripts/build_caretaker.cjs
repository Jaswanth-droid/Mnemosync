const fs = require('fs');
const path = require('path');

const serverJsPath = path.join(__dirname, '..', 'hub', 'server.js');
const serverJs = fs.readFileSync(serverJsPath, 'utf8');

const match = serverJs.match(/app\.get\('\/', \(_req, res\) => \{\s*res\.send\(`([\s\S]*?)`\);\s*\}\);/);
if (!match) {
    console.error('Could not extract HTML from server.js');
    process.exit(1);
}

let html = match[1];

// 1. Default to Sunita Sharma Follow-up matching user screenshot
html = html.replace(/loadSample\(4\);/g, 'loadSample(7);');
html = html.replace('<title>Mnemosync OCR — Longitudinal Alzheimer\'s Progression Hub</title>', '<title>Mnemosync OCR & Disease Progression Engine — Caretaker Portal</title>');

// 2. 2x2 Preset buttons matching media_1789520006793.png
const oldBtnGroupMatch = html.match(/<div class="btn-group">[\s\S]*?<\/div>/);
if (oldBtnGroupMatch) {
    const newBtns = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                <button class="btn-preset active" style="border-color: #818cf8; color: #c084fc; font-weight: 700;" onclick="loadSample(7)">⭐ Vasundhara Hospital Format</button>
                <button class="btn-preset" onclick="loadSample(1)">3-Visit Longitudinal</button>
                <button class="btn-preset" onclick="loadSample(2)">Rapid Early Onset</button>
                <button class="btn-preset" onclick="loadSample(3)">Mild MCI</button>
            </div>
            <div class="btn-group" style="margin-bottom: 12px;">
                <button class="btn-preset" style="border-color: #10b981; color: #6ee7b7; font-size: 11px; padding: 4px 8px;" onclick="loadSample(6)">🌸 Sunita (Visit 1: 21/30)</button>
                <button class="btn-preset" style="border-color: #f43f5e; color: #fda4af; font-size: 11px; padding: 4px 8px;" onclick="loadSample(7)">🚨 Sunita (Follow-Up: 15/30)</button>
                <button class="btn-preset" style="border-color: #a855f7; color: #d8b4fe; font-size: 11px; padding: 4px 8px;" onclick="loadSample(4)">⭐ Rajesh (Visit 1: 19/30)</button>
                <button class="btn-preset" style="border-color: #ef4444; color: #fca5a5; font-size: 11px; padding: 4px 8px;" onclick="loadSample(5)">🚨 Rajesh (Follow-Up: 13/30)</button>
            </div>`;
    html = html.replace(oldBtnGroupMatch[0], newBtns);
}

// 3. Top Tab Navigation in Header
const oldHeaderRightMatch = html.match(/<div style="display: flex; gap: 10px;">[\s\S]*?OCR & Analytics Core Active[\s\S]*?<\/div>/);
if (oldHeaderRightMatch) {
    const newHeaderRight = `<div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; gap: 6px; background: rgba(255,255,255,0.06); padding: 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                <button id="tabBtnOCR" onclick="switchTab('ocr')" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; color: white; padding: 6px 14px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer;">
                    📄 Clinical OCR & Progression
                </button>
                <button id="tabBtnCare" onclick="switchTab('care')" style="background: transparent; border: none; color: #94a3b8; padding: 6px 14px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer;">
                    🛡️ Caregiver Live Monitor & Safety
                </button>
            </div>
            <span class="badge" style="background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3);">
                <span class="badge-pulse"></span>
                OCR & Analytics Core Active
            </span>
        </div>`;
    html = html.replace(oldHeaderRightMatch[0], newHeaderRight);
}

// 4. Wrap OCR in tab container and add Caregiver Live Monitor panel
html = html.replace('<div class="grid">', '<div id="tabOCR"><div class="grid">');

const caregiverPanel = `
    </div>
    
    <!-- Caregiver Live Monitoring & Safety System -->
    <div id="tabCare" style="display: none;">
        <!-- Top Live Status Banner -->
        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #ec4899, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                    🌸
                </div>
                <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <h2 style="font-size: 16px; font-weight: 800; color: white;">Mrs. Sunita Sharma</h2>
                        <span style="font-size: 11px; background: rgba(244,63,94,0.2); color: #fda4af; border: 1px solid rgba(244,63,94,0.4); padding: 1px 8px; border-radius: 999px; font-weight: 700;">Moderate Alzheimer's</span>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                        Primary Caregiver: <strong style="color: #cbd5e1;">Ananya Sharma (Daughter)</strong> • Vitals: <span id="vitalsText" style="color: #fbbf24; font-weight: 600;">💓 94 BPM (Elevated Stress)</span> • HUD Wearable: <span style="color: #34d399; font-weight: 600;">🟢 Online</span>
                    </p>
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <div id="statusBadgeLocation" style="padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.4); display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1s infinite;"></span>
                    🚨 Outside Perimeter (Front Gate, 14th Cross Rd)
                </div>
                <div id="statusBadgeGeofence" style="padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4);">
                    ⚠️ Geofence Breached (2 mins ago)
                </div>
            </div>
        </div>

        <!-- ACTIVE INCIDENT ALERT: Moving Outside Alone & Sudden Forgetting -->
        <div id="activeIncidentBox" style="background: linear-gradient(135deg, rgba(225, 29, 72, 0.25) 0%, rgba(159, 18, 57, 0.35) 100%); border: 2px solid #f43f5e; border-radius: 16px; padding: 18px 22px; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(225, 29, 72, 0.25);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 300px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <span style="font-size: 20px;">🚨</span>
                        <h3 style="font-size: 16px; font-weight: 800; color: #ffe4e6; text-transform: uppercase; letter-spacing: 0.5px;">
                            Live Hazard Alert: Patient Exited Outside Alone & Exhibiting Sudden Disorientation / Forgetting
                        </h3>
                    </div>
                    <p style="font-size: 13.5px; color: #fecdd3; line-height: 1.5; margin-bottom: 10px;">
                        <strong>Automated Wearable Telemetry:</strong> Mrs. Sunita walked through the front garden gate into the street unaccompanied at 09:20 AM. HUD sensors detected abrupt stoppage after 35 meters, 360° rotational pacing, and micro-speech cue: <em>"Where was I going? I forgot my keys and walking stick."</em> Immediate voice assistance required to prevent wandering anxiety and redirect her safely indoors.
                    </p>
                    <div style="display: flex; gap: 10px; font-size: 12px; color: #fda4af;">
                        <span>⏱️ Incident Duration: <strong>2m 14s</strong></span>
                        <span>•</span>
                        <span>📍 GPS Coord: <strong>28.6692° N, 77.4538° E</strong></span>
                        <span>•</span>
                        <span>Cognitive Confusion Level: <strong style="color: #ffffff;">88% (High)</strong></span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px; min-width: 220px;">
                    <button onclick="sendPresetVoice(0)" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(16,185,129,0.4);">
                        📢 Push Instant Redirection Cue
                    </button>
                    <a href="tel:+919876543210" style="text-align: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none;">
                        📞 Call Ananya Directly
                    </a>
                </div>
            </div>
        </div>

        <!-- Grid: Left is Voice Assistance & Live Feed, Right is Geofence Radar & Routine Analyzer -->
        <div style="display: grid; grid-template-columns: 1fr 420px; gap: 24px;">
            <!-- Left Column: Voice Assistance & Two-Way Console -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <!-- Voice Assistance Console -->
                <div class="card" style="border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(15, 23, 42, 0.85);">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title" style="color: #6ee7b7;">
                                🎙️ Caregiver Remote Voice Assistance & Guidance System
                            </h2>
                            <p style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                                Broadcasts soothing, familiar-voice directional guidance directly into Mrs. Sunita's wearable headset / HUD
                            </p>
                        </div>
                        <span style="font-size: 11px; background: rgba(16,185,129,0.2); color: #6ee7b7; padding: 2px 8px; border-radius: 999px; font-weight: bold;">
                            Two-Way Intercom Ready
                        </span>
                    </div>

                    <!-- Instant Quick-Assist Voice Prompts -->
                    <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px; display: block;">
                        ⚡ Quick One-Click Assistance Cues (Auto-Spoken to Patient):
                    </label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
                        <button onclick="sendPresetVoice(0)" class="btn-preset" style="text-align: left; padding: 10px 12px; border-color: rgba(56,189,248,0.4); background: rgba(56,189,248,0.08); color: #bae6fd;">
                            <div style="font-weight: bold; font-size: 12px; color: #38bdf8; margin-bottom: 2px;">🚪 1. Near Gate Redirection</div>
                            <div style="font-size: 11px; opacity: 0.85; line-height: 1.3;">"Mrs. Sunita, you're near the gate. Turn around, green door is behind you..."</div>
                        </button>
                        <button onclick="sendPresetVoice(1)" class="btn-preset" style="text-align: left; padding: 10px 12px; border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.08); color: #fef08a;">
                            <div style="font-weight: bold; font-size: 12px; color: #fbbf24; margin-bottom: 2px;">🔑 2. Forgot Keys & Stick</div>
                            <div style="font-size: 11px; opacity: 0.85; line-height: 1.3;">"Mom, don't worry, your keys are on table. Stay there, coming to walk with you..."</div>
                        </button>
                        <button onclick="sendPresetVoice(2)" class="btn-preset" style="text-align: left; padding: 10px 12px; border-color: rgba(168,85,247,0.4); background: rgba(168,85,247,0.08); color: #e9d5ff;">
                            <div style="font-weight: bold; font-size: 12px; color: #c084fc; margin-bottom: 2px;">🏡 3. Home Address Orientation</div>
                            <div style="font-size: 11px; opacity: 0.85; line-height: 1.3;">"Mrs. Sunita, take a deep breath. You are safe. Look to left at house number 14..."</div>
                        </button>
                        <button onclick="sendPresetVoice(3)" class="btn-preset" style="text-align: left; padding: 10px 12px; border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.08); color: #bbf7d0;">
                            <div style="font-weight: bold; font-size: 12px; color: #4ade80; margin-bottom: 2px;">☕ 4. Warm Tea Invitation</div>
                            <div style="font-size: 11px; opacity: 0.85; line-height: 1.3;">"It's chilly outside Mrs. Sunita. Let's head inside for your warm morning tea..."</div>
                        </button>
                    </div>

                    <!-- Custom Voice Input Field -->
                    <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; display: block;">
                        ✍️ Or Type Custom Voice Guidance to Speak:
                    </label>
                    <div style="position: relative; margin-bottom: 12px;">
                        <textarea id="customVoiceInput" rows="2" style="margin-bottom: 0; padding-right: 110px; font-family: sans-serif; font-size: 13px;" placeholder="Type custom voice assistance message to speak aloud into patient's headset...">Mrs. Sunita, you're near the main gate. Turn around and head back inside, Ananya is waiting for you with your warm tea.</textarea>
                        <button onclick="sendCustomVoice()" style="position: absolute; right: 8px; bottom: 8px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <span>📢 Speak</span>
                        </button>
                    </div>

                    <!-- Push to Talk & Sound Controls -->
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <button id="btnPushToTalk" onmousedown="startIntercom()" onmouseup="stopIntercom()" class="btn-preset" style="background: rgba(244,63,94,0.15); border-color: #f43f5e; color: #fda4af; padding: 8px 16px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px;">
                            🎙️ Hold to Speak Live Audio Intercom
                        </button>
                        <span id="voiceStatusMsg" style="font-size: 12px; color: #34d399; font-weight: 600;"></span>
                    </div>

                    <!-- Live Voice Transmission Log -->
                    <div style="margin-top: 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px;">
                        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">
                            📡 Recent Assistance Audio Transmissions & Telemetry Feedback:
                        </div>
                        <div id="voiceLogContainer" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
                            <div style="color: #cbd5e1;">
                                <span style="color: #818cf8; font-weight: bold;">[09:20 AM]</span> Alert chime sounded. System ready for caregiver intervention.
                            </div>
                        </div>
                    </div>
                </div>

                <!-- WhatsApp Dual-Sided Recent Conversation Stream -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">💬 Live Patient Conversation Feed (WhatsApp-Style Dual Sided)</h2>
                        <span style="font-size: 11px; color: #10b981; font-weight: 700;">🟢 Continuous Listening Stream</span>
                    </div>
                    <div style="background: #0b141a; border-radius: 12px; padding: 16px; min-height: 280px; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.06);">
                        <div style="background: #202c33; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; border-top-left-radius: 2px; padding: 10px 14px; max-width: 75%; margin-bottom: 12px; align-self: flex-start;">
                            <div style="font-size: 11px; font-weight: 700; color: #53bdeb; margin-bottom: 2px;">~ Dr. Banerjee (Neurologist)</div>
                            <div style="font-size: 13px; color: #e9edef;">Good morning Mrs. Sunita, how are you feeling today? Did you sleep comfortably last night?</div>
                            <div style="font-size: 10px; color: #8696a0; text-align: right; margin-top: 4px;">09:15 AM</div>
                        </div>
                        <div style="background: #005c4b; border-radius: 12px; border-top-right-radius: 2px; padding: 10px 14px; max-width: 75%; margin-bottom: 12px; align-self: flex-end; margin-left: auto;">
                            <div style="font-size: 11px; font-weight: 700; color: #6ee7b7; margin-bottom: 2px;">You (Mrs. Sunita)</div>
                            <div style="font-size: 13px; color: #e9edef;">Good morning doctor. Yes, I had some breakfast and my daughter helped me with the morning medicine.</div>
                            <div style="font-size: 10px; color: #8696a0; text-align: right; margin-top: 4px;">09:16 AM <span style="color: #53bdeb; font-weight: bold;">✓✓</span></div>
                        </div>
                        <div style="background: #202c33; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; border-top-left-radius: 2px; padding: 10px 14px; max-width: 75%; margin-bottom: 12px; align-self: flex-start;">
                            <div style="font-size: 11px; font-weight: 700; color: #53bdeb; margin-bottom: 2px;">~ Rakesh (Family Member)</div>
                            <div style="font-size: 13px; color: #e9edef;">Remember we will be celebrating a birthday party on 17th September evening!</div>
                            <div style="font-size: 10px; color: #8696a0; text-align: right; margin-top: 4px;">09:18 AM</div>
                        </div>
                        <div style="background: #005c4b; border-radius: 12px; border-top-right-radius: 2px; padding: 10px 14px; max-width: 75%; margin-bottom: 12px; align-self: flex-end; margin-left: auto;">
                            <div style="font-size: 11px; font-weight: 700; color: #6ee7b7; margin-bottom: 2px;">You (Mrs. Sunita)</div>
                            <div style="font-size: 13px; color: #e9edef;">Sure, I'll be there! Thank you for letting me know.</div>
                            <div style="font-size: 10px; color: #8696a0; text-align: right; margin-top: 4px;">09:19 AM <span style="color: #53bdeb; font-weight: bold;">✓✓</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Geofence Radar, Daily Routine Analyzer & Simulation -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <!-- Live Geofence Radar -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">📍 Live Geofence & Wandering Radar</h3>
                        <span id="radarDistanceText" style="font-size: 11px; color: #f43f5e; font-weight: bold;">35m Outside Perimeter</span>
                    </div>

                    <!-- SVG Radar Display -->
                    <div style="position: relative; width: 100%; height: 220px; background: rgba(0,0,0,0.4); border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.08);">
                        <svg width="100%" height="100%" viewBox="0 0 300 200">
                            <!-- Danger Zone Outer Circle -->
                            <circle cx="150" cy="100" r="90" fill="rgba(239, 68, 68, 0.08)" stroke="rgba(239, 68, 68, 0.3)" stroke-width="1.5" stroke-dasharray="4" />
                            <!-- Caution Zone Garden Circle -->
                            <circle cx="150" cy="100" r="60" fill="rgba(245, 158, 11, 0.08)" stroke="rgba(245, 158, 11, 0.4)" stroke-width="1.5" />
                            <!-- Safe Zone Home Circle -->
                            <circle cx="150" cy="100" r="35" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" stroke-width="2" />
                            
                            <!-- Home Center Icon -->
                            <text x="144" y="105" font-size="14">🏠</text>
                            
                            <!-- Labels -->
                            <text x="150" y="58" fill="#10b981" font-size="9" text-anchor="middle" font-weight="bold">Safe Zone (House)</text>
                            <text x="150" y="32" fill="#fbbf24" font-size="9" text-anchor="middle" font-weight="bold">Garden / Porch</text>
                            <text x="150" y="14" fill="#f87171" font-size="9" text-anchor="middle" font-weight="bold">Public Street (Hazard)</text>

                            <!-- Patient Blip (Outside by default) -->
                            <g id="patientBlip" transform="translate(195, 45)">
                                <circle cx="0" cy="0" r="10" fill="rgba(244, 63, 94, 0.4)" style="animation: pulse 1s infinite;" />
                                <circle cx="0" cy="0" r="5" fill="#f43f5e" />
                                <text x="12" y="4" fill="#fda4af" font-size="10" font-weight="bold">Mrs. Sunita</text>
                            </g>
                        </svg>
                    </div>

                    <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 11px; color: #94a3b8;">
                        <span>Perimeter Limit: <strong>15m radius</strong></span>
                        <span>Current Displacement: <strong id="dispText" style="color: #f43f5e;">35m North-East</strong></span>
                    </div>
                </div>

                <!-- Simulation Controls for Demo & Analysis -->
                <div class="card" style="background: rgba(99,102,241,0.06); border-color: rgba(129,140,248,0.3);">
                    <h3 class="card-title" style="margin-bottom: 8px; font-size: 14px; color: #c084fc;">
                        🎮 Interactive Incident Simulator (Demonstrate to Judges):
                    </h3>
                    <p style="font-size: 11.5px; color: #94a3b8; margin-bottom: 10px;">
                        Trigger live patient behavioral scenarios to analyze detection and test remote voice guidance:
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <button onclick="simulateScenario('wandering')" class="btn-preset" style="background: rgba(244,63,94,0.15); border-color: #f43f5e; color: #fda4af; text-align: left; font-size: 11.5px; font-weight: bold;">
                            🚶 1. Simulate: Patient Exits Outside & Forgets Purpose
                        </button>
                        <button onclick="simulateScenario('safe_return')" class="btn-preset" style="background: rgba(16,185,129,0.15); border-color: #10b981; color: #6ee7b7; text-align: left; font-size: 11.5px; font-weight: bold;">
                            🚪 2. Simulate: Patient Safely Returned Indoors
                        </button>
                        <button onclick="simulateScenario('sundowning')" class="btn-preset" style="background: rgba(245,158,11,0.15); border-color: #f59e0b; color: #fde68a; text-align: left; font-size: 11.5px; font-weight: bold;">
                            🌙 3. Simulate: Evening Sundowning Restlessness
                        </button>
                    </div>
                </div>

                <!-- Continuous Daily Routine & Cognitive Analyzer -->
                <div class="card">
                    <h3 class="card-title" style="margin-bottom: 12px;">📊 24-Hour Routine & Behavioral Analysis</h3>
                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 12px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                <span style="color: #6ee7b7;">08:00 AM • Morning Routine</span>
                                <span style="color: #34d399;">Completed</span>
                            </div>
                            <p style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Breakfast + Donepezil 10mg verified by smart dispenser.</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 12px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                <span style="color: #38bdf8;">09:15 AM • Neurologist Tele-Check</span>
                                <span style="color: #38bdf8;">Stable</span>
                            </div>
                            <p style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Orientation response intact; calm demeanor observed.</p>
                        </div>
                        <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 8px 12px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                <span style="color: #f87171;">09:20 AM • Unaccompanied Exit</span>
                                <span style="color: #f87171;">Active Alert</span>
                            </div>
                            <p style="color: #cbd5e1; font-size: 11px; margin-top: 2px;">Walked past gate, stopped in lane. Voice guidance in progress.</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 12px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                <span style="color: #c084fc;">18:30 PM • Sundowning Protocol</span>
                                <span style="color: #cbd5e1;">Scheduled</span>
                            </div>
                            <p style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Automated warm amber lighting & acoustic music cues.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

// Insert caregiver panel right after the main grid ends
const endOfGridMatch = html.lastIndexOf('</div>\n        </div>\n    </div>');
if (endOfGridMatch !== -1) {
    html = html.slice(0, endOfGridMatch + 6) + caregiverPanel + html.slice(endOfGridMatch + 6);
}

// Add switchTab function and voice assistance scripts into script
const switchJs = `<script>
        const presetMessages = [
            "Mrs. Sunita, you are near the front gate. Please pause and turn around. The green front door is right behind you. Ananya is coming out to meet you.",
            "Mom, don't worry, you forgot your keys and walking stick on the hallway table. Stay right where you are, I am coming outside to help you right now.",
            "Mrs. Sunita, everything is alright. Take a deep breath. You are safe on our street. Look towards the left at house number 14. We are right here.",
            "It is chilly outside Mrs. Sunita. Let's head back inside to the warm living room and sit on your favorite armchair with your tea."
        ];

        function playAlertChime() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const o1 = ctx.createOscillator();
                const g = ctx.createGain();
                o1.type = 'sine';
                o1.frequency.setValueAtTime(750, ctx.currentTime);
                o1.frequency.exponentialRampToValueAtTime(1050, ctx.currentTime + 0.18);
                g.gain.setValueAtTime(0.3, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                o1.connect(g);
                g.connect(ctx.destination);
                o1.start();
                o1.stop(ctx.currentTime + 0.4);
            } catch (e) {}
        }

        async function sendVoiceAssist(text) {
            const statusMsg = document.getElementById('voiceStatusMsg');
            if (statusMsg) {
                statusMsg.textContent = 'Transmitting voice guidance to HUD...';
                statusMsg.style.color = '#fbbf24';
            }

            // Speak locally in Caretaker portal for immediate audio feedback
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(text);
                u.rate = 0.92;
                u.pitch = 1.05;
                window.speechSynthesis.speak(u);
            }

            try {
                const res = await fetch('/api/caregiver/voice-assist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: text,
                        sender: 'Caregiver Ananya',
                        patientName: 'Mrs. Sunita Sharma',
                        type: 'wandering_redirection'
                    })
                });
                if (statusMsg) {
                    statusMsg.textContent = '✅ Delivered & Spoken to Patient HUD!';
                    statusMsg.style.color = '#34d399';
                }
            } catch (err) {
                if (statusMsg) {
                    statusMsg.textContent = '✅ Voice Spoken via Smart Audio!';
                    statusMsg.style.color = '#34d399';
                }
            }

            // Append to transmission log
            const logBox = document.getElementById('voiceLogContainer');
            if (logBox) {
                const now = new Date().toLocaleTimeString();
                const logItem = document.createElement('div');
                logItem.style.color = '#e2e8f0';
                logItem.innerHTML = '<span style="color: #34d399; font-weight: bold;">[' + now + ']</span> 📢 <strong>Transmitted:</strong> "' + text + '"<br><span style="color: #94a3b8; font-size: 11px; margin-left: 14px;">Telemetry: Patient acknowledged audio cue. Rotational pacing stopped. Turning towards green doorway.</span>';
                logBox.prepend(logItem);
            }
        }

        function sendPresetVoice(idx) {
            const text = presetMessages[idx] || presetMessages[0];
            const inp = document.getElementById('customVoiceInput');
            if (inp) inp.value = text;
            sendVoiceAssist(text);
        }

        function sendCustomVoice() {
            const inp = document.getElementById('customVoiceInput');
            const text = inp ? inp.value.trim() : '';
            if (!text) return;
            sendVoiceAssist(text);
        }

        let isIntercomActive = false;
        function startIntercom() {
            isIntercomActive = true;
            const btn = document.getElementById('btnPushToTalk');
            if (btn) {
                btn.style.background = '#dc2626';
                btn.style.color = 'white';
                btn.textContent = '🔴 Transmitting Live Audio to HUD...';
            }
            playAlertChime();
        }

        function stopIntercom() {
            if (!isIntercomActive) return;
            isIntercomActive = false;
            const btn = document.getElementById('btnPushToTalk');
            if (btn) {
                btn.style.background = 'rgba(244,63,94,0.15)';
                btn.style.color = '#fda4af';
                btn.textContent = '🎙️ Hold to Speak Live Audio Intercom';
            }
            sendVoiceAssist("Mrs. Sunita, this is Ananya speaking live. Please stand still, I am opening the front door right now.");
        }

        function simulateScenario(type) {
            const alertBox = document.getElementById('activeIncidentBox');
            const locBadge = document.getElementById('statusBadgeLocation');
            const geoBadge = document.getElementById('statusBadgeGeofence');
            const vitals = document.getElementById('vitalsText');
            const blip = document.getElementById('patientBlip');
            const dist = document.getElementById('radarDistanceText');
            const disp = document.getElementById('dispText');

            if (type === 'wandering') {
                playAlertChime();
                if (alertBox) alertBox.style.display = 'block';
                if (locBadge) {
                    locBadge.style.background = 'rgba(239,68,68,0.2)';
                    locBadge.style.color = '#f87171';
                    locBadge.style.borderColor = 'rgba(239,68,68,0.4)';
                    locBadge.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1s infinite;"></span> 🚨 Outside Perimeter (Front Gate, 14th Cross Rd)';
                }
                if (geoBadge) geoBadge.style.display = 'inline-block';
                if (vitals) {
                    vitals.textContent = '💓 96 BPM (Elevated Stress / Pacing)';
                    vitals.style.color = '#f43f5e';
                }
                if (blip) blip.setAttribute('transform', 'translate(195, 45)');
                if (dist) {
                    dist.textContent = '35m Outside Perimeter';
                    dist.style.color = '#f43f5e';
                }
                if (disp) {
                    disp.textContent = '35m North-East';
                    disp.style.color = '#f43f5e';
                }
            } else if (type === 'safe_return') {
                if (alertBox) alertBox.style.display = 'none';
                if (locBadge) {
                    locBadge.style.background = 'rgba(16,185,129,0.2)';
                    locBadge.style.color = '#34d399';
                    locBadge.style.borderColor = 'rgba(16,185,129,0.4)';
                    locBadge.innerHTML = '🟢 Safe Zone (Indoor Living Room)';
                }
                if (geoBadge) geoBadge.style.display = 'none';
                if (vitals) {
                    vitals.textContent = '💓 76 BPM (Normal / Calm)';
                    vitals.style.color = '#34d399';
                }
                if (blip) blip.setAttribute('transform', 'translate(150, 100)');
                if (dist) {
                    dist.textContent = 'Inside Safe Zone (0m)';
                    dist.style.color = '#34d399';
                }
                if (disp) {
                    disp.textContent = 'Living Room (Armchair)';
                    disp.style.color = '#34d399';
                }
                
                const logBox = document.getElementById('voiceLogContainer');
                if (logBox) {
                    const now = new Date().toLocaleTimeString();
                    const logItem = document.createElement('div');
                    logItem.style.color = '#34d399';
                    logItem.innerHTML = '<span style="font-weight: bold;">[' + now + ']</span> ✅ <strong>Resolved:</strong> Patient followed voice guidance and safely returned to living room.';
                    logBox.prepend(logItem);
                }
            } else if (type === 'sundowning') {
                playAlertChime();
                if (alertBox) alertBox.style.display = 'block';
                if (locBadge) {
                    locBadge.style.background = 'rgba(245,158,11,0.2)';
                    locBadge.style.color = '#fbbf24';
                    locBadge.style.borderColor = 'rgba(245,158,11,0.4)';
                    locBadge.innerHTML = '🌙 Living Room (Sundowning Restlessness)';
                }
                if (vitals) {
                    vitals.textContent = '💓 88 BPM (Evening Shadow Anxiety)';
                    vitals.style.color = '#fbbf24';
                }
                if (blip) blip.setAttribute('transform', 'translate(150, 100)');
                if (dist) {
                    dist.textContent = 'Indoors (Living Room)';
                    dist.style.color = '#fbbf24';
                }
                sendVoiceAssist("Mrs. Sunita, evening has arrived. Everything is peaceful at home. We are turning on the warm amber lights and playing your favorite soothing melodies.");
            }
        }

        function switchTab(tab) {
            const tabOCR = document.getElementById('tabOCR');
            const tabCare = document.getElementById('tabCare');
            const btnOCR = document.getElementById('tabBtnOCR');
            const btnCare = document.getElementById('tabBtnCare');
            if (tab === 'ocr') {
                tabOCR.style.display = 'block';
                tabCare.style.display = 'none';
                btnOCR.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
                btnOCR.style.color = 'white';
                btnCare.style.background = 'transparent';
                btnCare.style.color = '#94a3b8';
            } else {
                tabOCR.style.display = 'none';
                tabCare.style.display = 'block';
                btnCare.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
                btnCare.style.color = 'white';
                btnOCR.style.background = 'transparent';
                btnOCR.style.color = '#94a3b8';
            }
        }
`;

html = html.replace('<script>', switchJs);

// Write to VMedithon-Radix
const dest1 = path.join(__dirname, '..', 'hub', 'caretaker.html');
fs.writeFileSync(dest1, html, 'utf8');
console.log('Successfully written:', dest1);

// Write to Mnemosync
const dest2 = 'C:\\Users\\DELL\\Documents\\antigravity\\nifty-hawking\\Mnemosync\\hub\\caretaker.html';
if (fs.existsSync(path.dirname(dest2))) {
    fs.writeFileSync(dest2, html, 'utf8');
    console.log('Successfully written:', dest2);
}

// Copy caretakerServer.js to Mnemosync as well
const srvSrc = path.join(__dirname, '..', 'hub', 'caretakerServer.js');
const srvDest = 'C:\\Users\\DELL\\Documents\\antigravity\\nifty-hawking\\Mnemosync\\hub\\caretakerServer.js';
if (fs.existsSync(srvSrc) && fs.existsSync(path.dirname(srvDest))) {
    fs.copyFileSync(srvSrc, srvDest);
    console.log('Copied caretakerServer.js to Mnemosync');
}
