/**
 * TABEZA Printer Agent - Windows Service Entry Point
 * 
 * This is the main service that runs as a Windows Service.
 * It coordinates all components and ensures reliable operation.
 */

import { ServiceController } from './service/service-controller';
import { Logger } from './utils/logger';
import { ServiceConfig } from './config/service-config';

const logger = Logger.getInstance();

async function main(): Promise<void> {
  try {
    logger.info('Starting TABEZA Printer Agent...');
    
    // Load configuration
    const config = ServiceConfig.load();
    logger.info('Configuration loaded', { 
      serviceName: config.serviceName,
      dataDirectory: config.dataDirectory 
    });

    // Initialize service controller
    const serviceController = new ServiceController(config);
    
    // Start the service
    await serviceController.start();
    
    logger.info('TABEZA Printer Agent started successfully');

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await serviceController.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await serviceController.stop();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', { promise, reason });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start TABEZA Printer Agent:', error);
    process.exit(1);
  }
}

// Start the service
main().catch((error) => {
  console.error('Fatal error starting service:', error);
  process.exit(1);
});