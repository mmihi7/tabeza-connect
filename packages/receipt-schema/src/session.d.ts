/**
 * TABEZA Receipt Session Schema v1
 * Session-based, multi-order transaction truth infrastructure
 *
 * Core Concept: A single TABEZA receipt may contain multiple POS print events
 * (orders, partial bills, refunds), with shared headers and final settlement.
 */
import { z } from 'zod';
export declare const MerchantSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kra_pin: z.ZodOptional<z.ZodString>;
    registration_no: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    kra_pin?: string | undefined;
    registration_no?: string | undefined;
    location?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
}, {
    id: string;
    name: string;
    kra_pin?: string | undefined;
    registration_no?: string | undefined;
    location?: string | undefined;
    address?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
}>;
export declare const DeviceSchema: z.ZodObject<{
    printer_id: z.ZodString;
    pos_hint: z.ZodOptional<z.ZodString>;
    connection_type: z.ZodOptional<z.ZodEnum<["USB", "NETWORK", "BLUETOOTH", "SERIAL"]>>;
    location: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    printer_id: string;
    location?: string | undefined;
    pos_hint?: string | undefined;
    connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
}, {
    printer_id: string;
    location?: string | undefined;
    pos_hint?: string | undefined;
    connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
}>;
export declare const ReceiptSessionSchema: z.ZodObject<{
    tabeza_receipt_id: z.ZodString;
    session_reference: z.ZodString;
    merchant: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kra_pin: z.ZodOptional<z.ZodString>;
        registration_no: z.ZodOptional<z.ZodString>;
        location: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        kra_pin?: string | undefined;
        registration_no?: string | undefined;
        location?: string | undefined;
        address?: string | undefined;
        phone?: string | undefined;
        email?: string | undefined;
    }, {
        id: string;
        name: string;
        kra_pin?: string | undefined;
        registration_no?: string | undefined;
        location?: string | undefined;
        address?: string | undefined;
        phone?: string | undefined;
        email?: string | undefined;
    }>;
    device: z.ZodObject<{
        printer_id: z.ZodString;
        pos_hint: z.ZodOptional<z.ZodString>;
        connection_type: z.ZodOptional<z.ZodEnum<["USB", "NETWORK", "BLUETOOTH", "SERIAL"]>>;
        location: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        printer_id: string;
        location?: string | undefined;
        pos_hint?: string | undefined;
        connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
    }, {
        printer_id: string;
        location?: string | undefined;
        pos_hint?: string | undefined;
        connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
    }>;
    opened_at: z.ZodString;
    closed_at: z.ZodOptional<z.ZodString>;
    currency: z.ZodLiteral<"KES">;
    status: z.ZodEnum<["OPEN", "CLOSED"]>;
    table_number: z.ZodOptional<z.ZodString>;
    customer_identifier: z.ZodOptional<z.ZodString>;
    staff_identifier: z.ZodOptional<z.ZodString>;
    compliance_hints: z.ZodOptional<z.ZodObject<{
        jurisdiction: z.ZodOptional<z.ZodEnum<["KE", "UG", "TZ", "RW"]>>;
        business_category: z.ZodOptional<z.ZodEnum<["RESTAURANT", "RETAIL", "SERVICE", "OTHER"]>>;
        requires_tax_submission: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
        business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
        requires_tax_submission?: boolean | undefined;
    }, {
        jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
        business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
        requires_tax_submission?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "OPEN" | "CLOSED";
    tabeza_receipt_id: string;
    session_reference: string;
    merchant: {
        id: string;
        name: string;
        kra_pin?: string | undefined;
        registration_no?: string | undefined;
        location?: string | undefined;
        address?: string | undefined;
        phone?: string | undefined;
        email?: string | undefined;
    };
    device: {
        printer_id: string;
        location?: string | undefined;
        pos_hint?: string | undefined;
        connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
    };
    opened_at: string;
    currency: "KES";
    closed_at?: string | undefined;
    table_number?: string | undefined;
    customer_identifier?: string | undefined;
    staff_identifier?: string | undefined;
    compliance_hints?: {
        jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
        business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
        requires_tax_submission?: boolean | undefined;
    } | undefined;
}, {
    status: "OPEN" | "CLOSED";
    tabeza_receipt_id: string;
    session_reference: string;
    merchant: {
        id: string;
        name: string;
        kra_pin?: string | undefined;
        registration_no?: string | undefined;
        location?: string | undefined;
        address?: string | undefined;
        phone?: string | undefined;
        email?: string | undefined;
    };
    device: {
        printer_id: string;
        location?: string | undefined;
        pos_hint?: string | undefined;
        connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
    };
    opened_at: string;
    currency: "KES";
    closed_at?: string | undefined;
    table_number?: string | undefined;
    customer_identifier?: string | undefined;
    staff_identifier?: string | undefined;
    compliance_hints?: {
        jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
        business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
        requires_tax_submission?: boolean | undefined;
    } | undefined;
}>;
export declare const LineItemSchema: z.ZodObject<{
    name: z.ZodString;
    sku: z.ZodOptional<z.ZodString>;
    qty: z.ZodNumber;
    unit_price: z.ZodNumber;
    total_price: z.ZodNumber;
    tax_rate: z.ZodOptional<z.ZodNumber>;
    tax_amount: z.ZodOptional<z.ZodNumber>;
    discount_amount: z.ZodOptional<z.ZodNumber>;
    category: z.ZodOptional<z.ZodString>;
    modifiers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    qty: number;
    unit_price: number;
    total_price: number;
    sku?: string | undefined;
    tax_rate?: number | undefined;
    tax_amount?: number | undefined;
    discount_amount?: number | undefined;
    category?: string | undefined;
    modifiers?: string[] | undefined;
}, {
    name: string;
    qty: number;
    unit_price: number;
    total_price: number;
    sku?: string | undefined;
    tax_rate?: number | undefined;
    tax_amount?: number | undefined;
    discount_amount?: number | undefined;
    category?: string | undefined;
    modifiers?: string[] | undefined;
}>;
export declare const EventTotalsSchema: z.ZodObject<{
    subtotal: z.ZodNumber;
    tax: z.ZodNumber;
    discount: z.ZodNumber;
    service_charge: z.ZodNumber;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    subtotal: number;
    tax: number;
    discount: number;
    service_charge: number;
    total: number;
}, {
    subtotal: number;
    tax: number;
    discount: number;
    service_charge: number;
    total: number;
}>;
export declare const PaymentSchema: z.ZodObject<{
    method: z.ZodEnum<["MPESA", "CASH", "CARD", "BANK", "OTHER"]>;
    reference: z.ZodOptional<z.ZodString>;
    amount: z.ZodNumber;
    currency: z.ZodLiteral<"KES">;
    processed_at: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["PENDING", "COMPLETED", "FAILED", "CANCELLED"]>>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
    currency: "KES";
    method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
    amount: number;
    reference?: string | undefined;
    processed_at?: string | undefined;
}, {
    currency: "KES";
    method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
    amount: number;
    status?: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
    reference?: string | undefined;
    processed_at?: string | undefined;
}>;
export declare const ReceiptEventSchema: z.ZodObject<{
    event_id: z.ZodString;
    session_id: z.ZodString;
    source_receipt_no: z.ZodOptional<z.ZodString>;
    printed_at: z.ZodString;
    type: z.ZodEnum<["SALE", "REFUND", "VOID", "ADJUSTMENT", "PARTIAL_BILL"]>;
    sequence: z.ZodNumber;
    items: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        sku: z.ZodOptional<z.ZodString>;
        qty: z.ZodNumber;
        unit_price: z.ZodNumber;
        total_price: z.ZodNumber;
        tax_rate: z.ZodOptional<z.ZodNumber>;
        tax_amount: z.ZodOptional<z.ZodNumber>;
        discount_amount: z.ZodOptional<z.ZodNumber>;
        category: z.ZodOptional<z.ZodString>;
        modifiers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        qty: number;
        unit_price: number;
        total_price: number;
        sku?: string | undefined;
        tax_rate?: number | undefined;
        tax_amount?: number | undefined;
        discount_amount?: number | undefined;
        category?: string | undefined;
        modifiers?: string[] | undefined;
    }, {
        name: string;
        qty: number;
        unit_price: number;
        total_price: number;
        sku?: string | undefined;
        tax_rate?: number | undefined;
        tax_amount?: number | undefined;
        discount_amount?: number | undefined;
        category?: string | undefined;
        modifiers?: string[] | undefined;
    }>, "many">;
    totals: z.ZodObject<{
        subtotal: z.ZodNumber;
        tax: z.ZodNumber;
        discount: z.ZodNumber;
        service_charge: z.ZodNumber;
        total: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        subtotal: number;
        tax: number;
        discount: number;
        service_charge: number;
        total: number;
    }, {
        subtotal: number;
        tax: number;
        discount: number;
        service_charge: number;
        total: number;
    }>;
    payment: z.ZodOptional<z.ZodObject<{
        method: z.ZodEnum<["MPESA", "CASH", "CARD", "BANK", "OTHER"]>;
        reference: z.ZodOptional<z.ZodString>;
        amount: z.ZodNumber;
        currency: z.ZodLiteral<"KES">;
        processed_at: z.ZodOptional<z.ZodString>;
        status: z.ZodDefault<z.ZodEnum<["PENDING", "COMPLETED", "FAILED", "CANCELLED"]>>;
    }, "strip", z.ZodTypeAny, {
        status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
        currency: "KES";
        method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
        amount: number;
        reference?: string | undefined;
        processed_at?: string | undefined;
    }, {
        currency: "KES";
        method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
        amount: number;
        status?: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
        reference?: string | undefined;
        processed_at?: string | undefined;
    }>>;
    raw_hash: z.ZodString;
    parsed_confidence: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
    staff_notes: z.ZodOptional<z.ZodString>;
    customer_notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "SALE" | "REFUND" | "VOID" | "ADJUSTMENT" | "PARTIAL_BILL";
    event_id: string;
    session_id: string;
    printed_at: string;
    sequence: number;
    items: {
        name: string;
        qty: number;
        unit_price: number;
        total_price: number;
        sku?: string | undefined;
        tax_rate?: number | undefined;
        tax_amount?: number | undefined;
        discount_amount?: number | undefined;
        category?: string | undefined;
        modifiers?: string[] | undefined;
    }[];
    totals: {
        subtotal: number;
        tax: number;
        discount: number;
        service_charge: number;
        total: number;
    };
    raw_hash: string;
    parsed_confidence: number;
    source_receipt_no?: string | undefined;
    payment?: {
        status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
        currency: "KES";
        method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
        amount: number;
        reference?: string | undefined;
        processed_at?: string | undefined;
    } | undefined;
    notes?: string | undefined;
    staff_notes?: string | undefined;
    customer_notes?: string | undefined;
}, {
    type: "SALE" | "REFUND" | "VOID" | "ADJUSTMENT" | "PARTIAL_BILL";
    event_id: string;
    session_id: string;
    printed_at: string;
    sequence: number;
    items: {
        name: string;
        qty: number;
        unit_price: number;
        total_price: number;
        sku?: string | undefined;
        tax_rate?: number | undefined;
        tax_amount?: number | undefined;
        discount_amount?: number | undefined;
        category?: string | undefined;
        modifiers?: string[] | undefined;
    }[];
    totals: {
        subtotal: number;
        tax: number;
        discount: number;
        service_charge: number;
        total: number;
    };
    raw_hash: string;
    parsed_confidence: number;
    source_receipt_no?: string | undefined;
    payment?: {
        currency: "KES";
        method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
        amount: number;
        status?: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
        reference?: string | undefined;
        processed_at?: string | undefined;
    } | undefined;
    notes?: string | undefined;
    staff_notes?: string | undefined;
    customer_notes?: string | undefined;
}>;
export declare const SessionTotalsSchema: z.ZodObject<{
    subtotal: z.ZodNumber;
    tax: z.ZodNumber;
    discount: z.ZodNumber;
    service_charge: z.ZodNumber;
    total: z.ZodNumber;
    paid: z.ZodNumber;
    balance: z.ZodOptional<z.ZodNumber>;
    total_events: z.ZodNumber;
    sale_events: z.ZodNumber;
    refund_events: z.ZodNumber;
    void_events: z.ZodNumber;
    computed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    subtotal: number;
    tax: number;
    discount: number;
    service_charge: number;
    total: number;
    paid: number;
    total_events: number;
    sale_events: number;
    refund_events: number;
    void_events: number;
    computed_at: string;
    balance?: number | undefined;
}, {
    subtotal: number;
    tax: number;
    discount: number;
    service_charge: number;
    total: number;
    paid: number;
    total_events: number;
    sale_events: number;
    refund_events: number;
    void_events: number;
    computed_at: string;
    balance?: number | undefined;
}>;
export declare const CompleteReceiptSessionSchema: z.ZodObject<{
    session: z.ZodObject<{
        tabeza_receipt_id: z.ZodString;
        session_reference: z.ZodString;
        merchant: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            kra_pin: z.ZodOptional<z.ZodString>;
            registration_no: z.ZodOptional<z.ZodString>;
            location: z.ZodOptional<z.ZodString>;
            address: z.ZodOptional<z.ZodString>;
            phone: z.ZodOptional<z.ZodString>;
            email: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
            kra_pin?: string | undefined;
            registration_no?: string | undefined;
            location?: string | undefined;
            address?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        }, {
            id: string;
            name: string;
            kra_pin?: string | undefined;
            registration_no?: string | undefined;
            location?: string | undefined;
            address?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        }>;
        device: z.ZodObject<{
            printer_id: z.ZodString;
            pos_hint: z.ZodOptional<z.ZodString>;
            connection_type: z.ZodOptional<z.ZodEnum<["USB", "NETWORK", "BLUETOOTH", "SERIAL"]>>;
            location: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            printer_id: string;
            location?: string | undefined;
            pos_hint?: string | undefined;
            connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
        }, {
            printer_id: string;
            location?: string | undefined;
            pos_hint?: string | undefined;
            connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
        }>;
        opened_at: z.ZodString;
        closed_at: z.ZodOptional<z.ZodString>;
        currency: z.ZodLiteral<"KES">;
        status: z.ZodEnum<["OPEN", "CLOSED"]>;
        table_number: z.ZodOptional<z.ZodString>;
        customer_identifier: z.ZodOptional<z.ZodString>;
        staff_identifier: z.ZodOptional<z.ZodString>;
        compliance_hints: z.ZodOptional<z.ZodObject<{
            jurisdiction: z.ZodOptional<z.ZodEnum<["KE", "UG", "TZ", "RW"]>>;
            business_category: z.ZodOptional<z.ZodEnum<["RESTAURANT", "RETAIL", "SERVICE", "OTHER"]>>;
            requires_tax_submission: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
            business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
            requires_tax_submission?: boolean | undefined;
        }, {
            jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
            business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
            requires_tax_submission?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "OPEN" | "CLOSED";
        tabeza_receipt_id: string;
        session_reference: string;
        merchant: {
            id: string;
            name: string;
            kra_pin?: string | undefined;
            registration_no?: string | undefined;
            location?: string | undefined;
            address?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        };
        device: {
            printer_id: string;
            location?: string | undefined;
            pos_hint?: string | undefined;
            connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
        };
        opened_at: string;
        currency: "KES";
        closed_at?: string | undefined;
        table_number?: string | undefined;
        customer_identifier?: string | undefined;
        staff_identifier?: string | undefined;
        compliance_hints?: {
            jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
            business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
            requires_tax_submission?: boolean | undefined;
        } | undefined;
    }, {
        status: "OPEN" | "CLOSED";
        tabeza_receipt_id: string;
        session_reference: string;
        merchant: {
            id: string;
            name: string;
            kra_pin?: string | undefined;
            registration_no?: string | undefined;
            location?: string | undefined;
            address?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        };
        device: {
            printer_id: string;
            location?: string | undefined;
            pos_hint?: string | undefined;
            connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
        };
        opened_at: string;
        currency: "KES";
        closed_at?: string | undefined;
        table_number?: string | undefined;
        customer_identifier?: string | undefined;
        staff_identifier?: string | undefined;
        compliance_hints?: {
            jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
            business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
            requires_tax_submission?: boolean | undefined;
        } | undefined;
    }>;
    events: z.ZodArray<z.ZodObject<{
        event_id: z.ZodString;
        session_id: z.ZodString;
        source_receipt_no: z.ZodOptional<z.ZodString>;
        printed_at: z.ZodString;
        type: z.ZodEnum<["SALE", "REFUND", "VOID", "ADJUSTMENT", "PARTIAL_BILL"]>;
        sequence: z.ZodNumber;
        items: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            sku: z.ZodOptional<z.ZodString>;
            qty: z.ZodNumber;
            unit_price: z.ZodNumber;
            total_price: z.ZodNumber;
            tax_rate: z.ZodOptional<z.ZodNumber>;
            tax_amount: z.ZodOptional<z.ZodNumber>;
            discount_amount: z.ZodOptional<z.ZodNumber>;
            category: z.ZodOptional<z.ZodString>;
            modifiers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            qty: number;
            unit_price: number;
            total_price: number;
            sku?: string | undefined;
            tax_rate?: number | undefined;
            tax_amount?: number | undefined;
            discount_amount?: number | undefined;
            category?: string | undefined;
            modifiers?: string[] | undefined;
        }, {
            name: string;
            qty: number;
            unit_price: number;
            total_price: number;
            sku?: string | undefined;
            tax_rate?: number | undefined;
            tax_amount?: number | undefined;
            discount_amount?: number | undefined;
            category?: string | undefined;
            modifiers?: string[] | undefined;
        }>, "many">;
        totals: z.ZodObject<{
            subtotal: z.ZodNumber;
            tax: z.ZodNumber;
            discount: z.ZodNumber;
            service_charge: z.ZodNumber;
            total: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            subtotal: number;
            tax: number;
            discount: number;
            service_charge: number;
            total: number;
        }, {
            subtotal: number;
            tax: number;
            discount: number;
            service_charge: number;
            total: number;
        }>;
        payment: z.ZodOptional<z.ZodObject<{
            method: z.ZodEnum<["MPESA", "CASH", "CARD", "BANK", "OTHER"]>;
            reference: z.ZodOptional<z.ZodString>;
            amount: z.ZodNumber;
            currency: z.ZodLiteral<"KES">;
            processed_at: z.ZodOptional<z.ZodString>;
            status: z.ZodDefault<z.ZodEnum<["PENDING", "COMPLETED", "FAILED", "CANCELLED"]>>;
        }, "strip", z.ZodTypeAny, {
            status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
            currency: "KES";
            method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
            amount: number;
            reference?: string | undefined;
            processed_at?: string | undefined;
        }, {
            currency: "KES";
            method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
            amount: number;
            status?: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
            reference?: string | undefined;
            processed_at?: string | undefined;
        }>>;
        raw_hash: z.ZodString;
        parsed_confidence: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
        staff_notes: z.ZodOptional<z.ZodString>;
        customer_notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "SALE" | "REFUND" | "VOID" | "ADJUSTMENT" | "PARTIAL_BILL";
        event_id: string;
        session_id: string;
        printed_at: string;
        sequence: number;
        items: {
            name: string;
            qty: number;
            unit_price: number;
            total_price: number;
            sku?: string | undefined;
            tax_rate?: number | undefined;
            tax_amount?: number | undefined;
            discount_amount?: number | undefined;
            category?: string | undefined;
            modifiers?: string[] | undefined;
        }[];
        totals: {
            subtotal: number;
            tax: number;
            discount: number;
            service_charge: number;
            total: number;
        };
        raw_hash: string;
        parsed_confidence: number;
        source_receipt_no?: string | undefined;
        payment?: {
            status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
            currency: "KES";
            method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
            amount: number;
            reference?: string | undefined;
            processed_at?: string | undefined;
        } | undefined;
        notes?: string | undefined;
        staff_notes?: string | undefined;
        customer_notes?: string | undefined;
    }, {
        type: "SALE" | "REFUND" | "VOID" | "ADJUSTMENT" | "PARTIAL_BILL";
        event_id: string;
        session_id: string;
        printed_at: string;
        sequence: number;
        items: {
            name: string;
            qty: number;
            unit_price: number;
            total_price: number;
            sku?: string | undefined;
            tax_rate?: number | undefined;
            tax_amount?: number | undefined;
            discount_amount?: number | undefined;
            category?: string | undefined;
            modifiers?: string[] | undefined;
        }[];
        totals: {
            subtotal: number;
            tax: number;
            discount: number;
            service_charge: number;
            total: number;
        };
        raw_hash: string;
        parsed_confidence: number;
        source_receipt_no?: string | undefined;
        payment?: {
            currency: "KES";
            method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
            amount: number;
            status?: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
            reference?: string | undefined;
            processed_at?: string | undefined;
        } | undefined;
        notes?: string | undefined;
        staff_notes?: string | undefined;
        customer_notes?: string | undefined;
    }>, "many">;
    totals: z.ZodOptional<z.ZodObject<{
        subtotal: z.ZodNumber;
        tax: z.ZodNumber;
        discount: z.ZodNumber;
        service_charge: z.ZodNumber;
        total: z.ZodNumber;
        paid: z.ZodNumber;
        balance: z.ZodOptional<z.ZodNumber>;
        total_events: z.ZodNumber;
        sale_events: z.ZodNumber;
        refund_events: z.ZodNumber;
        void_events: z.ZodNumber;
        computed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        subtotal: number;
        tax: number;
        discount: number;
        service_charge: number;
        total: number;
        paid: number;
        total_events: number;
        sale_events: number;
        refund_events: number;
        void_events: number;
        computed_at: string;
        balance?: number | undefined;
    }, {
        subtotal: number;
        tax: number;
        discount: number;
        service_charge: number;
        total: number;
        paid: number;
        total_events: number;
        sale_events: number;
        refund_events: number;
        void_events: number;
        computed_at: string;
        balance?: number | undefined;
    }>>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    version: z.ZodLiteral<"1.0.0">;
}, "strip", z.ZodTypeAny, {
    session: {
        status: "OPEN" | "CLOSED";
        tabeza_receipt_id: string;
        session_reference: string;
        merchant: {
            id: string;
            name: string;
            kra_pin?: string | undefined;
            registration_no?: string | undefined;
            location?: string | undefined;
            address?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        };
        device: {
            printer_id: string;
            location?: string | undefined;
            pos_hint?: string | undefined;
            connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
        };
        opened_at: string;
        currency: "KES";
        closed_at?: string | undefined;
        table_number?: string | undefined;
        customer_identifier?: string | undefined;
        staff_identifier?: string | undefined;
        compliance_hints?: {
            jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
            business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
            requires_tax_submission?: boolean | undefined;
        } | undefined;
    };
    events: {
        type: "SALE" | "REFUND" | "VOID" | "ADJUSTMENT" | "PARTIAL_BILL";
        event_id: string;
        session_id: string;
        printed_at: string;
        sequence: number;
        items: {
            name: string;
            qty: number;
            unit_price: number;
            total_price: number;
            sku?: string | undefined;
            tax_rate?: number | undefined;
            tax_amount?: number | undefined;
            discount_amount?: number | undefined;
            category?: string | undefined;
            modifiers?: string[] | undefined;
        }[];
        totals: {
            subtotal: number;
            tax: number;
            discount: number;
            service_charge: number;
            total: number;
        };
        raw_hash: string;
        parsed_confidence: number;
        source_receipt_no?: string | undefined;
        payment?: {
            status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
            currency: "KES";
            method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
            amount: number;
            reference?: string | undefined;
            processed_at?: string | undefined;
        } | undefined;
        notes?: string | undefined;
        staff_notes?: string | undefined;
        customer_notes?: string | undefined;
    }[];
    created_at: string;
    updated_at: string;
    version: "1.0.0";
    totals?: {
        subtotal: number;
        tax: number;
        discount: number;
        service_charge: number;
        total: number;
        paid: number;
        total_events: number;
        sale_events: number;
        refund_events: number;
        void_events: number;
        computed_at: string;
        balance?: number | undefined;
    } | undefined;
}, {
    session: {
        status: "OPEN" | "CLOSED";
        tabeza_receipt_id: string;
        session_reference: string;
        merchant: {
            id: string;
            name: string;
            kra_pin?: string | undefined;
            registration_no?: string | undefined;
            location?: string | undefined;
            address?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        };
        device: {
            printer_id: string;
            location?: string | undefined;
            pos_hint?: string | undefined;
            connection_type?: "USB" | "NETWORK" | "BLUETOOTH" | "SERIAL" | undefined;
        };
        opened_at: string;
        currency: "KES";
        closed_at?: string | undefined;
        table_number?: string | undefined;
        customer_identifier?: string | undefined;
        staff_identifier?: string | undefined;
        compliance_hints?: {
            jurisdiction?: "KE" | "UG" | "TZ" | "RW" | undefined;
            business_category?: "RESTAURANT" | "RETAIL" | "SERVICE" | "OTHER" | undefined;
            requires_tax_submission?: boolean | undefined;
        } | undefined;
    };
    events: {
        type: "SALE" | "REFUND" | "VOID" | "ADJUSTMENT" | "PARTIAL_BILL";
        event_id: string;
        session_id: string;
        printed_at: string;
        sequence: number;
        items: {
            name: string;
            qty: number;
            unit_price: number;
            total_price: number;
            sku?: string | undefined;
            tax_rate?: number | undefined;
            tax_amount?: number | undefined;
            discount_amount?: number | undefined;
            category?: string | undefined;
            modifiers?: string[] | undefined;
        }[];
        totals: {
            subtotal: number;
            tax: number;
            discount: number;
            service_charge: number;
            total: number;
        };
        raw_hash: string;
        parsed_confidence: number;
        source_receipt_no?: string | undefined;
        payment?: {
            currency: "KES";
            method: "OTHER" | "MPESA" | "CASH" | "CARD" | "BANK";
            amount: number;
            status?: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
            reference?: string | undefined;
            processed_at?: string | undefined;
        } | undefined;
        notes?: string | undefined;
        staff_notes?: string | undefined;
        customer_notes?: string | undefined;
    }[];
    created_at: string;
    updated_at: string;
    version: "1.0.0";
    totals?: {
        subtotal: number;
        tax: number;
        discount: number;
        service_charge: number;
        total: number;
        paid: number;
        total_events: number;
        sale_events: number;
        refund_events: number;
        void_events: number;
        computed_at: string;
        balance?: number | undefined;
    } | undefined;
}>;
export declare const AuditEventSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["SESSION_OPENED", "RECEIPT_CAPTURED", "SESSION_CLOSED", "PAYMENT_PROCESSED", "ETIMS_SUBMITTED", "COMPLIANCE_CHECKED", "DATA_CORRECTED"]>;
    entity_id: z.ZodString;
    entity_type: z.ZodEnum<["SESSION", "EVENT", "PAYMENT"]>;
    timestamp: z.ZodString;
    actor: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<["PRINTER", "STAFF", "SYSTEM", "API"]>;
    hash: z.ZodString;
    previous_hash: z.ZodOptional<z.ZodString>;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "SESSION_OPENED" | "RECEIPT_CAPTURED" | "SESSION_CLOSED" | "PAYMENT_PROCESSED" | "ETIMS_SUBMITTED" | "COMPLIANCE_CHECKED" | "DATA_CORRECTED";
    entity_id: string;
    entity_type: "SESSION" | "EVENT" | "PAYMENT";
    timestamp: string;
    source: "PRINTER" | "STAFF" | "SYSTEM" | "API";
    hash: string;
    actor?: string | undefined;
    previous_hash?: string | undefined;
    data?: Record<string, any> | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    id: string;
    type: "SESSION_OPENED" | "RECEIPT_CAPTURED" | "SESSION_CLOSED" | "PAYMENT_PROCESSED" | "ETIMS_SUBMITTED" | "COMPLIANCE_CHECKED" | "DATA_CORRECTED";
    entity_id: string;
    entity_type: "SESSION" | "EVENT" | "PAYMENT";
    timestamp: string;
    source: "PRINTER" | "STAFF" | "SYSTEM" | "API";
    hash: string;
    actor?: string | undefined;
    previous_hash?: string | undefined;
    data?: Record<string, any> | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export type Merchant = z.infer<typeof MerchantSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type ReceiptSession = z.infer<typeof ReceiptSessionSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type EventTotals = z.infer<typeof EventTotalsSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type ReceiptEvent = z.infer<typeof ReceiptEventSchema>;
