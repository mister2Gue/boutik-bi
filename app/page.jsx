'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CATEGORIES, STOCK, calculs, dfr, fmt, groupBy, key, moisFr, n, parJour, recent, sum, today } from '../lib/outils';

const AVANT = "Avant l'application";
const AUCUNE = 'Aucune vente';

/* ---------- icônes ---------- */
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01',
  out: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  users: 'M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 9v-1.5a3.5 3.5 0 0 0-2.5-3.35M15 4.15a3.5 3.5 0 0 1 0 6.7',
  hand: 'M7 11V7a2 2 0 1 1 4 0v4m0-2V5a2 2 0 1 1 4 0v6m0-3a2 2 0 1 1 4 0v5a7 7 0 0 1-7 7h-1a7 7 0 0 1-6.2-3.8L3 13.5a1.8 1.8 0 0 1 3-1.9L7 13',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Zm13 7h.01',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  check: 'M5 12.5 10 17 19 7',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  shield: 'M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6z',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01',
  cal: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  store: 'M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M3 7l2-4h14l2 4M3 7h18v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM9 20v-5h6v5',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
};
const Ic = ({ name }) => <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d={P[name]} /></svg>;

const DEFAUT = { nom: 'Boutik bi', slogan: 'Gestion de la boutique', logo: null };
const initiales = s => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'B';
const Brand = ({ b, small }) => (
  <div className="brand">
    <div className="logo" style={b.logo ? { background: '#fff', overflow: 'hidden' } : undefined}>{b.logo ? <img src={b.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : initiales(b.nom)}</div>
    <div style={{ minWidth: 0 }}><b>{b.nom}</b>{!small && b.slogan && <span>{b.slogan}</span>}</div>
  </div>
);

const VIEWS = [
  { id: 'accueil', lab: 'Tableau de bord', short: 'Accueil', ic: 'home', sub: "Vue d'ensemble de la boutique" },
  { id: 'journee', lab: 'Ma journée', short: 'Journée', ic: 'cal', sub: 'Notez chaque vente et chaque dépense : les totaux du jour se font tout seuls' },
  { id: 'ventes', lab: 'Ventes', short: 'Ventes', ic: 'cart', sub: 'Le total vendu chaque jour' },
  { id: 'depenses', lab: 'Dépenses', short: 'Dépenses', ic: 'out', sub: 'Tout ce qui sort de la caisse, rangé par catégorie' },
  { id: 'revendeurs', lab: 'Revendeurs', short: 'Revend.', ic: 'users', sub: 'Ce que les revendeurs vous doivent et ont rendu' },
  { id: 'prets', lab: 'Prêts', short: 'Prêts', ic: 'hand', sub: 'Argent prêté et matériel donné à crédit' },
  { id: 'rapports', lab: 'Rapports PDF', short: 'Rapports', ic: 'file', sub: 'Choisissez la période et les parties, puis téléchargez le PDF' },
  { id: 'parametres', lab: 'Ma boutique', short: 'Boutique', ic: 'store', sub: 'Nom, slogan et logo de la boutique', admin: true },
  { id: 'acces', lab: 'Accès', short: 'Accès', ic: 'shield', sub: 'Qui peut voir ou modifier les données', admin: true },
];

/* ---------- page ---------- */
export default function Home() {
  const [session, setSession] = useState(undefined);
  const [role, setRole] = useState(undefined);
  const [boutique, setBoutique] = useState(DEFAUT);
  const chargerBoutique = useCallback(async () => {
    const { data } = await supabase.from('boutique').select('nom, slogan, logo').eq('id', 1).maybeSingle();
    if (data) setBoutique({ ...DEFAUT, ...data });
  }, []);
  useEffect(() => { chargerBoutique(); }, [chargerBoutique]);
  useEffect(() => { document.title = boutique.nom; }, [boutique.nom]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setRole(undefined); return; }
    supabase.rpc('mon_role').then(({ data, error }) => setRole(error ? null : data || null));
  }, [session]);

  if (session === undefined || (session && role === undefined)) return <div className="authpage"><div className="formside" style={{ gridColumn: '1 / -1' }}><p className="hint">Chargement…</p></div></div>;
  if (!session) return <Auth boutique={boutique} />;
  if (!role) return (
    <div className="authpage"><div className="formside" style={{ gridColumn: '1 / -1' }}><div className="authbox">
      <h2>Accès pas encore autorisé</h2>
      <p className="hint">Vous êtes connecté avec <b>{session.user.email}</b>, mais cette adresse n'est pas dans la liste des personnes autorisées. Demandez au propriétaire de l'ajouter, puis rechargez la page.</p>
      <button className="btn" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
    </div></div></div>
  );
  return <App session={session} admin={role === 'admin'} boutique={boutique} rechargerBoutique={chargerBoutique} />;
}

/* ---------- connexion ---------- */
function Auth({ boutique }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState({ t: '', c: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg({ t: '', c: '' });
    const res = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin } });
    setBusy(false);
    if (res.error) setMsg({ c: 'err', t: mode === 'login' ? 'Email ou mot de passe incorrect.' : "Le compte n'a pas pu être créé : " + res.error.message });
    else if (mode === 'signup' && !res.data.session) setMsg({ c: 'ok', t: 'Compte créé. Ouvrez le mail de confirmation, puis revenez vous connecter.' });
  }

  return (
    <div className="authpage">
      <div className="hero">
        <Brand b={boutique} />
        <h2>Suivez votre caisse, vos ventes et ce qu'on vous doit.</h2>
        <ul>
          <li><Ic name="check" /> Vente du jour notée en quelques secondes</li>
          <li><Ic name="check" /> Revendeurs et prêts suivis personne par personne</li>
          <li><Ic name="check" /> Rapports PDF de la période de votre choix</li>
        </ul>
      </div>
      <div className="formside">
        <div className="authbox">
          <div><h2 style={{ fontSize: 22 }}>{mode === 'login' ? 'Se connecter' : 'Créer un compte'}</h2>
            <p className="hint">{mode === 'login' ? 'Entrez votre email et votre mot de passe.' : "Utilisez l'email que le propriétaire a autorisé. Mot de passe : 6 caractères minimum."}</p></div>
          <form onSubmit={submit}>
            <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></div>
            <div className="field"><label htmlFor="pw">Mot de passe</label><input id="pw" type="password" required minLength={6} value={pw} onChange={e => setPw(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
            <button className="btn" disabled={busy}>{busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}</button>
            <p className={'msg ' + msg.c}>{msg.t}</p>
          </form>
          <p className="hint">
            {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
            <button className="linkbtn" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg({ t: '', c: '' }); }}>
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- application ---------- */
function App({ session, admin, boutique, rechargerBoutique }) {
  const views = VIEWS.filter(v => !v.admin || admin);
  const [view, setView] = useState('accueil');
  const [S, setS] = useState({ ventes: [], depenses: [], revendeurs: [], prets: [], caisse: null });
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [maj, setMaj] = useState('');

  useEffect(() => {
    const read = () => { const h = location.hash.slice(1); setView(VIEWS.some(v => v.id === h) ? h : 'accueil'); scrollTo(0, 0); };
    read(); addEventListener('hashchange', read); return () => removeEventListener('hashchange', read);
  }, []);

  const load = useCallback(async (tables = ['ventes', 'depenses', 'revendeurs', 'prets', 'caisse']) => {
    const res = await Promise.all(tables.map(t => supabase.from(t).select('*')));
    if (res.some(r => r.error)) { setErr('Impossible de lire les données. Vérifiez la connexion et rechargez la page.'); return; }
    setErr('');
    setS(prev => {
      const next = { ...prev };
      tables.forEach((t, i) => { next[t] = t === 'caisse' ? (res[i].data[0] || null) : res[i].data; });
      return next;
    });
    setLoaded(true);
    const d = new Date(); setMaj(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const fresh = () => { if (document.visibilityState === 'visible') load(); };
    const t = setInterval(fresh, 60000);
    addEventListener('focus', fresh); document.addEventListener('visibilitychange', fresh);
    return () => { clearInterval(t); removeEventListener('focus', fresh); document.removeEventListener('visibilitychange', fresh); };
  }, [load]);

  const c = useMemo(() => calculs(S), [S]);
  const V = views.find(v => v.id === view) || views[0];
  const ctx = { S, c, load, admin, session, maj, boutique };
  const logout = <button className="logout" onClick={() => supabase.auth.signOut()}><Ic name="logout" /> Se déconnecter</button>;

  return (
    <div className="app">
      <aside className="side">
        <Brand b={boutique} />
        <nav className="menu" aria-label="Menu">
          {views.map(v => <a key={v.id} href={'#' + v.id} className={V.id === v.id ? 'on' : ''}><Ic name={v.ic} />{v.lab}</a>)}
        </nav>
        <div className="foot"><span className="who">{session.user.email}</span><span className="rolepill">{admin ? 'Administrateur' : 'Lecture seule'}</span>{logout}</div>
      </aside>

      <div className="content">
        <div className="mtop"><Brand b={boutique} small />{logout}</div>
        <header className="pagehead">
          <div><h1>{V.lab}</h1><p>{V.sub}</p></div>
          <div className="headright">
            {!admin && <span className="pill view"><Ic name="eye" /> Lecture seule</span>}
            {loaded && <div className="soldechip">Solde <b className="num">{fmt(c.solde)}</b></div>}
          </div>
        </header>
        <main className="page">
          {!loaded && !err && <div className="banner">Chargement des données…</div>}
          {err && <div className="banner err">{err}</div>}
          {loaded && V.id === 'accueil' && <Accueil {...ctx} />}
          {loaded && V.id === 'journee' && <Journee {...ctx} />}
          {loaded && V.id === 'ventes' && <Ventes {...ctx} />}
          {loaded && V.id === 'depenses' && <Depenses {...ctx} />}
          {loaded && V.id === 'revendeurs' && <Revendeurs {...ctx} />}
          {loaded && V.id === 'prets' && <Prets {...ctx} />}
          {loaded && V.id === 'rapports' && <Rapports {...ctx} />}
          {loaded && V.id === 'parametres' && admin && <Parametres boutique={boutique} recharger={rechargerBoutique} />}
          {loaded && V.id === 'acces' && admin && <Acces {...ctx} />}
        </main>
      </div>

      <nav className="bottomnav" aria-label="Menu">
        {views.map(v => <a key={v.id} href={'#' + v.id} className={V.id === v.id ? 'on' : ''}><Ic name={v.ic} />{v.short}</a>)}
      </nav>
    </div>
  );
}

/* ---------- petits composants ---------- */
const Kpi = ({ lab, val, sub, ic, cls = '' }) => (
  <div className={'kpi ' + cls}>
    <div className="top"><span>{lab}</span><span className="ico"><Ic name={ic} /></span></div>
    <span className="val num">{fmt(val)}</span>
    {sub && <span className="sub">{sub}</span>}
  </div>
);

function useSave() {
  const [msg, setMsg] = useState({ t: '', c: '' });
  const run = async (fn, ok) => {
    setMsg({ t: 'Enregistrement…', c: '' });
    const { error } = await fn();
    if (error) { setMsg({ t: "L'enregistrement n'a pas marché. Vérifiez la connexion et réessayez.", c: 'err' }); return false; }
    setMsg({ t: ok, c: 'ok' }); setTimeout(() => setMsg(m => (m.t === ok ? { t: '', c: '' } : m)), 3000);
    return true;
  };
  return [msg, run];
}

function DelBtn({ table, id, load, match = 'id', short }) {
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 4000); return () => clearTimeout(t); }, [arm]);
  return (
    <button className={'lnk' + (arm ? ' arm' : '')} disabled={busy} onClick={async e => {
      e.stopPropagation();
      if (!arm) return setArm(true);
      setBusy(true); const { error } = await supabase.from(table).delete().eq(match, id); setBusy(false);
      if (!error) load([table]); else setArm(false);
    }} aria-label="Supprimer">{arm ? (short ? 'Sûr ?' : 'Confirmer ?') : (short ? '✕' : 'Supprimer')}</button>
  );
}

