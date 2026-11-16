# Boutik bi

Application de gestion de la boutique : ventes du jour, dépenses, revendeurs, prêts (argent / matériel) et caisse (manquement).
Next.js + Supabase (projet « boutik bi »).

## Lancer sur votre ordinateur

1. Installer Node.js 20 ou plus récent.
2. Dans ce dossier : `npm install`
3. Le fichier `.env.local` contient déjà l'adresse et la clé publique du projet Supabase (copie dans `.env.example`).
4. `npm run dev`, puis ouvrir http://localhost:3000

## Qui peut entrer

Seules les adresses email de la table `acces` (Supabase → Table Editor → acces) voient et modifient les données.
Pour ajouter quelqu'un : il crée son compte dans l'application, puis vous ajoutez son email dans `acces`.

## Calcul du solde

Solde = ventes + remboursements des revendeurs − dépenses − argent prêté + remboursements des prêts.
Manquement = solde − argent en main.
