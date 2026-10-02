import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const plistPath = 'ios/App/App/Info.plist';
if (existsSync(plistPath)) {
  let plist = readFileSync(plistPath, 'utf8');
  const entries = {
    NSLocationWhenInUseUsageDescription: 'Tijdens de werkdag meten we of u op het opdrachtadres bent, voor de factuur.',
    NSLocationAlwaysAndWhenInUseUsageDescription: 'Locatie op Altijd is nodig zodat aankomst en vertrek ook vastliggen als de app dicht is. Alleen tijdens de dienst, niet daarbuiten.',
  };
  for (const [key, value] of Object.entries(entries)) {
    if (!plist.includes(key)) {
      plist = plist.replace('</dict>\n</plist>', `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>\n</plist>`);
    }
  }
  if (!plist.includes('UIBackgroundModes')) {
    plist = plist.replace('</dict>\n</plist>', `\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>location</string>\n\t</array>\n</dict>\n</plist>`);
  } else if (!plist.includes('<string>location</string>')) {
    plist = plist.replace('<key>UIBackgroundModes</key>\n\t<array>', '<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>location</string>');
  }
  writeFileSync(plistPath, plist);
}

const appDelegate = 'ios/App/App/AppDelegate.swift';
if (existsSync(appDelegate)) {
  let source = readFileSync(appDelegate, 'utf8');
  if (!source.includes('VisitFenceBootstrap.start()')) {
    source = source.replace(
      'func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {',
      'func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {\n        VisitFenceBootstrap.start()',
    );
  }
  if (!source.includes('import VisitFence')) {
    source = source.includes('import Capacitor')
      ? source.replace('import Capacitor', 'import Capacitor\nimport VisitFence')
      : `import VisitFence\n${source}`;
  }
  writeFileSync(appDelegate, source);
}

const manifest = 'android/app/src/main/AndroidManifest.xml';
if (existsSync(manifest)) {
  let xml = readFileSync(manifest, 'utf8');
  if (!xml.includes('ACCESS_BACKGROUND_LOCATION')) {
    xml = xml.replace('<application', '<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />\n    <application');
    writeFileSync(manifest, xml);
  }
}
