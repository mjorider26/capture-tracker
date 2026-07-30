import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Capture Tracker", template: "%s | Capture Tracker" },
  description:
    "SPENDING TRACKED. BUSINESS GROWN. A focused financial command center for a solo business owner.",
  applicationName: "Capture Tracker",
  icons: {
    icon: "/brand/favicon-32.png",
    apple: "/brand/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Capture Tracker",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = { themeColor: "#082b4d" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
