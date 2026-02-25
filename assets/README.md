# TabezaConnect Tray Icons

This directory contains the tray icon assets for TabezaConnect.

## Required Icons

- **icon-green.ico** - Connected state (operational)
- **icon-yellow.ico** - Warning state (starting, disconnected, unconfigured)
- **icon-red.ico** - Error state (critical errors)

## Icon Specifications

- **Format**: .ICO (Windows native icon format)
- **Sizes**: Multi-resolution (16x16, 32x32, 48x48 pixels)
- **Style**: Simple, recognizable at small sizes
- **Design**: Tabeza logo with colored background

## Creating Icons

Icons should be created using a graphics editor that supports .ico format:

1. **Design**: Create a simple, recognizable design (e.g., "T" letter or printer icon)
2. **Colors**: 
   - Green: #00FF00 or similar (connected)
   - Yellow: #FFFF00 or similar (warning)
   - Red: #FF0000 or similar (error)
3. **Export**: Save as .ico with multiple resolutions (16x16, 32x32, 48x48)

## Placeholder Icons

For development, you can use online tools to convert PNG to ICO:
- https://convertio.co/png-ico/
- https://www.icoconverter.com/

Or use ImageMagick:
```bash
convert -background transparent icon-green.png -define icon:auto-resize=16,32,48 icon-green.ico
```

## Production Icons

For production release, professional icons should be created with:
- Clean, professional design
- Proper anti-aliasing
- Consistent style across all three states
- Clear visibility at 16x16 size (system tray size)
