import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARC — Your life. Your character.",
  description: "A real-life RPG for the person you are becoming.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
