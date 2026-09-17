/**
 * Deploy this file as a Google Apps Script Web App.
 * Store the shared secret in Script Properties as EMAIL_SHARED_SECRET.
 * Execute as the owner and allow access to anyone who has the URL.
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('EMAIL_SHARED_SECRET');
    if (!expected || body.secret !== expected) return jsonResponse({ success: false, error: 'Unauthorized' });
    if (!isValidEmail(body.to) || !body.subject || !body.html) {
      return jsonResponse({ success: false, error: 'Invalid request' });
    }
    MailApp.sendEmail({
      to: body.to,
      subject: String(body.subject).slice(0, 200),
      htmlBody: String(body.html).slice(0, 100000),
      body: 'Please view this message in an HTML-capable email client.'
    });
    return jsonResponse({ success: true });
  } catch (err) {
    console.error('Transactional email delivery failed', err && err.message ? err.message : 'unknown');
    return jsonResponse({ success: false, error: 'Delivery failed' });
  }
}

function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
