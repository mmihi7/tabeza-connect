/**
 * Receipt Distribution Modal
 * Shows when POS sends a print job to Tabeza Virtual Printer
 * Allows staff to choose between physical receipt or digital delivery
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

'use client';

import { useState } from 'react';
import { X, Printer, Smartphone, Users } from 'lucide-react';

export interface ReceiptData {
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  total: number;
  customerInfo?: {
    tableNumber?: number;
    phone?: string;
  };
  rawReceipt: string;
}

export interface ReceiptDistributionModalProps {
  isOpen: boolean;
  receiptData: ReceiptData;
  onPhysicalReceipt: () => void;
  onDigitalReceipt: () => void;
  onClose: () => void;
}

export function ReceiptDistributionModal({
  isOpen,
  receiptData,
  onPhysicalReceipt,
  onDigitalReceipt,
  onClose
}: ReceiptDistributionModalProps) {
  if (!isOpen) return null;

  const { items, total, customerInfo } = receiptData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer className="w-6 h-6" />
            <h2 className="text-xl font-bold">Receipt Distribution</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Receipt Preview */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Order Summary</h3>
          
          {customerInfo?.tableNumber && (
            <div className="mb-3 text-sm text-gray-600">
              <span className="font-medium">Table:</span> {customerInfo.tableNumber}
            </div>
          )}

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={index} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-medium text-gray-900">
                    KES {item.total_price.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            
            <div className="mt-4 pt-4 border-t-2 border-gray-900 flex justify-between">
              <span className="font-bold text-lg text-gray-900">Total:</span>
              <span className="font-bold text-lg text-gray-900">
                KES {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Selection */}
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">
            How would you like to deliver this receipt?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Physical Receipt Option */}
            <button
              onClick={onPhysicalReceipt}
              className="group relative bg-white border-2 border-blue-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all duration-200 text-left"
            >
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-500 transition-colors">
                  <Printer className="w-6 h-6 text-blue-600 group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">Physical Receipt</h4>
                  <p className="text-sm text-gray-600">
                    Print to thermal printer for walk-in customers
                  </p>
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-500 italic">
                Traditional paper receipt
              </div>
            </button>

            {/* Digital Receipt Option */}
            <button
              onClick={onDigitalReceipt}
              className="group relative bg-white border-2 border-green-200 rounded-lg p-6 hover:border-green-500 hover:shadow-lg transition-all duration-200 text-left"
            >
              <div className="flex items-start gap-4">
                <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-500 transition-colors">
                  <Smartphone className="w-6 h-6 text-green-600 group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">Tabeza Digital Receipt</h4>
                  <p className="text-sm text-gray-600">
                    Send to customer's Tabeza app
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 italic">
                <Users className="w-3 h-3" />
                Select customer in next step
              </div>
            </button>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">💡 Tip:</span> Choose "Physical Receipt" for walk-in customers 
              or "Tabeza Digital Receipt" for customers using the Tabeza app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
