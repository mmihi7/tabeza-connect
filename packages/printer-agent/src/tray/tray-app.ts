/**
 * TABEZA Printer Agent - System Tray Application
 * Minimal tray UI for Phase-1 (optional component)
 */

// Electron tray app - disabled for Phase-1 (Windows Service focus)
// import { app, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { Logger } from '../utils/logger';

export class TrayApp {
  private tray: Tray | null = null;
  private logger = Logger.getInstance();

  constructor() {
    this.initializeTray();
  }

  private initializeTray(): void {
    // Create tray icon (simple colored dot for Phase-1)
    const icon = nativeImage.createFromDataURL(this.createStatusIcon('green'));
    
    this.tray = new Tray(icon);
    this.tray.setToolTip('TABEZA Printer Agent - Online');
    
    this.updateContextMenu();
    
    this.logger.info('System tray initialized');
  }

  private createStatusIcon(color: 'green' | 'red' | 'yellow'): string {
    // Simple SVG icon as data URL
    const colors = {
      green: '#22c55e',
      red: '#ef4444', 
      yellow: '#eab308'
    };
    
    const svg = `
      <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6" fill="${colors[color]}" stroke="#000" stroke-width="1"/>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  private updateContextMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'TABEZA Printer Agent',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Status: Online',
        enabled: false
      },
      {
        label: 'View Logs',
        click: () => this.openLogs()
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => app.quit()
      }
    ]);

    this.tray?.setContextMenu(contextMenu);
  }

  private openLogs(): void {
    const { shell } = require('electron');
    const logPath = path.join(
      process.env.ProgramData || 'C:\\ProgramData',
      'TABEZA',
      'Logs'
    );
    shell.openPath(logPath);
  }

  updateStatus(isOnline: boolean): void {
    if (!this.tray) return;

    const color = isOnline ? 'green' : 'red';
    const status = isOnline ? 'Online' : 'Offline';
    
    const icon = nativeImage.createFromDataURL(this.createStatusIcon(color));
    this.tray.setImage(icon);
    this.tray.setToolTip(`TABEZA Printer Agent - ${status}`);
    
    this.logger.debug(`Tray status updated: ${status}`);
  }
}