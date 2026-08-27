import { Resend } from 'resend';

// Use environment variable or fallback for development if not present, though it should be in .env
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build');

const DEFAULT_FROM = 'PrimeRealOps Support <notifications@primerealops.com>'; // Fallback domain

const getSignature = () => `
<br><br>
<div style="font-family: Georgia, serif; color: #333; margin-top: 20px;">
  <p>Best Regards,</p>
  <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px;">
    <tr>
      <td style="padding-right: 15px; text-align: center; vertical-align: top;">
        <img src="https://prime-lead-bridge-five.vercel.app/Favicon.gif" width="110" height="110" style="border-radius: 50%; display: block;" alt="Support Team">
        <div style="margin-top: 15px;">
          <a href="https://calendly.com/primerealops/primerealops-discovery-call" style="color: #0056b3; font-weight: bold; text-decoration: none; font-size: 14px;">Book A Call</a>
        </div>
      </td>
      <td style="border-left: 2px solid #0056b3; padding-left: 15px; vertical-align: top;">
        <h3 style="margin: 0; font-size: 18px; color: #000;">Support Team</h3>
        <p style="margin: 2px 0 10px 0; font-size: 14px; color: #333; font-weight: bold;">
          <a href="https://www.primerealops.com/" style="color: #333; text-decoration: none;">PrimeRealOps</a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #555;">
          <span style="font-size: 14px;">📞</span> +91 88052 92130, +1 (929) 833-8166
        </p>
        <p style="margin: 2px 0 10px 0; font-size: 13px; color: #555;">
          <span style="font-size: 14px;">📍</span> Mumbai, India
        </p>
        <p style="margin: 0 0 10px 0; font-size: 13px;">
          <a href="https://www.linkedin.com/company/prime-real-ops/" style="text-decoration: none; color: #0056b3; font-weight: bold;">
             <img src="https://prime-lead-bridge-five.vercel.app/linkedin.png" width="14" height="14" style="vertical-align: middle; margin-right: 4px;" alt="LinkedIn">LinkedIn
          </a>
          &nbsp;|&nbsp;
          <a href="https://wa.me/16786789750" style="text-decoration: none; color: #0056b3; font-weight: bold;">
             <img src="https://prime-lead-bridge-five.vercel.app/whatsapp.png" width="14" height="14" style="vertical-align: middle; margin-right: 4px;" alt="WhatsApp">WhatsApp
          </a>
        </p>
        <p style="margin: 0; font-size: 13px; font-weight: bold; color: #000; font-style: italic;">
          "Jack of all trades, master of none,<br>
          But oftentimes better than a master of one."
        </p>
      </td>
    </tr>
  </table>
</div>
`;

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const finalHtml = html + getSignature();
    
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to,
      subject,
      html: finalHtml,
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
