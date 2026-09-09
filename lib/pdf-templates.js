export const getInvoicePdfHtml = (invoice, orgName, period, baseFee, usageCost, planName, callLogs = []) => {
  const logoUrl = "https://alvfyayrabxzxthcjphx.supabase.co/storage/v1/object/public/public-assets/Favicon.gif";
  
  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase()}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            padding: 40px; 
            background-color: #0a0a0e;
            color: #f8fafc; 
            line-height: 1.6; 
          }
          .glass-card {
            background: rgba(30, 41, 59, 0.4);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header { 
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.1); 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
          }
          .header-left h1 { margin: 0; color: #fff; font-size: 28px; font-weight: bold; }
          .header-left p { margin: 5px 0 0 0; color: #94a3b8; font-size: 14px; }
          .header-right img { width: 64px; height: 64px; border-radius: 12px; }
          .details { margin-bottom: 40px; color: #cbd5e1; }
          .details strong { color: #f8fafc; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px; }
          th, td { padding: 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
          th { background-color: rgba(0,0,0,0.2); font-weight: 600; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
          th:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
          th:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
          .totals { width: 350px; float: right; }
          .totals table { border: none; margin-bottom: 0; }
          .totals th, .totals td { border: none; padding: 12px 16px; }
          .totals td:last-child { text-align: right; }
          .total-row { font-weight: bold; font-size: 1.2em; border-top: 1px solid rgba(255,255,255,0.1); color: #fff; }
          .total-row td { padding-top: 16px; }
          .footer { 
            clear: both; 
            margin-top: 60px; 
            padding-top: 30px; 
            border-top: 1px solid rgba(255,255,255,0.1); 
            display: flex;
            justify-content: space-between;
          }
          .footer-left h3 { margin: 0 0 5px 0; color: #fff; font-size: 16px; }
          .footer-left p { margin: 0 0 8px 0; color: #94a3b8; font-size: 13px; }
          .footer-left a { color: #818cf8; text-decoration: none; }
          .footer-quote { font-style: italic; color: #64748b; font-size: 13px; line-height: 1.5; max-width: 300px; text-align: right; }
          
          /* Print optimizations */
          @media print {
            body { background-color: #0a0a0e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .glass-card { border: 1px solid #334155 !important; box-shadow: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="glass-card">
          <div class="header">
            <div class="header-left">
              <h1>Prime Lead Bridge</h1>
              <p>A product of Prime Real Ops</p>
            </div>
            <div class="header-right">
              <img src="${logoUrl}" alt="Prime Real Ops Logo" />
            </div>
          </div>
          
          <div class="details">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <p><strong>Billed To:</strong><br/>
                ${orgName}</p>
              </div>
              <div style="text-align: right;">
                <p><strong>Invoice ID:</strong> ${invoice.invoice_number || invoice.id.slice(0,8).toUpperCase()}<br/>
                <strong>Billing Period:</strong> ${period}<br/>
                <strong>Issue Date:</strong> ${new Date(invoice.created_at).toLocaleDateString()}<br/>
                <strong>Due Date:</strong> ${invoice.due_date || "N/A"}<br/>
                <strong>Status:</strong> <span style="color: ${invoice.status === "paid" ? "#34d399" : invoice.status === "overdue" ? "#f87171" : "#fbbf24"}">${invoice.status?.toUpperCase()}</span>
                ${invoice.status === "paid" && invoice.paid_date ? `<br/><strong>Paid On:</strong> ${invoice.paid_date}` : ""}
                </p>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${planName} Base Plan</td>
                <td>1</td>
                <td>$${baseFee.toFixed(2)}</td>
                <td style="text-align: right;">$${baseFee.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Voice Calls Usage</td>
                <td>${parseFloat(invoice.rate_per_minute || 0) > 0 ? Math.round(usageCost / parseFloat(invoice.rate_per_minute)) : (invoice.total_minutes || 0)} min</td>
                <td>$${parseFloat(invoice.rate_per_minute || 0).toFixed(4)}/min</td>
                <td style="text-align: right;">$${usageCost.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr>
                <td>Subtotal</td>
                <td>$${parseFloat(invoice.subtotal || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Discount Applied</td>
                <td style="color: #34d399;">-$${parseFloat(invoice.discount_amount || 0).toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>Total Due</td>
                <td style="color: #34d399;">$${parseFloat(invoice.total_amount || invoice.amount_due || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="footer">
            <div class="footer-left">
              <h3>Support Team, PrimeRealOps</h3>
              <p>📞 +1 (929) 833-8166 | ✉️ info@primerealops.com</p>
              <p>
                <a href="https://calendly.com/primerealops/primerealops-discovery-call">Book a Call</a> &bull; 
                <a href="https://www.linkedin.com/company/prime-real-ops/">LinkedIn</a> &bull; 
                <a href="https://wa.me/16786789750">WhatsApp</a>
              </p>
            </div>
            <div class="footer-quote">
              "Jack of all trades, master of none,<br/>
              But oftentimes better than a master of one."
            </div>
          </div>
        </div>

        ${callLogs && callLogs.length > 0 ? `
        <div style="page-break-before: always; margin-top: 40px;"></div>
        <div class="glass-card">
          <div class="header">
            <div class="header-left">
              <h1>Call Log Statement</h1>
              <p>${period}</p>
            </div>
            <div class="header-right">
              <img src="${logoUrl}" alt="Prime Real Ops Logo" />
            </div>
          </div>
          
          <table style="font-size: 13px;">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Type</th>
                <th>Phone Number</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${callLogs.map(log => `
                <tr>
                  <td>${new Date(log.created_at).toLocaleString()}</td>
                  <td>${log.call_type === 'outbound' ? 'Outbound' : 'Inbound'}</td>
                  <td style="font-family: monospace;">${log.call_type === 'outbound' ? log.to_number : log.from_number}</td>
                  <td>${log.duration ? Math.ceil(log.duration / 60) + ' min' : '0 min'}</td>
                  <td>${log.status || 'completed'}</td>
                  <td style="color: ${log.notes ? '#cbd5e1' : '#64748b'}; font-style: ${log.notes ? 'normal' : 'italic'}; max-width: 200px;">${log.notes || 'No notes available'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
    </html>
  `;
};

