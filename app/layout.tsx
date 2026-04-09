import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "새림 ERP",
  description: "새림 전사 운영 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-[#f0f2f5]">{children}</body>
    </html>
  );
}
