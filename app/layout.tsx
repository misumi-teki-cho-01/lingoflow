import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LingoFlow",
  description: "AI-powered English shadowing practice and intensive reading tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
