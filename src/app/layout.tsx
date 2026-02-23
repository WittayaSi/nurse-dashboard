import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

const sarabun = Sarabun({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ["thai", "latin"],
  variable: "--font-sarabun",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Nursing Organization Dashboard",
  description: "Real-time Workforce Monitoring & Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
