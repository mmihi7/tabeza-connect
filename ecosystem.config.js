// PM2 ecosystem config for Tabeza Connect
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save
//
// Windows auto-start (run once):
//   npm install -g pm2-windows-startup
//   pm2-startup install
//   pm2 save

module.exports = {
  apps: [
    {
      name: 'tabeza-connect',
      script: 'src/service/index.js',
      cwd: 'C:\\Projects\\tabeza-connect',
      watch: false,                    // never watch — chokidar handles file watching internally
      autorestart: true,
      max_restarts: 20,
      min_uptime: '5s',               // must stay up 5s to count as a successful start
      restart_delay: 1000,            // wait 1s before restarting after crash
      env: {
        NODE_ENV: 'development',
      },
      error_file: 'C:\\TabezaPrints\\logs\\pm2-error.log',
      out_file:   'C:\\TabezaPrints\\logs\\pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
