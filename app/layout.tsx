import type { Metadata } from "next";
import { Header, Footer } from "@/components/ui";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Fideli — La fidélité qui fait revenir", template: "%s | Fideli" }, description: "Une expérience de fidélité simple et sans application à télécharger." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body><Header/><main>{children}</main><Footer/></body></html>; }
