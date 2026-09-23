import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pb Messenger — Your message. Your control.",
    template: "%s | Pb Messenger",
  },
  description:
    "Connect with friends, share freely, and control the moment with Pb Messenger.",
  applicationName: "Pb Messenger",
  icons: {
    icon: [{ url: "/brand/pb-logo.jpg", type: "image/jpeg" }],
    apple: "/brand/pb-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('pb-theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var s=localStorage.getItem('pb-message-size')||'default';document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.dataset.themePreference=p;document.documentElement.dataset.messageSize=s}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
