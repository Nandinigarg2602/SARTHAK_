import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, IUser } from '../models/User.js';
import { Medication } from '../models/Medication.js';
import { EventLog, IEventLog, EventType } from '../models/EventLog.js';
import * as geminiService from './gemini.service.js';
import * as twilioService from './twilio.service.js';
import { sseClients } from '../routes/alert.routes.js';

// In-memory escalation timers
const activeEscalations = new Map<string, NodeJS.Timeout[]>();

/**
 * Start the full escalation pipeline for a safety event.
 */
export async function triggerEscalation(
  userId: string,
  eventType: EventType,
  metadata: Record<string, unknown> = {}
): Promise<IEventLog> {
  // 1. Fetch user with contacts
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // 2. Fetch active medications
  const medications = await Medication.find({
    userId,
    isActive: true,
  });

  // 3. Generate emergency context summary via Gemini (with instant fallback to ensure emergency calls are never blocked)
  let contextSummary = `EMERGENCY ALERT: ${eventType} detected for ${user.fullName} (${user.age}yo) at ${new Date().toLocaleTimeString('en-IN')}.`;
  try {
    contextSummary = await geminiService.generateEmergencyContext({
      patientName: user.fullName,
      age: user.age,
      medications: medications.map((m) => `${m.drugName} ${m.dosage}`),
      allergies: user.allergies,
      eventType,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    });
  } catch (err) {
    console.warn('[ESCALATION] Gemini summary error fallback:', err);
  }

  // 4. Generate temporary emergency link token (2 hour expiry)
  const emergencyLinkToken = jwt.sign(
    { type: 'emergency', userId, eventType },
    env.JWT_SECRET,
    { expiresIn: 7200 }
  );

  // 5. Create EventLog entry
  const event = await EventLog.create({
    userId,
    eventType,
    escalationStatus: 'ESCALATED',
    contextSummary,
    emergencyLinkToken,
    metadata,
  });

  // 6. Broadcast SSE to connected dashboards
  broadcastSSE(userId, event);

  // 7. Start sequential contact escalation
  startContactChain(user, event, contextSummary, emergencyLinkToken);

  return event;
}

/**
 * Sequentially escalate through emergency contacts.
 */
function startContactChain(
  user: IUser,
  event: IEventLog,
  contextSummary: string,
  token: string
) {
  const contacts = [...user.emergencyContacts].sort(
    (a, b) => a.priorityOrder - b.priorityOrder
  );

  if (contacts.length === 0) {
    console.warn(`[ESCALATION] No emergency contacts for user ${user._id}`);
    return;
  }

  const timers: NodeJS.Timeout[] = [];
  const eventId = event._id.toString();
  const emergencyLink = `${env.EMERGENCY_LINK_BASE_URL}?token=${token}`;

  // Send SMS to first contact immediately
  escalateToContact(0);

  function escalateToContact(index: number) {
    if (index >= contacts.length) {
      console.log(`[ESCALATION] All contacts exhausted for event ${eventId}`);
      return;
    }

    const contact = contacts[index];
    const smsBody = `🚨 SARTHAK ALERT\n\n${contextSummary}\n\nView details: ${emergencyLink}\n\nReply ACK to acknowledge.`;

    // Send SMS
    twilioService.sendSMS(contact.phone, smsBody);

    // Also initiate immediate automated emergency voice call to ensure caregiver is alerted instantly
    twilioService.makeVoiceCall(
      contact.phone,
      `Emergency alert from Sarthak. ${contextSummary}. Please check on ${user.fullName} immediately.`
    );

    // Update event with current contact index
    EventLog.findByIdAndUpdate(eventId, {
      currentContactNotifiedIndex: index,
    }).catch(console.error);

    console.log(
      `[ESCALATION] SMS and Voice Call dispatched to Contact #${index + 1}: ${contact.name} (${contact.phone})`
    );

    // If there are more contacts, cascade after delay if not acknowledged
    const callDelay = (contact.callEscalationDelayMinutes || 3) * 60 * 1000;
    const nextTimer = setTimeout(async () => {
      const current = await EventLog.findById(eventId);
      if (
        current &&
        current.escalationStatus !== 'RESOLVED' &&
        current.escalationStatus !== 'VERIFIED_SAFE'
      ) {
        console.log(`[ESCALATION] Cascading to next contact for event ${eventId}...`);
        escalateToContact(index + 1);
      }
    }, callDelay);
    timers.push(nextTimer);
  }

  activeEscalations.set(eventId, timers);
}

/**
 * Cancel active escalation (e.g., false alarm or resolved).
 */
export function cancelEscalation(eventId: string) {
  const timers = activeEscalations.get(eventId);
  if (timers) {
    timers.forEach((t) => clearTimeout(t));
    activeEscalations.delete(eventId);
    console.log(`[ESCALATION] Cancelled for event ${eventId}`);
  }
}

/**
 * Mark event as false alarm and adjust user sensitivity.
 */
export async function markFalseAlarm(eventId: string) {
  const event = await EventLog.findByIdAndUpdate(
    eventId,
    { isFalseAlarm: true, escalationStatus: 'VERIFIED_SAFE' },
    { new: true }
  );

  if (event) {
    cancelEscalation(eventId);

    // Adjust sensitivity — increase threshold slightly
    await User.findByIdAndUpdate(event.userId, {
      $inc: { 'sensitivitySettings.fallDetectionThreshold': 0.02 },
    });

    broadcastSSE(event.userId.toString(), event);
  }

  return event;
}

/**
 * Broadcast event update to connected SSE clients.
 */
function broadcastSSE(userId: string, event: IEventLog) {
  const clients = sseClients.get(userId);
  if (clients) {
    const data = JSON.stringify(event);
    clients.forEach((res) => {
      res.write(`data: ${data}\n\n`);
    });
  }
}
