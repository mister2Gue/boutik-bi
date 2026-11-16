'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './landing.css';

/* Page d'accueil montrée avant la connexion. Elle se pose par-dessus l'écran de connexion
   et disparaît quand on touche « Se connecter » ou « Créer un compte ». */

const I = {
  cal: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Zm13 7h.01',
  users: 'M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 9v-1.5a3.5 3.5 0 0 0-2.5-3.35M15 4.15a3.5 3.5 0 0 1 0 6.7',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  shield: 'M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6z',
  note: 'M5 4h14a1 1 0 0 1 1 1v10l-5 5H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm10 16v-4a1 1 0 0 1 1-1h4M8 9h8M8 13h5',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2',
};
const Svg = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const Ok = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7" /></svg>;
const initiales = s => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'B';

const FEATS = [
  ['cal', 'Ma journée', 'Notez chaque vente et chaque dépense en quelques secondes. Le total et le bilan du jour se calculent tout seuls, même les jours à 0 F.'],
  ['wallet', 'Manquement automatique', "Entrez l'argent que vous avez en main : l'application vous dit tout de suite combien il manque par rapport au solde."],
  ['users', 'Revendeurs', 'Ce que chaque revendeur vous doit, ce qu’il a déjà rendu et ce qui reste, personne par personne.'],
  ['tag', 'Prêts : argent et matériel', "L'argent prêté et le matériel donné à crédit sont séparés, avec une note pour chaque opération."],
  ['file', 'Rapports PDF', 'Choisissez la période et les parties, puis téléchargez un rapport propre avec le nom et le logo de la boutique.'],
  ['shield', 'Accès sécurisé', 'Vous décidez qui peut voir. Un associé ou un comptable peut consulter sans pouvoir rien modifier.'],
];

