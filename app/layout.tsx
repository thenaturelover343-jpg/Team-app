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
      <body className="antialiased">{children}</body>
    </html>
  );
}
