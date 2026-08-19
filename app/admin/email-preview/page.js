import { getWelcomeEmailHtml, getAdminNewBrokerHtml, getInvoiceEmailHtml, getAdminInvoiceSummaryHtml, getVoicemailEmailHtml } from '@/lib/email-templates';

export default function EmailPreviewPage() {
  const welcomeHtml = getWelcomeEmailHtml('John Doe');
  const adminBrokerHtml = getAdminNewBrokerHtml(
    { company_name: 'Acme Realty', contact_email: 'john@acme.com' }, 
    { name: 'John Doe', cell_phone: '+1 555 123 4567' }
  );
  const invoiceHtml = getInvoiceEmailHtml('Acme Realty', 'August 2026', 1500, 114.00, 0, 114.00, '2026-09-07');
  const adminSummaryHtml = getAdminInvoiceSummaryHtml(12, 1450.50);
  const voicemailHtml = getVoicemailEmailHtml('+1 555 987 6543', 45, 'https://api.twilio.com/2010-04-01/Accounts/AC.../Recordings/RE...');

  const EmailCard = ({ title, subject, html }) => (
    <div className="mb-12 bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
        <h3 className="font-semibold text-slate-800 text-lg mb-1">{title}</h3>
        <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Subject:</span> {subject}</p>
      </div>
      <div className="p-6">
        <div dangerouslySetInnerHTML={{ __html: html }} className="max-w-2xl bg-white" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-8 text-slate-800">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Email Templates Preview</h1>
        
        <EmailCard 
          title="1. Broker Welcome Email" 
          subject="Welcome to Prime Lead Bridge"
          html={welcomeHtml} 
        />
        
        <EmailCard 
          title="2. Invoice Email (Sent to Broker)" 
          subject="Your Prime Lead Bridge Invoice - August 2026"
          html={invoiceHtml} 
        />
        
        <EmailCard 
          title="3. Voicemail Notification (Sent to Broker)" 
          subject="New Voicemail Received - Prime Lead Bridge"
          html={voicemailHtml} 
        />
        
        <EmailCard 
          title="4. Admin Notification: New Broker Signup" 
          subject="New Broker Signup - Prime Lead Bridge"
          html={adminBrokerHtml} 
        />
        
        <EmailCard 
          title="5. Admin Notification: Monthly Billing Cycle" 
          subject="Monthly Billing Cycle Completed - Prime Lead Bridge"
          html={adminSummaryHtml} 
        />
      </div>
    </div>
  );
}
