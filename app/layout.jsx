import './globals.css';
import Porte from './Porte';

export const metadata = {
  title: 'Boutik bi',
  description: 'Gestion de la boutique : ventes, dépenses, revendeurs, prêts',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0c2557' };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}<Porte /></body>
    </html>
  );
}
