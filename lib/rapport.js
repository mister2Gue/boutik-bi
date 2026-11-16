// Génère le rapport PDF de la boutique selon les choix de l'utilisateur.
import { CATEGORIES, STOCK, calculs, dfr, fmt, groupBy, moisFr, n, parJour, sum } from './outils';

const BLEU = [31, 90, 214];
const NUIT = [12, 37, 87];
const GRIS = [91, 107, 133];

export async function genererRapport(S, opts) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const dans = d => (opts.tout ? true : !!d && d >= opts.du && d <= opts.au);
  const periodeTxt = opts.tout ? 'Toutes les données' : `Du ${dfr(opts.du)} au ${dfr(opts.au)}`;

  // En-tête
  doc.setFillColor(...NUIT); doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Boutik bi', M, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.text('Rapport de gestion de la boutique', M, 20);
  doc.text(periodeTxt, W - M, 13, { align: 'right' });
  doc.setFontSize(9); doc.text(`Créé le ${dfr(opts.aujourdhui)}`, W - M, 20, { align: 'right' });
  let y = 40;

  const titre = t => {
    if (y > 260) { doc.addPage(); y = 18; }
    doc.setTextColor(...NUIT); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(t, M, y);
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.6); doc.line(M, y + 2, M + 24, y + 2);
    y += 7;
  };
  const note = t => { doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(doc.splitTextToSize(t, W - 2 * M), M, y); y += 5; };
  const table = (head, body, extra = {}) => {
    autoTable(doc, {
      startY: y, head: [head], body, margin: { left: M, right: M }, theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, lineColor: [225, 232, 242], textColor: [15, 29, 51] },
      headStyles: { fillColor: BLEU, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 249, 253] },
      ...extra,
    });
    y = doc.lastAutoTable.finalY + 9;
  };
  const droite = cols => Object.fromEntries(cols.map(i => [i, { halign: 'right' }]));
  const totalRow = { fontStyle: 'bold', fillColor: [232, 239, 252] };

  const ventes = S.ventes.filter(v => dans(v.date)).sort((a, b) => a.date.localeCompare(b.date));
  const depenses = S.depenses.filter(d => dans(d.date));
  const sansDate = opts.tout ? 0 : S.depenses.filter(d => !d.date).length;
  const totV = sum(ventes, 'montant'), totD = sum(depenses, 'montant');
  const stock = sum(depenses.filter(d => d.categorie === STOCK), 'montant');
  const c = calculs(S);
  const jours = parJour(ventes).sort((a, b) => a.date.localeCompare(b.date));
  const nbJ = jours.length;

  if (opts.resume) {
    titre('Résumé');
    table(['Indicateur', 'Montant'], [
      ['Ventes de la période', fmt(totV)],
      ['Jours de vente notés', String(nbJ)],
      ['Moyenne par jour', fmt(nbJ ? totV / nbJ : 0)],
      ['Dépenses de la période', fmt(totD)],
      ['   dont achat de stock', fmt(stock)],
      ['   dont charges (hors stock)', fmt(totD - stock)],
      [{ content: 'Ventes - dépenses de la période', styles: totalRow }, { content: fmt(totV - totD), styles: totalRow }],
    ], { columnStyles: droite([1]) });
    table(['Situation à ce jour', 'Montant'], [
      [{ content: 'Solde (argent qui devrait être en caisse)', styles: totalRow }, { content: fmt(c.solde), styles: totalRow }],
      ['Revendeurs : reste à récupérer', fmt(c.revReste)],
      ['Argent prêté à récupérer', fmt(c.argReste)],
      ['Matériel à crédit à récupérer', fmt(c.matReste)],
      ['Total à récupérer', fmt(c.revReste + c.argReste + c.matReste)],
    ], { columnStyles: droite([1]) });
  }

  if (opts.ventes) {
    titre('Ventes');
    const mois = [];
    jours.forEach(v => { const m = v.date.slice(0, 7); let g = mois[mois.length - 1]; if (!g || g.m !== m) { g = { m, j: 0, t: 0 }; mois.push(g); } g.j++; g.t += v.t; });
    table(['Mois', 'Jours notés', 'Total', 'Moyenne / jour'], [
      ...mois.map(g => [moisFr(g.m), String(g.j), fmt(g.t), fmt(g.t / g.j)]),
      [{ content: 'Total', styles: totalRow }, { content: String(nbJ), styles: totalRow }, { content: fmt(totV), styles: totalRow }, { content: fmt(nbJ ? totV / nbJ : 0), styles: totalRow }],
    ], { columnStyles: droite([1, 2, 3]) });
    if (opts.ventesDetail && nbJ) table(['Date', 'Nombre de ventes', 'Total du jour'], jours.map(j => [dfr(j.date), String(j.nb), fmt(j.t)]), { columnStyles: droite([1, 2]) });
    if (!ventes.length) note('Aucune vente notée sur cette période.');
  }

  if (opts.depenses) {
    titre('Dépenses');
    const parCat = CATEGORIES.map(cat => { const l = depenses.filter(d => (d.categorie || 'Autre') === cat); return [cat, l.length, sum(l, 'montant')]; }).filter(r => r[1]);
    table(['Catégorie', 'Nombre', 'Total', 'Part'], [
      ...parCat.map(([cat, nb, t]) => [cat, String(nb), fmt(t), totD ? Math.round(t / totD * 100) + ' %' : '-']),
      [{ content: 'Total', styles: totalRow }, { content: String(depenses.length), styles: totalRow }, { content: fmt(totD), styles: totalRow }, { content: '100 %', styles: totalRow }],
    ], { columnStyles: droite([1, 2, 3]) });
    if (opts.depensesDetail && depenses.length) {
      const tri = [...depenses].sort((a, b) => (a.categorie || '').localeCompare(b.categorie || '') || (a.date || '').localeCompare(b.date || ''));
      table(['Date', 'Description', 'Catégorie', 'Montant'], tri.map(d => [d.date ? dfr(d.date) : 'Sans date', d.description, d.categorie || 'Autre', fmt(d.montant)]), { columnStyles: droite([3]) });
    }
    if (sansDate) note(`${sansDate} dépense(s) notée(s) avant l'application n'ont pas de date : elles ne figurent que dans un rapport « Toutes les données ».`);
  }

  if (opts.revendeurs) {
    titre('Revendeurs (situation à ce jour)');
    const g = groupBy(S.revendeurs, 'nom', 'dette', 'rembourse').filter(x => opts.soldes || x.d - x.r > 0);
    table(['Revendeur', 'Total dû', 'Rendu', 'Reste'], [
      ...g.map(x => [x.nom, fmt(x.d), fmt(x.r), fmt(x.d - x.r)]),
      [{ content: 'Total', styles: totalRow }, { content: fmt(sum(g, 'd')), styles: totalRow }, { content: fmt(sum(g, 'r')), styles: totalRow }, { content: fmt(sum(g, 'd') - sum(g, 'r')), styles: totalRow }],
    ], { columnStyles: droite([1, 2, 3]) });
  }

  if (opts.prets) {
    titre('Prêts (situation à ce jour)');
    const lignes = [];
    for (const type of ['ARGENT', 'MATERIEL']) {
      groupBy(S.prets.filter(p => (p.type === 'MATERIEL') === (type === 'MATERIEL')), 'personne', 'pret', 'rembourse')
        .filter(x => opts.soldes || x.d - x.r > 0)
        .forEach(x => lignes.push([x.nom, type === 'MATERIEL' ? 'Matériel' : 'Argent', fmt(x.d), fmt(x.r), fmt(x.d - x.r)]));
    }
    table(['Personne', 'Type', 'Prêté', 'Rendu', 'Reste'], [
      ...lignes,
      [{ content: 'Total', styles: totalRow }, { content: '', styles: totalRow }, { content: fmt(c.argPret + c.matPret), styles: totalRow }, { content: fmt(c.argRemb + c.matRemb), styles: totalRow }, { content: fmt(c.argReste + c.matReste), styles: totalRow }],
    ], { columnStyles: droite([2, 3, 4]) });
  }

  // Pied de page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text(`Boutik bi · ${periodeTxt}`, M, 290);
    doc.text(`Page ${i} / ${pages}`, W - M, 290, { align: 'right' });
  }
  const nom = opts.tout ? 'tout' : `${opts.du}_${opts.au}`;
  doc.save(`boutik-bi-rapport-${nom}.pdf`);
}
