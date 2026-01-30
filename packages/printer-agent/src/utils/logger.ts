/**
 * Logger Utility
 * Winston-based logging for the TABEZA Printer Agent
 */

import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    this.logger = this.createLogger();
  }

  /**
   * Get singleton logger instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Create Winston logger instance
   */
  private createLogger(): winston.Logger {
    const logDirectory = path.join(
      process.env.ProgramData || 'C:\\ProgramData',
      'TABEZA',
      'Logs'
    );

    // Ensure log directory exists
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }

    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta)}`;
        }
        
        // Add stack trace for errors
        if (stack) {
          log += `\n${stack}`;
        }
        
        return log;
      })
    );

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            logFormat
          )
        }),
        
        // File transport for all logs
        new winston.transports.File({
          filename: path.join(logDirectory, 'tabeza-agent.log'),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        }),
        
        // Separate file for errors
        new winston.transports.File({
          filename: path.join(logDirectory, 'tabeza-agent-error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 3,
          tailable: true
        })
      ],
      
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logDirectory, 'tabeza-agent-exceptions.log')
        })
      ],
      
      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logDirectory, 'tabeza-agent-rejections.log')
        })
      ]
    });
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log error message
   */
  error(message: string, error?: any, meta?: any): void {
    if (error instanceof Error) {
      this.logger.error(message, { ...meta, error: error.message, stack: error.stack });
    } else if (error) {
      this.logger.error(message, { ...meta, error });
    } else {
      this.logger.error(message, meta);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log verbose message
   */
  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  /**
   * Update log level
   */
  setLevel(level: string): void {
    this.logger.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this.logger.level;
  }
}