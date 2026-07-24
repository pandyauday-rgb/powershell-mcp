import { z } from 'zod';

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Send an email via the Resend API
 */
export async function sendResendEmail({ to, subject, text, html, from }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY environment variable is not set.'
    };
  }

  const fromAddress = from || process.env.RESEND_FROM_EMAIL;
  if (!fromAddress) {
    return {
      success: false,
      error: 'No "from" address provided and RESEND_FROM_EMAIL environment variable is not set.'
    };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        html
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Resend API returned status ${response.status}`
      };
    }

    return {
      success: true,
      id: data.id,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Register email tools backed by Resend
 */
export function registerEmailTools(server) {

  server.tool(
    'send-email',
    'Send an email via Resend. Requires RESEND_API_KEY (and RESEND_FROM_EMAIL or an explicit "from") to be set in the environment.',
    {
      to: z.union([z.string(), z.array(z.string())]).describe('Recipient email address(es)'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body content'),
      html: z.boolean().optional().default(false).describe('Whether the body should be sent as HTML (default: plain text)'),
      from: z.string().optional().describe('Optional sender address, overrides RESEND_FROM_EMAIL')
    },
    async ({ to, subject, body, html, from }) => {
      const result = await sendResendEmail({
        to,
        subject,
        text: html ? undefined : body,
        html: html ? body : undefined,
        from
      });

      if (result.success) {
        return {
          content: [{
            type: 'text',
            text: `📧 **Email Sent**\n\nTo: ${Array.isArray(to) ? to.join(', ') : to}\nSubject: ${subject}\nMessage ID: ${result.id}\n\n📅 Sent: ${result.timestamp}`
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `❌ Failed to send email:\n\n${result.error}`
        }],
        isError: true
      };
    }
  );
}
