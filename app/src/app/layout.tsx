import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GTMath",
  description: "Math card game by Alpha School",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
