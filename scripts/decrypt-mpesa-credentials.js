const crypto = require('crypto');

// Your KMS key from environment
const KMS_KEY = 'f96e963596ff777eb4cd1a5425480909';

function decryptCredential(encryptedHex) {
  try {
    // Remove \x prefix and convert hex to buffer
    const cleanHex = encryptedHex.replace(/\\x/g, '');
    const encryptedBuffer = Buffer.from(cleanHex, 'hex');
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = encryptedBuffer.slice(0, 12);
    const encryptedData = encryptedBuffer.slice(12, -16);
    const authTag = encryptedBuffer.slice(-16);
    
    // Create decipher
    const decipher = crypto.createDecipherGCM('aes-256-gcm', Buffer.from(KMS_KEY, 'hex'));
    decipher.setIV(iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encryptedData, null, 'utf8');
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

console.log('Consumer Key:', decryptCredential(credentials.consumer_key));
console.log('Consumer Secret:', decryptCredential(credentials.consumer_secret));
console.log('Passkey:', decryptCredential(credentials.passkey));

console.log('\n🚨 ANALYSIS:');
console.log('- If these are sandbox credentials, they should start with test/sandbox identifiers');
console.log('- If these look like production credentials, that explains the real money transfer');
console.log('- Sandbox consumer keys typically contain "sandbox" or test identifiers');