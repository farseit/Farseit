import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "../globals.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "FarseIT | Web Development, AI Chatbot & School Management Systems",
  description:
    "FarseIT builds robust, sustainable web platforms — e-commerce stores, school management systems, internal tools, and Farse AI, an automatic Messenger sales chatbot for Facebook shops.",
};

export default function SiteLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="farse-site bg-paper font-body text-ink antialiased">{children}</body>
    </html>
  );
}