export type SessionTotals = z.infer<typeof SessionTotalsSchema>;
export type CompleteReceiptSession = z.infer<typeof CompleteReceiptSessionSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export declare const ReceiptEventType: {
    readonly SALE: "SALE";
    readonly REFUND: "REFUND";
    readonly VOID: "VOID";
    readonly ADJUSTMENT: "ADJUSTMENT";
    readonly PARTIAL_BILL: "PARTIAL_BILL";
};
export declare const SessionStatus: {
    readonly OPEN: "OPEN";
    readonly CLOSED: "CLOSED";
};
export declare const PaymentMethod: {
    readonly MPESA: "MPESA";
    readonly CASH: "CASH";
    readonly CARD: "CARD";
    readonly BANK: "BANK";
    readonly OTHER: "OTHER";
};
export declare const PaymentStatus: {
    readonly PENDING: "PENDING";
    readonly COMPLETED: "COMPLETED";
    readonly FAILED: "FAILED";
    readonly CANCELLED: "CANCELLED";
};
export declare const AuditEventType: {
    readonly SESSION_OPENED: "SESSION_OPENED";
    readonly RECEIPT_CAPTURED: "RECEIPT_CAPTURED";
    readonly SESSION_CLOSED: "SESSION_CLOSED";
    readonly PAYMENT_PROCESSED: "PAYMENT_PROCESSED";
    readonly ETIMS_SUBMITTED: "ETIMS_SUBMITTED";
    readonly COMPLIANCE_CHECKED: "COMPLIANCE_CHECKED";
    readonly DATA_CORRECTED: "DATA_CORRECTED";
};
/**
 * Validate that event totals are mathematically correct
 */
export declare function validateEventTotals(totals: EventTotals): boolean;
/**
 * Validate that session totals match aggregated events
 */
export declare function validateSessionTotals(sessionTotals: SessionTotals, events: ReceiptEvent[]): boolean;
/**
 * Check if a session can be closed
 */
export declare function canCloseSession(session: ReceiptSession, events: ReceiptEvent[]): boolean;
/**
 * Compute session totals from events (alias for createSessionTotals)
 */
export declare function computeSessionTotals(events: ReceiptEvent[]): SessionTotals;
//# sourceMappingURL=session.d.ts.map