export default function Porte() {
  const [phase, setPhase] = useState('check');
  const [connecte, setConnecte] = useState(false);
  const [b, setB] = useState({ nom: 'Boutik bi', slogan: 'Gestion de la boutique', logo: null });

  useEffect(() => {
    supabase.from('boutique').select('nom, slogan, logo').eq('id', 1).maybeSingle().then(({ data }) => data && setB(x => ({ ...x, ...data })));
    supabase.auth.getSession().then(({ data }) => { setConnecte(!!data.session); setPhase(data.session || location.hash === '#connexion' ? 'off' : 'on'); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      setConnecte(!!s);
      if (s) setPhase('off');
      else if (e === 'SIGNED_OUT') setPhase('on');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = phase === 'on' ? 'hidden' : '';
    if (phase === 'on') document.title = `${b.nom} · Gestion de boutique`;
  }, [phase, b.nom]);

  const entrer = creer => {
    setPhase('off');
    if (creer) setTimeout(() => {
      const btn = [...document.querySelectorAll('.authbox .linkbtn')].find(x => /créer/i.test(x.textContent));
      btn?.click();
    }, 60);
  };

  if (phase === 'check') return null;
  if (phase === 'off') return connecte ? null : (
    <button className="lp-btn light sm" onClick={() => setPhase('on')} style={{ position: 'fixed', top: 14, right: 14, zIndex: 60, boxShadow: '0 4px 14px rgba(12, 37, 87, .18)', border: '1px solid var(--line)' }}>‹ Accueil</button>
  );

  const Logo = () => (
    <div className="brand">
      <div className="logo" style={b.logo ? { background: '#fff', overflow: 'hidden' } : undefined}>
        {b.logo ? <img src={b.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : initiales(b.nom)}
      </div>
      <div style={{ minWidth: 0 }}><b>{b.nom}</b>{b.slogan && <span>{b.slogan}</span>}</div>
    </div>
  );

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap">
          <Logo />
          <nav aria-label="Navigation">
            <a className="hide" href="#lp-fonctions">Fonctions</a>
            <a className="hide" href="#lp-caisse">La caisse</a>
            <button className="lp-btn light sm" onClick={() => entrer(false)}>Se connecter</button>
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap">
          <div>
            <span className="lp-tag"><i /> Logiciel de gestion de boutique</span>
            <h1>Votre caisse, vos ventes et ce qu’on vous doit, <em>au franc près.</em></h1>
            <p className="lead">Fini le cahier et les calculs à la main. Notez chaque vente et chaque dépense, suivez vos revendeurs et vos prêts, et sachez à tout moment combien il devrait y avoir dans la caisse.</p>
            <div className="lp-ctas">
              <button className="lp-btn pri" onClick={() => entrer(false)}>Se connecter</button>
              <button className="lp-btn ghost" onClick={() => entrer(true)}>Créer un compte</button>
            </div>
            <div className="lp-trust">
              <span><Ok /> Sur téléphone et ordinateur</span>
              <span><Ok /> Calculs automatiques</span>
              <span><Ok /> Données sécurisées</span>
            </div>
          </div>

          <div className="lp-shot" aria-hidden="true">
            <div className="s-side">
              <b>{b.nom}</b>
              <span className="on">Tableau de bord</span><span>Ma journée</span><span>Ventes</span><span>Dépenses</span><span>Revendeurs</span><span>Prêts</span><span>Notes</span>
            </div>
            <div className="s-main">
              <div className="s-kpis">
                <div className="s-kpi pri">Solde<b>324 500 F</b></div>
                <div className="s-kpi">Ventes du jour<b>48 000 F</b></div>
                <div className="s-kpi">Dépenses<b>6 500 F</b></div>
              </div>
              <div className="s-card">
                <h4>Évolution des ventes</h4>
                <div className="s-bars">
                  {[38, 52, 30, 64, 45, 70, 58, 92, 50, 66, 42, 75].map((h, i) => <i key={i} className={h === 92 ? 'best' : ''} style={{ height: h + '%', animationDelay: i * 45 + 'ms' }} />)}
                </div>
              </div>
              <div className="s-card">
                <h4>Aujourd’hui</h4>
                <div className="s-row"><span>Chargeur type C</span><span className="p">+ 3 500 F</span></div>
                <div className="s-row"><span>Écouteurs</span><span className="p">+ 5 000 F</span></div>
                <div className="s-row"><span>Transport</span><span className="m">− 1 000 F</span></div>
              </div>
              <div className="s-alert">Il manque 4 500 F dans la caisse</div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="lp-fonctions">
        <div className="lp-wrap">
          <div className="lp-head">
            <small>Fonctions</small>
            <h2>Tout ce qu’il faut pour tenir la boutique</h2>
            <p>Pensé pour une boutique au quotidien : simple à remplir, et les totaux se font tout seuls.</p>
          </div>
          <div className="lp-feats">
            {FEATS.map(([ic, t, d]) => (
              <article className="lp-feat" key={t}>
                <span className="ico"><Svg d={I[ic]} /></span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec alt" id="lp-caisse">
        <div className="lp-wrap lp-split">
          <div>
            <div className="lp-head" style={{ textAlign: 'left', margin: 0 }}><small>La caisse</small></div>
            <h2>Sachez exactement ce qui devrait être dans la caisse</h2>
            <p>L’application fait le calcul pour vous, à chaque vente, dépense, prêt ou remboursement. Comparez avec l’argent que vous avez en main et voyez tout de suite s’il manque quelque chose.</p>
            <ul className="lp-list">
              <li><Ok /> Les ventes à crédit et le matériel donné vont dans les prêts, pas dans les ventes.</li>
              <li><Ok /> Chaque remboursement reçu s’ajoute au solde automatiquement.</li>
              <li><Ok /> Le tableau de bord vous prévient si aucune vente n’a été notée depuis plusieurs jours.</li>
            </ul>
          </div>
          <div className="lp-formula" aria-label="Exemple de calcul du solde">
            <div className="l"><span>Ventes</span><b>+ 1 676 500 F</b></div>
            <div className="l"><span>Remboursements reçus</span><b>+ 693 000 F</b></div>
            <div className="l"><span>Dépenses</span><b>− 638 000 F</b></div>
            <div className="l"><span>Argent prêté</span><b>− 1 356 000 F</b></div>
            <div className="l tot"><span>Solde</span><b>375 500 F</b></div>
            <div className="miss"><span>En main : 371 000 F</span><span>Il manque 4 500 F</span></div>
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-head">
            <small>Comment ça marche</small>
            <h2>Prêt en trois étapes</h2>
          </div>
          <div className="lp-steps">
            <div className="lp-step"><h3>Connectez-vous</h3><p>Avec l’email autorisé par le propriétaire de la boutique, sur téléphone ou ordinateur.</p></div>
            <div className="lp-step"><h3>Notez la journée</h3><p>Chaque vente et chaque dépense, au moment où elles arrivent. Une journée sans vente se note en un geste.</p></div>
            <div className="lp-step"><h3>Suivez et contrôlez</h3><p>Tableau de bord, comptes des revendeurs, prêts, notes et rapports PDF quand vous en avez besoin.</p></div>
          </div>
        </div>
      </section>

      <section className="lp-sec" style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="lp-cta">
            <h2>Prêt à tenir la boutique sans cahier ?</h2>
            <p>Connectez-vous pour retrouver vos ventes, vos dépenses et vos comptes, où que vous soyez.</p>
            <div className="lp-ctas" style={{ justifyContent: 'center' }}>
              <button className="lp-btn light" onClick={() => entrer(false)}>Se connecter</button>
              <button className="lp-btn ghost" onClick={() => entrer(true)}>Créer un compte</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <span>© {new Date().getFullYear()} {b.nom}</span>
          <span>Géré avec Boutik bi</span>
        </div>
      </footer>
    </div>
  );
}
