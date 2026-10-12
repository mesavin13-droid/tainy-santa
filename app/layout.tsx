import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Тайный Санта — корпоративная игра', description: 'Организуйте Тайного Санту в компании. Подключение по ссылке и QR-коду.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru"><body>{children}</body></html>; }