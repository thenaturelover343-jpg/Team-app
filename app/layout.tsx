import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Barlicious Team App",
  description: "Planning, opdrachten en tijdregistratie voor het Barlicious-team.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Barlicious Team", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/brand-logo.svg",
    shortcut: "/brand-logo.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={`${outfit.variable} ${plusJakarta.variable}`}>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
