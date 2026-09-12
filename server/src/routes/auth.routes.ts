import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { sendSMS } from '../services/twilio.service.js';

export const authRoutes = Router();

// POST /api/auth/register (Patient signup + mandatory caregiver registration)
authRoutes.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      age,
      primaryLanguage,
    } = req.body;

    const caregiverName = req.body.caregiverName || req.body.caregiver?.fullName || req.body.caregiver?.name;
    const caregiverPhone = req.body.caregiverPhone || req.body.caregiver?.phone;
    const caregiverEmail = req.body.caregiverEmail || req.body.caregiver?.email;
    const caregiverRelationship = req.body.caregiverRelationship || req.body.caregiver?.relationship || 'Family Member';

    // 1. Patient validation
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      res.status(400).json({ success: false, error: 'Please enter your full name.' });
      return;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
      return;
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
      res.status(400).json({ success: false, error: 'Please enter a valid senior phone number.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
      return;
    }

    // 2. Caregiver mandatory validation
    if (!caregiverName || typeof caregiverName !== 'string' || !caregiverName.trim()) {
      res.status(400).json({ success: false, error: 'Please enter a caregiver full name.' });
      return;
    }

    if (!caregiverPhone || typeof caregiverPhone !== 'string' || caregiverPhone.trim().length < 8) {
      res.status(400).json({ success: false, error: 'Please enter a valid caregiver phone number.' });
      return;
    }

    if (!caregiverEmail || typeof caregiverEmail !== 'string' || !caregiverEmail.includes('@')) {
      res.status(400).json({ success: false, error: 'Please enter a valid caregiver email address.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCaregiverEmail = caregiverEmail.trim().toLowerCase();

    if (normalizedEmail === normalizedCaregiverEmail) {
      res.status(400).json({
        success: false,
        error: 'Patient and caregiver email cannot be the same address.',
      });
      return;
    }

    // Check if patient email already registered
    const existingPatient = await User.findOne({ email: normalizedEmail });
    if (existingPatient) {
      res.status(400).json({
        success: false,
        error: 'This email is already registered. Please sign in instead.',
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the patient user
    const patient = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password: hashedPassword,
      age: Number(age) || 72,
      role: 'patient',
      primaryLanguage: ['en', 'hi', 'kn', 'ta', 'te', 'mr'].includes(primaryLanguage)
        ? primaryLanguage
        : 'en',
      allergies: [],
      emergencyContacts: [
        {
          name: caregiverName.trim(),
          phone: caregiverPhone.trim(),
          email: normalizedCaregiverEmail,
          relationship: caregiverRelationship?.trim() || 'Family Member',
          priorityOrder: 1,
          callEscalationDelayMinutes: 5,
        },
      ],
      sensitivitySettings: {
        fallDetectionThreshold: 0.7,
        graceWindowSeconds: 60,
      },
    });

    // 3. Provision the caregiver account automatically
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let caregiver = await User.findOne({ email: normalizedCaregiverEmail });
    if (!caregiver) {
      caregiver = await User.create({
        fullName: caregiverName.trim(),
        email: normalizedCaregiverEmail,
        phone: caregiverPhone.trim(),
        role: 'caregiver',
        linkedPatientId: patient._id,
        inviteToken,
        inviteExpires,
        isInviteAccepted: false,
        age: 40,
        primaryLanguage: patient.primaryLanguage,
      });
    } else {
      caregiver.role = 'caregiver';
      caregiver.linkedPatientId = patient._id;
      caregiver.inviteToken = inviteToken;
      caregiver.inviteExpires = inviteExpires;
      await caregiver.save();
    }

    const clientBase = env.CLIENT_URL || 'http://localhost:5173';
    const inviteLink = `${clientBase}/caregiver/setup-password?token=${inviteToken}`;

    // Send invite SMS to caregiver via Twilio
    const smsMessage = `Hello ${caregiverName.trim()}, ${patient.fullName} has added you as their emergency caregiver on Sarthak Companion. Please set your password to access their safety dashboard: ${inviteLink}`;
    sendSMS(caregiverPhone.trim(), smsMessage).catch((err) =>
      console.warn('[TWILIO] Caregiver invite SMS dispatch error:', err)
    );

    console.log(`[CAREGIVER INVITE] Link generated for ${normalizedCaregiverEmail}: ${inviteLink}`);

    // Create session token for patient
    const token = jwt.sign({ userId: patient._id }, env.JWT_SECRET, {
      expiresIn: 7 * 24 * 60 * 60,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: patient._id,
        fullName: patient.fullName,
        email: patient.email,
        role: patient.role,
        primaryLanguage: patient.primaryLanguage,
        caregiverInviteLink: inviteLink,
      },
      token,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      res.status(400).json({ success: false, error: 'This email is already registered.' });
      return;
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors)
        .map((e: any) => e.message)
        .join(', ');
      res.status(400).json({
        success: false,
        error: messages || 'Invalid registration details provided.',
      });
      return;
    }
    res.status(500).json({
      success: false,
      error:
        'Could not complete registration. Please ensure MongoDB is connected or verify your connection.',
    });
  }
});

// GET /api/auth/caregiver/invite (Validate invite token and get context)
authRoutes.get(['/caregiver/invite', '/caregiver/invite/:token'], async (req: Request, res: Response) => {
  try {
    const token = (req.params.token || req.query.token) as string;
    if (!token) {
      res.status(400).json({ success: false, error: 'Invitation token is required.' });
      return;
    }

    const caregiver = await User.findOne({
      inviteToken: token,
      inviteExpires: { $gt: new Date() },
    });

    if (!caregiver) {
      res.status(400).json({
        success: false,
        error: 'This caregiver invitation link is invalid or has expired.',
      });
      return;
    }

    let patientName = 'Your loved one';
    if (caregiver.linkedPatientId) {
      const patient = await User.findById(caregiver.linkedPatientId);
      if (patient) patientName = patient.fullName;
    }

    res.json({
      success: true,
      data: {
        caregiverName: caregiver.fullName,
        caregiverEmail: caregiver.email,
        patientName,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/caregiver/request-invite (Retrieve/generate invitation link for caregiver)
authRoutes.post('/caregiver/request-invite', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'Caregiver email is required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const caregiver = await User.findOne({ email: normalizedEmail, role: 'caregiver' });

    if (!caregiver) {
      res.status(404).json({
        success: false,
        error: 'No caregiver account found with this email. Please check the email registered by the senior.',
      });
      return;
    }

    if (caregiver.isInviteAccepted && caregiver.password) {
      res.status(400).json({
        success: false,
        error: 'This caregiver account is already activated. Please log in directly with your password.',
        alreadyActive: true,
      });
      return;
    }

    // Generate or refresh invite token
    let inviteToken = caregiver.inviteToken;
    if (!inviteToken || !caregiver.inviteExpires || caregiver.inviteExpires < new Date()) {
      inviteToken = crypto.randomBytes(32).toString('hex');
      caregiver.inviteToken = inviteToken;
      caregiver.inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await caregiver.save();
    }

    const clientOrigin = req.headers.origin || req.headers.referer || env.CLIENT_URL || 'http://localhost:5173';
    const baseUrl = clientOrigin.replace(/\/+$/, '');
    const inviteLink = `${baseUrl}/caregiver/setup-password?token=${inviteToken}`;

    if (caregiver.phone) {
      try {
        let seniorName = 'your family member';
        if (caregiver.linkedPatientId) {
          const patient = await User.findById(caregiver.linkedPatientId);
          if (patient) seniorName = patient.fullName;
        }
        await sendSMS(
          caregiver.phone,
          `[SARTHAK Caregiver Setup] Activate your caregiver account for ${seniorName}: ${inviteLink}`
        );
      } catch (smsErr) {
        console.warn('[CAREGIVER INVITE RESEND] SMS send failed:', smsErr);
      }
    }

    res.json({
      success: true,
      message: 'Caregiver invitation link ready.',
      data: {
        inviteToken,
        inviteLink,
        email: caregiver.email,
        fullName: caregiver.fullName,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/caregiver/setup (Caregiver sets password from invite link)
authRoutes.post('/caregiver/setup', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      res.status(400).json({ success: false, error: 'Invitation token is required.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      return;
    }

    const caregiver = await User.findOne({
      inviteToken: token,
      inviteExpires: { $gt: new Date() },
    });

    if (!caregiver) {
      res.status(400).json({
        success: false,
        error: 'This invitation token has expired or is invalid. Please request a new invite.',
      });
      return;
    }

    caregiver.password = await bcrypt.hash(password, 12);
    caregiver.isInviteAccepted = true;
    caregiver.inviteToken = undefined;
    caregiver.inviteExpires = undefined;
    await caregiver.save();

    const jwtToken = jwt.sign({ userId: caregiver._id }, env.JWT_SECRET, {
      expiresIn: 7 * 24 * 60 * 60,
    });

    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Caregiver account password created successfully.',
      data: {
        _id: caregiver._id,
        fullName: caregiver.fullName,
        email: caregiver.email,
        role: caregiver.role,
        linkedPatientId: caregiver.linkedPatientId,
      },
      token: jwtToken,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/caregiver/login (Separate login for caregivers)
authRoutes.post('/caregiver/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Please enter your email and password.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    if (user.role !== 'caregiver') {
      res.status(403).json({
        success: false,
        error: 'This account is registered as a Senior. Please sign in via the Patient Companion login.',
      });
      return;
    }

    if (!user.password) {
      res.status(400).json({
        success: false,
        error: 'Your caregiver account has not set a password yet. Please use the invite link sent to you.',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, {
      expiresIn: 7 * 24 * 60 * 60,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        linkedPatientId: user.linkedPatientId,
      },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login (Patient / Senior login)
authRoutes.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Please enter your email and password.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    if (user.role === 'caregiver') {
      res.status(403).json({
        success: false,
        error:
          'This account is registered as a Family Caregiver. Please sign in at the Caregiver Portal (/caregiver/login).',
      });
      return;
    }

    if (!user.password) {
      res.status(401).json({ success: false, error: 'Account has no password set.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, {
      expiresIn: 7 * 24 * 60 * 60,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role === 'senior' ? 'patient' : user.role,
        primaryLanguage: user.primaryLanguage,
      },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/logout
authRoutes.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/auth/me
authRoutes.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: req.user });
});
