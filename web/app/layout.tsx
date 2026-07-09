import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Transparência · Contratos TSE',
  description:
    'Dashboard de gastos com contratos do Tribunal Superior Eleitoral, a partir dos dados públicos do Compras.gov.br.',
};

const themeInit = `
try {
  const stored = localStorage.getItem('theme');
  const dark = stored ? stored === 'dark' : true;
  document.documentElement.classList.toggle('dark', dark);
} catch {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
