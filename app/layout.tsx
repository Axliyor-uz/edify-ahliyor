import type { Metadata } from 'next';
import {
  Plus_Jakarta_Sans, Fredoka, Inter, Manrope, IBM_Plex_Sans, Space_Grotesk,
} from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { Toaster } from 'react-hot-toast';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'cyrillic-ext'],
  variable: '--font-jakarta',
});

const display = Fredoka({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
});

const inter = Inter({
  subsets: ['latin', 'cyrillic-ext'],
  variable: '--font-inter',
});

const manrope = Manrope({
  subsets: ['latin', 'cyrillic-ext'],
  variable: '--font-manrope',
});

const plex = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
  display: 'swap',
});

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
});

export const metadata: Metadata = {
  title: 'Edify | O\'qituvchi Portali',
  description: 'Zamonaviy ta\'lim platformasi orqali darslarni avtomatlashtiring.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="uz"
      className={`${jakarta.variable} ${display.variable} ${inter.variable} ${manrope.variable} ${plex.variable} ${grotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-white text-slate-900" suppressHydrationWarning>
        <AuthProvider>
          {children}
          <Toaster position="top-center" toastOptions={{ duration: 1500 }} />
        </AuthProvider>
      </body>
    </html>
  );
}
