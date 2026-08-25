import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerFlow AI",
  description: "Your AI career progress assistant",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
