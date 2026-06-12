import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Join Care Now — Recruitment & workforce platform for care providers",
    template: "%s | Join Care Now",
  },
  description:
    "Advertise jobs, manage applicants, complete onboarding and sync staff into your training platform — built for the UK care sector.",
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
