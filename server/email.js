const nodemailer = require('nodemailer');

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (!smtpConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// Deliberately generic and warm — no specific reason for the decision is
// given, which is standard practice and avoids creating a paper trail that
// could be picked apart later. HR can always follow up personally with more
// context outside this system if they choose to.
function rejectionEmailContent(candidate) {
  const subject = `Your application to ${process.env.SCHOOL_NAME || 'WAAPC American School'}`;
  const text = `Dear ${candidate.name},

Thank you for the time and care you put into your application to WAAPC American School, and for completing every stage of our process.

After careful review, we will not be moving forward with your application at this time. This was a competitive process, and this decision does not reflect a lack of appreciation for your background and experience.

We're grateful for your interest in our school and wish you all the best in your search.

Warm regards,
WAAPC American School — Recruitment Team`;
  const html = text
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return { subject, text, html };
}

// Returns { sent: true } on success. Throws if SMTP isn't configured or the
// send fails — callers should surface that to HR rather than silently
// pretending an email went out.
async function sendRejectionEmail(candidate) {
  const transport = getTransport();
  if (!transport) {
    throw new Error('Email is not configured yet — set SMTP_HOST/SMTP_USER/SMTP_PASS in the environment first.');
  }
  const { subject, text, html } = rejectionEmailContent(candidate);
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: candidate.email,
    subject,
    text,
    html,
  });
  return { sent: true };
}

module.exports = { smtpConfigured, sendRejectionEmail, rejectionEmailContent };
