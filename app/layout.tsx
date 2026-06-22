import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Join Care Now — Recruitment & workforce platform for care providers",
    template: "%s | Join Care Now",
  },
  description:
    "Advertise jobs, manage applicants and complete onboarding — recruitment and onboarding software built for the UK care sector.",
  icons: {
    icon: [
      { url: "/brand/jcn-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/jcn-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/brand/jcn-icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
