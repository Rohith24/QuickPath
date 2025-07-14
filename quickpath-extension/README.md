# QuickPath Chrome Extension

QuickPath allows you to bookmark and quickly navigate to paths across different domains. Perfect for developers, system administrators, and anyone managing multiple websites with similar structures.

## Features

- **Path Bookmarking**: Save paths like `/admin/login` or `/api/docs`
- **Cross-Domain Navigation**: Use saved paths on any domain
- **Smart Search**: Quickly find saved paths
- **Import/Export**: Backup and share path collections
- **Keyboard Shortcuts**: Quick access with `Ctrl+Shift+P`

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select this folder

## Usage

1. Navigate to any page
2. Click the QuickPath icon or press `Ctrl+Shift+P`
3. Click "Save Path" to bookmark the current path
4. Click on saved paths to navigate to them on the current domain

## Development

- Replace placeholder icons in `/icons/` with actual PNG files
- Test thoroughly before publishing
- Follow Chrome Web Store policies

## License

MIT License
```

Let's check our final project structure:

```bash
Get-ChildItem -Recurse | Select-Object FullName