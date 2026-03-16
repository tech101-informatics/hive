import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GlobalSearch } from "@/components/GlobalSearch";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export const metadata: Metadata = {
  title: "Hive",
  description: "Internal project management for your team",
  icons: {
    icon: "/hive-icon.png",
    apple: "/hive-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#111214" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var t = localStorage.getItem('hive-theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', t);
                } catch(e){}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg-base text-text-primary">
        <SessionProvider>
          <ThemeProvider>
            <Navbar />
            <GlobalSearch />
            <OnboardingWizard />
            <main className="max-w-7xl mx-auto px-4 py-4">{children}</main>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
