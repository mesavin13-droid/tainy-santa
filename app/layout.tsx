import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Тайный Санта 2027 — корпоративная игра',
  description: 'Организуйте Тайного Санту в компании: приглашения по ссылке и QR-коду, тайная жеребьёвка, пожелания и видео-поздравления.',
  applicationName: 'Тайный Санта 2027',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'Тайный Санта 2027',
    description: 'Подарки — тайна. Радость — общая.',
    type: 'website',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary',
    title: 'Тайный Санта 2027',
    description: 'Подарки — тайна. Радость — общая.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
