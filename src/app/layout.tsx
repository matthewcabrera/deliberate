import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "deliberate",
  description: "Turn debate into an editable, evidence-linked map.",
  icons: {
    icon: [{ url: "/brand/deliberate-mark-paper.png", type: "image/png" }],
    apple: [{ url: "/brand/deliberate-mark-paper.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Paper fiber grain over the whole surface */}
        <svg className="paper-texture" aria-hidden="true" preserveAspectRatio="none">
          <filter id="paperGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.28  0 0 0 0 0.24  0 0 0 0 0.19  0 0 0 0.18 0"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#paperGrain)" />
        </svg>
        {children}
      </body>
    </html>
  );
}
