# 🛡️ Sarthak (सार्थक) — AI Safety Companion for Elderly

> **A privacy-first, edge-native telecare platform for seniors living independently. Features client-side computer vision for fall & abnormal posture detection, single-lens medication adherence tracking, multilingual voice assistance (English, Hindi, Kannada), and automated caregiver emergency escalation.**

---

## 📌 Executive Summary

Elderly individuals living independently face two critical vulnerabilities: **undetected falls / medical distress** and **medication non-adherence**. Traditional solutions either invade privacy by continuously streaming video footage to cloud servers or rely on wearable panic pendants that seniors frequently forget to wear or cannot trigger when unconscious.

**Sarthak** solves this through an **edge-first, single-camera telecare architecture**:
- **100% On-Device Computer Vision**: Video frames are processed strictly in local browser memory via WebAssembly (MediaPipe Pose). **Zero video bytes or raw images are ever sent to the cloud.**
- **Dual-Mode Single Lens**: The same webcam lens acts as an ambient fall monitor and dynamically transitions into an active medication ingestion verifier when dose time arrives.
- **Multilingual Voice Companion**: Full natural voice interaction and distress phrase listening in **English**, **Hindi (Devanagari)**, and **Kannada**.
- **Automated Family Escalation**: Automated cancellation grace windows, Twilio SMS alerts, telephone emergency dispatch, and unified caregiver telemetry.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      EDGE CLIENT (React PWA / Desktop)                  │
│                                                                         │
│  ┌──────────────┐     ┌──────────────────────────────────────────────┐  │
│  │ Local Webcam │ ──> │ MediaPipe Pose Engine (WASM / WebGL)         │  │
│  └──────────────┘     │ • 33 Body Keypoints (0 KB Cloud Upload)      │  │
│                       └──────────────────────┬───────────────────────┘  │
│                                              │                          │
│                       ┌──────────────────────▼───────────────────────┐  │
│                       │ Real-Time Kinematic Analyzers                │  │
│                       │  1. Gravitational Fall Detection             │  │
│                       │  2. Abnormal Slump & Agitation Monitor       │  │
│                       │  3. Hand-to-Mouth Ingestion State Machine    │  │
│                       └──────────────────────┬───────────────────────┘  │
│                                              │                          │
│  ┌─────────────────────────────────────────┐ │ Event Trigger            │
│  │ Multilingual Voice Companion (WebSpeech)│ │                          │
│  │ • Native Hindi, English & Kannada       │ │                          │
│  │ • 0ms Vocal Distress Screams Filter     │<┘                          │
│  │ • Grace Period Cancellation Protocol    │                            │
│  └────────────────────┬────────────────────┘                            │
└───────────────────────┼─────────────────────────────────────────────────┘
                        │ Secure HTTPS / WSS API
┌───────────────────────▼─────────────────────────────────────────────────┐
│                   CLOUD APPLICATION SERVICES (Node.js / Express)        │
│                                                                         │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Telecare API Engine     │  │ Google Gemini AI                     │  │
│  │ • Auth & Role Isolation │  │ • Conversational Voice Intelligence  │  │
│  │ • Medication Scheduler  │  │ • Multilingual Intent Recognition    │  │
│  │ • Adherence Ledger      │  └──────────────────────────────────────┘  │
│  └────────────┬────────────┘  ┌──────────────────────────────────────┐  │
│               │               │ Twilio Communication Service         │  │
│               ▼               │ • Emergency SMS Dispatches           │  │
│  ┌─────────────────────────┐  │ • Caregiver Account Invites          │  │
│  │ MongoDB Atlas Database  │  └──────────────────────────────────────┘  │
│  └─────────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Capabilities & Technical Highlights

### 1. Clinical-Grade Computer Vision (Edge Pose Estimation)
All spatial inference runs locally on the senior's device at 6–8 FPS using MediaPipe Pose Landmarker:
- **Physics-Based Fall Detection**: Eliminates false alarms from sitting down or ducking by requiring:
  1. *Gravitational Velocity Spike*: Rapid torso descent ($\Delta y / \Delta t \ge 1.15$ screen heights/sec within 350ms).
  2. *Ground Collapse Posture*: Torso spine angle tilts $>62^\circ$ or upper body drops below camera threshold.
  3. *Post-Impact Stun Period*: Sustained immobility on the floor for $\ge 2.2$ seconds before firing an alert.
- **Abnormal Behavior Telemetry**:
  - *Postural Slump (Syncope / Fainting)*: Detects sudden loss of tone where the spine tilts $>48^\circ$ with complete motor cessation for $\ge 7.0$ seconds.
  - *Acute Motor Agitation*: Detects high-frequency wrist erratic struggle ($\ge 4.5$ seconds) indicative of seizure or distress.
  - *Prolonged Floor Immobility*: Continuous timer tracking seniors stranded on the ground.

---

### 2. Single-Lens Medication Ingestion Tracking
Eliminates the need for multiple cameras or smart pill bottles:
- **3-Phase Kinematic State Machine**:
  - **Phase 0 (`IDLE`)**: Senior's hand begins below chest level. Static hand resting on chin/cheek will **never** trigger false ingestion.
  - **Phase 1 (`HAND_RAISING`)**: Validates upward trajectory of pill/glass toward mouth with landmark confidence checks ($>0.50$).
  - **Phase 2 (`AT_MOUTH`)**: Dynamically scales to shoulder width (`refSpan`). Requires sustained swallow dwell of **1.6 seconds** (or 1.3s dwell with active hand retraction).
