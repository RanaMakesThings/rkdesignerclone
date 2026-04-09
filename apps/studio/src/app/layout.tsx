import type { Metadata } from "next";
import {
  Manrope,
  Plus_Jakarta_Sans,
  Sora,
  Space_Grotesk,
} from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body-alt",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-display-alt",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Designer Studio",
  description: "Current stamped slide roots and version archives for the Designer deck.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${spaceGrotesk.variable} ${plusJakartaSans.variable} ${sora.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
