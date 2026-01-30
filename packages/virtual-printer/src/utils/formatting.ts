/**
 * Formatting utilities for receipt display and output
 */

import { CanonicalReceipt } from '../types/receipt';

/**
 * Format receipt for console/text display
 */
export function formatReceiptForDisplay(receipt: CanonicalReceipt): string {
  const width = 48;
  const line = '='.repeat(width);
  const dashes = '-'.repeat(width);

  return `
${line}
${centerText(receipt.merchant.name, width)}
${receipt.merchant.address ? centerText(receipt.merchant.address, width) : ''}
${receipt.merchant.phone ? centerText(receipt.merchant.phone, width) : ''}
${receipt.merchant.email ? centerText(receipt.merchant.email, width) : ''}
${line}

Receipt #: ${receipt.transaction.receipt_no}
Date: ${formatDate(receipt.transaction.datetime)}
Time: ${formatTime(receipt.transaction.datetime)}
${receipt.transaction.cashier ? `Cashier: ${receipt.transaction.cashier}` : ''}
${receipt.merchant.kra_pin ? `KRA PIN: ${receipt.merchant.kra_pin}` : ''}

${dashes}
ITEMS
${dashes}
${receipt.items.map(item => formatItemLine(item, width)).join('\n')}

${dashes}
${formatTotalLine('Subtotal:', receipt.totals.subtotal, width)}
${receipt.totals.tax > 0 ? formatTotalLine('Tax (16%):', receipt.totals.tax, width) : ''}
${receipt.totals.discount > 0 ? formatTotalLine('Discount:', -receipt.totals.discount, width) : ''}
${receipt.totals.service_charge > 0 ? formatTotalLine('Service:', receipt.totals.service_charge, width) : ''}
${line}
${formatTotalLine('TOTAL:', receipt.totals.total, width, true)}
${line}

Payment: ${receipt.transaction.payment_method || 'CASH'}
${receipt.transaction.pos_reference ? `Ref: ${receipt.transaction.pos_reference}` : ''}

${receipt.footer?.message ? `\n${centerText(receipt.footer.message, width)}` : ''}
${receipt.footer?.terms ? `\n${centerText(receipt.footer.terms, width)}` : ''}
${receipt.footer?.contact_info ? `\n${centerText(receipt.footer.contact_info, width)}` : ''}

${centerText('Powered by TABEZA Virtual Printer', width)}
${centerText(`Receipt ID: ${receipt.receipt_id}`, width)}
  `.trim();
}

/**
 * Generate HTML representation of receipt
 */
