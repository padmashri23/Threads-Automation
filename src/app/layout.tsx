import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Threads AI Editor",
  description: "Your personal AI technology editor: the two stories worth talking about today, written for Threads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-20 pt-6 flex-1">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          Threads AI Editor · research → verify → write. Nothing is invented: every post is grounded in the sources shown.
        </footer>
      </body>
    </html>
  );
}
