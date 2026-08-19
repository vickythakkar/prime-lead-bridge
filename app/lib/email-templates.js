export const getSignatureHtml = () => `
<div style="margin-top: 40px; font-family: Arial, sans-serif; color: #333;">
  <p style="margin-bottom: 20px;">Best Regards,</p>
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
    <tr>
      <td style="padding-right: 20px; text-align: center; vertical-align: top;">
        <img src="https://primeleadbridge.com/favicon.ico" alt="PrimeRealOps" width="80" height="80" style="border-radius: 50%; display: block; margin: 0 auto 10px auto; object-fit: cover; background-color: #f3f4f6;" />
        <a href="https://calendly.com/primerealops/primerealops-discovery-call" style="color: #4f46e5; font-weight: bold; text-decoration: none; font-size: 14px;">Book A Call</a>
      </td>
      <td style="border-left: 3px solid #4f46e5; padding-left: 20px; vertical-align: top;">
        <h3 style="margin: 0 0 5px 0; color: #111827; font-size: 18px;">Support Team</h3>
        <p style="margin: 0 0 15px 0; color: #111827; font-weight: bold; font-size: 14px;">PrimeRealOps</p>
        
        <p style="margin: 0 0 5px 0; font-size: 13px; color: #4b5563;">
          <span style="color: #e11d48; margin-right: 5px;">📞</span> +1 (929) 833-8166
        </p>
        <p style="margin: 0 0 15px 0; font-size: 13px; color: #4b5563;">
          <span style="color: #e11d48; margin-right: 5px;">📍</span> Mumbai, India | New York, USA
        </p>
        
        <p style="margin: 0; font-size: 13px; font-style: italic; color: #374151; max-width: 300px; line-height: 1.4;">
          "Jack of all trades, master of none,<br/>But oftentimes better than a master of one."
        </p>
      </td>
    </tr>
  </table>
</div>
`;

export const getWelcomeEmailHtml = (name) => `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
  <h2>Welcome to Prime Lead Bridge!</h2>
  <p>Hi ${name || 'there'},</p>
  <p>We are thrilled to have you onboard. Your organization has been successfully created and your account is now active.</p>
  <p><strong>Next Steps:</strong></p>
  <ul>
    <li>Log in to your dashboard to complete your profile.</li>
    <li>Purchase a dedicated phone number to start routing calls.</li>
    <li>Set up your IVR greeting and routing rules.</li>
  </ul>
  <p>If you have any questions or need help setting up, please don't hesitate to reach out or book a discovery call with us.</p>
  ${getSignatureHtml()}
</div>
`;

export const getAdminNewBrokerHtml = (orgData, agentData) => `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
  <h2>New Broker Onboarded</h2>
  <p>A new broker has successfully signed up.</p>
  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Organization:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${orgData.company_name}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Contact Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${agentData.name}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${orgData.contact_email}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${agentData.cell_phone}</td></tr>
  </table>
</div>
`;

export const getInvoiceEmailHtml = (orgName, month, totalMinutes, subtotal, overage, totalAmount, dueDate) => `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
  <h2>Your Monthly Invoice is Ready</h2>
  <p>Hi ${orgName},</p>
  <p>Your Prime Lead Bridge invoice for the month of <strong>${month}</strong> has been generated.</p>
  
  <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0;"><strong>Total Minutes Used:</strong></td><td style="text-align: right;">${totalMinutes} mins</td></tr>
      <tr><td style="padding: 8px 0;"><strong>Subtotal:</strong></td><td style="text-align: right;">$${subtotal.toFixed(2)}</td></tr>
      ${overage > 0 ? `<tr><td style="padding: 8px 0; color: #ef4444;"><strong>Past Due Overage/Penalty:</strong></td><td style="text-align: right; color: #ef4444;">$${overage.toFixed(2)}</td></tr>` : ''}
      <tr><td colspan="2" style="border-bottom: 2px solid #e5e7eb; padding-top: 10px;"></td></tr>
      <tr><td style="padding: 15px 0 0 0; font-size: 18px;"><strong>Total Due:</strong></td><td style="text-align: right; padding: 15px 0 0 0; font-size: 18px; color: #10b981;"><strong>$${totalAmount.toFixed(2)}</strong></td></tr>
    </table>
  </div>
  
  <p>Please ensure payment is completed by <strong>${dueDate}</strong> to avoid any service interruptions or late fees.</p>
  <p>You can view the full details and settle this invoice directly from your billing dashboard.</p>
  
  ${getSignatureHtml()}
</div>
`;

export const getAdminInvoiceSummaryHtml = (invoicesCount, totalRevenue) => `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
  <h2>Monthly Billing Cycle Completed</h2>
  <p>The automated cron job has successfully generated the invoices for the previous month.</p>
  <ul>
    <li><strong>Invoices Generated:</strong> ${invoicesCount}</li>
    <li><strong>Total Billable Revenue:</strong> $${totalRevenue.toFixed(2)}</li>
  </ul>
  <p>All brokers have been emailed their respective invoices.</p>
</div>
`;

export const getVoicemailEmailHtml = (fromNumber, duration, listenUrl) => `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
  <h2>New Voicemail Received</h2>
  <p>You have a new voicemail message waiting for you.</p>
  <div style="background-color: #f9fafb; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${fromNumber}</p>
    <p style="margin: 0 0 15px 0;"><strong>Duration:</strong> ${duration} seconds</p>
    <a href="${listenUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Listen to Voicemail</a>
  </div>
  <p>Alternatively, you can log into your Prime Lead Bridge dashboard to manage your voicemails.</p>
  ${getSignatureHtml()}
</div>
`;
