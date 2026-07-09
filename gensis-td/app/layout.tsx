import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gensis Teknik Dosya",
  description: "Asansör CE teknik dosya oluşturma platformu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
