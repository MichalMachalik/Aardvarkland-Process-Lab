export function parseRequest(email, attachment) {
  const [header, ...body] = email.trim().split(/\r?\n\r?\n/);
  const headers = new Map(header.split(/\r?\n/).map(line => {
    const split = line.indexOf(':');
    return [line.slice(0, split).toLowerCase(), line.slice(split + 1).trim()];
  }));
  const id = headers.get('message-id')?.match(/^<(PO-DEMO-\d{3})@[a-z-]+\.test>$/)?.[1];
  const sender = headers.get('from');
  if (!id || !sender?.match(/<[a-z]+@[a-z-]+\.test>$/) || !headers.get('subject') || !body.length) {
    throw new Error('E-mail musí mít ukázkové ID, odesílatele, předmět a tělo.');
  }
  const [columns, ...lines] = attachment.trim().split(/\r?\n/);
  if (columns !== 'kod;pocet' || !lines.length || lines.length > 25) throw new Error('Příloha musí obsahovat kódy a počty položek.');
  const products = {
    'REG-DEMO-J': { title: 'Regál Jalovec', unitPrice: 1890 },
    'POL-DEMO-M': { title: 'Police Modřín', unitPrice: 550 },
  };
  const seen = new Set();
  const items = lines.map(line => {
    const [code, count, ...extra] = line.split(';');
    const quantity = Number(count);
    if (!Object.hasOwn(products, code) || !/^\d{1,3}$/.test(count) || quantity < 1 || extra.length || seen.has(code)) {
      throw new Error('Příloha obsahuje neplatnou nebo opakovanou položku.');
    }
    seen.add(code);
    return { code, quantity, ...products[code] };
  });
  return { id, sender, subject: headers.get('subject'), body: body.join('\n\n'), items,
    total: items.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0) };
}

export function sendQuote(state, quote, interrupted) {
  if (!state.approved || state.approved !== quote.id) throw new Error('Nejdřív schvalte nabídku.');
  if (state.receipt?.status === 'confirmed') return state;
  const record = state.receipt?.id ?? ('CRM-' + quote.id);
  const status = interrupted ? 'pending' : 'confirmed';
  return { ...state, receipt: { id: record, status }, events: [...(state.events ?? []), status] };
}

export const products = [
  { id: 'FEED-201', name: 'Police Modřín', material: 'březová překližka', width: null },
  { id: 'FEED-202', name: 'Stojan Jalovec', material: 'lakovaná ocel', width: 380 },
];

export function describeProduct(product, proposedWidth) {
  const entered = proposedWidth.trim();
  const width = entered === '' ? null : Number(entered);
  const errors = [];
  if (width !== null && (!/^\d+$/.test(entered) || !Number.isSafeInteger(width) || width <= 0)) errors.push('Rozměr musí být kladné celé číslo v milimetrech.');
  else if (width !== null && product.width === null) errors.push('Dodavatelský feed šířku neobsahuje.');
  else if (width !== null && width !== product.width) errors.push('Navržená šířka se liší od údaje v dodavatelském feedu.');
  return { text: product.name + ' · ' + product.material + (entered ? ' · šířka ' + entered + ' mm' : ''),
    errors, source: product.id };
}

export const questions = [
  { id: 'price', question: 'Kolik stojí servis tří jednotek s dopravou na Prahu 5?', sources: ['CEN-01', 'CEN-02'] },
  { id: 'scope', question: 'Co servis zahrnuje?', sources: ['CEN-03'] },
  { id: 'weekend', question: 'Přijedete na servis v neděli?', sources: [] },
];
export const sources = {
  'CEN-01': { title: 'Cena servisu', text: 'Servis stojí 1 200 Kč za jednu jednotku.', amount: 1200 },
  'CEN-02': { title: 'Doprava', text: 'Doprava na Prahu 5 stojí 250 Kč za návštěvu.', amount: 250 },
  'CEN-03': { title: 'Rozsah', text: 'Servis zahrnuje čištění filtrů, kontrolu odvodu kondenzátu a zkoušku chlazení.' },
};
export function resolveSupport(id, selected) {
  const item = questions.find(row => row.id === id);
  if (!item) throw new Error('Dotaz nebyl nalezen.');
  if (!item.sources.length) return { answer: 'Podklady neuvádějí nedělní dostupnost.', citations: [], outcome: 'missing' };
  const citations = item.sources.filter(source => selected.includes(source));
  if (citations.length !== item.sources.length) {
    return { answer: 'K ověření odpovědi chybí potřebný podklad.', citations, outcome: 'missing' };
  }
  const total = new Intl.NumberFormat('cs-CZ').format(3 * sources['CEN-01'].amount + sources['CEN-02'].amount);
  const answer = id === 'price' ? 'Servis tří jednotek na Praze 5 stojí ' + total + ' Kč včetně dopravy.' : sources['CEN-03'].text;
  return { answer, citations, outcome: 'verified' };
}

