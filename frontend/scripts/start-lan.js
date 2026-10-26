const os = require('os');
const { spawn } = require('child_process');

function getWifiIp() {
  const interfaces = os.networkInterfaces();
  let fallbackIp = null;

  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name];
    for (const info of netInterface) {
      if (info.family === 'IPv4' && !info.internal) {
        // Prioritize Wi-Fi or wireless interfaces
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wireless') || name.toLowerCase().includes('inalámbrica')) {
          return info.address;
        }
        // Prioritize standard local class C network (usually home router Wi-Fi)
        if (info.address.startsWith('192.168.')) {
          return info.address;
        }
        // Save as fallback if it's not a loopback or local host
        if (!info.address.startsWith('127.')) {
          fallbackIp = info.address;
        }
      }
    }
  }
  return fallbackIp || 'localhost';
}

const wifiIp = getWifiIp();
console.log(`\n\x1b[36m┌────────────────────────────────────────────────────────┐\x1b[0m`);
console.log(`\x1b[36m│          UTP MOVIL - EXPO LAN CONFIG                   │\x1b[0m`);
console.log(`\x1b[36m├────────────────────────────────────────────────────────┤\x1b[0m`);
console.log(`\x1b[36m│  IP Wi-Fi: \x1b[32m${wifiIp.padEnd(43)}\x1b[36m │\x1b[0m`);
console.log(`\x1b[36m│  Expo configurado en interfaz de red local.            │\x1b[0m`);
console.log(`\x1b[36m└────────────────────────────────────────────────────────┘\x1b[0m\n`);

process.env.REACT_NATIVE_PACKAGER_HOSTNAME = wifiIp;
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-old-space-size=4096`.trim();

// Start Expo (shell: true is required on Windows to run npx.cmd)
const isWin = process.platform === 'win32';
const command = isWin ? 'npx.cmd' : 'npx';
const child = spawn(command, ['expo', 'start', '--go'], {
  stdio: 'inherit',
  env: { ...process.env },
  shell: true
});

child.on('close', (code) => {
  process.exit(code);
});
