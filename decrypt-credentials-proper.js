const crypto = require('crypto');

// Your KMS key from environment
const KMS_KEY = 'f96e963596ff777eb4cd1a5425480909';

function decryptFromBytea(byteaHex) {
  try {
    // Validate format - fail fast if not bytea hex
    if (!byteaHex.startsWith('\\x')) {
      throw new Error('Invalid bytea format: must start with \\x');
    }
    
    // Convert hex string to Buffer
    const encryptedBuffer = Buffer.from(byteaHex.slice(2), 'hex');
    
    if (encryptedBuffer.length < 28) { // 12 (IV) + 16 (AuthTag) = 28 minimum
      throw new Error('Invalid encrypted data: too short');
    }
    
    // Extract components
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encrypted = encryptedBuffer.subarray(28);
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(KMS_KEY, 'utf8'), iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    return `[DECRYPT_ERROR: ${error.message}]`;
  }
}

// Your encrypted credentials from database
const credentials = {
  consumer_key: "\\xce74911cdd157b122b5b95d9d97e93561524eadac19c98381afbb8ac4deb5b618404a5c09576592f301c7d924463d591c20dcd0caeb51d694466f32fd0ec1f2104c1248ac3a9c551db4f6b74",
  consumer_secret: "\\x7b150a8578e13a8600a8d8d5c1d194ae9706e8d041d6618a40380bd22ad5479151512142014238f394ab064c7f7e3da545ddfc6fec8f5b914290c07b7b29ab17d4682bc0c5597eace5b1e4150e214762e96196066985f63d9e78b862",
  passkey: "\\xa74ac4daa5f4f01cf711eae1cf085546afa3a303858698e99c28b957bb7f5ae4a44d7209781cc8e4b8329fb2d7c0200a86c0996e7673b39607e7216d50700d2d0531e4237f05d7fe73cfe319ded365dd70dbe298db1b7ad87b822d91"
};

console.log('🔍 Decrypting M-Pesa credentials...\n');

const consumerKey = decryptFromBytea(credentials.consumer_key);
const consumerSecret = decryptFromBytea(credentials.consumer_secret);
const passkey = decryptFromBytea(credentials.passkey);

console.log('Consumer Key:', consumerKey);
console.log('Consumer Secret:', consumerSecret);
console.log('Passkey:', passkey);

console.log('\n🚨 ANALYSIS:');

// Check if these look like sandbox or production credentials
if (consumerKey.includes('[DECRYPT_ERROR')) {
  console.log('❌ Failed to decrypt consumer key');
} else {
  console.log('✅ Consumer key decrypted successfully');
  if (consumerKey.toLowerCase().includes('sandbox') || consumerKey.toLowerCase().includes('test')) {
    console.log('✅ Consumer key appears to be for SANDBOX (contains sandbox/test)');
  } else {
    console.log('⚠️ Consumer key does NOT contain sandbox/test identifiers');
    console.log('🚨 This might be a PRODUCTION consumer key!');
  }
}

if (consumerSecret.includes('[DECRYPT_ERROR')) {
  console.log('❌ Failed to decrypt consumer secret');
} else {
  console.log('✅ Consumer secret decrypted successfully');
}

if (passkey.includes('[DECRYPT_ERROR')) {
  console.log('❌ Failed to decrypt passkey');
} else {
  console.log('✅ Passkey decrypted successfully');
  
  // Check if it's the standard sandbox passkey
  const STANDARD_SANDBOX_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
  if (passkey === STANDARD_SANDBOX_PASSKEY) {
    console.log('✅ Passkey matches STANDARD SANDBOX passkey');
  } else {
    console.log('⚠️ Passkey does NOT match standard sandbox passkey');
    console.log('🚨 This might be a PRODUCTION passkey!');
  }
}

console.log('\n📋 SUMMARY:');
console.log('- Database shows: Environment = sandbox, Shortcode = 174379');
console.log('- But you transferred REAL MONEY (100 KES) with receipt UAV4J5QE4Y');
console.log('- This suggests either:');
console.log('  1. Safaricom sandbox is broken (processing real money)');
console.log('  2. Your credentials are actually production credentials');
console.log('  3. Your callback URL routes to production system');
console.log('  4. Phone number triggered production processing');