export const requests = [
  { id: 'INT-DEMO-301', title: 'Nákup servisního vybavení', queue: 'Finance', total: 28000 },
  { id: 'INT-DEMO-302', title: 'Přesun montáže na jiný termín', queue: 'Provoz', total: 0 },
  { id: 'INT-DEMO-303', title: 'Nákup bez přiložené nabídky', queue: 'Doplnění podkladů', total: null },
];

export function reviewRequest(state, request, role, action) {
  const previous = state[request.id] ?? { status: 'new', entries: [] };
  let status;
  if (action === 'forward' && role === 'coordinator' && ['new', 'returned'].includes(previous.status) && request.total !== null) status = 'review';
  else if (action === 'return' && role === 'reviewer' && previous.status === 'review') status = 'returned';
  else if (action === 'approve' && role === 'reviewer' && previous.status === 'review') status = 'approved';
  else throw new Error('Tento krok vyžaduje jinou roli, stav nebo doplnění podkladů.');
  return { ...state, [request.id]: { status, entries: [...previous.entries, { role, status }] } };
}

export const slots = [
  { id: 'atelier', title: 'Ateliér · dopoledne', room: 'Ateliér', start: 9, hourly: 1600 },
  { id: 'studio', title: 'Ateliér · odpoledne', room: 'Ateliér', start: 12, hourly: 1600 },
  { id: 'hall', title: 'Sál · odpoledne', room: 'Sál', start: 13, hourly: 2800 },
];
export const clients = { javor: 'Javor ateliér', lipa: 'Lípa studio' };

export function estimateBooking(input) {
  const slot = slots.find(row => row.id === input.slot);
  if (!slot || !Object.hasOwn(clients, input.client) || !Number.isInteger(input.hours)
    || input.hours < 1 || input.hours > 4 || typeof input.equipment !== 'boolean') {
    throw new Error('Vyberte prostor, odběratele a délku od jedné do čtyř hodin.');
  }
  const identity = [slot.id, input.client, input.hours, Number(input.equipment)].join('-').toUpperCase();
  const total = slot.hourly * input.hours + (input.equipment ? 600 : 0);
  return { ...input, slot, total, id: 'REZ-DEMO-' + identity, crm: 'CRM-REZ-' + identity };
}

export function book(list, input) {
  const proposal = estimateBooking(input);
  if (list.some(row => row.id === proposal.id)) return { list, proposal, duplicate: true };
  const overlaps = row => row.slot.room === proposal.slot.room &&
    row.slot.start < proposal.slot.start + proposal.hours &&
    proposal.slot.start < row.slot.start + row.hours;
  if (list.some(overlaps)) throw new Error('Prostor se v tomto čase překrývá s jinou rezervací.');
  return { list: [...list, proposal], proposal, duplicate: false };
}

export function runAttempt(previous, available) {
  const state = previous ?? { id: 'RUN-DEMO-17', status: 'new', events: [] };
  if (state.status === 'completed') return state;
  const status = available ? 'completed' : 'failed';
  const event = { attempt: state.events.length + 1, status, code: available ? 'PROVIDER_OK' : 'PROVIDER_UNAVAILABLE' };
  return { ...state, status, events: [...state.events, event] };
}
