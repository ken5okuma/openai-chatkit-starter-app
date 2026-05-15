import type { Metadata, Viewport } from "next";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Translator",
  description:
    "OpenAI gpt-realtime-translate を使った日本語↔多言語のリアルタイム翻訳PWA",
  applicationName: "Voice Translator",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Translator",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
