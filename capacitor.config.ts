import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.bab173ce3571427cbdc293435d4a878a',
  appName: 'sortify-scan-guide',
  webDir: 'dist',
  server: {
    url: 'https://bab173ce-3571-427c-bdc2-93435d4a878a.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    }
  }
};

export default config;