import type { Metadata } from "next";
import { Outfit, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "~/lib/theme/ThemeProvider";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EdgeTX Dashboards",
  description:
    "Generate and edit EdgeTX Lua dashboards for RadioMaster TX15 — telemetry, layout editor, and install guides",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${ibmPlexMono.variable}`}
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='etx-dashboards-theme';var t=localStorage.getItem(k);var ok=['light','dark','midnight','slate','forest','ocean','contrast'];if(ok.indexOf(t)>=0)document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
