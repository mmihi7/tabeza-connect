/**
 * Session Manager
 * Manages receipt sessions using the TABEZA receipt schema
 */

import { EventEmitter } from 'events';
import { 
  CompleteReceiptSession, 
  ReceiptSession, 
  ReceiptEvent,
  SessionTotals,
  SessionStatus,
  createReceiptSession,
  createReceiptEvent,
  computeSessionTotals
} from '@tabeza/receipt-schema';
import { LocalStore } from './local-store';
import { Logger } from '../utils/logger';

export interface ActiveSession {
  session: ReceiptSession;
  events: ReceiptEvent[];
  lastActivity: Date;
}

export class SessionManager extends EventEmitter {
  private localStore: LocalStore;
  private logger = Logger.getInstance();
  private activeSessions = new Map<string, ActiveSession>();
  private sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes

  constructor(localStore: LocalStore) {
    super();
    this.localStore = localStore;
    this.startSessionCleanup();
  }

  /**
   * Update session with new receipt data
   */
  async updateSession(receipt: CompleteReceiptSession): Promise<void> {
    const sessionId = receipt.session.session_reference;
    
    try {
      // Get or create active session
      let activeSession = this.activeSessions.get(sessionId);
      
      if (!activeSession) {
        activeSession = {
          session: receipt.session,
          events: receipt.events,
          lastActivity: new Date()
        };
        this.activeSessions.set(sessionId, activeSession);
        this.logger.info('Created new active session', { sessionId });
      } else {
        // Update existing session with new events
        const newEvents = receipt.events.filter(event => 
          !activeSession!.events.some(existing => existing.event_id === event.event_id)
        );
        
        activeSession.events.push(...newEvents);
        activeSession.lastActivity = new Date();
        
        this.logger.debug('Updated active session', { 
          sessionId, 
          newEventsCount: newEvents.length 
        });
      }

      // Check if session should be closed
      if (this.shouldCloseSession(activeSession)) {
        await this.closeSession(sessionId);
      }

      this.emit('session-updated', { sessionId, session: activeSession });

    } catch (error) {
      this.logger.error('Failed to update session:', error, { sessionId });
      throw error;
    }
  }

