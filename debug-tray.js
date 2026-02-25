// Debug script to test tray app initialization
console.log('Starting tray app debug...');

try {
  const { app } = require('electron');
  console.log('Electron app loaded');
  
  app.whenReady().then(() => {
    console.log('Electron app ready');
    
    try {
      const TrayApp = require('./src/tray/tray-app.js');
      console.log('TrayApp class loaded');
      
      const trayApp = new TrayApp({ minimized: false });
      console.log('TrayApp instance created');
      
      trayApp.start().then(() => {
        console.log('TrayApp started successfully');
      }).catch(err => {
        console.error('TrayApp start failed:', err);
      });
      
    } catch (err) {
      console.error('Error loading TrayApp:', err);
    }
  });
  
} catch (err) {
  console.error('Error loading electron:', err);
}
