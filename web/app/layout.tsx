import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Transparência TSE',
  description:
    'Panorama dos gastos com contratos e do quadro de pessoal do Tribunal Superior Eleitoral, a partir de dados públicos (Compras.gov.br e portais do TSE).',
};

const themeInit = `
try {
  const stored = localStorage.getItem('theme');
  const dark = stored ? stored === 'dark' : true;
  document.documentElement.classList.toggle('dark', dark);
  const tema = localStorage.getItem('tema');
  if (tema && tema !== 'neutro') document.documentElement.dataset.theme = tema;
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
