# Extension Icons

This directory should contain the extension icon files in PNG format:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

## Converting SVG to PNG

The `icon.svg` file in this directory can be converted to PNG format using one of these methods:

### Method 1: Online Tool
1. Open https://cloudconvert.com/svg-to-png
2. Upload the `icon.svg` file
3. Download the PNG and resize to 16x16, 48x48, and 128x128

### Method 2: Using ImageMagick (if installed)
```bash
# Install ImageMagick first, then run:
magick -background none icon.svg -resize 16x16 icon16.png
magick -background none icon.svg -resize 48x48 icon48.png
magick -background none icon.svg -resize 128x128 icon128.png
```

### Method 3: Using Figma/Sketch/Photoshop
1. Open the SVG file
2. Export as PNG at the required sizes

## Temporary Placeholder

For testing purposes, you can use any PNG images as placeholders. Chrome will still load the extension.
