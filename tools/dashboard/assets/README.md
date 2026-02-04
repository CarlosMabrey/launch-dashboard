# Assets Directory

This directory contains assets for the JellyOS Launcher Electron app.

## Icon Files

- `icon.png` - Main application icon (512x512 PNG)
- `icon.ico` - Windows application icon
- `icon.icns` - macOS application icon (if needed)

## Adding Icons

To add custom icons:

1. Create a 512x512 PNG file named `icon.png`
2. Convert to `.ico` for Windows using an online converter or tool like `png2ico`
3. Place both files in this directory
4. Rebuild the Electron app using `npm run electron-build`

## Default Icons

If no custom icons are provided, Electron will use default system icons.
