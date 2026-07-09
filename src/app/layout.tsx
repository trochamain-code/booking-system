import type { Metadata, Viewport } from "next";
import { Playfair_Display, Karla, Geist_Mono } from "next/font/google";
import { MuiProvider } from "./mui-provider";
import "./globals.css";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema de Reservas",
  description: "Acepta reservas desde cualquier sitio web.",
};

// viewportFit "cover" exposes env(safe-area-inset-*) so the fixed bottom nav
// can clear the iPhone home-indicator area. Zoom stays enabled (a11y).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${karla.variable} ${playfair.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MuiProvider>{children}</MuiProvider>
      </body>
    </html>
  );
}
