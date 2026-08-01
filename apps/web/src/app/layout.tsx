import type { Metadata } from "next";
import { Outfit, IBM_Plex_Mono } from "next/font/google";
import { AiSettingsProvider } from "~/components/AiSettingsProvider";
import { FirstRunWizard } from "~/components/FirstRunWizard";
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
    "Generate, preview, and edit EdgeTX Lua dashboards for TX15, Boxer, MT12, and other color radios — then download a zip for your radio SD card",
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
            __html: `(function(){try{var k='etx-dashboards-theme';var t=localStorage.getItem(k);var ok=['light','dark','midnight','slate','forest','ocean','contrast','graphite','meadow','fog','ember','volt','copper'];if(ok.indexOf(t)>=0)document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <AiSettingsProvider>
            <FirstRunWizard />
            {children}
          </AiSettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
