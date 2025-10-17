# Password Sync - Desktop Client

Electron + Angular desktop application for Password Sync.

## Development

### Prerequisites
- Node.js 22+
- npm 11+
- Running Password Sync server (Go backend)

### Setup

```bash
cd clients/desktop
npm install
```

### Run in Development Mode

```bash
# Terminal 1: Start the Go server
cd ../..
make run

# Terminal 2: Start Electron + Angular
cd clients/desktop
npm run electron:dev
```

This will:
1. Start Angular dev server on http://localhost:4200
2. Wait for Angular to compile
3. Build Electron main process
4. Launch Electron app with hot reload

### Build for Production

```bash
# Build Angular + Electron
npm run build
npm run electron:build

# Package for your platform
npm run package:mac    # macOS (dmg + zip)
npm run package:win    # Windows (installer + portable)
npm run package:linux  # Linux (AppImage + deb)
```

## Project Structure

```
clients/desktop/
├── electron/              # Electron main process
│   ├── main.ts           # App entry point
│   └── preload.ts        # Preload script (IPC bridge)
├── src/
│   ├── app/
│   │   ├── services/     # API client for Go server
│   │   │   └── api.service.ts
│   │   ├── components/   # Angular components
│   │   └── ...
│   └── ...
├── tsconfig.electron.json # Electron TypeScript config
└── package.json
```

## Features

### API Service
The `ApiService` (`src/app/services/api.service.ts`) provides type-safe communication with the Go backend:

```typescript
import { ApiService } from './services/api.service';

constructor(private api: ApiService) {}

// Create credential
this.api.createCredential({
  server: 'github.com',
  account: 'user@example.com',
  password: 'secret'
}).subscribe(result => {
  console.log('Created:', result.uuid);
});

// Sync
this.api.pullSync({
  zone: 'default',
  last_gencount: 0
}).subscribe(updates => {
  console.log('Updates:', updates);
});
```

### Configuration
Server URL defaults to `http://localhost:8080` but can be changed:

```typescript
this.api.setServerUrl('http://your-server:8080');
```

## Security

- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer process
- **Preload Script**: Secure IPC bridge between main and renderer

## Debugging

Development mode automatically opens DevTools. Use:
- `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS) to toggle DevTools
- Angular DevTools extension for component inspection

## Release

Built binaries are output to `release/` directory:
- macOS: `.dmg` and `.zip`
- Windows: `.exe` installer and portable `.exe`
- Linux: `.AppImage` and `.deb` package
