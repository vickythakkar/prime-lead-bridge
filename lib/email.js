import { Resend } from 'resend';

// Use environment variable or fallback for development if not present, though it should be in .env
const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_FROM = 'PrimeRealOps Support <support@primeleadbridge.com>'; // Fallback domain if they haven't verified primerealops.com

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const data = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to,
      subject,
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
};
