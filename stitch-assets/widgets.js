// Interactive lesson widgets (lektion.html). Pair with widgets.css.
//
// A widget is mounted either where the lesson body has <div data-widget="name">,
// or at the end of a step listed in PLACEMENTS (no content change needed).
// Each widget starts as an opt-in question so the lesson never forces it.
(function () {
  const PLACEMENTS = {
    'aktier-grund': [{ step: 3, widget: 'aktie-sim' }],
  };

  const kr = (n, d = 2) => n.toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = n => (n > 0 ? '+' : '') + n.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
  const round2 = n => Math.round(n * 100) / 100;

  // Opt-in wrapper: question first, widget only after "Ja, testa!"
  function optIn(host, { icon, title, text, start }) {
    function ask() {
      host.innerHTML = `
        <div class="uw-pad">
          <div class="uw-head">
            <div class="uw-icon"><span class="material-symbols-outlined">${icon}</span></div>
            <div><p class="uw-title">${title}</p><p class="uw-sub">${text}</p></div>
          </div>
          <div class="uw-row" style="margin-top:16px">
            <button type="button" class="uw-btn uw-btn-primary" data-yes>Ja, testa!</button>
            <button type="button" class="uw-btn uw-btn-ghost" data-no>Nej tack</button>
          </div>
        </div>`;
      host.querySelector('[data-yes]').addEventListener('click', start);
      host.querySelector('[data-no]').addEventListener('click', declined);
    }
    function declined() {
      host.innerHTML = `<div class="uw-pad uw-row" style="justify-content:space-between"><span class="uw-muted">Du kan testa när du vill.</span><button type="button" class="uw-link" data-open>${title.replace(/\?$/, '')} →</button></div>`;
      host.querySelector('[data-open]').addEventListener('click', start);
    }
    ask();
  }

  // ---------------------------------------------------------------
  // aktie-sim: buy a share with play money, then see the price move
  // ---------------------------------------------------------------
  function aktieSim(host) {
    const CASH = 1000;
    const COURTAGE = 1;
    const SHARES_OUTSTANDING = 50000000;
    const company = 'Glimra AB';

    let last, bid, ask, qty, type, limit, holding, buyPrice, pending;

    function setQuotes(price) {
      last = round2(price);
      bid = round2(last - 0.2);
      ask = round2(last + 0.2);
    }

    function reset() {
      setQuotes(84);
      qty = 5;
      type = 'market';
      limit = round2(ask - 1);
      holding = 0;
      buyPrice = 0;
      pending = false;
      renderBuy();
    }

    function maxQty() { return Math.floor((CASH - COURTAGE) / ask); }

    function stockCard() {
      return `
        <div class="uw-stock">
          <div>
            <div class="uw-stock-name">${company}</div>
            <div class="uw-stock-meta">Påhittat bolag · Stockholmsbörsen</div>
          </div>
          <div>
            <div class="uw-price">${kr(last)} kr</div>
            <div class="uw-quotes"><span>Köp: <b>${kr(ask)}</b></span><span>Sälj: <b>${kr(bid)}</b></span></div>
          </div>
        </div>`;
    }

    function summary() {
      const price = type === 'market' ? ask : limit;
      return `
            <div><span>${qty} aktier × ${kr(price)} kr${type === 'limit' ? ' (max)' : ''}</span><span>${kr(qty * price)} kr</span></div>
            <div><span>Courtage (avgift till mäklaren)</span><span>${kr(COURTAGE)} kr</span></div>
            <div class="uw-total"><span>Totalt${type === 'limit' ? ' högst' : ''}</span><span>${kr(round2(qty * price + COURTAGE))} kr</span></div>`;
    }

    function renderBuy(message) {
      qty = Math.min(qty, maxQty());
      host.innerHTML = `
        <div class="uw-pad">
          <div class="uw-head">
            <div class="uw-icon"><span class="material-symbols-outlined">shopping_cart</span></div>
            <div><p class="uw-title">Köp din första aktie</p><p class="uw-sub">Du har <b>${kr(CASH, 0)} kr</b> i låtsaspengar på ditt ISK.</p></div>
          </div>
          ${stockCard()}
          <div class="uw-field">
            <p class="uw-label">Antal aktier</p>
            <div class="uw-stepper">
              <button type="button" data-q="-1" aria-label="Färre" ${qty <= 1 || pending ? 'disabled' : ''}>−</button>
              <output>${qty}</output>
              <button type="button" data-q="1" aria-label="Fler" ${qty >= maxQty() || pending ? 'disabled' : ''}>+</button>
            </div>
          </div>
          <div class="uw-field">
            <p class="uw-label">Ordertyp</p>
            <div class="uw-seg" role="group">
              <button type="button" data-type="market" aria-pressed="${type === 'market'}" ${pending ? 'disabled' : ''}>Marknadsorder</button>
              <button type="button" data-type="limit" aria-pressed="${type === 'limit'}" ${pending ? 'disabled' : ''}>Limitorder</button>
            </div>
            <p class="uw-hint">${type === 'market'
              ? 'Köp direkt till bästa pris som någon säljer för just nu.'
              : 'Bestäm det högsta pris du är villig att betala. Ordern går bara igenom om någon säljer så billigt.'}</p>
          </div>
          ${type === 'limit' ? `
          <div class="uw-field">
            <p class="uw-label">Ditt maxpris: <b data-limit-label>${kr(limit)} kr</b></p>
            <input class="uw-range" type="range" min="${(ask - 4).toFixed(2)}" max="${(ask + 2).toFixed(2)}" step="0.1" value="${limit}" data-limit ${pending ? 'disabled' : ''} aria-label="Maxpris"/>
          </div>` : ''}
          <div class="uw-sum" data-sum>${summary()}</div>
          ${message || ''}
          <div class="uw-row" style="margin-top:16px">
            ${pending
              ? `<button type="button" class="uw-btn uw-btn-primary" data-wait>Vänta en handelsdag</button>
                 <button type="button" class="uw-btn uw-btn-ghost" data-cancel>Ändra order</button>`
              : `<button type="button" class="uw-btn uw-btn-primary" data-buy>Lägg köporder</button>`}
          </div>
          <p class="uw-note">Låtsaspengar och ett påhittat bolag – ingen riktig handel.</p>
        </div>`;

      host.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { qty += Number(b.dataset.q); renderBuy(); }));
      host.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { type = b.dataset.type; renderBuy(); }));
      const range = host.querySelector('[data-limit]');
      // Update only the labels while dragging; a full re-render would drop the drag
      if (range) range.addEventListener('input', () => {
        limit = round2(Number(range.value));
        host.querySelector('[data-limit-label]').textContent = `${kr(limit)} kr`;
        host.querySelector('[data-sum]').innerHTML = summary();
      });
      host.querySelector('[data-buy]')?.addEventListener('click', placeOrder);
      host.querySelector('[data-wait]')?.addEventListener('click', waitDay);
      host.querySelector('[data-cancel]')?.addEventListener('click', () => { pending = false; renderBuy(); });
    }

    function placeOrder() {
      if (type === 'market' || limit >= ask) {
        fill(ask, type === 'limit'
          ? `Någon säljer för <strong>${kr(ask)} kr</strong>, vilket är under ditt maxpris – så du betalar ${kr(ask)} kr, inte ${kr(limit)} kr.`
          : `Du köpte till säljarnas lägsta pris just nu, <strong>${kr(ask)} kr</strong>.`);
      } else {
        pending = true;
        renderBuy(`<div class="uw-msg uw-msg-info">Din order ligger kvar i orderboken. Ingen vill sälja för <strong>${kr(limit)} kr</strong> just nu – billigaste säljaren vill ha ${kr(ask)} kr.</div>`);
      }
    }

    function waitDay() {
      const change = (Math.random() * 6 - 3.2) / 100; // about −3 % to +3 %
      setQuotes(last * (1 + change));
      if (ask <= limit) {
        fill(ask, `Kursen ändrades ${pct(change * 100)} under dagen och en säljare gick med på <strong>${kr(ask)} kr</strong> – din limitorder gick igenom.`);
      } else {
        renderBuy(`<div class="uw-msg uw-msg-info">Kursen ändrades ${pct(change * 100)}. Billigaste säljaren vill ha ${kr(ask)} kr – fortfarande över ditt maxpris på ${kr(limit)} kr.</div>`);
      }
    }

    function fill(price, why) {
      pending = false;
      holding = qty;
      buyPrice = price;
      renderOwned(why);
    }

    function renderOwned(why) {
      const ownedPct = (holding / SHARES_OUTSTANDING) * 100;
      host.innerHTML = `
        <div class="uw-pad">
          <div class="uw-head">
            <div class="uw-icon" style="background:var(--uw-green-wash);color:#047857"><span class="material-symbols-outlined">verified</span></div>
            <div><p class="uw-title">Grattis – du är delägare!</p><p class="uw-sub">Du äger ${holding} aktier i ${company}.</p></div>
          </div>
          <div class="uw-msg uw-msg-ok">${why}</div>
          <p class="uw-muted" style="margin:14px 0 0">${company} har ${SHARES_OUTSTANDING.toLocaleString('sv-SE')} aktier. Du äger alltså <b>${ownedPct.toLocaleString('sv-SE', { maximumSignificantDigits: 2 })} %</b> av bolaget – en liten men riktig del.</p>
          <p class="uw-label" style="margin-top:18px">Vad händer nu? Välj en nyhet:</p>
          <div class="uw-row">
            <button type="button" class="uw-btn uw-btn-ghost" data-news="good">📈 Bättre vinst än väntat</button>
            <button type="button" class="uw-btn uw-btn-ghost" data-news="bad">📉 Sämre vinst än väntat</button>
            <button type="button" class="uw-btn uw-btn-ghost" data-news="random">🎲 Slumpa en vecka</button>
          </div>
        </div>`;
      host.querySelectorAll('[data-news]').forEach(b => b.addEventListener('click', () => week(b.dataset.news)));
    }

    // Five trading days after the news; the drift decides where the week ends up
    function week(kind) {
      const drift = kind === 'good' ? 0.07 : kind === 'bad' ? -0.09 : (Math.random() * 0.16 - 0.08);
      const days = [buyPrice];
      for (let i = 1; i <= 5; i++) {
        const target = buyPrice * (1 + drift * (i / 5));
        const noise = (Math.random() - 0.5) * 0.02 * buyPrice;
        days.push(round2(i === 5 ? buyPrice * (1 + drift) : target + noise));
      }
      const end = days[days.length - 1];
      const value = holding * end;
      const diff = value - holding * buyPrice;
      const diffPct = (end / buyPrice - 1) * 100;
      const up = diff >= 0;
      const story = kind === 'good'
        ? 'Fler vill köpa när framtiden ser ljusare ut – efterfrågan ökar och kursen stiger.'
        : kind === 'bad'
          ? 'När vinsten blir sämre vill fler sälja än köpa – utbudet ökar och kursen faller.'
          : 'Ingen särskild nyhet – kursen rör sig ändå varje dag när köpare och säljare möts.';

      host.innerHTML = `
        <div class="uw-pad">
          <div class="uw-head">
            <div class="uw-icon"><span class="material-symbols-outlined">${up ? 'trending_up' : 'trending_down'}</span></div>
            <div><p class="uw-title">En vecka senare</p><p class="uw-sub">${story}</p></div>
          </div>
          ${chart(days, up)}
          <div class="uw-stats">
            <div class="uw-stat"><span>Kurs nu</span><b>${kr(end)} kr</b></div>
            <div class="uw-stat"><span>Ditt innehav</span><b>${kr(value)} kr</b></div>
            <div class="uw-stat"><span>Förändring</span><b class="${up ? 'uw-up' : 'uw-down'}">${up ? '+' : ''}${kr(diff)} kr (${pct(diffPct)})</b></div>
          </div>
          <div class="uw-msg ${up ? 'uw-msg-ok' : 'uw-msg-bad'}">${up
            ? 'Snyggt! Men vinsten är bara <strong>på papperet</strong> tills du säljer – och kursen kan vända igen.'
            : 'Aj! Men förlusten är bara <strong>på papperet</strong> så länge du inte säljer. Därför ska aktiepengar vara pengar du klarar dig utan i flera år.'}</div>
          <div class="uw-row" style="margin-top:16px">
            <button type="button" class="uw-btn uw-btn-primary" data-again>Prova en annan nyhet</button>
            <button type="button" class="uw-btn uw-btn-ghost" data-reset>Börja om</button>
          </div>
        </div>`;
      host.querySelector('[data-again]').addEventListener('click', () => renderOwned('Samma köp som förut – vad händer med en annan nyhet?'));
      host.querySelector('[data-reset]').addEventListener('click', reset);
    }

    function chart(days, up) {
      const w = 320, h = 110, pad = 10;
      const min = Math.min(...days), max = Math.max(...days);
      const span = max - min || 1;
      const pts = days.map((v, i) => [pad + (i * (w - 2 * pad)) / (days.length - 1), h - pad - ((v - min) / span) * (h - 2 * pad)]);
      const color = up ? '#10B981' : '#DC2626';
      const line = pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
      const baseY = h - pad - ((days[0] - min) / span) * (h - 2 * pad);
      return `
        <svg class="uw-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Kursen under veckan, från ${kr(days[0])} till ${kr(days[days.length - 1])} kr">
          <line x1="${pad}" x2="${w - pad}" y1="${baseY.toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="#CBD5E1" stroke-dasharray="4 4"/>
          <polyline points="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="4.5" fill="${color}"/>
          <text x="${pad}" y="${(baseY - 6).toFixed(1)}" font-size="10" fill="#94A3B8">Ditt köp ${kr(days[0])} kr</text>
        </svg>`;
    }

    optIn(host, {
      icon: 'science',
      title: 'Vill du testa att köpa en aktie?',
      text: 'Prova med 1 000 kr i låtsaspengar och se vad som händer med kursen. Det tar ungefär en minut.',
      start: reset,
    });
  }

  const WIDGETS = { 'aktie-sim': aktieSim };

  function create(name) {
    const fn = WIDGETS[name];
    if (!fn) return null;
    const host = document.createElement('div');
    host.className = 'uw';
    host.dataset.widgetRoot = name;
    fn(host);
    return host;
  }

  window.LessonWidgets = {
    mount(root, lessonId, stepIndex) {
      root.querySelectorAll('[data-widget]').forEach(el => {
        const host = create(el.dataset.widget);
        if (host) el.replaceWith(host);
      });
      const prose = root.querySelector('.prose-lesson');
      if (!prose) return;
      (PLACEMENTS[lessonId] || []).filter(p => p.step === stepIndex).forEach(p => {
        const host = create(p.widget);
        if (host) prose.appendChild(host);
      });
    },
  };
})();