- **Automated Alarm & Camera Activation**: When a scheduled medication time is reached, the system automatically speaks out in the senior's language, activates the camera lens, guides ingestion, and records adherence.

---

### 3. Native Multilingual Voice Companion
Specially designed for multilingual elderly demographics:
- **Languages Supported**: **English**, **Hindi (`हिंदी`)**, and **Kannada (`ಕನ್ನಡ`)**.
- **Devanagari Acoustic Recognition**: Integrates native regional speech recognition models (`hi-IN`, `kn-IN`) rather than phonetic transliteration.
- **Dual-Tier Distress Processing**:
  - *Tier 1 (0ms Instant Screams)*: Client-side regex engine catches urgent screams (*"मदद"*, *"बचाओ"*, *"दर्द"*, *"help"*, *"bachao"*, *"chakkar"*) and triggers immediate safety protocol.
  - *Tier 2 (Conversational AI)*: Backend powered by Google Gemini handles conversational queries, general health check-ins, and schedule questions.

---

### 4. Strict Role Separation & Family Portals
- **Senior Portal (`/companion`, `/medications`, `/settings`)**:
  - Ultra-high contrast, large touch targets, accessible typography.
  - On-screen skeleton feedback proving 0 KB video is uploaded.
  - Manual dose triggers and one-tap emergency help buttons.
- **Caregiver Safety Portal (`/dashboard`)**:
  - Provisioned automatically during senior registration.
  - Real-time emergency incident timeline with instant status updates.
  - Weekly medication adherence rate visualization.
  - Direct alert resolution and verification controls.

---

### 5. Emergency Protocol & Grace Window
1. **Detection**: Fall or vocal distress recognized.
2. **Grace Window Activation**: A configurable countdown (default 15–60 seconds) begins with audible voice prompts (*"Are you okay? Say 'I am safe' or tap Cancel"*).
3. **Microphone Auto-Arm**: The voice assistant automatically un-mutes to listen for distress or safety confirmation.
4. **Escalation Dispatch**: If unaddressed, backend dispatches automated Twilio SMS and initiates calls to primary emergency contacts.

---

## 🗂️ Repository Structure

```
SARTHAK_/
├── client/                     # Frontend Application (Vite + React + TypeScript)
│   ├── src/
│   │   ├── components/         # Accessible UI widgets (LanguageSwitcher, AdherenceChart, etc.)
│   │   ├── contexts/           # AuthContext, MonitoringContext
│   │   ├── hooks/              # usePoseDetection (MediaPipe), useVoiceAssistant, useCamera
│   │   ├── i18n/               # Localization bundles (en.json, hi.json, kn.json)
│   │   ├── pages/              # LandingPage, HomePage, LoginPage, DashboardPage, etc.
│   │   ├── services/           # api.ts (Axios network client & offline queue)
│   │   └── types/              # Domain data contracts & telemetry interfaces
│   ├── vite.config.ts          # Build pipeline with PWA & MediaPipe asset caching
│   └── tailwind.config.js      # Healthcare-accessible palette & micro-animations
│
├── server/                     # Backend Microservice (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/             # Environment validation (JWT, Mongo, Twilio, Gemini)
│   │   ├── middleware/         # JWT authentication, role guards, error handler
│   │   ├── models/             # MongoDB schemas (User, Medication, AdherenceLog, EventLog)
│   │   ├── routes/             # REST controllers (auth, adherence, alert, emergency, voice)
│   │   └── services/           # Gemini AI live processing, Twilio SMS & voice dispatch
│   └── tsconfig.json           # Backend compiler options
│
└── README.md                   # System documentation
```

---

## 📡 REST API Specification

### Authentication & Profiles
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register senior + automatically provision linked caregiver |
| `POST` | `/api/auth/login` | Senior login |
| `POST` | `/api/auth/caregiver/login` | Dedicated caregiver login |
| `GET`  | `/api/auth/caregiver/invite` | Validate caregiver invite token |
| `POST` | `/api/auth/caregiver/setup` | Caregiver sets account password |

### Telecare & Health Records
| Method | Endpoint | Description |
|---|---|---|
| `GET`  | `/api/medications/user/:userId` | Retrieve active prescription schedules |
| `POST` | `/api/medications` | Add new prescription with scheduled dose times |
| `POST` | `/api/adherence` | Log verified dose adherence (vision or manual) |
| `GET`  | `/api/adherence/user/:userId/stats` | Adherence compliance analytics |

### Safety & Incident Alerts
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/alerts/escalate` | Trigger emergency escalation & dispatch SMS alerts |
| `POST` | `/api/alerts/resolve` | Mark active emergency as resolved |
| `POST` | `/api/voice/process` | AI natural language companion reasoning |

---

## 🔒 Privacy & Security Guarantees

1. **Zero Cloud Video Ingestion**: Webcam frames are analyzed inside the browser's GPU/WASM sandboxed memory and discarded every frame. No video or photo is transmitted across the network.
2. **Encrypted Identity & Role Isolation**: Strict route and database-level middleware ensure seniors and family caregivers can only access their authorized domain.
3. **Fail-Safe Offline Storage**: If an internet outage occurs, falls and adherence confirmations are cached securely in `localStorage` and automatically synchronize once connectivity is restored.

---

## 📄 License
Private & Proprietary. All rights reserved.
