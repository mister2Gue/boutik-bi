import './globals.css';

export const metadata = {
  title: 'Boutik bi',
  description: 'Gestion de la boutique : ventes, dépenses, revendeurs, prêts',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0d7a5a' };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
