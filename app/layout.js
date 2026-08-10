import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Prime Lead Bridge | Smart IVR for Realtors",
  description: "Automated property lead capture and call routing for modern brokerages.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} antialiased h-full bg-[#0a0a0e] text-slate-200`}>
      <body className="min-h-full flex flex-col font-sans selection:bg-indigo-500/30">
        {children}
      </body>
    </html>
  );
}
