import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Seekr — AI Hybrid Search & Research Engine',
  description: 'AI-Powered Hybrid Search Engine with Reciprocal Rank Fusion & RAG Citations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