  /**
   * Create a new receipt session
   */
  async createSession(
    merchantId: string,
    sessionReference: string,
    tableNumber?: string,
    customerIdentifier?: string
  ): Promise<ReceiptSession> {
    try {
      const session = createReceiptSession({
        merchantId,
        merchantName: merchantId, // Use merchantId as name for now
        printerId: 'default-printer',
        tableNumber,
        customerIdentifier
      });

      const activeSession: ActiveSession = {
        session,
        events: [],
        lastActivity: new Date()
      };

      this.activeSessions.set(sessionReference, activeSession);
      
      this.logger.info('Created new session', { 
        sessionId: sessionReference,
        merchantId,
        tableNumber 
      });

      this.emit('session-created', { sessionId: sessionReference, session });
      return session;

    } catch (error) {
      this.logger.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Close a session and compute final totals
   */
  async closeSession(sessionId: string): Promise<CompleteReceiptSession | null> {
    const activeSession = this.activeSessions.get(sessionId);
    
    if (!activeSession) {
      this.logger.warn('Attempted to close non-existent session', { sessionId });
      return null;
    }

    try {
      // Update session status to closed
      const closedSession: ReceiptSession = {
        ...activeSession.session,
        status: SessionStatus.CLOSED,
        closed_at: new Date().toISOString()
      };

      // Compute final totals
      const totals = computeSessionTotals(activeSession.events);

      // Create complete session
      const completeSession: CompleteReceiptSession = {
        session: closedSession,
        events: activeSession.events,
        totals,
        created_at: activeSession.session.opened_at,
        updated_at: new Date().toISOString(),
        version: '1.0.0'
      };

      // Store in local database
      await this.storeCompletedSession(completeSession);

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      this.logger.info('Session closed successfully', { 
        sessionId,
        eventsCount: activeSession.events.length,
        totalAmount: totals.total 
      });

      this.emit('session-closed', { sessionId, session: completeSession });
      return completeSession;

    } catch (error) {
      this.logger.error('Failed to close session:', error, { sessionId });
      throw error;
    }
  }

  /**
   * Get active session by ID
   */
  getActiveSession(sessionId: string): ActiveSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Map<string, ActiveSession> {
    return new Map(this.activeSessions);
  }

  /**
   * Check if session should be closed based on business logic
   */
  private shouldCloseSession(activeSession: ActiveSession): boolean {
    // Close if session has been inactive for too long
    const inactiveTime = Date.now() - activeSession.lastActivity.getTime();
    if (inactiveTime > this.sessionTimeoutMs) {
      return true;
    }

    // Close if session has payment events that complete the transaction
    const hasCompletedPayment = activeSession.events.some(event => 
      event.payment && event.payment.status === 'COMPLETED'
    );

    // Close if total is paid (simple logic - can be enhanced)
    if (hasCompletedPayment && activeSession.events.length > 0) {
      const totals = computeSessionTotals(activeSession.events);
      return (totals.balance || 0) <= 0.01; // Allow 1 cent tolerance
    }

    return false;
  }

  /**
   * Store completed session in local database
   */
  private async storeCompletedSession(session: CompleteReceiptSession): Promise<void> {
    try {
      // Store session record
      await this.localStore.addToSyncQueue({
        id: `session_${session.session.session_reference}`,
        type: 'session',
        data: session,
        priority: 'high'
      });

      // Log audit event
      this.localStore.logAuditEvent({
        eventType: 'SESSION_CLOSED',
        entityId: session.session.session_reference,
        entityType: 'SESSION',
        data: {
          eventsCount: session.events.length,
          totalAmount: session.totals?.total || 0,
          closedAt: session.session.closed_at
        }
      });

      this.logger.debug('Stored completed session', { 
        sessionId: session.session.session_reference 
      });

    } catch (error) {
      this.logger.error('Failed to store completed session:', error);
      throw error;
    }
  }

  /**
   * Start periodic cleanup of inactive sessions
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Clean up inactive sessions
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToClose: string[] = [];

    for (const [sessionId, activeSession] of this.activeSessions) {
      const inactiveTime = now - activeSession.lastActivity.getTime();
      
      if (inactiveTime > this.sessionTimeoutMs) {
        sessionsToClose.push(sessionId);
      }
    }

    for (const sessionId of sessionsToClose) {
      try {
        await this.closeSession(sessionId);
        this.logger.info('Auto-closed inactive session', { sessionId });
      } catch (error) {
        this.logger.error('Failed to auto-close session:', error, { sessionId });
      }
    }

    if (sessionsToClose.length > 0) {
      this.logger.info(`Cleaned up ${sessionsToClose.length} inactive sessions`);
    }
  }

  /**
   * Force close all active sessions (for shutdown)
   */
  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.activeSessions.keys());
    
    this.logger.info(`Closing ${sessionIds.length} active sessions...`);

    for (const sessionId of sessionIds) {
      try {
        await this.closeSession(sessionId);
      } catch (error) {
        this.logger.error('Failed to close session during shutdown:', error, { sessionId });
      }
    }

    this.logger.info('All sessions closed');
  }

  /**
   * Get session statistics
   */
  getStats(): {
    activeSessions: number;
    totalEvents: number;
    oldestSession?: string;
    newestSession?: string;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const totalEvents = sessions.reduce((sum, session) => sum + session.events.length, 0);
    
    let oldestSession: string | undefined;
    let newestSession: string | undefined;
    let oldestTime = Date.now();
    let newestTime = 0;

    for (const [sessionId, session] of this.activeSessions) {
      const sessionTime = new Date(session.session.opened_at).getTime();
      
      if (sessionTime < oldestTime) {
        oldestTime = sessionTime;
        oldestSession = sessionId;
      }
      
      if (sessionTime > newestTime) {
        newestTime = sessionTime;
        newestSession = sessionId;
      }
    }

    return {
      activeSessions: this.activeSessions.size,
      totalEvents,
      oldestSession,
      newestSession
    };
  }
}