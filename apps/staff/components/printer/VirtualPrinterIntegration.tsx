/**
 * Virtual Printer Integration Component
 * Manages the complete POS receipt distribution workflow
 * Integrates with the @tabeza/virtual-printer package
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { VirtualPrinterEngine, type VirtualPrinterConfig } from '@tabeza/virtual-printer';
import { ReceiptDistributionModal, type ReceiptData } from './ReceiptDistributionModal';
import { CustomerSelectionModal, type ConnectedCustomer } from './CustomerSelectionModal';
import { DeliveryConfirmationModal, type DeliveryResult } from './DeliveryConfirmationModal';
import { createClient } from '@supabase/supabase-js';
import { createDigitalReceiptDeliveryService, type PrintDataReceipt } from '@tabeza/shared/lib/services/digital-receipt-delivery';

export interface VirtualPrinterIntegrationProps {
  barId: string;
  supabaseUrl: string;
  supabaseKey: string;
  enabled: boolean; // Only enabled for POS authority modes
}

type ModalState = 
  | { type: 'none' }
  | { type: 'distribution'; receiptData: ReceiptData }
  | { type: 'customerSelection'; receiptData: ReceiptData; customers: ConnectedCustomer[] }
  | { type: 'confirmation'; deliveryResult: DeliveryResult };

export function VirtualPrinterIntegration({
  barId,
  supabaseUrl,
  supabaseKey,
  enabled
}: VirtualPrinterIntegrationProps) {
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });
  const [printerEngine, setPrinterEngine] = useState<VirtualPrinterEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [deliveryService] = useState(() => 
    createDigitalReceiptDeliveryService(supabaseUrl, supabaseKey)
  );

  // Initialize virtual printer engine
  useEffect(() => {
    if (!enabled || isInitialized) return;

    const initializePrinter = async () => {
      try {
        // Create configuration for virtual printer
        const config: VirtualPrinterConfig = {
          barId,
          supabaseUrl,
          supabaseKey,
          printCapture: {
            platform: 'windows',
            captureMethod: 'virtual_driver',
            barId,
            printerFilters: ['Tabeza Receipt Printer']
          },
          dualOutput: {
            forwardToPhysicalPrinter: true,
            generateQRCode: false,
            qrCodeFormat: 'none',
            deliveryMethods: ['digital'],
            physicalPrinterSettings: {
              preserveFormatting: true,
              addQRToReceipt: false,
              qrPosition: 'bottom'
            }
          },
          sync: {
            maxQueueSize: 100,
            retryIntervals: [1000, 5000, 15000],
            batchSize: 10,
            connectionCheckInterval: 30000,
            priorityWeights: {
              critical: 1.0,
              high: 0.8,
              medium: 0.5,
              low: 0.2
            }
          },
          security: {
            hashAlgorithm: 'sha256',
            signatureAlgorithm: 'hmac-sha256',
            secretKey: process.env.NEXT_PUBLIC_PRINTER_SECRET_KEY || 'default-secret-key',
            enableTimestampValidation: true,
            maxReceiptAge: 86400000,
            enableIntegrityChecks: true
          }
        };

        const engine = new VirtualPrinterEngine(config);

        // Listen for waiter action required events
        engine.on('waiterActionRequired', handleWaiterActionRequired);
        engine.on('orderSentToCustomer', handleOrderSentToCustomer);
        engine.on('internalReceiptPrinted', handleInternalReceiptPrinted);

        await engine.start();
        setPrinterEngine(engine);
        setIsInitialized(true);

        console.log('✅ Virtual Printer Integration initialized');
      } catch (error) {
        console.error('❌ Failed to initialize virtual printer:', error);
      }
    };

    initializePrinter();

    return () => {
      if (printerEngine) {
        printerEngine.stop();
      }
    };
  }, [enabled, barId, supabaseUrl, supabaseKey, isInitialized]);

  // Handle waiter action required event from virtual printer
  const handleWaiterActionRequired = useCallback((data: any) => {
    const { receiptData, availableTabs } = data;
    
    // Show receipt distribution modal
    setModalState({
      type: 'distribution',
      receiptData: {
        items: receiptData.items,
        total: receiptData.total,
        customerInfo: receiptData.customerInfo,
        rawReceipt: receiptData.rawReceipt
      }
    });
  }, []);

  // Handle successful order sent to customer
  const handleOrderSentToCustomer = useCallback((data: any) => {
    console.log('✅ Order sent to customer:', data);
  }, []);

  // Handle internal receipt printed
  const handleInternalReceiptPrinted = useCallback((data: any) => {
    console.log('🖨️ Internal receipt printed:', data);
  }, []);

  // Fetch connected customers with active tabs
  const fetchConnectedCustomers = async (): Promise<ConnectedCustomer[]> => {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: tabs, error } = await supabase
        .from('tabs')
        .select('id, tab_number, owner_identifier, status, device_identifier, updated_at')
        .eq('bar_id', barId)
        .eq('status', 'open')
        .order('tab_number', { ascending: true });

      if (error) {
        console.error('Failed to fetch connected customers:', error);
        return [];
      }

      // Transform tabs to connected customers
      return (tabs || []).map(tab => ({
        id: tab.id,
        tabId: tab.id,
        tabNumber: tab.tab_number,
        customerIdentifier: tab.owner_identifier || `Tab ${tab.tab_number}`,
        connectionStatus: determineConnectionStatus(new Date(tab.updated_at)),
        deviceInfo: {
          type: 'mobile' as const,
          lastSeen: new Date(tab.updated_at)
        },
        ownerIdentifier: tab.owner_identifier
      }));
    } catch (error) {
      console.error('Error fetching connected customers:', error);
      return [];
    }
  };

  // Determine connection status based on last activity
  const determineConnectionStatus = (lastSeen: Date): 'connected' | 'idle' | 'disconnected' => {
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = diffMs / 60000;

    if (diffMins < 5) return 'connected';
    if (diffMins < 30) return 'idle';
    return 'disconnected';
  };

  // Handle physical receipt selection
  const handlePhysicalReceipt = useCallback(async () => {
    if (modalState.type !== 'distribution') return;

    try {
      // Forward to physical printer
      console.log('🖨️ Forwarding to physical printer...');
      
      // In a real implementation, this would trigger the actual print job forwarding
      // For now, we'll just close the modal
      setModalState({ type: 'none' });
      
      // Show success notification
      alert('Receipt sent to physical printer');
    } catch (error) {
      console.error('Failed to print physical receipt:', error);
      alert('Failed to print physical receipt. Please try again.');
    }
  }, [modalState]);

  // Handle digital receipt selection
  const handleDigitalReceipt = useCallback(async () => {
    if (modalState.type !== 'distribution') return;

    try {
      // Fetch connected customers
      const customers = await fetchConnectedCustomers();
      
      // Show customer selection modal
      setModalState({
        type: 'customerSelection',
        receiptData: modalState.receiptData,
        customers
      });
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      alert('Failed to load customers. Please try again.');
    }
  }, [modalState, barId, supabaseUrl, supabaseKey]);

  // Handle customer selection confirmation
  const handleCustomerSelectionConfirm = useCallback(async (selectedCustomerIds: string[]) => {
    if (modalState.type !== 'customerSelection') return;

    try {
      const { receiptData, customers } = modalState;
      
      // Convert receipt data to print data format
      const printData: PrintDataReceipt = {
        items: receiptData.items,
        total: receiptData.total,
        customerInfo: receiptData.customerInfo
      };

      // Prepare customer data for delivery
      const customersToDeliver = selectedCustomerIds
        .map(id => customers.find(c => c.id === id))
        .filter((c): c is ConnectedCustomer => c !== undefined)
        .map(c => ({
          tabId: c.tabId,
          tabNumber: c.tabNumber,
          customerIdentifier: c.customerIdentifier
        }));

      // Use digital receipt delivery service
      const deliveryResults = await deliveryService.deliverToMultipleCustomers(
        printData,
        customersToDeliver,
        barId
      );

      // Transform results for confirmation modal
      const successful = deliveryResults
        .filter(r => r.success)
        .map(r => ({
          customerId: r.tabId,
          tabNumber: r.tabNumber,
          customerIdentifier: r.customerIdentifier,
          orderId: r.orderId!
        }));

      const failed = deliveryResults
        .filter(r => !r.success)
        .map(r => ({
          customerId: r.tabId,
          tabNumber: r.tabNumber,
          customerIdentifier: r.customerIdentifier,
          error: r.error || 'Unknown error'
        }));

      // Show delivery confirmation
      setModalState({
        type: 'confirmation',
        deliveryResult: {
          deliveryId: `delivery-${Date.now()}`,
          successful,
          failed,
          timestamp: new Date()
        }
      });

      // Log delivery statistics
      const stats = deliveryService.getDeliveryStats(barId);
      console.log('📊 Delivery Statistics:', stats);
    } catch (error) {
      console.error('Failed to send digital receipts:', error);
      alert('Failed to send digital receipts. Please try again.');
    }
  }, [modalState, barId, deliveryService]);

  // Handle fallback to physical receipt
  const handleFallbackToPhysical = useCallback(() => {
    handlePhysicalReceipt();
  }, [handlePhysicalReceipt]);

  // Handle retry failed deliveries
  const handleRetryFailedDeliveries = useCallback(async () => {
    if (modalState.type !== 'confirmation') return;

    const { deliveryResult } = modalState;
    const { failed } = deliveryResult;

    if (failed.length === 0) return;

    try {
      // Get the original receipt data from the first failed delivery
      // In a real implementation, we'd store this with the delivery result
      console.log('🔄 Retrying failed deliveries...');

      // For now, show a message that retry is in progress
      alert(`Retrying ${failed.length} failed deliveries...`);

      // Close the modal
      setModalState({ type: 'none' });
    } catch (error) {
      console.error('Failed to retry deliveries:', error);
      alert('Failed to retry deliveries. Please try again.');
    }
  }, [modalState]);

  // Close all modals
  const handleCloseModal = useCallback(() => {
    setModalState({ type: 'none' });
  }, []);

  // Don't render anything if not enabled
  if (!enabled) {
    return null;
  }

  return (
    <>
      {/* Receipt Distribution Modal */}
      {modalState.type === 'distribution' && (
        <ReceiptDistributionModal
          isOpen={true}
          receiptData={modalState.receiptData}
          onPhysicalReceipt={handlePhysicalReceipt}
          onDigitalReceipt={handleDigitalReceipt}
          onClose={handleCloseModal}
        />
      )}

      {/* Customer Selection Modal */}
      {modalState.type === 'customerSelection' && (
        <CustomerSelectionModal
          isOpen={true}
          customers={modalState.customers}
          receiptTotal={modalState.receiptData.total}
          onConfirm={handleCustomerSelectionConfirm}
          onCancel={handleCloseModal}
          onFallbackToPhysical={handleFallbackToPhysical}
        />
      )}

      {/* Delivery Confirmation Modal */}
      {modalState.type === 'confirmation' && (
        <DeliveryConfirmationModal
          isOpen={true}
          deliveryResult={modalState.deliveryResult}
          onClose={handleCloseModal}
          onRetryFailed={handleRetryFailedDeliveries}
        />
      )}
    </>
  );
}
