import React, { useEffect, useId, useState } from 'react';
import { createRoot } from 'react-dom/client';
import logo from './brand/aardvarkland.png';
import './style.css';
import './ops.css';
import './process.css';
import { book, clients, describeProduct, estimateBooking, parseRequest, products, questions, requests,
  resolveSupport, reviewRequest, runAttempt, sendQuote, slots, sources } from './core.js';

const pages = {
  nabidky: ['Poptávka a nabídka', 'M3 5h18v14H3zM3 7l9 6 9-6'],
  provoz: ['Provozní dohled', 'M3 12h4l3-6 4 12 3-6h4'],
  katalog: ['Kontrola katalogu', 'M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h4'],
  schvalovani: ['Schvalování', 'M5 4h14v16H5zM8 12l3 3 6-6'],
  podpora: ['Zákaznická podpora', 'M4 5h16v11H9l-5 4zM8 9h8m-8 3h5'],
  rezervace: ['Rezervace termínu', 'M4 6h16v14H4zM4 10h16M8 3v5m8-5v5'],
  eventy: ['Pronájem prostoru', 'M3 20h18M6 20V7l6-3 6 3v13m-8 0v-5h4v5'],
};
const currentRoute = () => {
  const value = location.hash.slice(1);
  return Object.hasOwn(pages, value) ? value : 'nabidky';
};
const money = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });
const states = { new: 'Nový', review: 'Ke schválení', returned: 'Vrácen', approved: 'Schválen',
  completed: 'Dokončen', failed: 'Vyžaduje opakování', pending: 'Čeká na potvrzení', confirmed: 'Potvrzeno' };
const roles = { coordinator: 'Koordinátor', reviewer: 'Schvalovatel' };
const live = import.meta.env.VITE_CONNECTOR === 'live';

function read(key, initial) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? initial; }
  catch { return initial; }
}

function useStore(section, initial) {
  const key = 'aardvarkland:process:' + section + ':v1';
  const [state, setState] = useState(() => read(key, initial));
  useEffect(() => {
    const sync = event => { if (event.key === key) setState(read(key, initial)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key, initial]);
  async function commit(change) {
    const write = () => {
      const next = change(read(key, initial));
      localStorage.setItem(key, JSON.stringify(next));
      setState(next);
      return next;
    };
    return navigator.locks ? navigator.locks.request(key, write) : write();
  }
  return [state, commit];
}

function useAction() {
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);
  async function act(task) {
    setWorking(true);
    setMessage(null);
    try { setMessage({ text: await task(), error: false }); }
    catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setWorking(false); }
  }
  return { working, message, act, clear: () => setMessage(null) };
}

function Status({ value }) {
  if (!value?.text) return null;
  return <p role={value.error ? 'alert' : 'status'} className={value.error ? 'error' : 'notice'}>{value.text}</p>;
}

