// test-service-simple.js
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Test service running');
});

server.listen(8765, () => {
  console.log('✅ Test service running on port 8765');
  console.log('Press Ctrl+C to stop');
});
