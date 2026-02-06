/**
 * Virtual Printer Components
 * React-based UI components for POS receipt distribution workflow
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

export { ReceiptDistributionModal } from './ReceiptDistributionModal';
export type { ReceiptData, ReceiptDistributionModalProps } from './ReceiptDistributionModal';

export { CustomerSelectionModal } from './CustomerSelectionModal';
export type { ConnectedCustomer, CustomerSelectionModalProps } from './CustomerSelectionModal';

export { DeliveryConfirmationModal } from './DeliveryConfirmationModal';
export type { DeliveryResult, DeliveryConfirmationModalProps } from './DeliveryConfirmationModal';

export { VirtualPrinterIntegration } from './VirtualPrinterIntegration';
export type { VirtualPrinterIntegrationProps } from './VirtualPrinterIntegration';