function Select({ label, value, change, options }) {
  const id = useId();
  return <div className="ticket-picker"><label htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={event => change(event.target.value)}>
      {options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
    </select></div>;
}

function Header({ screen, subtitle }) {
  return <div className="page-title"><h1>{pages[screen][0]}</h1><p className="lede">{subtitle}</p></div>;
}

async function fixture(filename) {
  const response = await fetch(import.meta.env.BASE_URL + 'fixtures/' + filename);
  if (!response.ok) throw new Error('Ukázkový podklad se nepodařilo načíst.');
  return response.text();
}

const empty = Object.freeze({});
const emptyList = Object.freeze([]);
function Quote() {
  const [state, commit] = useStore('quote', empty);
  const [broken, setBroken] = useState(false);
  const { working, message, act } = useAction();
  const quote = state.quote;
  return <><Header screen="nabidky" subtitle="Načtěte poptávku a přílohu, schvalte nabídku a ověřte předání do CRM." />
    <div className="columns">
      <section className="surface stack"><h2>Doručená poptávka</h2>
        <div className="links"><a href="./fixtures/request.eml" download>Stáhnout e-mail</a><a href="./fixtures/items.csv" download>Stáhnout přílohu CSV</a></div>
        <div><button className="primary" disabled={working} onClick={() => act(async () => {
          const [email, input] = await Promise.all([fixture('request.eml'), fixture('items.csv')]);
          const parsed = parseRequest(email, input);
          const next = await commit(previous => previous.quote?.id === parsed.id ? previous : { quote: parsed });
          return next.approved ? 'Původní schválená nabídka zůstala uložena.' : 'Položky a cena byly načteny.';
        })}>Načíst poptávku</button></div>
        {quote && <><dl><dt>ID</dt><dd>{quote.id}</dd><dt>Od</dt><dd>{quote.sender}</dd><dt>Předmět</dt><dd>{quote.subject}</dd></dl>
          <p className="muted">{quote.body}</p></>}
      </section>
      <section className="surface stack" aria-label="Nabídka"><div className="row"><h2>Nabídka</h2>
        {state.approved && <span className="pill ok">Schválená</span>}</div>
        {!quote && <p className="muted">Nejprve načtěte poptávku.</p>}
        {quote && <>
          <div className="table-wrap"><table><thead><tr><th>Položka</th><th>Počet</th><th>Cena</th></tr></thead><tbody>
            {quote.items.map(row => <tr key={row.code}><th scope="row">{row.title}</th><td>{row.quantity}</td>
              <td>{money.format(row.quantity * row.unitPrice)}</td></tr>)}
          </tbody></table></div>
          <p>Celkem <strong>{money.format(quote.total)}</strong></p>
          {!state.approved ? <div><button className="primary" disabled={working} onClick={() => act(async () => {
            await commit(previous => ({ ...previous, approved: quote.id }));
            return 'Nabídka byla schválena.';
          })}>Schválit nabídku</button></div> : <>
            {state.receipt?.status !== 'confirmed' && <label className="checkline"><input type="checkbox" checked={broken}
              onChange={event => setBroken(event.target.checked)} disabled={working} /> Ztratit potvrzení po zápisu</label>}
            <div><button className="primary" disabled={working} onClick={() => act(async () => {
              const next = await commit(previous => sendQuote(previous, quote, broken));
              setBroken(false);
              return next.receipt.status === 'pending' ? 'CRM uložilo nabídku. Potvrzení nedorazilo.'
                : 'Nabídka je potvrzena pod stejným ID.';
            })}>{state.receipt ? 'Zopakovat předání' : 'Předat do CRM'}</button></div>
          </>}
          {state.receipt && <p className="evidence">{state.receipt.id} · {states[state.receipt.status]}</p>}
        </>}
        <Status value={message} />
      </section>
    </div></>;
}

function Catalog() {
  const [id, choose] = useState(products[0].id);
  const [width, setWidth] = useState('420');
  const [saved, commit] = useStore('catalog', empty);
  const { working, message, act, clear } = useAction();
  const product = products.find(row => row.id === id);
  const draft = describeProduct(product, width);
  return <><Header screen="katalog" subtitle="Před schválením porovnejte každé tvrzení s dodavatelským feedem." />
    <div className="columns">
      <section className="surface stack"><h2>Dodavatelský feed</h2>
        <Select label="Produkt" value={id} change={value => { choose(value); setWidth('420'); clear(); }}
          options={products.map(row => [row.id, row.name])} />
        <dl><dt>Podklad</dt><dd>{product.id}</dd><dt>Materiál</dt><dd>{product.material}</dd><dt>Šířka</dt>
          <dd>{product.width === null ? 'Neuvedena' : product.width + ' mm'}</dd></dl>
      </section>
      <section className="surface stack"><h2>Návrh popisu</h2>
        <label>Navržená šířka (mm)<input inputMode="numeric" maxLength="6" value={width} disabled={working}
          onChange={event => { setWidth(event.target.value); clear(); }} /></label>
        <p className="evidence">{draft.text}</p>
        {draft.errors.map(error => <p className="error" key={error}>{error}</p>)}
        <div className="row"><button disabled={working} onClick={() => { setWidth(String(product.width ?? '')); clear(); }}>Použít údaje z feedu</button>
          <button className="primary" disabled={working || draft.errors.length > 0} onClick={() => act(async () => {
            await commit(previous => ({ ...previous, [id]: draft.text }));
            return 'Popis byl schválen.';
          })}>Schválit popis</button></div>
        {saved[id] && <p className="small">Uložený popis · {saved[id]}</p>}
        <Status value={message} />
      </section>
    </div></>;
}

function HelpDesk() {
  const [id, choose] = useState(questions[0].id);
  const [subset, setSubset] = useState('all');
  const [result, setResult] = useState(null);
  const [queue, commit] = useStore('support', empty);
  const { working, message, act, clear } = useAction();
  const item = questions.find(row => row.id === id);
  return <><Header screen="podpora" subtitle="Ověřte odpověď podle ceníku. Dotaz bez podkladů lze předat obsluze." />
    <div className="columns"><section className="surface stack"><h2>Dotaz</h2>
      <Select label="Dotaz zákazníka" value={id} change={value => { choose(value); setResult(null); clear(); }}
        options={questions.map(row => [row.id, row.question])} />
      <Select label="Dostupné podklady" value={subset} change={value => { setSubset(value); setResult(null); clear(); }}
        options={ [['all', 'Všechny podklady'], ['partial', 'Bez údaje o dopravě']] } />
      <div><button className="primary" onClick={() => {
        clear();
        setResult(resolveSupport(id, item.sources.filter(source => subset === 'all' || source !== 'CEN-02')));
      }}>Ověřit odpověď</button></div></section>
      <section className="surface stack" aria-label="Odpověď"><div className="row"><h2>Odpověď</h2>{result &&
        <span className={'pill ' + (result.outcome === 'verified' ? 'ok' : 'warn')}>{result.outcome === 'verified' ? 'Ověřeno' : 'Chybí podklady'}</span>}</div>
        {result ? <><p>{result.answer}</p>
          {result.citations.map(source => <div className="evidence" key={source}><h3>{source} · {sources[source].title}</h3>
            <p className="muted">{sources[source].text}</p></div>)}
          {result.outcome === 'missing' && <div><button className="primary" disabled={working} onClick={() => act(async () => {
            await commit(previous => ({ ...previous, [id]: 'POD-DEMO-' + id.toUpperCase() }));
            return 'Dotaz byl předán obsluze.';
          })}>Předat obsluze</button></div>}
        </> : <p className="muted">Nejdřív ověřte vybraný dotaz.</p>}
        {queue[id] && <p className="evidence">Předaný případ · {queue[id]}</p>}
        <Status value={message} />
      </section>
    </div></>;
}

function Approval() {
  const [id, choose] = useState(requests[0].id);
  const [role, setRole] = useState('coordinator');
  const [data, commit] = useStore('approval', empty);
  const { working, message, act, clear } = useAction();
  const request = requests.find(row => row.id === id);
  const current = data[id] ?? { status: 'new', entries: [] };
  const update = (action, feedback) => act(async () => {
    await commit(previous => reviewRequest(previous, request, role, action));
    return feedback;
  });
  return <><Header screen="schvalovani" subtitle="Zařaďte požadavek, přepněte roli a projděte schválení nebo vrácení." />
    <div className="columns"><section className="surface stack"><h2>Přijatý požadavek</h2>
      <Select label="Požadavek" value={id} change={value => { choose(value); clear(); }} options={requests.map(row => [row.id, row.title])} />
      <Select label="Pracovní role" value={role} change={value => { setRole(value); clear(); }} options={Object.entries(roles)} />
      <dl><dt>ID</dt><dd>{id}</dd><dt>Fronta</dt><dd>{request.queue}</dd><dt>Odhad</dt><dd>{request.total === null ? 'Chybí' : money.format(request.total)}</dd></dl>
    </section><section className="surface stack" aria-label="Schválení">
      <div className="row"><h2>Schválení</h2><span className={'pill ' + (current.status === 'approved' ? 'ok' : '')}>{states[current.status]}</span></div>
      {request.total === null && <p className="notice">Před schválením je potřeba doplnit cenový podklad.</p>}
      {role === 'coordinator' && ['new', 'returned'].includes(current.status) && <div>
        <button className="primary" disabled={working || request.total === null}
          onClick={() => update('forward', 'Požadavek byl předán ke schválení.')}>Předat ke schválení</button></div>}
      {role === 'reviewer' && current.status === 'review' && <div className="row">
        <button disabled={working} onClick={() => update('return', 'Požadavek byl vrácen koordinátorovi.')}>Vrátit k doplnění</button>
        <button className="primary" disabled={working} onClick={() => update('approve', 'Požadavek byl schválen.')}>Schválit požadavek</button>
      </div>}
      {current.entries.length > 0 && <><h3>Historie změn</h3><ol className="history">{current.entries.map((entry, i) =>
        <li key={i}>{roles[entry.role]} · {states[entry.status]}</li>)}</ol></>}
      <Status value={message} />
    </section></div>
  </>;
}

function Booking({ event }) {
  const [form, setForm] = useState({ slot: 'atelier', client: 'javor', hours: 2, equipment: false });
  const [list, commit] = useStore('booking', emptyList);
  const { working, message, act, clear } = useAction();
  const proposal = estimateBooking(form);
  const saved = list.find(row => row.id === proposal.id);
  const update = value => { setForm({ ...form, ...value }); clear(); };
  return <><Header screen={event ? 'eventy' : 'rezervace'} subtitle={event ?
    'Připravte cenu pronájmu, potvrďte dostupnost a vytvořte záznam pro obchod.' :
    'Vyberte termín. Překrývající se rezervace stejného prostoru se nepovolí.'} />
    <div className="columns"><section className="surface stack"><h2>{event ? 'Parametry akce' : 'Parametry rezervace'}</h2>
      <Select label="Prostor a čas" value={form.slot} change={slot => update({ slot })} options={slots.map(row => [row.id, row.title])} />
      <Select label="Odběratel" value={form.client} change={client => update({ client })} options={Object.entries(clients)} />
      <Select label="Délka (hodiny)" value={String(form.hours)} change={hours => update({ hours: Number(hours) })}
        options={[1, 2, 3, 4].map(hours => [String(hours), String(hours)])} />
      <label className="checkline"><input type="checkbox" checked={form.equipment} onChange={change => update({ equipment: change.target.checked })} /> Technické vybavení</label>
    </section><section className="surface stack" aria-label="Kalkulace"><h2>Kalkulace</h2>
      <dl><dt>Prostor</dt><dd>{proposal.slot.room}</dd><dt>Čas</dt><dd>{proposal.slot.start}:00–{proposal.slot.start + form.hours}:00</dd>
        <dt>Pronájem</dt><dd>{money.format(proposal.slot.hourly * form.hours)}</dd><dt>Vybavení</dt><dd>{money.format(form.equipment ? 600 : 0)}</dd></dl>
      <p>Celkem <strong>{money.format(proposal.total)}</strong></p>
      <div><button className="primary" disabled={working} onClick={() => act(async () => {
        await commit(previous => book(previous, form).list);
        return 'Termín je potvrzený.';
      })}>{saved ? 'Zopakovat potvrzení' : 'Potvrdit rezervaci'}</button></div>
      {saved && <p className="evidence">{proposal.id}{event && <><br />Předání · {proposal.crm}</>}</p>}
      <Status value={message} />
    </section></div>
  </>;
}

async function trace(method = 'GET', available) {
  const response = await fetch('/api/run', {
    method, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
    body: method === 'POST' ? JSON.stringify({ available }) : undefined,
  });
  if (!response.ok) throw new Error('Provozní služba neodpověděla.');
  return response.json();
}

function Monitor() {
  const [local, commit] = useStore('trace', empty);
  const [server, setServer] = useState(null);
  const [down, setDown] = useState(true);
  const { working, message, act } = useAction();
  const result = live ? server : local.run;
  useEffect(() => { if (live) trace().then(setServer).catch(() => {}); }, []);
  return <><Header screen="provoz" subtitle="Vyvolejte výpadek služby, najděte běh v logu a ověřte bezpečné opakování." />
    <div className="columns"><section className="surface stack"><h2>Spuštění</h2>
      <label className="checkline"><input type="checkbox" checked={down} disabled={working}
        onChange={event => setDown(event.target.checked)} /> Simulovat výpadek služby</label>
      <div className="row"><button className="primary" disabled={working} onClick={() => act(async () => {
        const next = live ? await trace('POST', !down)
          : (await commit(previous => ({ run: runAttempt(previous.run, !down) }))).run;
        if (live) setServer(next);
        return next.status === 'failed' ? 'Běh čeká na opakování.' : 'Běh je dokončen.';
      })}>{result?.status === 'failed' ? 'Zopakovat běh' : 'Spustit běh'}</button>
      {!live && result && <button disabled={working} onClick={() => act(async () => { await commit(() => ({})); setDown(true); return 'Záznam byl vymazán.'; })}>
        Vymazat záznam</button>}</div>
      <Status value={message} />
    </section><section className="surface stack" aria-label="Provozní log">
      <div className="row"><h2>Provozní log</h2>{result && <span className={'pill '+(result.status === 'completed' ? 'ok' : 'warn')}>{states[result.status]}</span>}</div>
      {result ? <><strong>{result.id}</strong><ol className="history">{result.events.map(entry => <li key={entry.attempt}>
        Pokus {entry.attempt} · <code>{entry.code}</code></li>)}</ol></> : <p className="muted">Zatím žádný běh.</p>}
    </section></div>
  </>;
}

function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const next = () => setRoute(currentRoute());
    window.addEventListener('hashchange', next);
    return () => window.removeEventListener('hashchange', next);
  }, []);
  const views = { nabidky: Quote, provoz: Monitor, katalog: Catalog, schvalovani: Approval,
    podpora: HelpDesk, rezervace: Booking, eventy: Booking };
  const Page = views[route];
  return <div className="shell">
    <aside className="sidebar"><a className="brand" href="#nabidky"><img src={logo} width="34" height="34" alt="" />
      <span><strong>Process Lab</strong><small>Aardvarkland</small></span></a>
    <nav aria-label="Pracovní prostor">{Object.entries(pages).map(([routeId, [title, path]]) =>
      <a key={routeId} href={'#' + routeId} aria-current={route === routeId ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={path} /></svg>{title}
      </a>)}</nav></aside>
    <div className="workspace"><header className="topbar"><span>Provoz</span><span className="divider" aria-hidden="true"></span>{pages[route][0]}</header>
      <main><Page key={route} event={route === 'eventy'} /></main>
    </div>
  </div>;
}

const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.href = logo;
document.head.append(favicon);
createRoot(document.querySelector('#root')).render(<App />);
