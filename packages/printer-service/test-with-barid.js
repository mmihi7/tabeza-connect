/**
 * Test connection with specific bar ID
 */

// Set environment variables
process.env.TABEZA_BAR_ID = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
process.env.TABEZA_API_URL = 'http://localhost:3003';

// Run the test
require('./test-connection.js');
