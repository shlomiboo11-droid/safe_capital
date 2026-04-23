/**
 * Email service — Gmail SMTP via Nodemailer.
 *
 * Required env vars:
 *   GMAIL_USER          e.g. hello@safecapital.co.il (the Gmail/Workspace account)
 *   GMAIL_APP_PASSWORD  16-char Google App Password (not the account password)
 *   MAIL_FROM           optional display: "Safe Capital <hello@safecapital.co.il>"
 *
 * If env vars are missing, calls return gracefully (no throw) so the HTTP
 * request that triggered the email is never blocked by mail config issues.
 */

const nodemailer = require('nodemailer');

let _transporter = null;
let _configWarned = false;

function isConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getTransporter() {
  if (_transporter) return _transporter;
  if (!isConfigured()) {
    if (!_configWarned) {
      console.warn('[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — emails will be skipped.');
      _configWarned = true;
    }
    return null;
  }
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  return _transporter;
}

function getFromAddress() {
  return process.env.MAIL_FROM || `Safe Capital <${process.env.GMAIL_USER}>`;
}

function escapeHtml(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDirectionsLink(fullAddress) {
  if (!fullAddress) return null;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(fullAddress);
}

function buildEventRegistrationHtml(registration, event) {
  const firstName = escapeHtml(registration.first_name || '');
  const guestLine = registration.guest_name
    ? `עם מלווה: ${escapeHtml(registration.guest_name)}`
    : 'ללא מלווה';

  const eventTitleMain = escapeHtml(event.hero_title_main || 'ערב משקיעים');
  const eventTitleAccent = escapeHtml(event.hero_title_accent || '');
  const dateDisplay = escapeHtml(event.event_date_display_full || '');
  const timeStart = escapeHtml(event.event_time_start || '');
  const timeEnd = escapeHtml(event.event_time_end || '');
  const venueName = escapeHtml(event.venue_name || '');
  const venueShort = escapeHtml(event.venue_address || '');
  const venueFull = escapeHtml(event.venue_full_address || '');

  const directions = buildDirectionsLink(event.venue_full_address);

  const timeLine = timeStart && timeEnd
    ? `${timeStart}–${timeEnd}`
    : (timeStart || '');

  const eventTitleLine = eventTitleAccent
    ? `${eventTitleMain} · ${eventTitleAccent}`
    : eventTitleMain;

  // Inline-styled HTML — email clients strip <style> blocks.
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>אישור הרשמה · Safe Capital</title>
</head>
<body style="margin:0;padding:0;background-color:#fbf9f6;font-family:'Heebo','Segoe UI',Arial,sans-serif;color:#1b1c1a;direction:rtl;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fbf9f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="background-color:#022445;padding:28px 32px;text-align:right;">
              <div style="color:#ffffff;font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:0.7;font-family:'Inter','Segoe UI',Arial,sans-serif;">Safe Capital</div>
              <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:6px;">אישור הרשמה · ערב משקיעים</div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px 32px;text-align:right;">
              <div style="font-size:20px;font-weight:700;color:#022445;margin-bottom:8px;">היי ${firstName},</div>
              <div style="font-size:16px;line-height:1.7;color:#43474e;">
                תודה שנרשמת לערב המשקיעים של Safe Capital. ההרשמה שלך התקבלה בהצלחה, ונשמח לראותך באירוע.
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px 32px;text-align:right;">
              <div style="background-color:#f5f3f0;border-radius:10px;padding:20px 24px;">
                <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#984349;font-weight:700;margin-bottom:10px;font-family:'Inter','Segoe UI',Arial,sans-serif;">פרטי האירוע</div>
                <div style="font-size:18px;font-weight:700;color:#022445;margin-bottom:12px;">${eventTitleLine}</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;color:#1b1c1a;line-height:1.8;">
                  ${dateDisplay ? `<tr><td style="padding:2px 0;"><span style="color:#43474e;">תאריך:</span> <strong>${dateDisplay}</strong></td></tr>` : ''}
                  ${timeLine ? `<tr><td style="padding:2px 0;"><span style="color:#43474e;">שעה:</span> <strong>${timeLine}</strong></td></tr>` : ''}
                  ${venueName ? `<tr><td style="padding:2px 0;"><span style="color:#43474e;">מקום:</span> <strong>${venueName}</strong></td></tr>` : ''}
                  ${venueShort ? `<tr><td style="padding:2px 0;"><span style="color:#43474e;">אזור:</span> ${venueShort}</td></tr>` : ''}
                </table>
              </div>
            </td>
          </tr>

          ${venueFull ? `
          <tr>
            <td style="padding:16px 32px 8px 32px;text-align:right;">
              <div style="background-color:#ffffff;border-radius:10px;padding:20px 24px;background-color:#f5f3f0;">
                <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#984349;font-weight:700;margin-bottom:10px;font-family:'Inter','Segoe UI',Arial,sans-serif;">דרכי הגעה</div>
                <div style="font-size:15px;color:#1b1c1a;line-height:1.7;margin-bottom:14px;">${venueFull}</div>
                ${directions ? `<a href="${directions}" style="display:inline-block;background-color:#022445;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">פתח בגוגל מפות</a>` : ''}
              </div>
            </td>
          </tr>
          ` : ''}

          <tr>
            <td style="padding:16px 32px 8px 32px;text-align:right;">
              <div style="background-color:#f5f3f0;border-radius:10px;padding:20px 24px;">
                <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#984349;font-weight:700;margin-bottom:10px;font-family:'Inter','Segoe UI',Arial,sans-serif;">פרטי ההרשמה שלך</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;color:#1b1c1a;line-height:1.8;">
                  <tr><td style="padding:2px 0;"><span style="color:#43474e;">שם:</span> <strong>${firstName} ${escapeHtml(registration.last_name || '')}</strong></td></tr>
                  <tr><td style="padding:2px 0;"><span style="color:#43474e;">טלפון:</span> <strong dir="ltr" style="unicode-bidi:embed;">${escapeHtml(registration.phone || '')}</strong></td></tr>
                  <tr><td style="padding:2px 0;"><span style="color:#43474e;">אימייל:</span> <strong dir="ltr" style="unicode-bidi:embed;">${escapeHtml(registration.email || '')}</strong></td></tr>
                  <tr><td style="padding:2px 0;">${guestLine}</td></tr>
                </table>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 32px 32px;text-align:right;">
              <div style="font-size:14px;line-height:1.7;color:#43474e;">
                נתראה באירוע,<br>
                <strong style="color:#022445;">צוות Safe Capital</strong>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color:#022445;padding:18px 32px;text-align:center;">
              <div style="color:#ffffff;font-size:12px;opacity:0.7;font-family:'Inter','Segoe UI',Arial,sans-serif;letter-spacing:1px;">Safe Capital · סייף קפיטל</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEventRegistrationText(registration, event) {
  const lines = [
    `היי ${registration.first_name || ''},`,
    '',
    'תודה שנרשמת לערב המשקיעים של Safe Capital. ההרשמה שלך התקבלה בהצלחה.',
    '',
    '— פרטי האירוע —'
  ];
  if (event.hero_title_main) lines.push(event.hero_title_main);
  if (event.event_date_display_full) lines.push(`תאריך: ${event.event_date_display_full}`);
  if (event.event_time_start && event.event_time_end) {
    lines.push(`שעה: ${event.event_time_start}–${event.event_time_end}`);
  }
  if (event.venue_name) lines.push(`מקום: ${event.venue_name}`);
  if (event.venue_full_address) {
    lines.push(`כתובת: ${event.venue_full_address}`);
    lines.push(`מפה: ${buildDirectionsLink(event.venue_full_address)}`);
  }
  lines.push('', '— פרטי ההרשמה שלך —');
  lines.push(`שם: ${registration.first_name || ''} ${registration.last_name || ''}`);
  lines.push(`טלפון: ${registration.phone || ''}`);
  lines.push(`אימייל: ${registration.email || ''}`);
  if (registration.guest_name) lines.push(`מלווה: ${registration.guest_name}`);
  lines.push('', 'נתראה באירוע,', 'צוות Safe Capital');
  return lines.join('\n');
}

/**
 * Send thank-you email to an event registrant.
 * Resolves to { sent: boolean, skipped?: boolean, error?: Error }.
 * Never throws — safe to call fire-and-forget.
 */
async function sendEventRegistrationEmail(registration, event) {
  try {
    if (!registration || !registration.email) {
      return { sent: false, skipped: true, reason: 'missing email' };
    }
    const transporter = getTransporter();
    if (!transporter) {
      return { sent: false, skipped: true, reason: 'smtp not configured' };
    }
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: registration.email,
      subject: 'אישור הרשמה · ערב המשקיעים של Safe Capital',
      text: buildEventRegistrationText(registration, event || {}),
      html: buildEventRegistrationHtml(registration, event || {})
    });
    console.log('[email] Registration confirmation sent:', info.messageId, '→', registration.email);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('[email] Failed to send registration confirmation:', err.message);
    return { sent: false, error: err };
  }
}

module.exports = {
  sendEventRegistrationEmail,
  isConfigured
};
