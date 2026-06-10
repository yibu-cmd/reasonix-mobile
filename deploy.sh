#!/bin/bash
# Reasonix Mobile Backend Deploy Script
# Run this on your Ubuntu server

set -e

echo "=== Reasonix Mobile Backend Deploy ==="

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# Create app directory
APP_DIR=/opt/reasonix-mobile
mkdir -p $APP_DIR/sessions

# Copy backend files
cat > $APP_DIR/package.json << 'PJSON'
{
  "name": "reasonix-mobile-backend",
  "version": "1.5.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "build": "tsc",
    "prod": "node dist/index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "ws": "^8.18.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
PJSON

cat > $APP_DIR/tsconfig.json << 'TSCONF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
TSCONF

# Install dependencies
cd $APP_DIR
npm install

# Create systemd service
cat > /etc/systemd/system/reasonix-mobile.service << 'SERVICE'
[Unit]
Description=Reasonix Mobile Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/reasonix-mobile
Environment=DEEPSEEK_API_KEY=sk-86bd93760acd4edc9ad8aba18e903929
Environment=PORT=3456
Environment=WORKSPACE_ROOT=/opt/workspace
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

# Create workspace
mkdir -p /opt/workspace

# Start the service
systemctl daemon-reload
systemctl enable reasonix-mobile
systemctl restart reasonix-mobile

echo ""
echo "=== Deploy Complete ==="
echo "Backend running on: http://106.54.217.162:3456"
echo "Check status: systemctl status reasonix-mobile"
echo "View logs: journalctl -u reasonix-mobile -f"