const Seg = ({ value, onChange, options, label }) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map(([v, l]) => <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
  </div>
);

const Bar = ({ d, r }) => <div className="bar"><i style={{ width: (d > 0 ? Math.min(100, Math.max(0, r / d * 100)) : 100) + '%' }} /></div>;

/* ---------- tableau de bord ---------- */
const addDays = (s, k) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const ecart = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
const PERIODES = [['7j', '7 jours'], ['30j', '30 jours'], ['mois', 'Ce mois'], ['moisdernier', 'Mois dernier'], ['tout', 'Tout']];

function bornes(id) {
  const t = today(), [y, m, d] = t.split('-').map(Number);
  const pad = x => String(x).padStart(2, '0');
  const finMois = (yy, mm) => `${yy}-${pad(mm)}-${pad(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`;
  const moisAvant = (yy, mm) => (mm === 1 ? [yy - 1, 12] : [yy, mm - 1]);
  if (id === '7j' || id === '30j') {
    const k = id === '7j' ? 7 : 30, du = addDays(t, -(k - 1));
    return { du, au: t, pdu: addDays(du, -k), pau: addDays(du, -1), lab: `${k} jours précédents` };
  }
  if (id === 'mois') {
    const [py, pm] = moisAvant(y, m);
    const pau = `${py}-${pad(pm)}-${pad(Math.min(d, +finMois(py, pm).slice(8)))}`;
    return { du: `${y}-${pad(m)}-01`, au: t, pdu: `${py}-${pad(pm)}-01`, pau, lab: `même période de ${moisFr(`${py}-${pad(pm)}`)}` };
  }
  if (id === 'moisdernier') {
    const [py, pm] = moisAvant(y, m), [qy, qm] = moisAvant(py, pm);
    return { du: `${py}-${pad(pm)}-01`, au: finMois(py, pm), pdu: `${qy}-${pad(qm)}-01`, pau: finMois(qy, qm), lab: moisFr(`${qy}-${pad(qm)}`) };
  }
  return { tout: true };
}

