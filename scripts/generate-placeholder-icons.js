/**
 * Generate Placeholder Icons for TabezaConnect
 * 
 * This script creates simple placeholder .ico files for development.
 * For production, these should be replaced with professionally designed icons.
 * 
 * The script creates basic 32x32 BMP files wrapped in ICO format.
 */

const fs = require('fs');
const path = require('path');

/**
 * Create a simple ICO file with a single 32x32 image
 * ICO format: https://en.wikipedia.org/wiki/ICO_(file_format)
 */
function createSimpleIco(color, outputPath) {
  const size = 32; // 32x32 pixels
  const bpp = 24; // 24 bits per pixel (RGB)
  
  // ICO Header (6 bytes)
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);      // Reserved (must be 0)
  icoHeader.writeUInt16LE(1, 2);      // Image type (1 = ICO)
  icoHeader.writeUInt16LE(1, 4);      // Number of images
  
  // Image Directory Entry (16 bytes)
  const imageDir = Buffer.alloc(16);
  imageDir.writeUInt8(size, 0);       // Width
  imageDir.writeUInt8(size, 1);       // Height
  imageDir.writeUInt8(0, 2);          // Color palette (0 = no palette)
  imageDir.writeUInt8(0, 3);          // Reserved
  imageDir.writeUInt16LE(1, 4);       // Color planes
  imageDir.writeUInt16LE(bpp, 6);     // Bits per pixel
  
  // Calculate BMP size
  const rowSize = Math.floor((bpp * size + 31) / 32) * 4; // Row must be multiple of 4 bytes
  const pixelDataSize = rowSize * size;
  const bmpHeaderSize = 40;
  const bmpSize = bmpHeaderSize + pixelDataSize;
  
  imageDir.writeUInt32LE(bmpSize, 8);     // Image size
  imageDir.writeUInt32LE(22, 12);         // Image offset (6 + 16 = 22)
  
  // BMP Info Header (40 bytes)
  const bmpHeader = Buffer.alloc(40);
  bmpHeader.writeUInt32LE(40, 0);         // Header size
  bmpHeader.writeInt32LE(size, 4);        // Width
  bmpHeader.writeInt32LE(size * 2, 8);    // Height (doubled for ICO format)
  bmpHeader.writeUInt16LE(1, 12);         // Planes
  bmpHeader.writeUInt16LE(bpp, 14);       // Bits per pixel
  bmpHeader.writeUInt32LE(0, 16);         // Compression (0 = none)
  bmpHeader.writeUInt32LE(pixelDataSize, 20); // Image size
  bmpHeader.writeInt32LE(0, 24);          // X pixels per meter
  bmpHeader.writeInt32LE(0, 28);          // Y pixels per meter
  bmpHeader.writeUInt32LE(0, 32);         // Colors used
  bmpHeader.writeUInt32LE(0, 36);         // Important colors
  
  // Parse color
  const rgb = {
    green: { r: 0, g: 255, b: 0 },
    yellow: { r: 255, g: 255, b: 0 },
    red: { r: 255, g: 0, b: 0 }
  }[color] || { r: 128, g: 128, b: 128 };
  
  // Create pixel data (BMP is stored bottom-to-top)
  const pixelData = Buffer.alloc(pixelDataSize);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = y * rowSize + x * 3;
      
      // Create a simple circle design
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size / 2 - 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (distance <= radius) {
        // Inside circle - use color
        pixelData[offset] = rgb.b;     // Blue
        pixelData[offset + 1] = rgb.g; // Green
        pixelData[offset + 2] = rgb.r; // Red
      } else {
        // Outside circle - transparent/white
        pixelData[offset] = 255;       // Blue
        pixelData[offset + 1] = 255;   // Green
        pixelData[offset + 2] = 255;   // Red
      }
    }
  }
  
  // Combine all parts
  const icoFile = Buffer.concat([
    icoHeader,
    imageDir,
    bmpHeader,
    pixelData
  ]);
  
  // Write to file
  fs.writeFileSync(outputPath, icoFile);
  console.log(`Created ${color} icon: ${outputPath}`);
}

// Main execution
function main() {
  const assetsDir = path.join(__dirname, '../assets');
  
  // Create assets directory if it doesn't exist
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    console.log('Created assets directory');
  }
  
  // Generate placeholder icons
  console.log('Generating placeholder icons...');
  createSimpleIco('green', path.join(assetsDir, 'icon-green.ico'));
  createSimpleIco('yellow', path.join(assetsDir, 'icon-yellow.ico'));
  createSimpleIco('red', path.join(assetsDir, 'icon-red.ico'));
  console.log('Placeholder icons generated successfully');
  console.log('Note: Replace these with professional icons for production');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createSimpleIco };
