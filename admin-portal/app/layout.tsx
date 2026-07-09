import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Admin Portal | Sympl Finance",
  description: "Internal admin portal for Sympl Finance staff.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50 font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
