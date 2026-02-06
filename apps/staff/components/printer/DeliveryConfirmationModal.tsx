/**
 * Delivery Confirmation Modal
 * Shows confirmation after digital receipts are delivered to customers
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

'use client';

import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

export interface DeliveryResult {
  deliveryId: string;
  successful: Array<{
    customerId: string;
    tabNumber: number;
    customerIdentifier: string;
  }>;
  failed: Array<{
    customerId: string;
    tabNumber: number;
    customerIdentifier: string;
    error: string;
  }>;
  timestamp: Date;
}

export interface DeliveryConfirmationModalProps {
  isOpen: boolean;
  deliveryResult: DeliveryResult;
  onClose: () => void;
  onRetryFailed?: () => void;
}

export function DeliveryConfirmationModal({
  isOpen,
  deliveryResult,
  onClose,
  onRetryFailed
}: DeliveryConfirmationModalProps) {
  if (!isOpen) return null;

  const { successful, failed, timestamp } = deliveryResult;
  const totalAttempted = successful.length + failed.length;
  const allSuccessful = failed.length === 0;
  const allFailed = successful.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`
          px-6 py-4 flex items-center justify-between text-white
          ${allSuccessful ? 'bg-green-600' : allFailed ? 'bg-red-600' : 'bg-yellow-600'}
        `}>
          <div className="flex items-center gap-3">
            {allSuccessful ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : allFailed ? (
              <XCircle className="w-6 h-6" />
            ) : (
              <AlertCircle className="w-6 h-6" />
            )}
            <h2 className="text-xl font-bold">
              {allSuccessful 
                ? 'Delivery Successful' 
                : allFailed 
                ? 'Delivery Failed' 
                : 'Partial Delivery'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Summary */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Delivery Summary</p>
              <p className="text-2xl font-bold text-gray-900">
                {successful.length} of {totalAttempted} successful
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              {timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {/* Successful Deliveries */}
          {successful.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Successfully Delivered ({successful.length})
              </h3>
              <div className="space-y-2">
                {successful.map((delivery) => (
                  <div
                    key={delivery.customerId}
                    className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        Tab #{delivery.tabNumber}
                      </p>
                      <p className="text-sm text-gray-600">
                        {delivery.customerIdentifier}
                      </p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed Deliveries */}
          {failed.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Failed Deliveries ({failed.length})
              </h3>
              <div className="space-y-2">
                {failed.map((delivery) => (
                  <div
                    key={delivery.customerId}
                    className="bg-red-50 border border-red-200 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          Tab #{delivery.tabNumber}
                        </p>
                        <p className="text-sm text-gray-600">
                          {delivery.customerIdentifier}
                        </p>
                      </div>
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    </div>
                    <div className="bg-red-100 rounded px-3 py-2">
                      <p className="text-sm text-red-800">
                        <span className="font-semibold">Error:</span> {delivery.error}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {failed.length > 0 && onRetryFailed ? (
            <div className="flex gap-3">
              <button
                onClick={onRetryFailed}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Retry Failed Deliveries
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Done
            </button>
          )}

          {/* Info Message */}
          {!allSuccessful && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">💡 Tip:</span> Failed deliveries may be due to 
                customer disconnection. You can print a physical receipt as a backup.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
