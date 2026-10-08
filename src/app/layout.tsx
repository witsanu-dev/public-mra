import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import { LayoutShell } from "@/components/layout/LayoutShell";
import "./globals.css";
import "./sweetalert2-mra.css";

const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบประเมินคุณภาพการบันทึกเวชระเบียน (MRA 2563)",
  description: "ระบบตรวจประเมินคุณภาพการบันทึกเวชระเบียนตามเกณฑ์มาตรฐาน สปสช. ปี 2563",
  icons: {
    icon: "/moph-logo.png",
    shortcut: "/moph-logo.png",
    apple: "/moph-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${anuphan.className} min-h-screen bg-slate-50 text-slate-800 antialiased`} suppressHydrationWarning>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
