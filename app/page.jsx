'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

/* ---------- outils ---------- */
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const n = v => Number(v) || 0;
const fmt = v => Math.round(n(v)).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' F';
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const dfr = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+d} ${MOIS[+m - 1]} ${y}`; };
const moisFr = ym => `${MOIS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const key = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const sum = (a, f) => a.reduce((t, x) => t + n(x[f]), 0);
const recent = a => [...a].sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.created_at || '').localeCompare(x.created_at || '') || n(y.ordre) - n(x.ordre));
const AVANT = "Avant l'application";

function groupBy(rows, field, a, b) {
  const g = new Map();
  for (const r of rows) {
    const k = key(r[field]); if (!k) continue;
    if (!g.has(k)) g.set(k, { k, nom: String(r[field]).trim(), rows: [], d: 0, r: 0 });
    const e = g.get(k); e.rows.push(r); e.d += n(r[a]); e.r += n(r[b]);
  }
  return [...g.values()].sort((x, y) => (y.d - y.r) - (x.d - x.r));
}

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
};
const Ic = ({ name }) => <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d={P[name]} /></svg>;

const VIEWS = [
  { id: 'accueil', lab: 'Tableau de bord', short: 'Accueil', ic: 'home', sub: "Vue d'ensemble de la boutique" },
  { id: 'ventes', lab: 'Ventes', short: 'Ventes', ic: 'cart', sub: 'Le total vendu chaque jour' },
  { id: 'depenses', lab: 'Dépenses', short: 'Dépenses', ic: 'out', sub: 'Tout ce qui sort de la caisse' },
  { id: 'revendeurs', lab: 'Revendeurs', short: 'Revendeurs', ic: 'users', sub: 'Ce que les revendeurs vous doivent et ont rendu' },
  { id: 'prets', lab: 'Prêts', short: 'Prêts', ic: 'hand', sub: 'Argent prêté et matériel donné à crédit' },
];

/* ---------- page ---------- */
export default function Home() {
  const [session, setSession] = useState(undefined);
  const [autorise, setAutorise] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setAutorise(null); return; }
    supabase.rpc('est_autorise').then(({ data, error }) => setAutorise(error ? false : !!data));
  }, [session]);

  if (session === undefined || (session && autorise === null)) return <div className="authpage"><div className="formside" style={{ gridColumn: '1 / -1' }}><p className="hint">Chargement…</p></div></div>;
  if (!session) return <Auth />;
  if (!autorise) return (
    <div className="authpage"><div className="formside" style={{ gridColumn: '1 / -1' }}><div className="authbox">
      <h2>Accès pas encore autorisé</h2>
      <p className="hint">Vous êtes connecté avec <b>{session.user.email}</b>, mais cette adresse n'est pas dans la liste des personnes autorisées. Demandez au propriétaire de l'ajouter, puis rechargez la page.</p>
      <button className="btn" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
    </div></div></div>
  );
  return <App session={session} />;
}

