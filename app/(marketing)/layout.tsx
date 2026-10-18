import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./landing.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-landing-sans",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-landing-serif",
});

export const metadata: Metadata = {
  title: { absolute: "Bridgify: client requests, handled in the chat" },
  description:
    "Bridgify sits in your client's iMessage group, accepts the edits your agreement already covers, asks for missing details, and turns requests into tasks. Anything out of scope comes to you privately.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${sans.variable} ${serif.variable} landing`}>{children}</div>;
}
