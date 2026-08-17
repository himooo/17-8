import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";

const cairo = localFont({
  src: "../../public/fonts/Amiri-Regular.ttf",
  variable: "--font-cairo",
  display: "swap",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: "بسلاسة | غرفة عمليات المدرس",
  description: "إطار تفاعلي متكامل للمدرس - عرض الشرائح، السبورة الذكية، إدارة الطلاب، والتحفيز التراكمي",
  keywords: ["بسلاسة", "تعليم", "رياضيات", "سبورة تفاعلية", "مدرس"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "بسلاسة",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} antialiased`}
      >
        {children}
        <Toaster />
        <SonnerToaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "Cairo, sans-serif",
              direction: "rtl",
            },
          }}
        />
      </body>
    </html>
  );
}
