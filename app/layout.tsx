import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barlicious Team App",
  description: "Planning, opdrachten en tijdregistratie voor het Barlicious-team.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Barlicious Team", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

/** Critical first-paint CSS — visible before the CSS chunk downloads. */
const BOOT_SPLASH_CSS = `
#boot-splash{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
background:radial-gradient(circle at 12% -10%,rgba(56,191,208,.13),transparent 32rem),
radial-gradient(circle at 90% 5%,rgba(42,105,140,.12),transparent 28rem),
linear-gradient(180deg,#040a0f,#071017 34%,#09141b);color:#edf7f9;font-family:system-ui,sans-serif;margin:0}
#boot-splash .card{width:min(28rem,92vw);padding:2rem 1.5rem;border-radius:1.125rem;
border:1px solid rgba(151,190,202,.16);background:rgba(13,24,33,.82);
box-shadow:0 18px 50px rgba(0,0,0,.28);text-align:center}
#boot-splash .logo{width:7.25rem;height:7.25rem;margin:0 auto 1rem;border-radius:1.75rem;
border:1px solid rgba(80,196,211,.34);background:linear-gradient(145deg,rgba(56,191,208,.32),rgba(15,45,59,.72));
display:flex;align-items:center;justify-content:center;padding:.35rem}
#boot-splash .logo img{width:88%;height:88%;object-fit:contain}
#boot-splash .eyebrow{color:#5ad4df;font-size:.72rem;font-weight:800;letter-spacing:.18em;margin:0 0 .5rem}
#boot-splash p{margin:0;color:#9bb0ba;font-size:.95rem}
body:has(.login-shell) #boot-splash,
body:has(.app-shell) #boot-splash,
body:has(.app-boot-shell) #boot-splash{display:none!important}
`;

const BOOT_SPLASH_HIDE = `
(function(){
  function hide(){var el=document.getElementById('boot-splash');if(el)el.style.display='none';}
  function ready(){return document.querySelector('.login-shell,.app-shell,.app-boot-shell');}
  if(ready()){hide();return;}
  var obs=new MutationObserver(function(){if(ready()){hide();obs.disconnect();}});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(hide,8000);
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <style dangerouslySetInnerHTML={{ __html: BOOT_SPLASH_CSS }} />
      </head>
      <body className="antialiased">
        <div id="boot-splash" aria-busy="true" aria-live="polite">
          <div className="card">
            <div className="logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand-logo.svg" alt="" width={100} height={100} />
            </div>
            <div className="eyebrow">FIELD OPERATIONS</div>
            <p>Barlicious Team</p>
          </div>
        </div>
        {children}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SPLASH_HIDE }} />
      </body>
    </html>
  );
}
