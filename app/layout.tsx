export const metadata = {
  title: "NextJS + Redis Q and A Demo",
  description: "Minimal demo showing cache, sessions, rate limits, and live updates"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-sans-serif, system-ui, Arial" }}>{children}</body>
    </html>
  );
}
