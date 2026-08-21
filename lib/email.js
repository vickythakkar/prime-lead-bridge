import { Resend } from 'resend';

// Use environment variable or fallback for development if not present, though it should be in .env
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build');

const DEFAULT_FROM = 'PrimeRealOps Support <info@primerealops.com>'; // Fallback domain

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to,
      subject,
      html,
    });
    
    if (response.error) {
      console.error('Resend API Error:', response.error.message);
      return { success: false, error: response.error };
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Failed to send email network/internal:', error);
    return { success: false, error };
  }
};