export function generateReceiptHTML(receipt: CanonicalReceipt): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - ${receipt.transaction.receipt_no}</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            max-width: 400px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .receipt {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .merchant-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .merchant-info {
            font-size: 12px;
            color: #666;
        }
        .receipt-info {
            margin-bottom: 15px;
            font-size: 12px;
        }
        .items {
            border-top: 1px dashed #333;
            border-bottom: 1px dashed #333;
            padding: 10px 0;
            margin: 15px 0;
        }
        .item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        .item-name {
            flex: 1;
        }
        .item-qty-price {
            margin: 0 10px;
        }
        .item-total {
            font-weight: bold;
        }
        .totals {
            margin-top: 15px;
        }
        .total-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
        }
        .final-total {
            border-top: 2px solid #333;
            padding-top: 5px;
            font-weight: bold;
            font-size: 16px;
        }
        .payment-info {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px dashed #333;
            text-align: center;
        }
        .footer {
            margin-top: 15px;
            text-align: center;
            font-size: 11px;
            color: #666;
        }
        .qr-code {
            text-align: center;
            margin: 15px 0;
        }
        @media print {
            body { background: white; }
            .receipt { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <div class="merchant-name">${escapeHtml(receipt.merchant.name)}</div>
            ${receipt.merchant.address ? `<div class="merchant-info">${escapeHtml(receipt.merchant.address)}</div>` : ''}
            ${receipt.merchant.phone ? `<div class="merchant-info">${escapeHtml(receipt.merchant.phone)}</div>` : ''}
            ${receipt.merchant.email ? `<div class="merchant-info">${escapeHtml(receipt.merchant.email)}</div>` : ''}
        </div>

        <div class="receipt-info">
            <div>Receipt #: <strong>${escapeHtml(receipt.transaction.receipt_no)}</strong></div>
            <div>Date: ${formatDate(receipt.transaction.datetime)}</div>
            <div>Time: ${formatTime(receipt.transaction.datetime)}</div>
            ${receipt.transaction.cashier ? `<div>Cashier: ${escapeHtml(receipt.transaction.cashier)}</div>` : ''}
            ${receipt.merchant.kra_pin ? `<div>KRA PIN: ${escapeHtml(receipt.merchant.kra_pin)}</div>` : ''}
        </div>

        <div class="items">
            ${receipt.items.map((item: any) => `
                <div class="item">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    <div class="item-qty-price">${item.qty}x${formatCurrency(item.unit_price)}</div>
                    <div class="item-total">${formatCurrency(item.total_price)}</div>
                </div>
            `).join('')}
        </div>

        <div class="totals">
            <div class="total-line">
                <span>Subtotal:</span>
                <span>${formatCurrency(receipt.totals.subtotal)}</span>
            </div>
            ${receipt.totals.tax > 0 ? `
                <div class="total-line">
                    <span>Tax (16%):</span>
                    <span>${formatCurrency(receipt.totals.tax)}</span>
                </div>
            ` : ''}
            ${receipt.totals.discount > 0 ? `
                <div class="total-line">
                    <span>Discount:</span>
                    <span>-${formatCurrency(receipt.totals.discount)}</span>
                </div>
            ` : ''}
            ${receipt.totals.service_charge > 0 ? `
                <div class="total-line">
                    <span>Service Charge:</span>
                    <span>${formatCurrency(receipt.totals.service_charge)}</span>
                </div>
            ` : ''}
            <div class="total-line final-total">
                <span>TOTAL:</span>
                <span>${formatCurrency(receipt.totals.total)}</span>
            </div>
        </div>

        <div class="payment-info">
            <div><strong>Payment: ${receipt.transaction.payment_method || 'CASH'}</strong></div>
            ${receipt.transaction.pos_reference ? `<div>Reference: ${escapeHtml(receipt.transaction.pos_reference)}</div>` : ''}
        </div>

        ${receipt.footer ? `
            <div class="footer">
                ${receipt.footer.message ? `<div>${escapeHtml(receipt.footer.message)}</div>` : ''}
                ${receipt.footer.terms ? `<div>${escapeHtml(receipt.footer.terms)}</div>` : ''}
                ${receipt.footer.contact_info ? `<div>${escapeHtml(receipt.footer.contact_info)}</div>` : ''}
            </div>
        ` : ''}

        <div class="footer">
            <div>Powered by TABEZA Virtual Printer</div>
            <div>Receipt ID: ${receipt.receipt_id}</div>
        </div>
    </div>
</body>
</html>
  `.trim();
}

/**
 * Generate PDF-ready HTML (simplified for PDF generation)
 */
export function generateReceiptPDF(receipt: CanonicalReceipt): string {
  // This would typically use a PDF generation library like puppeteer or jsPDF
  // For now, return HTML that's optimized for PDF conversion
  return generateReceiptHTML(receipt).replace(
    '<style>',
    '<style>@page { size: A4; margin: 20mm; } body { font-size: 12px; }'
  );
}

/**
 * Format receipt as JSON with pretty printing
 */
export function formatReceiptAsJSON(receipt: CanonicalReceipt, indent: number = 2): string {
  return JSON.stringify(receipt, null, indent);
}

/**
 * Format receipt as CSV (for bulk processing)
 */
export function formatReceiptAsCSV(receipts: CanonicalReceipt[]): string {
  const headers = [
    'receipt_id',
    'merchant_name',
    'receipt_no',
    'date',
    'time',
    'subtotal',
    'tax',
    'discount',
    'total',
    'payment_method',
    'items_count',
    'etims_status'
  ];

  const rows = receipts.map(receipt => [
    receipt.receipt_id,
    receipt.merchant.name,
    receipt.transaction.receipt_no,
    formatDate(receipt.transaction.datetime),
    formatTime(receipt.transaction.datetime),
    receipt.totals.subtotal.toFixed(2),
    receipt.totals.tax.toFixed(2),
    receipt.totals.discount.toFixed(2),
    receipt.totals.total.toFixed(2),
    receipt.transaction.payment_method || 'CASH',
    receipt.items.length,
    receipt.etims_status
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

/**
 * Format receipt for SMS delivery
 */
export function formatReceiptForSMS(receipt: CanonicalReceipt): string {
  const total = formatCurrency(receipt.totals.total);
  const date = formatDate(receipt.transaction.datetime);
  
  return `Receipt from ${receipt.merchant.name}\nTotal: ${total}\nDate: ${date}\nRef: ${receipt.transaction.receipt_no}\nView online: https://tabeza.app/receipt/${receipt.receipt_id}`;
}

/**
 * Format receipt for WhatsApp delivery
 */
export function formatReceiptForWhatsApp(receipt: CanonicalReceipt): string {
  const total = formatCurrency(receipt.totals.total);
  const date = formatDate(receipt.transaction.datetime);
  
  return `🧾 *Receipt from ${receipt.merchant.name}*\n\n💰 Total: *${total}*\n📅 Date: ${date}\n🔢 Ref: ${receipt.transaction.receipt_no}\n\n📱 View digital receipt:\nhttps://tabeza.app/receipt/${receipt.receipt_id}`;
}

/**
 * Helper functions
 */

function centerText(text: string, width: number): string {
  if (text.length >= width) return text;
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(padding) + text;
}

function formatItemLine(item: { name: string; qty: number; unit_price: number; total_price: number }, width: number): string {
  const qtyPrice = `${item.qty}x${formatCurrency(item.unit_price)}`;
  const total = formatCurrency(item.total_price);
  const nameWidth = width - qtyPrice.length - total.length - 2;
  
  let name = item.name;
  if (name.length > nameWidth) {
    name = name.substring(0, nameWidth - 3) + '...';
  }
  
  return `${name.padEnd(nameWidth)} ${qtyPrice} ${total}`;
}

function formatTotalLine(label: string, amount: number, width: number, bold: boolean = false): string {
  const amountStr = formatCurrency(Math.abs(amount));
  const line = `${label.padEnd(width - amountStr.length)}${amountStr}`;
  return bold ? line.toUpperCase() : line;
}

function formatCurrency(amount: number): string {
  return `KES ${amount.toFixed(2)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function escapeHtml(text: string): string {
  // Node.js environment fallback
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}