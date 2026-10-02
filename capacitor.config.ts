import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'be.barlicious.team',
  appName: 'Barlicious Team',
  webDir: 'public',
  server: {
    url: 'https://barlicious-team-app.thenaturelover343.workers.dev',
    androidScheme: 'https',
    allowNavigation: ['barlicious-team-app.thenaturelover343.workers.dev', 'accounts.google.com', '*.google.com', '*.firebaseapp.com'],
  },
};

export default config;
