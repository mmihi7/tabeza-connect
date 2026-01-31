/**
 * Formatting utilities for receipts and print data
 */

export function formatCurrency(amount: number, currency = 'KES'): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

export function padString(str: string, length: number, char = ' '): string {
  return str.padEnd(length, char);
}