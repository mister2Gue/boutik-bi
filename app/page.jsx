'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

/* ---------- outils ---------- */
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const n = v => Number(v) || 0;
const fmt = v => Math.round(n(v)).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' F';
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const dfr = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+d} ${MOIS[+m - 1]} ${y}`; };
const key = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const sum = (a, f) => a.reduce((t, x) => t + n(x[f]), 0);
const recent = a => [...a].sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.created_at || '').localeCompare(x.created_at || '') || n(y.ordre) - n(x.ordre));
const AVANT = "avant l'application";

function groupBy(rows, field, a, b) {
  const g = new Map();
  for (const r of rows) {
    const k = key(r[field]); if (!k) continue;
    if (!g.has(k)) g.set(k, { k, nom: String(r[field]).trim(), rows: [], d: 0, r: 0 });
    const e = g.get(k); e.rows.push(r); e.d += n(r[a]); e.r += n(r[b]);
  }
  return [...g.values()].sort((x, y) => (y.d - y.r) - (x.d - x.r));
}

const VIEWS = [['accueil', 'Accueil'], ['ventes', 'Ventes'], ['depenses', 'Dépenses'], ['revendeurs', 'Revendeurs'], ['prets', 'Prêts']];

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

  if (session === undefined) return <Shell><main><div className="banner">Chargement…</div></main></Shell>;
  if (!session) return <Shell><Auth /></Shell>;
  if (autorise === null) return <Shell session={session}><main><div className="banner">Vérification de l'accès…</div></main></Shell>;
  if (!autorise) return (
    <Shell session={session}><main><div className="card">
      <h2>Accès pas encore autorisé</h2>
      <p className="hint">Vous êtes connecté avec <b>{session.user.email}</b>, mais cette adresse n'est pas dans la liste des personnes autorisées. Demandez au propriétaire de l'ajouter, puis rechargez la page.</p>
    </div></main></Shell>
  );
  return <App session={session} />;
}

function Shell({ children, session, solde }) {
  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div><h1>Boutik bi</h1><div className="sub">Gestion de la boutique</div></div>
          <div className="solde" style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
            {solde !== undefined && <div><span className="sub">Solde</span><b className="num">{fmt(solde)}</b></div>}
            {session && <button className="topbtn" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>}
          </div>
        </div>
      </header>
      {children}
    </>
  );
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
    <main className="auth">
      <div className="card">
        <h2>{mode === 'login' ? 'Se connecter' : 'Créer un compte'}</h2>
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
    </main>
  );
}

/* ---------- application ---------- */
function App({ session }) {
  const [view, setView] = useState('accueil');
  const [S, setS] = useState({ ventes: [], depenses: [], revendeurs: [], prets: [], caisse: null });
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const read = () => { const h = location.hash.slice(1); setView(VIEWS.some(v => v[0] === h) ? h : 'accueil'); };
    read(); addEventListener('hashchange', read); return () => removeEventListener('hashchange', read);
  }, []);

  const load = useCallback(async (tables = ['ventes', 'depenses', 'revendeurs', 'prets', 'caisse']) => {
    const res = await Promise.all(tables.map(t => supabase.from(t).select('*')));
    const bad = res.find(r => r.error);
    if (bad) { setErr('Impossible de lire les données. Vérifiez la connexion et rechargez la page.'); return; }
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
    return {
      ventes, depenses, revDette, revRemb, revReste: revDette - revRemb,
      argPret, argRemb, argReste: argPret - argRemb, matPret, matRemb, matReste: matPret - matRemb,
      solde: ventes + revRemb - depenses - argPret + argRemb + matRemb,
    };
  }, [S]);

  const ctx = { S, c, load };
  return (
    <Shell session={session} solde={loaded ? c.solde : undefined}>
      <nav className="tabs" aria-label="Sections">
        <div className="tabs-inner">
          {VIEWS.map(([id, lab]) => <a key={id} href={'#' + id} className={view === id ? 'on' : ''}>{lab}</a>)}
        </div>
      </nav>
      <main>
        {!loaded && !err && <div className="banner">Chargement des données…</div>}
        {err && <div className="banner err">{err}</div>}
        {loaded && view === 'accueil' && <Accueil {...ctx} />}
        {loaded && view === 'ventes' && <Ventes {...ctx} />}
        {loaded && view === 'depenses' && <Depenses {...ctx} />}
        {loaded && view === 'revendeurs' && <Revendeurs {...ctx} />}
        {loaded && view === 'prets' && <Prets {...ctx} />}
      </main>
    </Shell>
  );
}

/* ---------- petits composants ---------- */
const Tile = ({ lab, val, cls = '' }) => <div className={'tile ' + cls}><span className="lab">{lab}</span><span className="val num">{fmt(val)}</span></div>;

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
    <button className={'del' + (arm ? ' arm' : '')} disabled={busy} onClick={async () => {
      if (!arm) return setArm(true);
      setBusy(true); const { error } = await supabase.from(table).delete().eq('id', id); setBusy(false);
      if (!error) load([table]); else setArm(false);
    }}>{arm ? 'Confirmer ?' : 'Supprimer'}</button>
  );
}

function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

function Person({ g, children }) {
  const [open, setOpen] = useState(false);
  const reste = g.d - g.r, pct = g.d > 0 ? Math.min(100, Math.max(0, g.r / g.d * 100)) : 100;
  return (
    <div className="person">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <div className="ptop"><span className="pname">{g.nom}</span>
          <span className="num amt">{reste > 0 ? <>{fmt(reste)} <span className="pill due">à récupérer</span></> : <span className="pill ok">soldé</span>}</span></div>
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
        <span className="meta hint">Total {fmt(g.d)} · rendu {fmt(g.r)}</span>
      </button>
      {open && <div className="detail list">{children}</div>}
    </div>
  );
}

/* ---------- accueil ---------- */
function Accueil({ S, c, load }) {
  const [val, setVal] = useState(S.caisse?.en_main ?? '');
  const [msg, run] = useSave();
  const enMain = S.caisse?.en_main ?? null;
  const m = enMain == null ? null : c.solde - n(enMain);

  return (
    <>
      <div className="card">
        <h2>Argent en caisse</h2>
        <div className="manq">
          <form className="row" style={{ alignContent: 'end' }} onSubmit={async e => {
            e.preventDefault();
            const v = val === '' ? null : Math.round(Number(val));
            if (await run(() => supabase.from('caisse').upsert({ id: 1, en_main: v, maj_le: today() }), 'Enregistré.')) load(['caisse']);
          }}>
            <div className="field wide"><label htmlFor="c-main">Argent que j'ai en main (F)</label>
              <input id="c-main" type="number" inputMode="numeric" min="0" step="1" placeholder="ex : 200000" value={val} onChange={e => setVal(e.target.value)} /></div>
            <button className="btn" type="submit">Enregistrer</button>
            <p className={'msg ' + msg.c} style={{ flexBasis: '100%' }}>{msg.t}</p>
          </form>
          <div className={'res ' + (m == null ? 'none' : m > 0 ? 'bad' : 'good')}>
            <span>{m == null ? 'Manquement' : m > 0 ? 'Il manque' : m < 0 ? 'Vous avez en plus' : 'Rien ne manque'}</span>
            <b className="num">{m == null ? '—' : fmt(Math.abs(m))}</b>
            <span className="hint">{m == null ? "Tapez l'argent que vous avez pour le calculer." : `Solde ${fmt(c.solde)} − en main ${fmt(enMain)}${S.caisse?.maj_le ? ' · noté le ' + dfr(S.caisse.maj_le) : ''}`}</span>
          </div>
        </div>
        <p className="formula">Solde = ventes + remboursements des revendeurs − dépenses − argent prêté + remboursements des prêts.<br />Manquement = solde − argent en main.</p>
      </div>
      <div className="card">
        <h2>Résumé</h2>
        <div className="tiles">
          <Tile lab="Total vendu" val={c.ventes} cls="in" />
          <Tile lab="Remboursements revendeurs reçus" val={c.revRemb} cls="in" />
          <Tile lab="Total dépenses" val={c.depenses} cls="out" />
          <Tile lab="Argent prêté pas encore rendu" val={c.argReste} cls="out" />
          <Tile lab="Revendeurs : reste à récupérer" val={c.revReste} cls="owed" />
          <Tile lab="Matériel à crédit à récupérer" val={c.matReste} cls="owed" />
        </div>
      </div>
      <Chart ventes={S.ventes} />
    </>
  );
}

function Chart({ ventes }) {
  const vs = [...ventes].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  if (!vs.length) return <div className="card"><h2>Ventes</h2><p className="hint">Pas encore de ventes.</p></div>;
  const avg = sum(vs, 'montant') / vs.length;
  const W = 640, H = 200, L = 52, B = 22, T = 8, R = 8;
  const max = Math.max(...vs.map(v => n(v.montant)), 1);
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const step = max / p < 3 ? p / 2 : p;
  const top = Math.ceil(max / step) * step;
  const y = v => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - R) / vs.length;
  const grid = []; for (let g = 0; g <= top; g += step) grid.push(g);
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h2>Ventes des 30 derniers jours notés</h2><span className="hint">Moyenne : {fmt(avg)} par jour</span>
      </div>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ventes par jour">
          {grid.map(g => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--line)" /><text x={L - 6} y={y(g) + 4} textAnchor="end">{g >= 1000 ? g / 1000 + 'k' : g}</text></g>)}
          {vs.map((v, i) => {
            const last = i === vs.length - 1, x = L + i * bw + bw * 0.15, [, mo, d] = v.date.split('-');
            return (
              <g key={v.date}>
                <rect x={x} y={y(n(v.montant))} width={bw * 0.7} height={Math.max(0, H - B - y(n(v.montant)))} rx="2"
                  fill={last ? 'var(--accent)' : 'var(--accent-soft)'} stroke="var(--accent)" strokeWidth={last ? 0 : 0.8}>
                  <title>{dfr(v.date)} : {fmt(v.montant)}</title>
                </rect>
                {(i % 5 === 0 || last) && <text x={x + bw * 0.35} y={H - 6} textAnchor="middle">{+d}/{+mo}</text>}
              </g>
            );
          })}
          <line x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} stroke="var(--warn)" strokeDasharray="4 3" />
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
  const mTot = {}; vs.forEach(v => { const m = v.date.slice(0, 7); mTot[m] = (mTot[m] || 0) + n(v.montant); });
  let cur = '';
  return (
    <>
      <div className="card">
        <h2>Noter la vente du jour</h2>
        <form className="row" onSubmit={async e => {
          e.preventDefault(); const m = Math.round(Number(mt)); if (!date || !(m >= 0) || mt === '') return;
          const had = S.ventes.find(v => v.date === date);
          if (await run(() => supabase.from('ventes').upsert({ date, montant: m }, { onConflict: 'date' }),
            had ? `Vente du ${dfr(date)} remplacée (avant : ${fmt(had.montant)}).` : `Vente du ${dfr(date)} enregistrée.`)) {
            setMt(''); setDate(today()); load(['ventes']);
          }
        }}>
          <div className="field"><label htmlFor="v-date">Date</label><input id="v-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="v-mt">Total vendu (F)</label><input id="v-mt" type="number" inputMode="numeric" min="0" step="1" required value={mt} onChange={e => setMt(e.target.value)} /></div>
          <button className="btn" type="submit">Enregistrer</button>
        </form>
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><h2>Toutes les ventes</h2><b className="num">{fmt(c.ventes)}</b></div>
        <div className="list">
          {vs.length === 0 && <p className="hint">Aucune vente notée.</p>}
          {vs.map(v => {
            const m = v.date.slice(0, 7), head = m !== cur; cur = m;
            return (
              <div key={v.id} style={{ display: 'contents' }}>
                {head && <div className="month"><span>{MOIS[+m.slice(5) - 1]} {m.slice(0, 4)}</span><span className="num">{fmt(mTot[m])}</span></div>}
                <div className="li">
                  <div className="main"><span>{dfr(v.date)}</span></div>
                  <span className="amt num">{fmt(v.montant)}</span>
                  <button className="del" onClick={() => { setDate(v.date); setMt(String(n(v.montant))); scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifier</button>
                  <DelBtn table="ventes" id={v.id} load={load} />
                </div>
              </div>
            );
          })}
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
  const [msg, run] = useSave();
  const sugg = [...new Set(S.depenses.map(d => String(d.description || '').trim()).filter(Boolean))];
  return (
    <>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><h2>Toutes les dépenses</h2><b className="num">{fmt(c.depenses)}</b></div>
        <div className="list">
          {S.depenses.length === 0 && <p className="hint">Aucune dépense.</p>}
          {recent(S.depenses).map(d => (
            <div className="li" key={d.id}>
              <div className="main"><span>{d.description}</span><span className="meta">{d.date ? dfr(d.date) : AVANT}</span></div>
              <span className="amt num neg">{fmt(d.montant)}</span>
              <DelBtn table="depenses" id={d.id} load={load} />
            </div>
          ))}
        </div>
      </div>
    </>
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
  return (
    <>
      <div className="card">
        <h2>Revendeurs</h2>
        <p className="hint">Ce que vous avez prêté aux revendeurs et ce qu'ils ont rendu. L'argent rendu s'ajoute au solde.</p>
        <form className="row" onSubmit={async e => {
          e.preventDefault(); const m = Math.round(Number(mt)); if (!nom.trim() || !(m > 0)) return;
          const ex = groups.find(g => g.k === key(nom));
          const row = { nom: ex ? ex.nom : nom.trim(), dette: kind === 'dette' ? m : 0, rembourse: kind === 'remb' ? m : 0, date };
          if (await run(() => supabase.from('revendeurs').insert(row), kind === 'dette' ? 'Dette ajoutée.' : 'Remboursement ajouté.')) { setMt(''); load(['revendeurs']); }
        }}>
          <div className="field" style={{ flexBasis: '100%' }}><Seg label="Type d'opération" value={kind} onChange={setKind} options={[['dette', 'Nouvelle dette'], ['remb', 'Remboursement']]} /></div>
          <div className="field wide"><label htmlFor="r-nom">Revendeur</label><input id="r-nom" list="dl-rev" required value={nom} onChange={e => setNom(e.target.value)} /></div>
          <div className="field"><label htmlFor="r-mt">Montant (F)</label><input id="r-mt" type="number" inputMode="numeric" min="1" step="1" required value={mt} onChange={e => setMt(e.target.value)} /></div>
          <div className="field"><label htmlFor="r-date">Date</label><input id="r-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
          <button className="btn" type="submit">Ajouter</button>
        </form>
        <datalist id="dl-rev">{groups.map(g => <option key={g.k} value={g.nom} />)}</datalist>
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>
      <div className="card">
        <div className="tiles">
          <Tile lab="Total prêté aux revendeurs" val={c.revDette} />
          <Tile lab="Déjà remboursé" val={c.revRemb} cls="in" />
          <Tile lab="Reste à récupérer" val={c.revReste} cls="owed" />
        </div>
        <div className="persons">
          {groups.length === 0 && <p className="hint">Aucun revendeur.</p>}
          {groups.map(g => (
            <Person key={g.k} g={g}>
              {recent(g.rows).map(r => {
                const isR = n(r.rembourse) > 0 && !n(r.dette);
                return (
                  <div className="li" key={r.id}>
                    <div className="main"><span>{isR ? 'Remboursement' : 'Dette'}</span><span className="meta">{r.date ? dfr(r.date) : AVANT}</span></div>
                    <span className={'amt num' + (isR ? ' pos' : '')}>{isR ? '+ ' + fmt(r.rembourse) : fmt(r.dette)}{!isR && n(r.rembourse) > 0 && <span className="meta"> (rendu {fmt(r.rembourse)})</span>}</span>
                    <DelBtn table="revendeurs" id={r.id} load={load} />
                  </div>
                );
              })}
            </Person>
          ))}
        </div>
      </div>
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
      <div className="card">
        <h2>Prêts</h2>
        <p className="hint">Argent prêté : enlevé du solde. Matériel donné à crédit : pas enlevé, car l'argent n'est pas sorti de la caisse. Tout remboursement s'ajoute au solde.</p>
        <form className="row" onSubmit={async e => {
          e.preventDefault(); const m = Math.round(Number(mt)); if (!nom.trim() || !(m > 0)) return;
          const ex = groups.find(g => g.k === key(nom));
          const row = { personne: ex ? ex.nom : nom.trim(), pret: kind === 'pret' ? m : 0, rembourse: kind === 'remb' ? m : 0, type, note: note.trim() || null, date };
          if (await run(() => supabase.from('prets').insert(row), kind === 'pret' ? 'Prêt ajouté.' : 'Remboursement ajouté.')) { setMt(''); setNote(''); load(['prets']); }
        }}>
          <div className="field" style={{ flexBasis: '100%' }}><Seg label="Type d'opération" value={kind} onChange={setKind} options={[['pret', 'Nouveau prêt'], ['remb', 'Remboursement']]} /></div>
          <div className="field" style={{ flexBasis: '100%' }}><Seg label="Argent ou matériel" value={type} onChange={setType} options={[['ARGENT', 'Argent'], ['MATERIEL', 'Matériel']]} /></div>
          <div className="field wide"><label htmlFor="p-nom">Personne</label><input id="p-nom" list="dl-pret" required value={nom} onChange={e => setNom(e.target.value)} /></div>
          <div className="field"><label htmlFor="p-mt">Montant (F)</label><input id="p-mt" type="number" inputMode="numeric" min="1" step="1" required value={mt} onChange={e => setMt(e.target.value)} /></div>
          <div className="field"><label htmlFor="p-date">Date</label><input id="p-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="field wide"><label htmlFor="p-note">Note (facultatif)</label><input id="p-note" placeholder="ex : protège-écran, chargeur" value={note} onChange={e => setNote(e.target.value)} /></div>
          <button className="btn" type="submit">Ajouter</button>
        </form>
        <datalist id="dl-pret">{groups.map(g => <option key={g.k} value={g.nom} />)}</datalist>
        <p className={'msg ' + msg.c}>{msg.t}</p>
      </div>
      <div className="card">
        <div className="tiles">
          <Tile lab="Argent prêté" val={c.argPret} cls="out" />
          <Tile lab="Argent rendu" val={c.argRemb} cls="in" />
          <Tile lab="Argent à récupérer" val={c.argReste} cls="owed" />
          <Tile lab="Matériel donné à crédit" val={c.matPret} />
          <Tile lab="Matériel payé" val={c.matRemb} cls="in" />
          <Tile lab="Matériel à récupérer" val={c.matReste} cls="owed" />
        </div>
        <div className="persons">
          {groups.length === 0 && <p className="hint">Aucun prêt.</p>}
          {groups.map(g => (
            <Person key={g.k} g={g}>
              {recent(g.rows).map(r => {
                const isR = n(r.rembourse) > 0 && !n(r.pret);
                return (
                  <div className="li" key={r.id}>
                    <div className="main">
                      <span>{isR ? 'Remboursement' : 'Prêt'} {r.type === 'MATERIEL' ? <span className="pill mat">Matériel</span> : <span className="pill arg">Argent</span>}</span>
                      <span className="meta">{[r.date ? dfr(r.date) : AVANT, r.note].filter(Boolean).join(' · ')}</span>
                    </div>
                    <span className={'amt num' + (isR ? ' pos' : '')}>{isR ? '+ ' + fmt(r.rembourse) : fmt(r.pret)}{!isR && n(r.rembourse) > 0 && <span className="meta"> (rendu {fmt(r.rembourse)})</span>}</span>
                    <DelBtn table="prets" id={r.id} load={load} />
                  </div>
                );
              })}
            </Person>
          ))}
        </div>
      </div>
    </>
  );
}
