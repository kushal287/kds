/**
 * KDS — Enquiry → Google Sheet + Email notification
 * -------------------------------------------------
 * Every enquiry sent from the website contact form is:
 *   1. saved as a new row in this Google Sheet ("Enquiries" tab), and
 *   2. emailed to you instantly (you'll also get a phone notification from the Gmail app).
 *
 * Setup steps are in SETUP-GOOGLE-SHEETS.md (and in your admin panel → "Google Sheet & Email").
 */

// ====== EDIT THESE TWO LINES ======================================================
const NOTIFY_EMAIL = '287kushal@gmail.com';        // where the alerts are sent
const SECRET = 'PUT-A-LONG-RANDOM-SECRET-HERE';     // must be IDENTICAL to the "Secret key" in the admin panel
// ==================================================================================

const SHEET_NAME = 'Enquiries';
const HEADERS = ['Received', 'ID', 'Name', 'Email', 'Phone', 'Service', 'Plan', 'Requirement / Message', 'Status', 'Notes'];

/** Receives the enquiry from the website server. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = JSON.parse(e.postData.contents);
    if (!data || data.secret !== SECRET) return reply({ ok: false, error: 'Wrong secret key — check it matches the admin panel' });

    const sheet = getSheet();

    // De-duplicate: if the website retries an enquiry we already stored, don't add or email it twice.
    if (data.id && sheet.getLastRow() > 1) {
      const ids = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().map((r) => r[0]);
      if (ids.indexOf(data.id) !== -1) return reply({ ok: true, duplicate: true });
    }

    sheet.appendRow([
      new Date(data.date || Date.now()),
      data.id || '', data.name || '', data.email || '', data.phone || '',
      data.service || '', data.plan || '', data.message || '',
      data.test ? 'Test' : 'New', ''
    ]);

    sendNotification(data);
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* ignore */ }
  }
}

/** Opening the web-app URL in a browser shows this — handy to check the deployment works. */
function doGet() {
  return reply({ ok: true, service: 'KDS enquiries', note: 'Deployed correctly. Enquiries are received via POST.' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f2c14e');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150); sheet.setColumnWidth(3, 140); sheet.setColumnWidth(4, 200); sheet.setColumnWidth(8, 420);
    sheet.getRange('A2:A1000').setNumberFormat('dd MMM yyyy, hh:mm AM/PM');
    sheet.getRange('H2:H1000').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    sheet.getRange('B2:B1000').setNumberFormat('@'); // keep IDs as plain text (Sheets could mangle e.g. "12e45")
    sheet.getRange('E2:E1000').setNumberFormat('@'); // keep phone numbers exactly as typed (+91…, leading zeros)

    // "Status" column (I) becomes a dropdown: New / Contacted / Done
    sheet.getRange('I2:I1000').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['New', 'Contacted', 'Done', 'Test'], true).setAllowInvalid(false).build()
    );
    // Colour whole rows by status so new requests stand out
    const area = sheet.getRange('A2:J1000');
    const rule = (status, color) => SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$I2="' + status + '"').setBackground(color).setRanges([area]).build();
    sheet.setConditionalFormatRules([rule('New', '#fff3c4'), rule('Contacted', '#e3f0ff'), rule('Done', '#e4f5e7'), rule('Test', '#eeeeee')]);
  }
  return sheet;
}

/** Sends the alert email. */
function sendNotification(d) {
  const esc = (s) => String(s || '—').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const subject = (d.test ? '[TEST] ' : '') + '🔔 New KDS enquiry from ' + (d.name || 'a visitor') + (d.service ? ' — ' + d.service : '');

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5c56a;border-radius:12px;overflow:hidden">' +
    '<div style="background:#0a0a0a;color:#f2c14e;padding:18px 22px;font-size:18px;font-weight:bold">KDS — New enquiry' + (d.test ? ' (test)' : '') + '</div>' +
    '<div style="padding:22px;color:#222;line-height:1.6">' +
    '<p style="margin:0 0 4px"><b>Name:</b> ' + esc(d.name) + '</p>' +
    '<p style="margin:0 0 4px"><b>Email:</b> ' + (d.email ? '<a href="mailto:' + esc(d.email) + '">' + esc(d.email) + '</a>' : '—') + '</p>' +
    '<p style="margin:0 0 4px"><b>Phone:</b> ' + (d.phone ? '<a href="tel:' + esc(d.phone) + '">' + esc(d.phone) + '</a>' : '—') + '</p>' +
    '<p style="margin:0 0 4px"><b>Service:</b> ' + esc(d.service) + '</p>' +
    '<p style="margin:0 0 14px"><b>Plan:</b> ' + esc(d.plan) + '</p>' +
    '<div style="background:#fff8e1;border-left:4px solid #f2c14e;padding:12px 14px;border-radius:6px;white-space:pre-wrap">' + esc(d.message) + '</div>' +
    '<p style="margin:18px 0 0;color:#666;font-size:13px">Received: ' + esc(Utilities.formatDate(new Date(d.date || Date.now()), Session.getScriptTimeZone(), 'dd MMM yyyy, hh:mm a')) + '</p>' +
    '<p style="margin:14px 0 0"><a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '" style="background:#f2c14e;color:#111;padding:10px 18px;border-radius:99px;text-decoration:none;font-weight:bold">Open the enquiries sheet</a></p>' +
    '</div></div>';

  const text =
    'New KDS enquiry\n\nName: ' + (d.name || '-') + '\nEmail: ' + (d.email || '-') + '\nPhone: ' + (d.phone || '-') +
    '\nService: ' + (d.service || '-') + '\nPlan: ' + (d.plan || '-') + '\n\nRequirement:\n' + (d.message || '-');

  const options = { htmlBody: html, name: 'KDS Website' };
  if (d.email) options.replyTo = d.email; // hit "Reply" in Gmail to answer the customer directly
  MailApp.sendEmail(NOTIFY_EMAIL, subject, text, options);
}

/* ---------------------------------------------------------------------------------
 * OPTIONAL: daily reminder of enquiries still marked "New" in the sheet.
 * Run `createDailyReminder` once (Run button) to switch it on; runs every morning ~9am.
 * -------------------------------------------------------------------------------- */
function createDailyReminder() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'sendDailyReminder').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendDailyReminder').timeBased().everyDays(1).atHour(9).create();
}
function sendDailyReminder() {
  const sheet = getSheet();
  if (sheet.getLastRow() < 2) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues().filter((r) => r[8] === 'New');
  if (!rows.length) return;
  const list = rows.map((r) => '• ' + r[2] + ' (' + (r[3] || r[4] || 'no contact') + ') — ' + (r[5] || 'general') + ': ' + String(r[7]).slice(0, 120)).join('\n');
  MailApp.sendEmail(NOTIFY_EMAIL, '⏰ ' + rows.length + ' KDS enquiries waiting for a reply', 'These enquiries are still marked "New" in your sheet:\n\n' + list + '\n\nChange the Status column to "Contacted" or "Done" once handled.\n' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

/** Run this once from the editor to authorise the script and send yourself a test email. */
function testSetup() {
  sendNotification({ name: 'Test Person', email: NOTIFY_EMAIL, phone: '0000000000', service: 'Website Building', plan: 'Pro', message: 'This is a test from the Apps Script editor.', date: new Date().toISOString(), test: true });
  getSheet();
}
