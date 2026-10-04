import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Selling",
  description: "Personal card-selling workspace"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
