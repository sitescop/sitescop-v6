import nodemailer from 'nodemailer';
import type { SmtpTestResult } from '../../shared/api-types.js';
import { getEmailSettings, getSmtpPassword } from './settings.service.js';

export interface SendSmtpEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{ filename: string; path: string }>;
}

function buildTransportOptions() {
  const settings = getEmailSettings();
  const password = getSmtpPassword();
  if (!settings.smtpHost.trim()) {
    throw new Error('SMTP server is not configured.');
  }
  if (!settings.smtpUsername.trim() || !password) {
    throw new Error('SMTP username and password are required.');
  }

  const encryption = settings.smtpEncryption;
  const port = settings.smtpPort;

  return {
    host: settings.smtpHost.trim(),
    port,
    secure: encryption === 'ssl',
    requireTLS: encryption === 'tls',
    auth: {
      user: settings.smtpUsername.trim(),
      pass: password,
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  };
}

export function isSmtpSendReady(): boolean {
  const settings = getEmailSettings();
  return Boolean(
    settings.smtpEnabled &&
      settings.smtpHost.trim() &&
      settings.smtpUsername.trim() &&
      getSmtpPassword() &&
      (settings.senderEmail.trim() || settings.fromEmail.trim()),
  );
}

export async function sendSmtpEmail(input: SendSmtpEmailInput): Promise<void> {
  const settings = getEmailSettings();
  if (!settings.smtpEnabled) {
    throw new Error('SMTP sending is disabled. Enable it in Settings → Email.');
  }
  const fromEmail = settings.senderEmail.trim() || settings.fromEmail.trim();
  const fromName = settings.senderName.trim() || 'SiteScop';
  const replyTo = settings.replyToEmail.trim() || undefined;

  const transport = nodemailer.createTransport(buildTransportOptions());
  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: input.to,
      replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
  } finally {
    transport.close();
  }
}

export async function testSmtpConnection(toEmail: string): Promise<SmtpTestResult> {
  const settings = getEmailSettings();
  const target = toEmail.trim().toLowerCase();
  if (!target.includes('@')) {
    return {
      ok: false,
      code: 'invalid_config',
      message: 'Enter a valid test email address.',
    };
  }
  if (!settings.smtpHost.trim() || !settings.smtpPort) {
    return {
      ok: false,
      code: 'invalid_config',
      message: 'Invalid server or port.',
    };
  }
  if (!settings.smtpUsername.trim() || !getSmtpPassword()) {
    return {
      ok: false,
      code: 'invalid_config',
      message: 'SMTP username and password are required.',
    };
  }

  let transport: nodemailer.Transporter | null = null;
  try {
    transport = nodemailer.createTransport(buildTransportOptions());
    await transport.verify();
    const fromEmail = settings.senderEmail.trim() || settings.fromEmail.trim();
    const fromName = settings.senderName.trim() || 'SiteScop';
    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: target,
      replyTo: settings.replyToEmail.trim() || undefined,
      subject: 'SiteScop SMTP test',
      text: `This is a test email from SiteScop V6.\n\nSMTP host: ${settings.smtpHost}\nPort: ${settings.smtpPort}\nEncryption: ${settings.smtpEncryption}\n\nIf you received this, SMTP is working.`,
    });
    return {
      ok: true,
      code: 'success',
      message: 'SMTP connection successful.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (
      lower.includes('invalid login') ||
      lower.includes('authentication') ||
      lower.includes('auth') ||
      lower.includes('535') ||
      lower.includes('534')
    ) {
      return { ok: false, code: 'auth_failed', message: 'SMTP authentication failed.' };
    }
    if (
      lower.includes('enotfound') ||
      lower.includes('econnrefused') ||
      lower.includes('etimedout') ||
      lower.includes('timeout') ||
      lower.includes('connect')
    ) {
      return { ok: false, code: 'connect_failed', message: 'Unable to connect to SMTP server.' };
    }
    if (lower.includes('port') || lower.includes('invalid')) {
      return { ok: false, code: 'invalid_config', message: 'Invalid server or port.' };
    }
    return {
      ok: false,
      code: 'send_failed',
      message: `SMTP test failed: ${message}`,
    };
  } finally {
    transport?.close();
  }
}