/* ---------- connexion ---------- */
function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState({ t: '', c: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg({ t: '', c: '' });
    const fn = mode === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { data, error } = await fn.call(supabase.auth, { email, password: pw });
    setBusy(false);
    if (error) setMsg({ c: 'err', t: mode === 'login' ? 'Email ou mot de passe incorrect.' : "Le compte n'a pas pu être créé : " + error.message });
    else if (mode === 'signup' && !data.session) setMsg({ c: 'ok', t: 'Compte créé. Ouvrez le mail de confirmation, puis revenez vous connecter.' });
  }

  return (
    <div className="authpage">
      <div className="hero">
        <div className="brand"><div className="logo">Bb</div><div><b>Boutik bi</b><span>Gestion de la boutique</span></div></div>
        <h2>Suivez votre caisse, vos ventes et ce qu'on vous doit.</h2>
        <ul>
          <li><Ic name="check" /> Vente du jour notée en quelques secondes</li>
          <li><Ic name="check" /> Revendeurs et prêts suivis personne par personne</li>
          <li><Ic name="check" /> Solde et manquement calculés tout seuls</li>
        </ul>
      </div>
      <div className="formside">
        <div className="authbox">
          <div><h2 style={{ fontSize: 22 }}>{mode === 'login' ? 'Se connecter' : 'Créer un compte'}</h2>
            <p className="hint">{mode === 'login' ? 'Entrez votre email et votre mot de passe.' : 'Choisissez un mot de passe de 6 caractères minimum.'}</p></div>
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
function App({ session }) {
  const [view, setView] = useState('accueil');
  const [S, setS] = useState({ ventes: [], depenses: [], revendeurs: [], prets: [], caisse: null });
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

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
  }, []);
  useEffect(() => { load(); }, [load]);

  const c = useMemo(() => {
    const ventes = sum(S.ventes, 'montant'), depenses = sum(S.depenses, 'montant');
    const revDette = sum(S.revendeurs, 'dette'), revRemb = sum(S.revendeurs, 'rembourse');
    const arg = S.prets.filter(p => p.type !== 'MATERIEL'), mat = S.prets.filter(p => p.type === 'MATERIEL');
    const argPret = sum(arg, 'pret'), argRemb = sum(arg, 'rembourse'), matPret = sum(mat, 'pret'), matRemb = sum(mat, 'rembourse');
    const ym = today().slice(0, 7);
    const vMois = S.ventes.filter(v => v.date?.startsWith(ym)), dMois = S.depenses.filter(d => d.date?.startsWith(ym));
    return {
      ventes, depenses, revDette, revRemb, revReste: revDette - revRemb,
      argPret, argRemb, argReste: argPret - argRemb, matPret, matRemb, matReste: matPret - matRemb,
      solde: ventes + revRemb - depenses - argPret + argRemb + matRemb,
      ym, ventesMois: sum(vMois, 'montant'), joursMois: vMois.length, depMois: sum(dMois, 'montant'),
      moyenne: S.ventes.length ? ventes / S.ventes.length : 0,
    };
  }, [S]);

  const V = VIEWS.find(v => v.id === view);
  const ctx = { S, c, load };
  const logout = <button className="logout" onClick={() => supabase.auth.signOut()}><Ic name="logout" /> Se déconnecter</button>;

  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><div className="logo">Bb</div><div><b>Boutik bi</b><span>Gestion de la boutique</span></div></div>
        <nav className="menu" aria-label="Menu">
          {VIEWS.map(v => <a key={v.id} href={'#' + v.id} className={view === v.id ? 'on' : ''}><Ic name={v.ic} />{v.lab}</a>)}
        </nav>
        <div className="foot"><span className="who">{session.user.email}</span>{logout}</div>
      </aside>

      <div className="content">
        <div className="mtop"><div className="brand"><div className="logo">Bb</div><div><b>Boutik bi</b></div></div>{logout}</div>
        <header className="pagehead">
          <div><h1>{V.lab}</h1><p>{V.sub}</p></div>
          {loaded && <div className="soldechip">Solde <b className="num">{fmt(c.solde)}</b></div>}
        </header>
        <main className="page">
          {!loaded && !err && <div className="banner">Chargement des données…</div>}
          {err && <div className="banner err">{err}</div>}
          {loaded && view === 'accueil' && <Accueil {...ctx} />}
          {loaded && view === 'ventes' && <Ventes {...ctx} />}
          {loaded && view === 'depenses' && <Depenses {...ctx} />}
          {loaded && view === 'revendeurs' && <Revendeurs {...ctx} />}
          {loaded && view === 'prets' && <Prets {...ctx} />}
        </main>
      </div>

      <nav className="bottomnav" aria-label="Menu">
        {VIEWS.map(v => <a key={v.id} href={'#' + v.id} className={view === v.id ? 'on' : ''}><Ic name={v.ic} />{v.short}</a>)}
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

function DelBtn({ table, id, load }) {
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 4000); return () => clearTimeout(t); }, [arm]);
  return (
    <button className={'lnk' + (arm ? ' arm' : '')} disabled={busy} onClick={async e => {
      e.stopPropagation();
      if (!arm) return setArm(true);
      setBusy(true); const { error } = await supabase.from(table).delete().eq('id', id); setBusy(false);
      if (!error) load([table]); else setArm(false);
    }}>{arm ? 'Confirmer ?' : 'Supprimer'}</button>
  );
}

