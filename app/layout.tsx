import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "ProjectHub",
  description: "Internal board management tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <SessionProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
