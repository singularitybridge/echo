/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import './globals.css';
import { Inter, Cormorant, IBM_Plex_Sans } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const cormorant = Cormorant({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-logo',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-docs',
});

export const metadata = {
  title: 'Echo - AI Video Creation',
  description: 'AI-powered video creation platform for artists and creators to craft compelling visual stories',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} ${ibmPlexSans.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
