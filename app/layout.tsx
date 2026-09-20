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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#071923" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
