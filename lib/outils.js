// Outils partagés : formats, dates, regroupements et calculs de la boutique.
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const CATEGORIES = ['Achat de stock', 'Loyer', 'Électricité et eau', 'Internet et téléphone', 'Transport', 'Fournitures', 'Réparations et matériel', 'Autre'];
export const STOCK = 'Achat de stock';

export const n = v => Number(v) || 0;
export const fmt = v => Math.round(n(v)).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' F';
export const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const dfr = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+d} ${MOIS[+m - 1]} ${y}`; };
export const moisFr = ym => `${MOIS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
export const key = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const sum = (a, f) => a.reduce((t, x) => t + n(x[f]), 0);
export const recent = a => [...a].sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.created_at || '').localeCompare(x.created_at || '') || n(y.ordre) - n(x.ordre));

export function groupBy(rows, field, a, b) {
  const g = new Map();
  for (const r of rows) {
    const k = key(r[field]); if (!k) continue;
    if (!g.has(k)) g.set(k, { k, nom: String(r[field]).trim(), rows: [], d: 0, r: 0 });
    const e = g.get(k); e.rows.push(r); e.d += n(r[a]); e.r += n(r[b]);
  }
  return [...g.values()].sort((x, y) => (y.d - y.r) - (x.d - x.r));
}

// Solde = ventes + remboursements des revendeurs − dépenses − argent prêté + remboursements des prêts.
export function calculs(S) {
  const ventes = sum(S.ventes, 'montant'), depenses = sum(S.depenses, 'montant');
  const stock = sum(S.depenses.filter(d => d.categorie === STOCK), 'montant');
  const revDette = sum(S.revendeurs, 'dette'), revRemb = sum(S.revendeurs, 'rembourse');
  const arg = S.prets.filter(p => p.type !== 'MATERIEL'), mat = S.prets.filter(p => p.type === 'MATERIEL');
  const argPret = sum(arg, 'pret'), argRemb = sum(arg, 'rembourse'), matPret = sum(mat, 'pret'), matRemb = sum(mat, 'rembourse');
  const ym = today().slice(0, 7);
  const vMois = S.ventes.filter(v => v.date?.startsWith(ym)), dMois = S.depenses.filter(d => d.date?.startsWith(ym));
  return {
    ventes, depenses, stock, charges: depenses - stock, revDette, revRemb, revReste: revDette - revRemb,
    argPret, argRemb, argReste: argPret - argRemb, matPret, matRemb, matReste: matPret - matRemb,
    solde: ventes + revRemb - depenses - argPret + argRemb + matRemb,
    ym, ventesMois: sum(vMois, 'montant'), joursMois: vMois.length, depMois: sum(dMois, 'montant'),
    moyenne: S.ventes.length ? ventes / S.ventes.length : 0,
  };
}