const Seg = ({ value, onChange, options, label }) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map(([v, l]) => <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
  </div>
);

const Bar = ({ d, r }) => <div className="bar"><i style={{ width: (d > 0 ? Math.min(100, Math.max(0, r / d * 100)) : 100) + '%' }} /></div>;

/* ---------- tableau de bord ---------- */
function Accueil({ S, c, load }) {
  const [val, setVal] = useState(S.caisse?.en_main ?? '');
  const [msg, run] = useSave();
  const enMain = S.caisse?.en_main ?? null;
  const m = enMain == null ? null : c.solde - n(enMain);
  const aRecup = c.revReste + c.argReste + c.matReste;
  const top = groupBy(S.revendeurs, 'nom', 'dette', 'rembourse').filter(g => g.d - g.r > 0).slice(0, 5);

  return (
    <>
      <div className="kpis">
        <Kpi cls="primary" ic="wallet" lab="Solde" val={c.solde} sub="Argent qui devrait être en caisse" />
        <Kpi cls="good" ic="trend" lab={'Ventes ' + moisFr(c.ym)} val={c.ventesMois} sub={`${c.joursMois} jour${c.joursMois > 1 ? 's' : ''} noté${c.joursMois > 1 ? 's' : ''} · moyenne ${fmt(c.moyenne)}/jour`} />
        <Kpi cls="bad" ic="out" lab="Dépenses" val={c.depenses} sub={`Dont ${fmt(c.depMois)} en ${moisFr(c.ym)}`} />
        <Kpi cls="warn" ic="clock" lab="À récupérer" val={aRecup} sub="Revendeurs + prêts" />
      </div>

      <div className="grid-main">
        <Chart ventes={S.ventes} />
        <div className="card">
          <div className="card-head"><h2>Contrôle de caisse</h2></div>
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
          <div className={'res ' + (m == null ? 'none' : m > 0 ? 'bad' : 'good')}>
            <span>{m == null ? 'Manquement' : m > 0 ? 'Il manque' : m < 0 ? 'Vous avez en plus' : 'Rien ne manque'}</span>
            <b className="num">{m == null ? '—' : fmt(Math.abs(m))}</b>
            <span className="hint">{m == null ? "Tapez l'argent que vous avez pour le calculer." : `Solde ${fmt(c.solde)} − en main ${fmt(enMain)}${S.caisse?.maj_le ? ' · noté le ' + dfr(S.caisse.maj_le) : ''}`}</span>
          </div>
          <p className="formula">Solde = ventes + remboursements des revendeurs − dépenses − argent prêté + remboursements des prêts. Manquement = solde − argent en main.</p>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head"><h2>Revendeurs qui doivent le plus</h2><a className="hint" href="#revendeurs">Tout voir</a></div>
          <div className="rank">
            {top.length === 0 && <p className="hint">Aucun revendeur ne vous doit d'argent.</p>}
            {top.map(g => (
              <div className="item" key={g.k}>
                <div className="line"><span>{g.nom}</span><b className="num">{fmt(g.d - g.r)}</b></div>
                <Bar d={g.d} r={g.r} />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Détail de ce qu'on vous doit</h2></div>
          <div className="breakdown">
            <div className="line"><span>Revendeurs</span><span className="num">{fmt(c.revReste)}</span></div>
            <div className="line"><span>Argent prêté</span><span className="num">{fmt(c.argReste)}</span></div>
            <div className="line"><span>Matériel donné à crédit</span><span className="num">{fmt(c.matReste)}</span></div>
            <div className="line"><span>Total à récupérer</span><span className="num">{fmt(aRecup)}</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

function Chart({ ventes }) {
  const vs = [...ventes].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  if (!vs.length) return <div className="card"><h2>Ventes</h2><p className="hint">Pas encore de ventes.</p></div>;
  const avg = sum(vs, 'montant') / vs.length;
  const W = 640, H = 220, L = 46, B = 24, T = 10, R = 8;
  const max = Math.max(...vs.map(v => n(v.montant)), 1);
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const step = max / p < 3 ? p / 2 : p;
  const top = Math.ceil(max / step) * step;
  const y = v => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - R) / vs.length;
  const grid = []; for (let g = 0; g <= top; g += step) grid.push(g);
  return (
    <div className="card">
      <div className="card-head"><h2>Ventes des 30 derniers jours notés</h2><span className="hint">Moyenne {fmt(avg)}/jour (ligne pointillée)</span></div>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ventes par jour">
          {grid.map(g => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--line)" /><text x={L - 6} y={y(g) + 4} textAnchor="end">{g >= 1000 ? g / 1000 + 'k' : g}</text></g>)}
          {vs.map((v, i) => {
            const last = i === vs.length - 1, x = L + i * bw + bw * 0.18, [, mo, d] = v.date.split('-');
            return (
              <g key={v.date}>
                <rect x={x} y={y(n(v.montant))} width={bw * 0.64} height={Math.max(0, H - B - y(n(v.montant)))} rx="2" fill={last ? 'var(--blue-dark)' : 'var(--blue)'} opacity={last ? 1 : 0.85}>
                  <title>{dfr(v.date)} : {fmt(v.montant)}</title>
                </rect>
                {(i % 5 === 0 || last) && <text x={x + bw * 0.32} y={H - 6} textAnchor="middle">{+d}/{+mo}</text>}
              </g>
            );
          })}
          <line x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} stroke="var(--warn)" strokeDasharray="5 4" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

/* ---------- ventes ---------- */
function Ventes({ S, c, load }) {
  const [date, setDate] = useState(today());
  const [mt, setMt] = useState('');
  const [msg, run] = useSave();
  const vs = [...S.ventes].sort((a, b) => b.date.localeCompare(a.date));
  const months = [];
  vs.forEach(v => { const m = v.date.slice(0, 7); let g = months[months.length - 1]; if (!g || g.m !== m) { g = { m, rows: [], tot: 0 }; months.push(g); } g.rows.push(v); g.tot += n(v.montant); });
  const best = [...S.ventes].sort((a, b) => n(b.montant) - n(a.montant))[0];

  return (
    <>
      <div className="kpis">
        <Kpi cls="primary" ic="cart" lab="Total vendu" val={c.ventes} sub={`${S.ventes.length} jours notés`} />
        <Kpi cls="good" ic="trend" lab={moisFr(c.ym)} val={c.ventesMois} sub={`${c.joursMois} jour(s) noté(s)`} />
        <Kpi ic="clock" lab="Moyenne par jour" val={c.moyenne} />
        <Kpi ic="trend" lab="Meilleur jour" val={best ? best.montant : 0} sub={best ? dfr(best.date) : ''} />
      </div>
      <div className="card">
        <div className="card-head"><h2>Noter la vente du jour</h2><span className="hint">Si la date existe déjà, le montant est remplacé.</span></div>
        <form className="row" onSubmit={async e => {
          e.preventDefault(); const m = Math.round(Number(mt)); if (!date || mt === '' || !(m >= 0)) return;
          const had = S.ventes.find(v => v.date === date);
          if (await run(() => supabase.from('ventes').upsert({ date, montant: m }, { onConflict: 'date' }),
            had ? `Vente du ${dfr(date)} remplacée (avant : ${fmt(had.montant)}).` : `Vente du ${dfr(date)} enregistrée.`)) { setMt(''); setDate(today()); load(['ventes']); }
        }}>
          <div className="field"><label htmlFor="v-date">Date</label><input id="v-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="v-mt">Total vendu (F)</label><input id="v-mt" type="number" inputMode="numeric" min="0" step="1" required value={mt} onChange={e => setMt(e.target.value)} /></div>
          <button className="btn" type="submit">Enregistrer</button>
        </form>
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>
      <div className="card">
        <div className="card-head"><h2>Historique des ventes</h2><b className="num">{fmt(c.ventes)}</b></div>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Date</th><th className="r">Montant</th><th className="r">Actions</th></tr></thead>
            <tbody>
              {months.length === 0 && <tr><td colSpan={3} className="muted">Aucune vente notée.</td></tr>}
              {months.map(g => (
                <Fragment key={g.m}>
                  <tr className="group"><td style={{ textTransform: 'capitalize' }}>{moisFr(g.m)} · {g.rows.length} jours</td><td className="r num">{fmt(g.tot)}</td><td /></tr>
                  {g.rows.map(v => (
                    <tr key={v.id}>
                      <td>{dfr(v.date)}</td>
                      <td className="r num">{fmt(v.montant)}</td>
                      <td><div className="actions">
                        <button className="lnk" onClick={() => { setDate(v.date); setMt(String(n(v.montant))); scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifier</button>
                        <DelBtn table="ventes" id={v.id} load={load} />
                      </div></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------- dépenses ---------- */
function Depenses({ S, c, load }) {
  const [desc, setDesc] = useState('');
  const [mt, setMt] = useState('');
  const [date, setDate] = useState(today());
  const [q, setQ] = useState('');
  const [msg, run] = useSave();
  const sugg = [...new Set(S.depenses.map(d => String(d.description || '').trim()).filter(Boolean))];
  const rows = recent(S.depenses).filter(d => !q || key(d.description).includes(key(q)));
  const cats = groupBy(S.depenses, 'description', 'montant', 'x').sort((a, b) => b.d - a.d).slice(0, 2);

  return (
    <>
      <div className="kpis">
        <Kpi cls="primary" ic="out" lab="Total dépenses" val={c.depenses} sub={`${S.depenses.length} dépenses`} />
        <Kpi cls="bad" ic="clock" lab={moisFr(c.ym)} val={c.depMois} />
        {cats.map(g => <Kpi key={g.k} ic="wallet" lab={g.nom} val={g.d} sub={`${g.rows.length} fois`} />)}
      </div>
      <div className="card">
        <h2>Ajouter une dépense</h2>
        <form className="row" onSubmit={async e => {
          e.preventDefault(); const m = Math.round(Number(mt)); if (!desc.trim() || !(m > 0)) return;
          if (await run(() => supabase.from('depenses').insert({ description: desc.trim(), montant: m, date }), 'Dépense ajoutée.')) { setDesc(''); setMt(''); load(['depenses']); }
        }}>
          <div className="field wide"><label htmlFor="d-desc">Description</label><input id="d-desc" list="dl-dep" required placeholder="ex : wifi, location, achat accessoires" value={desc} onChange={e => setDesc(e.target.value)} /></div>
          <div className="field"><label htmlFor="d-mt">Montant (F)</label><input id="d-mt" type="number" inputMode="numeric" min="1" step="1" required value={mt} onChange={e => setMt(e.target.value)} /></div>
          <div className="field"><label htmlFor="d-date">Date</label><input id="d-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
          <button className="btn" type="submit">Ajouter</button>
        </form>
        <datalist id="dl-dep">{sugg.map(s => <option key={s} value={s} />)}</datalist>
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>
      <div className="card">
        <div className="card-head">
          <h2>Liste des dépenses</h2>
          <div className="searchbar"><input aria-label="Rechercher une dépense" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />{q && <b className="num">{fmt(sum(rows, 'montant'))}</b>}</div>
        </div>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Description</th><th>Date</th><th className="r">Montant</th><th className="r">Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="muted">Aucune dépense.</td></tr>}
              {rows.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.description}</td>
                  <td className="muted">{d.date ? dfr(d.date) : AVANT}</td>
                  <td className="r num neg">{fmt(d.montant)}</td>
                  <td><div className="actions"><DelBtn table="depenses" id={d.id} load={load} /></div></td>
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
function PersonTable({ groups, table, amountField, withType, load, labels }) {
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
                        <td><div className="actions"><DelBtn table={table} id={r.id} load={load} /></div></td>
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
function Revendeurs({ S, c, load }) {
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
      <div className="card">
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
      </div>
      <PersonTable groups={groups} table="revendeurs" amountField="dette" load={load}
        labels={{ title: 'Comptes des revendeurs', who: 'Revendeur', total: 'Total dû', entry: 'Dette' }} />
    </>
  );
}

/* ---------- prêts ---------- */
function Prets({ S, c, load }) {
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
      <div className="card">
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
      </div>
      <PersonTable groups={groups} table="prets" amountField="pret" withType load={load}
        labels={{ title: 'Comptes des prêts', who: 'Personne', total: 'Total prêté', entry: 'Prêt' }} />
    </>
  );
}
