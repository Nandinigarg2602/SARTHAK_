# 🛡️ Sarthak — AI-Powered Senior Safety & Medication Companion

A continuous, zero-video-streaming, edge-first safety and medication monitoring solution for elderly individuals living independently. The system monitors posture/motion locally, performs on-device hand-to-mouth gesture detection, and triggers cloud LLM/VLM reasoning **only on verified exception events**.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  CLIENT (React PWA)                                       │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Camera   │→ │ MediaPipe    │→ │ Fall / Gesture   │   │
│  │ (Local)  │  │ WASM Engine  │  │ Detection Logic  │   │
│  └──────────┘  └──────────────┘  └────────┬─────────┘   │
│                                           │ Trigger      │
│  ┌──────────────────────────────────────┐ │              │
│  │ Grace Window (TTS + Speech Recog.)   │←┘              │
│  └────────────────┬─────────────────────┘                │
└───────────────────│──────────────────────────────────────┘
                    │ HTTPS / WSS
┌───────────────────│──────────────────────────────────────┐
│  CLOUD            ▼                                       │
│  ┌────────────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ Express Backend    │→ │ Gemini AI    │  │ Twilio   │ │
│  │ (Node.js + TS)     │  │ (VLM/Live)   │  │ SMS/Call │ │
│  └─────────┬──────────┘  └──────────────┘  └──────────┘ │
│            ▼                                              │
│  ┌────────────────────┐                                   │
│  │ MongoDB Atlas      │                                   │
│  └────────────────────┘                                   │
└──────────────────────────────────────────────────────────┘
```

## Features

1. **Medication Scanning & Interaction Audit** — Photo-to-schedule with drug interaction detection
2. **On-Device Fall Detection** — MediaPipe Pose Landmarker with grace window verification
3. **Visual Medication Verification** — Hand-to-mouth gesture detection with VLM confirmation
4. **Emergency Escalation Queue** — SMS → Voice Call → Next Contact chain with context handoff
5. **Caregiver Dashboard** — Real-time SSE event feed with false alarm feedback

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Client | React 18 + TypeScript + Vite (PWA) |
| Styling | Tailwind CSS v3 |
| Vision | MediaPipe WASM (Pose + Hand Landmarker) |
| AI | Gemini 2.5 Flash (VLM) + Gemini Live API (Voice) |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB (Mongoose) |
| Telephony | Twilio Voice & SMS |

## Quick Start

### Prerequisites
- Node.js v20+
- MongoDB Atlas cluster (or local MongoDB)
- Google Gemini API key
- Twilio account (optional — demo mode works without it)

### Setup

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your credentials (or keep DEMO_MODE=true)

# 2. Install & start server
cd server
npm install
npm run dev

# 3. Install & start client (new terminal)
cd client
npm install
npm run dev
```

Visit `http://localhost:5173` — the app starts in demo mode with mock API responses.

### Demo Mode
Set `DEMO_MODE=true` in `.env` to run without real API keys. All Gemini and Twilio calls return realistic mock data.

## Project Structure

```
SARTHAK_/
├── client/                 # React PWA
│   ├── src/
│   │   ├── components/     # Reusable UI (AlertModal, EventCard, etc.)
│   │   ├── pages/          # Route pages (Home, Medications, Dashboard)
│   │   ├── hooks/          # MediaPipe hooks (usePoseDetection, useHandGesture)
│   │   ├── services/       # API client, offline manager
│   │   ├── contexts/       # Auth, Monitoring state
│   │   └── types/          # TypeScript interfaces
│   └── vite.config.ts
├── server/                 # Express API
│   ├── src/
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # REST endpoints
│   │   ├── services/       # Gemini, Twilio, Escalation
│   │   ├── middleware/     # Auth, rate limiting
│   │   └── config/         # Environment validation
│   └── tsconfig.json
├── .env.example
└── README.md
```

## License
Private — All rights reserved.