function useCountUp(value, ms = 650) {
  const [v, setV] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current; prev.current = value;
    if (from === value || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)) { setV(value); return; }
    let raf; const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); setV(from + (value - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

function Delta({ cur, prev, inverse, lab }) {
  if (prev == null) return null;
  if (!prev && !cur) return <span className="delta flat">= {lab}</span>;
  if (!prev) return <span className={'delta ' + (inverse ? 'down' : 'up')}>nouveau vs {lab}</span>;
  const p = Math.round((cur - prev) / Math.abs(prev) * 100);
  const bon = inverse ? p < 0 : p > 0;
  return <span className={'delta ' + (p === 0 ? 'flat' : bon ? 'up' : 'down')} title={`Avant : ${fmt(prev)}`}>{p > 0 ? '▲' : p < 0 ? '▼' : '='} {Math.abs(p)} % vs {lab}</span>;
}

function KpiLive({ lab, val, ic, cls = '', sub, href, delta }) {
  const v = useCountUp(val);
  const Tag = href ? 'a' : 'div';
  return (
    <Tag className={'kpi ' + cls + (href ? ' link' : '')} href={href}>
      <div className="top"><span>{lab}</span><span className="ico"><Ic name={ic} /></span></div>
      <span className="val num">{fmt(v)}</span>
      {delta}
      {sub && <span className="sub">{sub}</span>}
    </Tag>
  );
}

function Accueil({ S, c, load, admin, maj }) {
  const [per, setPer] = useState('30j');
  const [val, setVal] = useState(S.caisse?.en_main ?? '');
  const [msg, run] = useSave();
  const b = bornes(per);
  const dans = (d, du, au) => !!d && d >= du && d <= au;
  const pick = (rows, du, au) => (b.tout ? rows : rows.filter(r => dans(r.date, du, au)));
  const V = pick(S.ventes, b.du, b.au), D = pick(S.depenses, b.du, b.au);
  const Vp = b.tout ? null : S.ventes.filter(r => dans(r.date, b.pdu, b.pau)), Dp = b.tout ? null : S.depenses.filter(r => dans(r.date, b.pdu, b.pau));
  const totV = sum(V, 'montant'), totD = sum(D, 'montant');
  const prevV = Vp && sum(Vp, 'montant'), prevD = Dp && sum(Dp, 'montant');
  const remb = sum(pick(S.revendeurs, b.du, b.au), 'rembourse') + sum(pick(S.prets, b.du, b.au), 'rembourse');
  const enMain = S.caisse?.en_main ?? null;
  const m = enMain == null ? null : c.solde - n(enMain);
  const aRecup = c.revReste + c.argReste + c.matReste;
  const top = groupBy(S.revendeurs, 'nom', 'dette', 'rembourse').filter(g => g.d - g.r > 0).slice(0, 5);
  const derniere = S.ventes.reduce((x, v) => (v.date > x ? v.date : x), '');
  const retard = derniere ? ecart(derniere, today()) : null;
  const nbJ = new Set(V.map(v => v.date)).size;
  const nbJours = b.tout ? nbJ : ecart(b.du, b.au) + 1;

  return (
    <>
      <div className="dashbar">
        <div className="chips" role="group" aria-label="Période">
          {PERIODES.map(([id, l]) => <button key={id} type="button" className={'chip' + (per === id ? ' on' : '')} onClick={() => setPer(id)}>{l}</button>)}
        </div>
        <div className="majinfo">
          <span className="livedot" aria-hidden="true" /> {b.tout ? 'Toutes les données' : `Du ${dfr(b.du)} au ${dfr(b.au)}`}
          <button type="button" className="lnk" onClick={() => load()} title="Recharger les données">Actualiser{maj ? ` · ${maj}` : ''}</button>
        </div>
      </div>

      {(retard > 1 || (m != null && m > 0)) && (
        <div className="alerts">
          {retard > 1 && <a className="alert warn" href="#journee"><Ic name="clock" /><span><b>Aucune vente notée depuis le {dfr(derniere)}</b> ({retard} jours).{admin && ' Touchez ici pour noter les ventes.'}</span></a>}
          {m != null && m > 0 && <div className="alert bad"><Ic name="wallet" /><span><b>Il manque {fmt(m)}</b> dans la caisse par rapport au solde.</span></div>}
        </div>
      )}

      <div className="kpis">
        <KpiLive cls="primary" ic="wallet" lab="Solde actuel" val={c.solde} sub="Argent qui devrait être en caisse" />
        <KpiLive cls="good" ic="trend" lab="Ventes" val={totV} href="#ventes" delta={<Delta cur={totV} prev={prevV} lab={b.lab} />}
          sub={`${nbJ} jour${nbJ > 1 ? 's' : ''} noté${nbJ > 1 ? 's' : ''}${b.tout ? '' : ` sur ${nbJours}`} · ${fmt(nbJ ? totV / nbJ : 0)}/jour`} />
        <KpiLive cls="bad" ic="out" lab="Dépenses" val={totD} href="#depenses" delta={<Delta cur={totD} prev={prevD} inverse lab={b.lab} />}
          sub={`${D.length} dépense${D.length > 1 ? 's' : ''}`} />
        <KpiLive cls="warn" ic="hand" lab="Remboursements reçus" val={remb} href="#revendeurs" sub={`Encore ${fmt(aRecup)} à récupérer`} />
      </div>

      <div className="grid-main">
        <ChartLive ventes={V} per={per} tout={b.tout} />
        <div className="card">
          <div className="card-head"><h2>Contrôle de caisse</h2></div>
          {admin && <>
            <form className="row" onSubmit={async e => {
              e.preventDefault();
              const v = val === '' ? null : Math.round(Number(val));
              if (await run(() => supabase.from('caisse').upsert({ id: 1, en_main: v, maj_le: today() }), 'Enregistré.')) load(['caisse']);
            }}>
              <div className="field wide"><label htmlFor="c-main">Argent que j'ai en main (F)</label>
                <input id="c-main" type="number" inputMode="numeric" min="0" step="1" placeholder="ex : 200000" value={val} onChange={e => setVal(e.target.value)} /></div>
              <button className="btn" type="submit">Enregistrer</button>
            </form>
            <p className={'msg ' + msg.c}>{msg.t}</p>
          </>}
          <div className={'res ' + (m == null ? 'none' : m > 0 ? 'bad' : 'good')}>
            <span>{m == null ? 'Manquement' : m > 0 ? 'Il manque' : m < 0 ? 'Vous avez en plus' : 'Rien ne manque'}</span>
            <b className="num">{m == null ? '—' : fmt(Math.abs(m))}</b>
            <span className="hint">{m == null ? "L'argent en main n'a pas encore été noté." : `Solde ${fmt(c.solde)} − en main ${fmt(enMain)}${S.caisse?.maj_le ? ' · noté le ' + dfr(S.caisse.maj_le) : ''}`}</span>
          </div>
          <p className="formula">Solde = ventes + remboursements des revendeurs − dépenses − argent prêté + remboursements des prêts. Manquement = solde − argent en main.</p>
        </div>
      </div>

      <div className="grid3">
        <Donut depenses={D} total={totD} />
        <div className="card">
          <div className="card-head"><h2>Qui doit le plus</h2><a className="hint" href="#revendeurs">Tout voir</a></div>
          <div className="rank">
            {top.length === 0 && <p className="hint">Aucun revendeur ne vous doit d'argent.</p>}
            {top.map((g, i) => (
              <a className="item" key={g.k} href="#revendeurs" style={{ animationDelay: i * 60 + 'ms' }}>
                <div className="line"><span>{g.nom}</span><b className="num">{fmt(g.d - g.r)}</b></div>
                <Bar d={g.d} r={g.r} />
              </a>
            ))}
          </div>
          <div className="breakdown">
            <div className="line"><span>Revendeurs</span><span className="num">{fmt(c.revReste)}</span></div>
            <div className="line"><span>Argent prêté</span><span className="num">{fmt(c.argReste)}</span></div>
            <div className="line"><span>Matériel à crédit</span><span className="num">{fmt(c.matReste)}</span></div>
            <div className="line"><span>Total à récupérer</span><span className="num">{fmt(aRecup)}</span></div>
          </div>
        </div>
        <Activite S={S} />
      </div>
    </>
  );
}

function ChartLive({ ventes, per, tout }) {
  const [mode, setMode] = useState(null);
  const [hover, setHover] = useState(null);
  const auto = tout ? 'mois' : per === '7j' || per === '30j' || per === 'mois' || per === 'moisdernier' ? 'jour' : 'semaine';
  const md = mode || auto;
  useEffect(() => { setMode(null); setHover(null); }, [per]);
  const lundi = s => { const d = new Date(s + 'T00:00:00Z'); const k = (d.getUTCDay() + 6) % 7; return addDays(s, -k); };
  const groups = new Map();
  [...ventes].sort((a, b) => a.date.localeCompare(b.date)).forEach(v => {
    const k = md === 'jour' ? v.date : md === 'semaine' ? lundi(v.date) : v.date.slice(0, 7);
    groups.set(k, (groups.get(k) || 0) + n(v.montant));
  });
  const pts = [...groups.entries()].map(([k, t]) => ({ k, t }));
  const label = k => md === 'mois' ? moisFr(k) : md === 'semaine' ? `Semaine du ${dfr(k)}` : dfr(k);
  const court = k => { if (md === 'mois') return MOIS_COURTS[+k.slice(5) - 1]; const [, mo, d] = k.split('-'); return `${+d}/${+mo}`; };
  const W = 640, H = 230, L = 46, B = 24, T = 14, R = 8;
  const max = Math.max(...pts.map(p => p.t), 1);
  const p10 = Math.pow(10, Math.floor(Math.log10(max)));
  const step = max / p10 < 3 ? p10 / 2 : p10;
  const top = Math.ceil(max / step) * step;
  const y = v => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - R) / Math.max(pts.length, 1);
  const avg = pts.length ? sum(pts, 't') / pts.length : 0;
  const best = pts.reduce((a, p, i) => (p.t > (pts[a]?.t ?? -1) ? i : a), 0);
  const every = Math.max(1, Math.ceil(pts.length / 8));
  const grid = []; for (let g = 0; g <= top; g += step) grid.push(g);
  const h = hover != null ? pts[hover] : null;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Évolution des ventes</h2>
        <Seg label="Regrouper par" value={md} onChange={v => { setMode(v); setHover(null); }} options={[['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois']]} />
      </div>
      {pts.length === 0 ? <p className="hint">Aucune vente notée sur cette période.</p> : (
        <div className="chart live" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ventes sur la période" key={md + per}>
            {grid.map(g => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--line)" /><text x={L - 6} y={y(g) + 4} textAnchor="end">{g >= 1000 ? g / 1000 + 'k' : g}</text></g>)}
            {pts.map((p, i) => {
              const x = L + i * bw + bw * 0.16, w = Math.max(2, bw * 0.68), on = hover === i;
              return (
                <g key={p.k} onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)} style={{ cursor: 'pointer' }}>
                  <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" />
                  <rect className="barre" style={{ animationDelay: Math.min(i * 18, 500) + 'ms' }} x={x} y={y(p.t)} width={w} height={Math.max(0, H - B - y(p.t))} rx="2"
                    fill={on ? 'var(--blue-dark)' : i === best ? '#3b74e8' : 'var(--blue)'} opacity={hover == null || on ? 1 : 0.45} />
                  {(i % every === 0 || i === pts.length - 1) && <text x={x + w / 2} y={H - 6} textAnchor="middle">{court(p.k)}</text>}
                </g>
              );
            })}
            <line x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} stroke="var(--warn)" strokeDasharray="5 4" strokeWidth="1.5" pointerEvents="none" />
          </svg>
          {h && (
            <div className="tip" style={{ left: `${((L + hover * bw + bw / 2) / W) * 100}%`, top: `${(y(h.t) / H) * 100}%` }}>
              <b className="num">{fmt(h.t)}</b><span>{label(h.k)}</span>
              {avg > 0 && <span className={h.t >= avg ? 'pos' : 'neg'}>{h.t >= avg ? '+' : '−'}{Math.abs(Math.round((h.t - avg) / avg * 100))} % vs moyenne</span>}
            </div>
          )}
        </div>
      )}
      {pts.length > 0 && <div className="legend">
        <span><i className="sw" style={{ background: 'var(--blue)' }} /> Ventes</span>
        <span><i className="sw dash" /> Moyenne : <b className="num">{fmt(avg)}</b></span>
        <span>Meilleur : <b>{label(pts[best].k)}</b> ({fmt(pts[best].t)})</span>
      </div>}
    </div>
  );
}
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const COULEURS = ['#0c2557', '#1f5ad6', '#4c86f0', '#7fa8f5', '#a9c5f8', '#5b6b85', '#93a3bd', '#c9d4e5'];
function Donut({ depenses, total }) {
  const [hi, setHi] = useState(null);
  const parts = CATEGORIES.map(cat => ({ cat, t: sum(depenses.filter(d => (d.categorie || 'Autre') === cat), 'montant') })).filter(x => x.t > 0).sort((a, b) => b.t - a.t);
  const r = 52, C = 2 * Math.PI * r;
  let acc = 0;
  const sel = hi != null ? parts[hi] : null;
  return (
    <div className="card">
      <div className="card-head"><h2>Où part l'argent</h2><a className="hint" href="#depenses">Détail</a></div>
      {parts.length === 0 ? <p className="hint">Aucune dépense datée sur cette période.</p> : (
        <div className="donutwrap">
          <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Dépenses par catégorie">
            <circle cx="70" cy="70" r={r} fill="none" stroke="var(--bg)" strokeWidth="20" />
            {parts.map((p, i) => {
              const len = p.t / total * C, off = acc; acc += len;
              return <circle key={p.cat} cx="70" cy="70" r={r} fill="none" stroke={COULEURS[i % COULEURS.length]} strokeWidth={hi === i ? 24 : 20}
                strokeDasharray={`${Math.max(0, len - 1.2)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 70 70)"
                opacity={hi == null || hi === i ? 1 : 0.35} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => setHi(hi === i ? null : i)} style={{ cursor: 'pointer', transition: 'stroke-width .15s, opacity .15s' }} />;
            })}
            <text x="70" y="66" textAnchor="middle" className="dl">{sel ? Math.round(sel.t / total * 100) + ' %' : 'Total'}</text>
            <text x="70" y="84" textAnchor="middle" className="dv">{fmt(sel ? sel.t : total).replace(' F', '')}</text>
          </svg>
          <ul className="dlegend">
            {parts.map((p, i) => (
              <li key={p.cat} className={hi === i ? 'on' : ''} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                <i className="sw" style={{ background: COULEURS[i % COULEURS.length] }} /><span>{p.cat}</span><b className="num">{fmt(p.t)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Activite({ S }) {
  const items = [
    ...S.ventes.map(v => ({ id: 'v' + v.id, date: v.date, ts: v.created_at, txt: v.article === AUCUNE ? 'Aucune vente' : v.article && v.article !== 'Total du jour' ? 'Vente · ' + v.article : 'Vente', mt: n(v.montant), sens: 1, ic: 'cart', href: '#ventes' })),
    ...S.depenses.filter(d => d.date).map(d => ({ id: 'd' + d.id, date: d.date, ts: d.created_at, txt: d.description, sub: d.categorie, mt: n(d.montant), sens: -1, ic: 'out', href: '#depenses' })),
    ...S.revendeurs.filter(r => r.date).map(r => ({ id: 'r' + r.id, date: r.date, ts: r.created_at, txt: (n(r.rembourse) && !n(r.dette) ? 'Remboursement · ' : 'Dette · ') + r.nom, mt: n(r.rembourse) || n(r.dette), sens: n(r.rembourse) && !n(r.dette) ? 1 : 0, ic: 'users', href: '#revendeurs' })),
    ...S.prets.filter(p => p.date).map(p => ({ id: 'p' + p.id, date: p.date, ts: p.created_at, txt: (n(p.rembourse) && !n(p.pret) ? 'Remboursement · ' : 'Prêt · ') + p.personne, mt: n(p.rembourse) || n(p.pret), sens: n(p.rembourse) && !n(p.pret) ? 1 : p.type === 'MATERIEL' ? 0 : -1, ic: 'hand', href: '#prets' })),
  ].sort((a, b) => b.date.localeCompare(a.date) || (b.ts || '').localeCompare(a.ts || '')).slice(0, 7);
  return (
    <div className="card">
      <div className="card-head"><h2>Activité récente</h2></div>
      <div className="feed">
        {items.length === 0 && <p className="hint">Rien pour le moment.</p>}
        {items.map((x, i) => (
          <a key={x.id} className="fitem" href={x.href} style={{ animationDelay: i * 50 + 'ms' }}>
            <span className={'fic ' + (x.sens > 0 ? 'in' : x.sens < 0 ? 'out' : '')}><Ic name={x.ic} /></span>
            <span className="ftxt"><b>{x.txt}</b><span className="muted">{dfr(x.date)}{x.sub ? ' · ' + x.sub : ''}</span></span>
            <b className={'num ' + (x.sens > 0 ? 'pos' : x.sens < 0 ? 'neg' : '')}>{x.sens > 0 ? '+' : x.sens < 0 ? '−' : ''}{fmt(x.mt)}</b>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ---------- ma journée ---------- */
const heure = ts => (ts ? new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');

function Journee({ S, load, admin }) {
  const [jour, setJour] = useState(today());
  const [art, setArt] = useState('');
  const [vmt, setVmt] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Autre');
  const [dmt, setDmt] = useState('');
  const [vmsg, vrun] = useSave();
  const [dmsg, drun] = useSave();
  const vRef = useRef(null), dRef = useRef(null);
  const tri = a => [...a].sort((x, y) => (y.created_at || '').localeCompare(x.created_at || ''));
  const vs = tri(S.ventes.filter(v => v.date === jour)), ds = tri(S.depenses.filter(d => d.date === jour));
  const tV = sum(vs, 'montant'), tD = sum(ds, 'montant'), bilan = tV - tD;
  const nbV = vs.filter(v => n(v.montant) > 0).length;
  const hier = sum(S.ventes.filter(v => v.date === addDays(jour, -1)), 'montant');
  const articles = [...new Set(S.ventes.map(v => String(v.article || '').trim()).filter(a => a && a !== 'Total du jour' && a !== AUCUNE))];
  const descs = [...new Set(S.depenses.map(d => String(d.description || '').trim()).filter(Boolean))];
  const lastCat = txt => { const k = key(txt); const d = recent(S.depenses).find(x => key(x.description) === k); return d?.categorie; };
  const estAujourdhui = jour === today();

  return (
    <>
      <div className="daynav">
        <button type="button" className="lnk" onClick={() => setJour(addDays(jour, -1))} aria-label="Jour précédent">‹ Veille</button>
        <div className="dayname"><b>{estAujourdhui ? "Aujourd'hui" : dfr(jour)}</b>{estAujourdhui && <span className="muted"> · {dfr(jour)}</span>}</div>
        <button type="button" className="lnk" onClick={() => setJour(addDays(jour, 1))} disabled={estAujourdhui} aria-label="Jour suivant">Lendemain ›</button>
        <input type="date" aria-label="Choisir un jour" value={jour} max={today()} onChange={e => e.target.value && setJour(e.target.value)} />
        {!estAujourdhui && <button type="button" className="chip on" onClick={() => setJour(today())}>Revenir à aujourd'hui</button>}
      </div>

      <div className="kpis">
        <KpiLive cls="good" ic="cart" lab="Ventes du jour" val={tV} sub={`${nbV} vente${nbV > 1 ? 's' : ''}${vs.length && !nbV ? ' (journée sans vente)' : ''}${hier ? ` · veille ${fmt(hier)}` : ''}`} />
        <KpiLive cls="bad" ic="out" lab="Dépenses du jour" val={tD} sub={`${ds.length} dépense${ds.length > 1 ? 's' : ''}`} />
        <KpiLive cls="primary" ic="wallet" lab="Bilan du jour" val={bilan} sub="Ventes − dépenses du jour" />
        <KpiLive ic="trend" lab="Vente moyenne" val={nbV ? tV / nbV : 0} sub="Par vente notée" />
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head"><h2>Ventes</h2><b className="num pos">{fmt(tV)}</b></div>
          {admin && <form className="row" onSubmit={async e => {
            e.preventDefault(); const m = Math.round(Number(vmt)); if (vmt === '' || !(m >= 0)) return;
            if (await vrun(() => supabase.from('ventes').insert({ date: jour, montant: m, article: art.trim() || (m === 0 ? AUCUNE : null) }), m === 0 ? 'Journée sans vente notée.' : `Vente de ${fmt(m)} ajoutée.`)) { setVmt(''); setArt(''); load(['ventes']); vRef.current?.focus(); }
          }}>
            <div className="field wide"><label htmlFor="j-art">Article (facultatif)</label><input id="j-art" list="dl-art" placeholder="ex : chargeur, écouteurs" value={art} onChange={e => setArt(e.target.value)} /></div>
            <div className="field"><label htmlFor="j-vmt">Montant (F)</label><input id="j-vmt" ref={vRef} type="number" inputMode="numeric" min="0" step="1" required value={vmt} onChange={e => setVmt(e.target.value)} /></div>
            <button className="btn" type="submit">+ Vente</button>
          </form>}
          {admin && vs.length === 0 && <button type="button" className="lnk" style={{ justifySelf: 'start', padding: '8px 12px', borderStyle: 'dashed', color: 'var(--blue)', borderColor: 'var(--blue)' }} onClick={() => vrun(() => supabase.from('ventes').insert({ date: jour, montant: 0, article: AUCUNE }), 'Journée sans vente notée.').then(ok => ok && load(['ventes']))}>Pas de vente {estAujourdhui ? "aujourd'hui" : 'ce jour-là'} (0 F)</button>}
          <datalist id="dl-art">{articles.map(a => <option key={a} value={a} />)}</datalist>
          {admin && <p className={'msg ' + vmsg.c}>{vmsg.t}</p>}
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Heure</th><th>Article</th><th className="r">Montant</th>{admin && <th />}</tr></thead>
              <tbody>
                {vs.length === 0 && <tr><td colSpan={4} className="muted">Aucune vente ce jour-là.</td></tr>}
                {vs.map(v => (
                  <tr key={v.id}>
                    <td className="muted num">{heure(v.created_at)}</td>
                    <td>{v.article || <span className="muted">—</span>}</td>
                    <td className="r num pos">{fmt(v.montant)}</td>
                    {admin && <td><div className="actions"><DelBtn table="ventes" id={v.id} load={load} short /></div></td>}
                  </tr>
                ))}
                {vs.length > 0 && <tr className="group"><td colSpan={2}>Total des ventes</td><td className="r num">{fmt(tV)}</td>{admin && <td />}</tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Dépenses</h2><b className="num neg">{fmt(tD)}</b></div>
          {admin && <form className="row" onSubmit={async e => {
            e.preventDefault(); const m = Math.round(Number(dmt)); if (!desc.trim() || !(m > 0)) return;
            if (await drun(() => supabase.from('depenses').insert({ date: jour, montant: m, description: desc.trim(), categorie: cat }), `Dépense de ${fmt(m)} ajoutée.`)) { setDmt(''); setDesc(''); load(['depenses']); dRef.current?.focus(); }
          }}>
            <div className="field wide"><label htmlFor="j-desc">Description</label><input id="j-desc" ref={dRef} list="dl-jdep" required placeholder="ex : transport, woyofal" value={desc}
              onChange={e => { setDesc(e.target.value); const lc = lastCat(e.target.value); if (lc) setCat(lc); }} /></div>
            <div className="field"><label htmlFor="j-cat">Catégorie</label>
              <select id="j-cat" value={cat} onChange={e => setCat(e.target.value)}>{CATEGORIES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
            <div className="field"><label htmlFor="j-dmt">Montant (F)</label><input id="j-dmt" type="number" inputMode="numeric" min="1" step="1" required value={dmt} onChange={e => setDmt(e.target.value)} /></div>
            <button className="btn" type="submit">+ Dépense</button>
          </form>}
          <datalist id="dl-jdep">{descs.map(a => <option key={a} value={a} />)}</datalist>
          {admin && <p className={'msg ' + dmsg.c}>{dmsg.t}</p>}
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Heure</th><th>Description</th><th className="r">Montant</th>{admin && <th />}</tr></thead>
              <tbody>
                {ds.length === 0 && <tr><td colSpan={4} className="muted">Aucune dépense ce jour-là.</td></tr>}
                {ds.map(d => (
                  <tr key={d.id}>
                    <td className="muted num">{heure(d.created_at)}</td>
                    <td>{d.description} <span className="muted" style={{ fontSize: 12 }}>· {d.categorie}</span></td>
                    <td className="r num neg">{fmt(d.montant)}</td>
                    {admin && <td><div className="actions"><DelBtn table="depenses" id={d.id} load={load} short /></div></td>}
                  </tr>
                ))}
                {ds.length > 0 && <tr className="group"><td colSpan={2}>Total des dépenses</td><td className="r num">{fmt(tD)}</td>{admin && <td />}</tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={'card bilan ' + (bilan >= 0 ? 'pos' : 'neg')}>
        <div className="bilanrow"><span>Ventes</span><b className="num">{fmt(tV)}</b></div>
        <div className="bilanrow"><span>− Dépenses</span><b className="num">{fmt(tD)}</b></div>
        <div className="bilanrow total"><span>= Bilan du {estAujourdhui ? 'jour' : dfr(jour)}</span><b className="num">{fmt(bilan)}</b></div>
      </div>
    </>
  );
}

/* ---------- ventes ---------- */
function Ventes({ S, c, load, admin }) {
  const [date, setDate] = useState(today());
  const [art, setArt] = useState('');
  const [mt, setMt] = useState('');
  const [open, setOpen] = useState(() => new Set());
  const [msg, run] = useSave();
  const jours = parJour(S.ventes).sort((a, b) => b.date.localeCompare(a.date));
  const months = [];
  jours.forEach(j => { const m = j.date.slice(0, 7); let g = months[months.length - 1]; if (!g || g.m !== m) { g = { m, rows: [], tot: 0 }; months.push(g); } g.rows.push(j); g.tot += j.t; });
  const best = [...jours].sort((a, b) => b.t - a.t)[0];
  const toggle = k => setOpen(s => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; });

  return (
    <>
      <div className="kpis">
        <Kpi cls="primary" ic="cart" lab="Total vendu" val={c.ventes} sub={`${jours.length} jours · ${S.ventes.length} ventes notées`} />
        <Kpi cls="good" ic="trend" lab={moisFr(c.ym)} val={c.ventesMois} sub={`${c.joursMois} jour(s) noté(s)`} />
        <Kpi ic="clock" lab="Moyenne par jour" val={c.moyenne} />
        <Kpi ic="trend" lab="Meilleur jour" val={best ? best.t : 0} sub={best ? dfr(best.date) : ''} />
      </div>
      {admin && <div className="card">
        <div className="card-head"><h2>Ajouter une vente</h2><a className="hint" href="#journee">Ou utilisez « Ma journée » pour voir le total du jour</a></div>
        <form className="row" onSubmit={async e => {
          e.preventDefault(); const m = Math.round(Number(mt)); if (!date || mt === '' || !(m >= 0)) return;
          if (await run(() => supabase.from('ventes').insert({ date, montant: m, article: art.trim() || (m === 0 ? AUCUNE : null) }), m === 0 ? `${dfr(date)} noté sans vente.` : `Vente de ${fmt(m)} ajoutée au ${dfr(date)}.`)) { setMt(''); setArt(''); load(['ventes']); }
        }}>
          <div className="field"><label htmlFor="v-date">Date</label><input id="v-date" type="date" required value={date} max={today()} onChange={e => setDate(e.target.value)} /></div>
          <div className="field wide"><label htmlFor="v-art">Article (facultatif)</label><input id="v-art" placeholder="ex : chargeur" value={art} onChange={e => setArt(e.target.value)} /></div>
          <div className="field"><label htmlFor="v-mt">Montant (F)</label><input id="v-mt" type="number" inputMode="numeric" min="0" step="1" required value={mt} onChange={e => setMt(e.target.value)} /></div>
          <button className="btn" type="submit">+ Vente</button>
        </form>
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>}
      <div className="card">
        <div className="card-head"><h2>Historique des ventes</h2><b className="num">{fmt(c.ventes)}</b></div>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Jour</th><th className="r">Ventes</th><th className="r">Total du jour</th></tr></thead>
            <tbody>
              {months.length === 0 && <tr><td colSpan={3} className="muted">Aucune vente notée.</td></tr>}
              {months.map(g => (
                <Fragment key={g.m}>
                  <tr className="group"><td style={{ textTransform: 'capitalize' }}>{moisFr(g.m)} · {g.rows.length} jours</td><td /><td className="r num">{fmt(g.tot)}</td></tr>
                  {g.rows.map(j => {
                    const o = open.has(j.date);
                    return (
                      <Fragment key={j.date}>
                        <tr className="click" onClick={() => toggle(j.date)} aria-expanded={o}>
                          <td><span className={'chev' + (o ? ' open' : '')}>›</span> {dfr(j.date)}</td>
                          <td className="r num muted">{j.nb}</td>
                          <td className="r num" style={{ fontWeight: 700 }}>{fmt(j.t)}</td>
                        </tr>
                        {o && [...j.rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).map(v => (
                          <tr className="sub" key={v.id}>
                            <td style={{ paddingLeft: 34 }}>{v.article || 'Vente'} <span className="muted" style={{ fontSize: 12 }}>{v.article === 'Total du jour' || v.article === AUCUNE ? '' : heure(v.created_at)}</span></td>
                            <td className="r">{admin && <DelBtn table="ventes" id={v.id} load={load} />}</td>
                            <td className="r num">{fmt(v.montant)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Touchez un jour pour voir chaque vente.</p>
      </div>
    </>
  );
}

/* ---------- dépenses ---------- */
function CatSelect({ d, load }) {
  const [busy, setBusy] = useState(false);
  return (
    <select className="catsel" aria-label="Catégorie" value={d.categorie || 'Autre'} disabled={busy} onChange={async e => {
      setBusy(true); const { error } = await supabase.from('depenses').update({ categorie: e.target.value }).eq('id', d.id); setBusy(false);
      if (!error) load(['depenses']);
    }}>
      {CATEGORIES.map(x => <option key={x} value={x}>{x}</option>)}
    </select>
  );
}

function Depenses({ S, c, load, admin }) {
  const [desc, setDesc] = useState('');
  const [mt, setMt] = useState('');
  const [date, setDate] = useState(today());
  const [cat, setCat] = useState('Autre');
  const [q, setQ] = useState('');
  const [fCat, setFCat] = useState('');
  const [msg, run] = useSave();
  const sugg = [...new Set(S.depenses.map(d => String(d.description || '').trim()).filter(Boolean))];
  const rows = recent(S.depenses).filter(d => (!q || key(d.description).includes(key(q))) && (!fCat || (d.categorie || 'Autre') === fCat));
  const parCat = CATEGORIES.map(x => { const l = S.depenses.filter(d => (d.categorie || 'Autre') === x); return { cat: x, nb: l.length, tot: sum(l, 'montant') }; })
    .filter(x => x.nb).sort((a, b) => b.tot - a.tot);
  const maxCat = Math.max(1, ...parCat.map(x => x.tot));
  const lastCat = txt => { const k = key(txt); const d = recent(S.depenses).find(x => key(x.description) === k); return d?.categorie; };

  return (
    <>
      <div className="kpis">
        <Kpi cls="primary" ic="out" lab="Total dépenses" val={c.depenses} sub={`${S.depenses.length} dépenses`} />
        <Kpi cls="bad" ic="tag" lab="Charges (hors stock)" val={c.charges} sub="Loyer, électricité, transport…" />
        <Kpi ic="cart" lab="Achat de stock" val={c.stock} sub="Marchandise à revendre" />
        <Kpi cls="warn" ic="clock" lab={moisFr(c.ym)} val={c.depMois} />
      </div>
      <div className="grid-main">
        {admin ? <div className="card">
          <h2>Ajouter une dépense</h2>
          <form className="row" onSubmit={async e => {
            e.preventDefault(); const m = Math.round(Number(mt)); if (!desc.trim() || !(m > 0)) return;
            if (await run(() => supabase.from('depenses').insert({ description: desc.trim(), montant: m, date, categorie: cat }), 'Dépense ajoutée.')) { setDesc(''); setMt(''); load(['depenses']); }
          }}>
            <div className="field wide"><label htmlFor="d-desc">Description</label><input id="d-desc" list="dl-dep" required placeholder="ex : wifi, location, achat accessoires" value={desc}
              onChange={e => { setDesc(e.target.value); const lc = lastCat(e.target.value); if (lc) setCat(lc); }} /></div>
            <div className="field"><label htmlFor="d-cat">Catégorie</label>
              <select id="d-cat" value={cat} onChange={e => setCat(e.target.value)}>{CATEGORIES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
            <div className="field"><label htmlFor="d-mt">Montant (F)</label><input id="d-mt" type="number" inputMode="numeric" min="1" step="1" required value={mt} onChange={e => setMt(e.target.value)} /></div>
            <div className="field"><label htmlFor="d-date">Date</label><input id="d-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
            <button className="btn" type="submit">Ajouter</button>
          </form>
          <datalist id="dl-dep">{sugg.map(s => <option key={s} value={s} />)}</datalist>
          <p className={'msg ' + msg.c}>{msg.t}</p>
        </div> : <div className="card"><h2>Dépenses</h2><p className="hint">Vous voyez les dépenses en lecture seule.</p></div>}
        <div className="card">
          <div className="card-head"><h2>Par catégorie</h2><span className="hint">Touchez pour filtrer</span></div>
          <div className="cats">
            {parCat.map(x => (
              <button key={x.cat} type="button" className={'catrow' + (fCat === x.cat ? ' on' : '')} onClick={() => setFCat(fCat === x.cat ? '' : x.cat)}>
                <div className="line"><span>{x.cat} <span className="muted">· {x.nb}</span></span><b className="num">{fmt(x.tot)}</b></div>
                <div className="bar"><i style={{ width: (x.tot / maxCat * 100) + '%', background: x.cat === STOCK ? 'var(--blue-dark)' : 'var(--blue)' }} /></div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <h2>Liste des dépenses{fCat && <> · <span className="pill arg">{fCat}</span> <button className="linkbtn" onClick={() => setFCat('')}>tout afficher</button></>}</h2>
          <div className="searchbar"><input aria-label="Rechercher une dépense" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />{(q || fCat) && <b className="num">{fmt(sum(rows, 'montant'))}</b>}</div>
        </div>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Description</th><th>Catégorie</th><th className="hide-m">Date</th><th className="r">Montant</th>{admin && <th className="r">Actions</th>}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="muted">Aucune dépense.</td></tr>}
              {rows.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.description}</td>
                  <td>{admin ? <CatSelect d={d} load={load} /> : <span className="pill arg">{d.categorie || 'Autre'}</span>}</td>
                  <td className="muted hide-m">{d.date ? dfr(d.date) : AVANT}</td>
                  <td className="r num neg">{fmt(d.montant)}</td>
                  {admin && <td><div className="actions"><DelBtn table="depenses" id={d.id} load={load} /></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------- tableau par personne (revendeurs et prêts) ---------- */
function PersonTable({ groups, table, amountField, withType, load, labels, admin }) {
  const [open, setOpen] = useState(() => new Set());
  const [q, setQ] = useState('');
  const toggle = k => setOpen(s => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; });
  const list = groups.filter(g => !q || g.k.includes(key(q)));
  return (
    <div className="card">
      <div className="card-head">
        <h2>{labels.title}</h2>
        <div className="searchbar"><input aria-label="Rechercher un nom" placeholder="Rechercher un nom…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>{labels.who}</th><th className="r">{labels.total}</th><th className="r">Rendu</th><th className="r">Reste</th><th className="hide-m">Progression</th><th>État</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={6} className="muted">Aucun résultat.</td></tr>}
            {list.map(g => {
              const reste = g.d - g.r, isOpen = open.has(g.k);
              return (
                <Fragment key={g.k}>
                  <tr className="click" onClick={() => toggle(g.k)} aria-expanded={isOpen}>
                    <td className="name"><span className={'chev' + (isOpen ? ' open' : '')}>›</span> {g.nom}</td>
                    <td className="r num">{fmt(g.d)}</td>
                    <td className="r num pos">{fmt(g.r)}</td>
                    <td className="r num" style={{ fontWeight: 700 }}>{fmt(reste)}</td>
                    <td className="hide-m"><Bar d={g.d} r={g.r} /></td>
                    <td>{reste > 0 ? <span className="pill due">À récupérer</span> : <span className="pill ok">Soldé</span>}</td>
                  </tr>
                  {isOpen && recent(g.rows).map(r => {
                    const isR = n(r.rembourse) > 0 && !n(r[amountField]);
                    return (
                      <tr className="sub" key={r.id}>
                        <td style={{ paddingLeft: 34 }}>
                          {isR ? 'Remboursement' : labels.entry}{' '}
                          {withType && (r.type === 'MATERIEL' ? <span className="pill mat">Matériel</span> : <span className="pill arg">Argent</span>)}
                          <div className="muted" style={{ fontSize: 12.5 }}>{[r.date ? dfr(r.date) : AVANT, r.note].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td className="r num">{isR ? '' : fmt(r[amountField])}</td>
                        <td className="r num pos">{n(r.rembourse) ? '+ ' + fmt(r.rembourse) : ''}</td>
                        <td />
                        <td className="hide-m" />
                        <td>{admin && <div className="actions"><DelBtn table={table} id={r.id} load={load} /></div>}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">Touchez un nom pour voir le détail de ses opérations.</p>
    </div>
  );
}

/* ---------- revendeurs ---------- */
function Revendeurs({ S, c, load, admin }) {
  const [kind, setKind] = useState('dette');
  const [nom, setNom] = useState('');
  const [mt, setMt] = useState('');
  const [date, setDate] = useState(today());
  const [msg, run] = useSave();
  const groups = groupBy(S.revendeurs, 'nom', 'dette', 'rembourse');
  const actifs = groups.filter(g => g.d - g.r > 0).length;

  return (
    <>
      <div className="kpis">
        <Kpi cls="primary" ic="clock" lab="Reste à récupérer" val={c.revReste} sub={`${actifs} revendeur${actifs > 1 ? 's' : ''} doivent encore`} />
        <Kpi ic="users" lab="Total prêté" val={c.revDette} sub={`${groups.length} revendeurs`} />
        <Kpi cls="good" ic="trend" lab="Déjà remboursé" val={c.revRemb} sub={c.revDette ? Math.round(c.revRemb / c.revDette * 100) + ' % du total' : ''} />
        <Kpi cls="warn" ic="wallet" lab="Plus grosse dette" val={groups[0] ? groups[0].d - groups[0].r : 0} sub={groups[0]?.nom} />
      </div>
      {admin && <div className="card">
        <h2>Nouvelle opération</h2>
        <form className="row" onSubmit={async e => {
          e.preventDefault(); const m = Math.round(Number(mt)); if (!nom.trim() || !(m > 0)) return;
          const ex = groups.find(g => g.k === key(nom));
          const row = { nom: ex ? ex.nom : nom.trim(), dette: kind === 'dette' ? m : 0, rembourse: kind === 'remb' ? m : 0, date };
          if (await run(() => supabase.from('revendeurs').insert(row), kind === 'dette' ? 'Dette ajoutée.' : 'Remboursement ajouté.')) { setMt(''); load(['revendeurs']); }
        }}>
          <div className="field full"><Seg label="Type d'opération" value={kind} onChange={setKind} options={[['dette', 'Nouvelle dette'], ['remb', 'Remboursement reçu']]} /></div>
          <div className="field wide"><label htmlFor="r-nom">Revendeur</label><input id="r-nom" list="dl-rev" required value={nom} onChange={e => setNom(e.target.value)} /></div>
          <div className="field"><label htmlFor="r-mt">Montant (F)</label><input id="r-mt" type="number" inputMode="numeric" min="1" step="1" required value={mt} onChange={e => setMt(e.target.value)} /></div>
          <div className="field"><label htmlFor="r-date">Date</label><input id="r-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
          <button className="btn" type="submit">Ajouter</button>
        </form>
        <datalist id="dl-rev">{groups.map(g => <option key={g.k} value={g.nom} />)}</datalist>
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>}
      <PersonTable groups={groups} table="revendeurs" amountField="dette" load={load} admin={admin}
        labels={{ title: 'Comptes des revendeurs', who: 'Revendeur', total: 'Total dû', entry: 'Dette' }} />
    </>
  );
}

/* ---------- prêts ---------- */
function Prets({ S, c, load, admin }) {
  const [kind, setKind] = useState('pret');
  const [type, setType] = useState('ARGENT');
  const [nom, setNom] = useState('');
  const [mt, setMt] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [msg, run] = useSave();
  const groups = groupBy(S.prets, 'personne', 'pret', 'rembourse');

  return (
    <>
      <div className="kpis">
        <Kpi cls="primary" ic="clock" lab="Total à récupérer" val={c.argReste + c.matReste} />
        <Kpi cls="bad" ic="wallet" lab="Argent à récupérer" val={c.argReste} sub={`Prêté ${fmt(c.argPret)} · rendu ${fmt(c.argRemb)}`} />
        <Kpi cls="warn" ic="cart" lab="Matériel à récupérer" val={c.matReste} sub={`Donné ${fmt(c.matPret)} · payé ${fmt(c.matRemb)}`} />
        <Kpi cls="good" ic="trend" lab="Total rendu" val={c.argRemb + c.matRemb} />
      </div>
      {admin && <div className="card">
        <div className="card-head"><h2>Nouvelle opération</h2>
          <span className="hint">Argent prêté : enlevé du solde. Matériel à crédit : pas enlevé. Tout remboursement s'ajoute au solde.</span></div>
        <form className="row" onSubmit={async e => {
          e.preventDefault(); const m = Math.round(Number(mt)); if (!nom.trim() || !(m > 0)) return;
          const ex = groups.find(g => g.k === key(nom));
          const row = { personne: ex ? ex.nom : nom.trim(), pret: kind === 'pret' ? m : 0, rembourse: kind === 'remb' ? m : 0, type, note: note.trim() || null, date };
          if (await run(() => supabase.from('prets').insert(row), kind === 'pret' ? 'Prêt ajouté.' : 'Remboursement ajouté.')) { setMt(''); setNote(''); load(['prets']); }
        }}>
          <div className="field wide"><Seg label="Type d'opération" value={kind} onChange={setKind} options={[['pret', 'Nouveau prêt'], ['remb', 'Remboursement reçu']]} /></div>
          <div className="field wide"><Seg label="Argent ou matériel" value={type} onChange={setType} options={[['ARGENT', 'Argent'], ['MATERIEL', 'Matériel']]} /></div>
          <div className="field wide"><label htmlFor="p-nom">Personne</label><input id="p-nom" list="dl-pret" required value={nom} onChange={e => setNom(e.target.value)} /></div>
          <div className="field"><label htmlFor="p-mt">Montant (F)</label><input id="p-mt" type="number" inputMode="numeric" min="1" step="1" required value={mt} onChange={e => setMt(e.target.value)} /></div>
          <div className="field"><label htmlFor="p-date">Date</label><input id="p-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field wide"><label htmlFor="p-note">Note (facultatif)</label><input id="p-note" placeholder="ex : protège-écran, chargeur" value={note} onChange={e => setNote(e.target.value)} /></div>
          <button className="btn" type="submit">Ajouter</button>
        </form>
        <datalist id="dl-pret">{groups.map(g => <option key={g.k} value={g.nom} />)}</datalist>
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>}
      <PersonTable groups={groups} table="prets" amountField="pret" withType load={load} admin={admin}
        labels={{ title: 'Comptes des prêts', who: 'Personne', total: 'Total prêté', entry: 'Prêt' }} />
    </>
  );
}

/* ---------- rapports PDF ---------- */
function periode(preset, du, au) {
  const t = today(), [y, m] = t.split('-').map(Number);
  const pad = x => String(x).padStart(2, '0');
  const fin = (yy, mm) => `${yy}-${pad(mm)}-${pad(new Date(yy, mm, 0).getDate())}`;
  if (preset === 'mois') return { du: `${y}-${pad(m)}-01`, au: t };
  if (preset === 'moisdernier') { const yy = m === 1 ? y - 1 : y, mm = m === 1 ? 12 : m - 1; return { du: `${yy}-${pad(mm)}-01`, au: fin(yy, mm) }; }
  if (preset === '30j') { const d = new Date(t); d.setDate(d.getDate() - 29); return { du: d.toISOString().slice(0, 10), au: t }; }
  if (preset === 'annee') return { du: `${y}-01-01`, au: t };
  if (preset === 'perso') return { du, au };
  return { tout: true };
}

const PARTIES = [
  ['resume', 'Résumé (chiffres clés et solde)'],
  ['ventes', 'Ventes par mois'],
  ['ventesDetail', 'avec le détail jour par jour', 'ventes'],
  ['depenses', 'Dépenses par catégorie'],
  ['depensesDetail', 'avec la liste de chaque dépense', 'depenses'],
  ['revendeurs', 'Revendeurs'],
  ['prets', 'Prêts'],
  ['soldes', 'Inclure les personnes qui ont tout remboursé'],
];

function Rapports({ S, boutique }) {
  const [preset, setPreset] = useState('tout');
  const [du, setDu] = useState(today().slice(0, 8) + '01');
  const [au, setAu] = useState(today());
  const [parts, setParts] = useState({ resume: true, ventes: true, ventesDetail: false, depenses: true, depensesDetail: true, revendeurs: true, prets: true, soldes: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ t: '', c: '' });
  const p = periode(preset, du, au);
  const nbV = p.tout ? new Set(S.ventes.map(v => v.date)).size : new Set(S.ventes.filter(v => v.date >= p.du && v.date <= p.au).map(v => v.date)).size;
  const aucun = !['resume', 'ventes', 'depenses', 'revendeurs', 'prets'].some(k => parts[k]);

  return (
    <div className="grid2">
      <div className="card">
        <h2>1. Période</h2>
        <div className="field"><label htmlFor="r-per">Période du rapport</label>
          <select id="r-per" value={preset} onChange={e => setPreset(e.target.value)}>
            <option value="tout">Toutes les données</option>
            <option value="mois">Ce mois-ci</option>
            <option value="moisdernier">Le mois dernier</option>
            <option value="30j">Les 30 derniers jours</option>
            <option value="annee">Cette année</option>
            <option value="perso">Dates de mon choix</option>
          </select></div>
        {preset === 'perso' && <div className="row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="field"><label htmlFor="r-du">Du</label><input id="r-du" type="date" value={du} max={au} onChange={e => setDu(e.target.value)} /></div>
          <div className="field"><label htmlFor="r-au">Au</label><input id="r-au" type="date" value={au} min={du} onChange={e => setAu(e.target.value)} /></div>
        </div>}
        <p className="formula">{p.tout ? `Tout depuis le début : ${nbV} jours de vente, ${S.depenses.length} dépenses.` : `Du ${dfr(p.du)} au ${dfr(p.au)} : ${nbV} jour(s) de vente noté(s).`} Les revendeurs et les prêts sont toujours montrés tels qu'ils sont aujourd'hui.</p>
      </div>
      <div className="card">
        <h2>2. Ce qu'il faut mettre dans le PDF</h2>
        <div className="checks">
          {PARTIES.map(([k, lab, parent]) => (
            <label key={k} className={'check' + (parent ? ' sub' : '')}>
              <input type="checkbox" checked={parts[k]} disabled={parent && !parts[parent]} onChange={() => setParts(x => ({ ...x, [k]: !x[k] }))} /> {lab}
            </label>
          ))}
        </div>
        <button className="btn" disabled={busy || aucun} onClick={async () => {
          setBusy(true); setMsg({ t: '', c: '' });
          try {
            const { genererRapport } = await import('../lib/rapport');
            await genererRapport(S, { ...parts, ventesDetail: parts.ventes && parts.ventesDetail, depensesDetail: parts.depenses && parts.depensesDetail, ...p, aujourdhui: today(), boutique });
            setMsg({ t: 'Le PDF est téléchargé.', c: 'ok' });
          } catch (e) { setMsg({ t: "Le PDF n'a pas pu être créé. Réessayez.", c: 'err' }); }
          setBusy(false);
        }}><Ic name="file" /> {busy ? 'Création du PDF…' : 'Télécharger le PDF'}</button>
        {aucun && <p className="msg err">Cochez au moins une partie.</p>}
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>
    </div>
  );
}

/* ---------- ma boutique ---------- */
function Parametres({ boutique, recharger }) {
  const [nom, setNom] = useState(boutique.nom);
  const [slogan, setSlogan] = useState(boutique.slogan || '');
  const [logo, setLogo] = useState(boutique.logo || null);
  const [err, setErr] = useState('');
  const [msg, run] = useSave();
  const apercu = { nom: nom.trim() || 'Ma boutique', slogan: slogan.trim(), logo };

  const choisir = e => {
    const f = e.target.files?.[0]; e.target.value = ''; setErr('');
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Choisissez une image (photo, PNG ou JPG).'); return; }
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 256 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      setLogo(cv.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); setErr("Cette image n'a pas pu être lue. Essayez une autre."); };
    img.src = url;
  };

  return (
    <div className="grid-main">
      <div className="card">
        <h2>Identité de la boutique</h2>
        <form className="row" onSubmit={async e => {
          e.preventDefault(); if (!nom.trim()) return;
          if (await run(() => supabase.from('boutique').upsert({ id: 1, nom: nom.trim(), slogan: slogan.trim() || null, logo, maj_le: new Date().toISOString() }), 'Boutique enregistrée.')) recharger();
        }}>
          <div className="field full"><label htmlFor="b-nom">Nom de la boutique</label><input id="b-nom" required maxLength={60} value={nom} onChange={e => setNom(e.target.value)} /></div>
          <div className="field full"><label htmlFor="b-slogan">Slogan ou petite phrase (facultatif)</label><input id="b-slogan" maxLength={80} placeholder="ex : Accessoires téléphone et électronique" value={slogan} onChange={e => setSlogan(e.target.value)} /></div>
          <div className="field full">
            <label htmlFor="b-logo">Logo</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="logo" style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--blue)', color: '#fff', display: 'grid', placeItems: 'center', font: '700 22px var(--display)', overflow: 'hidden', flex: 'none' }}>
                {logo ? <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} /> : initiales(apercu.nom)}
              </div>
              <label className="lnk" htmlFor="b-logo" style={{ cursor: 'pointer', padding: '8px 12px' }}>{logo ? 'Changer le logo' : 'Choisir une image'}</label>
              <input id="b-logo" type="file" accept="image/*" onChange={choisir} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
              {logo && <button type="button" className="lnk" onClick={() => setLogo(null)}>Retirer le logo</button>}
            </div>
            <span className="hint">Une photo ou une image carrée marche le mieux. Sans logo, les initiales du nom s'affichent.</span>
            {err && <span className="msg err">{err}</span>}
          </div>
          <button className="btn" type="submit">Enregistrer</button>
        </form>
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>
      <div className="card">
        <h2>Aperçu</h2>
        <div style={{ background: 'var(--blue-dark)', color: '#dbe5f7', borderRadius: 10, padding: '16px 10px' }}><Brand b={apercu} /></div>
        <p className="hint">Le nom et le logo apparaissent dans le menu, sur l'écran de connexion et en haut des rapports PDF.</p>
      </div>
    </div>
  );
}

/* ---------- accès ---------- */
function Acces({ session }) {
  const [list, setList] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('lecteur');
  const [msg, run] = useSave();
  const moi = session.user.email.toLowerCase();
  const charger = useCallback(async () => { const { data } = await supabase.from('acces').select('*').order('ajoute_le'); setList(data || []); }, []);
  useEffect(() => { charger(); }, [charger]);
  const [lien, setLien] = useState('');
  useEffect(() => { setLien(location.host); }, []);

  return (
    <>
      <div className="grid-main">
        <div className="card">
          <h2>Donner un accès</h2>
          <form className="row" onSubmit={async e => {
            e.preventDefault(); const em = email.trim().toLowerCase(); if (!em) return;
            if (list?.some(a => a.email.toLowerCase() === em)) { await run(async () => ({ error: null }), 'Cette personne a déjà un accès.'); return; }
            if (await run(() => supabase.from('acces').insert({ email: em, role }), `Accès donné à ${em}.`)) { setEmail(''); charger(); }
          }}>
            <div className="field wide"><label htmlFor="a-email">Email de la personne</label><input id="a-email" type="email" required placeholder="ex : comptable@gmail.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="a-role">Ce qu'elle peut faire</label>
              <select id="a-role" value={role} onChange={e => setRole(e.target.value)}>
                <option value="lecteur">Voir seulement</option>
                <option value="admin">Voir et modifier</option>
              </select></div>
            <button className="btn" type="submit">Donner l'accès</button>
          </form>
          <p className={'msg ' + msg.c}>{msg.t}</p>
        </div>
        <div className="card">
          <h2>Ensuite, la personne…</h2>
          <ol className="steps">
            <li>ouvre <b>{lien}</b> ;</li>
            <li>touche « Créer un compte » avec <b>le même email</b> ;</li>
            <li>confirme son email, puis se connecte.</li>
          </ol>
          <p className="hint">« Voir seulement » : elle voit tout et peut télécharger les rapports PDF, mais ne peut rien ajouter, modifier ni supprimer.</p>
        </div>
      </div>
      <div className="card">
        <h2>Personnes qui ont accès</h2>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Email</th><th>Droits</th><th className="hide-m">Ajouté le</th><th className="r">Actions</th></tr></thead>
            <tbody>
              {!list && <tr><td colSpan={4} className="muted">Chargement…</td></tr>}
              {list?.map(a => {
                const self = a.email.toLowerCase() === moi;
                return (
                  <tr key={a.email}>
                    <td style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{a.email}{self && <span className="muted"> (vous)</span>}</td>
                    <td>{self ? <span className="pill arg">Voir et modifier</span> :
                      <select className="catsel" aria-label="Droits" value={a.role} onChange={async e => { await supabase.from('acces').update({ role: e.target.value }).eq('email', a.email); charger(); }}>
                        <option value="lecteur">Voir seulement</option>
                        <option value="admin">Voir et modifier</option>
                      </select>}</td>
                    <td className="muted hide-m">{a.ajoute_le ? dfr(a.ajoute_le.slice(0, 10)) : ''}</td>
                    <td><div className="actions">{!self && <DelBtn table="acces" id={a.email} match="email" load={charger} />}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
