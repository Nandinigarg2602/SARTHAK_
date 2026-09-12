import Twilio from 'twilio';
import { env } from '../config/env.js';

let client: Twilio.Twilio | null = null;

function getClient(): Twilio.Twilio {
  if (!client) {
    if (env.DEMO_MODE || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      // Return a mock-safe null — callers check DEMO_MODE
      return null as any;
    }
    client = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

function normalizePhone(phone: string): string {
  if (!phone) return phone;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return `+${cleaned}`;
}

/**
 * Send an SMS message.
 */
export async function sendSMS(
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string }> {
  const normalizedTo = normalizePhone(to);
  if (env.DEMO_MODE) {
    console.log(`[DEMO] SMS → ${normalizedTo}: ${body.substring(0, 80)}...`);
    return { success: true, sid: `DEMO_SM_${Date.now()}` };
  }

  try {
    const message = await getClient().messages.create({
      to: normalizedTo,
      from: env.TWILIO_PHONE_NUMBER,
      body,
    });
    console.log(`[TWILIO] SMS sent to ${normalizedTo}: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err: any) {
    console.error(`[TWILIO] SMS failed to ${normalizedTo}:`, err?.message || err);
    return { success: false };
  }
}

/**
 * Initiate a voice call with TTS message.
 */
export async function makeVoiceCall(
  to: string,
  message: string
): Promise<{ success: boolean; sid?: string }> {
  const normalizedTo = normalizePhone(to);
  if (env.DEMO_MODE) {
    console.log(`[DEMO] Voice Call → ${normalizedTo}: ${message.substring(0, 80)}...`);
    return { success: true, sid: `DEMO_CA_${Date.now()}` };
  }

  try {
    // Trial accounts disallow inline twiml strings on calls; use Twimlet TTS URL
    const encodedMsg = encodeURIComponent(message);
    const twimletUrl = `https://twimlets.com/message?Message%5B0%5D=${encodedMsg}`;

    const call = await getClient().calls.create({
      to: normalizedTo,
      from: env.TWILIO_PHONE_NUMBER,
      url: twimletUrl,
    });
    console.log(`[TWILIO] Call initiated to ${normalizedTo}: ${call.sid}`);
    return { success: true, sid: call.sid };
  } catch (err: any) {
    console.error(`[TWILIO] Call failed to ${normalizedTo}:`, err?.message || err);
    return { success: false };
  }
}
