import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pb Messenger",
  description: "Connect and chat in real time with Pb Messenger.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
