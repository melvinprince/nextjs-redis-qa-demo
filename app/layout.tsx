import "./globals.css";

export const metadata = {
  title: "Next.js + Redis Q&A Demo",
  description:
    "Live Q&A showcasing Redis caching, sessions, rate limits, and realtime",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="app-root dark-only">{children}</body>
    </html>
  );
}
