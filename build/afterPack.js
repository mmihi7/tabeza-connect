const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  console.log('🔧 Running afterPack script to handle ffmpeg...');
  
  // Remove any ffmpeg-related files from the build
  const files = fs.readdirSync(context.appOutDir);
  files.forEach(file => {
    if (file.toLowerCase().includes('ffmpeg')) {
      const filePath = path.join(context.appOutDir, file);
      if (fs.existsSync(filePath)) {
        if (file.toLowerCase() !== 'ffmpeg.dll') {
          console.log(`Removing ffmpeg-related file: ${file}`);
          fs.unlinkSync(filePath);
        }
      }
    }
  });
  
  // Check and remove ffmpeg injection files from resources
  const resourcesDir = path.join(context.appOutDir, 'resources');
  if (fs.existsSync(resourcesDir)) {
    const removeFfmpegFromResources = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            removeFfmpegFromResources(itemPath);
          } else if (item.toLowerCase().includes('ffmpeg') || 
                     item.toLowerCase().includes('injectffmpeg')) {
            console.log(`Removing ffmpeg injection file: ${itemPath}`);
            fs.unlinkSync(itemPath);
          }
        });
      } catch (error) {
        // Ignore permission errors
      }
    };
    removeFfmpegFromResources(resourcesDir);
  }
  
  // Create an empty ffmpeg.dll file to prevent Electron from showing error
  const dummyFfmpegPath = path.join(context.appOutDir, 'ffmpeg.dll');
  if (!fs.existsSync(dummyFfmpegPath)) {
    console.log('Creating empty ffmpeg.dll to prevent Electron error dialog');
    fs.writeFileSync(dummyFfmpegPath, '');
  }
  
  console.log('✅ ffmpeg handling completed - empty ffmpeg.dll created');
};
