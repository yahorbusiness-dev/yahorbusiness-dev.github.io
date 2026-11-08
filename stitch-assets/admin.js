// Adminpanel (admin.html). Every action goes through the "admin" Edge Function,
// which checks server-side that the caller is an admin; this page only renders.
const SUPABASE_URL = 'https://psvjlxqdqcuhmafqorlv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yuBvIFJ1sU3sfLpC0P3rmA_lNdgxITd';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ROLE_LABEL = { student: 'Elev', teacher: 'Lärare', admin: 'Admin' };
const ROLE_CHIP = {
  student: 'bg-primary-tint text-primary-deep',
  teacher: 'bg-positive-wash text-secondary',
  admin: 'bg-text-primary text-on-primary',
};
const LOG_LABEL = { reset_account: 'Nollställde', delete_user: 'Tog bort' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => d ? new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
const fmtDateTime = d => d ? new Date(d).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–';
function ago(d) {
  if (!d) return 'Aldrig';
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  return days <= 0 ? 'Idag' : days === 1 ? 'Igår' : days < 30 ? `${days} dagar sedan` : fmtDate(d);
}
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '–';
}
const roleChip = r => `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full ${ROLE_CHIP[r] || ROLE_CHIP.student} font-caption-micro text-caption-micro">${ROLE_LABEL[r] || r}</span>`;

async function api(action, id) {
  const { data, error } = await sb.functions.invoke('admin', { body: { action, id } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch (e) { /* not JSON */ }
    throw new Error(msg);
  }
  return data;
}

function toast(message, kind = 'info') {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.className = `fixed left-1/2 -translate-x-1/2 bottom-6 z-[90] px-4 py-3 rounded-xl shadow-lg font-label-md text-label-md ${kind === 'error' ? 'bg-critical-danger text-on-primary' : 'bg-text-primary text-on-primary'}`;
  el.style.maxWidth = 'calc(100% - 32px)';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function modal(html, { wide = false } = {}) {
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:80;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `<div class="bg-surface-card rounded-2xl shadow-lg w-full p-space-lg md:p-space-xl" style="max-width:${wide ? 720 : 440}px;max-height:calc(100vh - 32px);overflow:auto">${html}</div>`;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
  const onEsc = e => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  document.addEventListener('keydown', onEsc);
  document.body.appendChild(overlay);
  return { el: overlay, close };
}

// Confirm dialog; with `typeToConfirm` the button stays disabled until the word is typed
function confirmDialog({ title, text, confirmLabel, danger, typeToConfirm }) {
  return new Promise(resolve => {
    const m = modal(`
      <h2 class="font-headline-2 text-headline-2 text-text-primary">${title}</h2>
      <p class="font-body-regular text-body-regular text-text-secondary mt-2">${text}</p>
      ${typeToConfirm ? `<label class="block mt-space-md font-label-md text-label-md text-text-secondary">Skriv <strong class="text-text-primary">${typeToConfirm}</strong> för att bekräfta
        <input data-confirm-input type="text" autocomplete="off" class="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-surface-subdued/50 font-body-regular text-body-regular focus:outline-none focus:ring-2 focus:ring-primary-container"/></label>` : ''}
      <div class="flex flex-wrap justify-end gap-2 mt-space-lg">
        <button type="button" data-close class="px-5 py-2.5 rounded-xl bg-surface-subdued hover:bg-surface-container text-text-primary font-label-md text-label-md">Avbryt</button>
        <button type="button" data-ok ${typeToConfirm ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl ${danger ? 'bg-critical-danger hover:opacity-90' : 'bg-primary-container hover:bg-primary-deep'} text-on-primary font-label-md text-label-md disabled:opacity-40 disabled:cursor-not-allowed">${confirmLabel}</button>
      </div>`);
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const ok = m.el.querySelector('[data-ok]');
    const input = m.el.querySelector('[data-confirm-input]');
    if (input) {
      input.addEventListener('input', () => { ok.disabled = input.value.trim().toUpperCase() !== typeToConfirm; });
      input.focus();
    }
    ok.addEventListener('click', () => { finish(true); m.close(); });
    new MutationObserver((_, obs) => { if (!m.el.isConnected) { obs.disconnect(); finish(false); } }).observe(document.body, { childList: true });
  });
}

function renderAccountMenu(user) {
  const avatar = document.getElementById('hdr-avatar');
  avatar.textContent = initials(user.user_metadata?.display_name || user.email);
  const wrap = document.createElement('div');
  wrap.className = 'relative';
  avatar.parentNode.insertBefore(wrap, avatar);
  wrap.appendChild(avatar);
  const menu = document.createElement('div');
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.className = 'absolute right-0 top-full mt-2 w-64 bg-surface-card rounded-2xl shadow-lg border border-border-subtle p-2 z-[60]';
  menu.innerHTML = `
    <div class="px-3 py-2.5 border-b border-border-subtle mb-1">
      <p class="font-label-md text-label-md text-text-primary truncate">${esc(user.user_metadata?.display_name || 'Admin')}</p>
      <p class="font-caption-micro text-caption-micro text-text-tertiary truncate">${esc(user.email)}</p>
    </div>
    <button type="button" role="menuitem" data-signout class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left font-label-md text-label-md text-critical-danger hover:bg-[#FEF2F2] transition-colors">
      <span class="material-symbols-outlined text-[20px]">logout</span>Logga ut
    </button>`;
  wrap.appendChild(menu);
  const setOpen = open => { menu.hidden = !open; avatar.setAttribute('aria-expanded', String(open)); };
  avatar.addEventListener('click', e => { e.stopPropagation(); setOpen(menu.hidden); });
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  menu.querySelector('[data-signout]').addEventListener('click', async () => { await sb.auth.signOut(); location.href = 'index.html'; });
}

function initAccounts(me, root) {
  const state = { users: [], log: [], filter: 'all', query: '', loading: true, error: null };

  async function load() {
    state.loading = true;
    render();
    try {
      const data = await api('list');
      state.users = (data.users || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      state.log = data.log || [];
      state.error = null;
    } catch (err) {
      state.error = err.message;
    }
    state.loading = false;
    render();
  }

  function render() {
    const { users } = state;
    const count = r => users.filter(u => u.role === r).length;
    const active7 = users.filter(u => u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at) < 7 * 86400000).length;
    const q = state.query.trim().toLowerCase();
    const visible = users
      .filter(u => state.filter === 'all' || u.role === state.filter)
      .filter(u => !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));

    const stat = (icon, value, label) => `
      <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col gap-1">
        <span class="material-symbols-outlined text-[22px] text-primary-container">${icon}</span>
        <span class="font-headline-1 text-headline-1 text-text-primary mt-1">${state.loading ? '…' : value}</span>
        <span class="font-label-md text-label-md text-text-secondary">${label}</span>
      </div>`;
    const filterBtn = (key, label, n) => `<button type="button" data-filter="${key}" class="px-3 py-1.5 rounded-full font-label-md text-[12px] transition-colors ${state.filter === key ? 'bg-text-primary text-on-primary' : 'bg-surface-card text-text-secondary hover:text-text-primary border border-border-subtle'}">${label} <span class="opacity-60">${n}</span></button>`;

    let tableBody;
    if (state.loading) tableBody = `<tr><td colspan="7" class="py-8 text-center font-body-regular text-[14px] text-text-tertiary">Hämtar konton…</td></tr>`;
    else if (state.error) tableBody = `<tr><td colspan="7" class="py-8 text-center font-body-regular text-[14px] text-critical-danger">Kunde inte hämta konton: ${esc(state.error)}</td></tr>`;
    else if (!visible.length) tableBody = `<tr><td colspan="7" class="py-8 text-center font-body-regular text-[14px] text-text-tertiary">Inga konton matchar.</td></tr>`;
    else tableBody = visible.map(u => `
      <tr class="border-t border-border-subtle hover:bg-bg-root cursor-pointer" data-user="${u.id}">
        <td class="py-3 pr-4">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-8 h-8 shrink-0 rounded-full bg-surface-subdued flex items-center justify-center font-label-md text-[12px] text-text-primary">${initials(u.name || u.email)}</div>
            <div class="min-w-0"><p class="font-label-md text-[14px] text-text-primary truncate">${esc(u.name || '–')}${u.id === me.id ? ' <span class="text-text-tertiary font-normal">(du)</span>' : ''}</p><p class="font-caption-micro text-caption-micro text-text-tertiary truncate">${esc(u.email)}</p></div>
          </div>
        </td>
        <td class="py-3 pr-4">${roleChip(u.role)}</td>
        <td class="py-3 pr-4 font-body-regular text-[14px] text-text-secondary whitespace-nowrap">${fmtDate(u.created_at)}</td>
        <td class="py-3 pr-4 font-body-regular text-[14px] text-text-secondary whitespace-nowrap">${ago(u.last_sign_in_at)}</td>
        <td class="py-3 pr-4 font-body-regular text-[14px] text-text-primary">${u.role === 'teacher' ? '–' : `${u.xp} XP`}</td>
        <td class="py-3 pr-4 font-body-regular text-[14px] text-text-primary">${u.role === 'teacher' ? '–' : `${u.completed} klara${u.quiz !== null ? ` · ${u.quiz}%` : ''}`}</td>
        <td class="py-3 text-right"><span class="inline-flex items-center gap-0.5 font-label-md text-[13px] text-primary-container">Visa<span class="material-symbols-outlined text-[18px]">chevron_right</span></span></td>
      </tr>`).join('');

    const logHtml = state.log.length
      ? state.log.map(l => `<li class="flex items-center justify-between gap-4 py-2.5 border-t border-border-subtle first:border-0"><span class="font-body-regular text-[14px] text-text-primary">${LOG_LABEL[l.action] || esc(l.action)} <strong>${esc(l.target_email || '–')}</strong></span><span class="font-caption-micro text-caption-micro text-text-tertiary whitespace-nowrap">${fmtDateTime(l.created_at)}</span></li>`).join('')
      : '<li class="py-2.5 font-body-regular text-[14px] text-text-tertiary">Inga händelser än.</li>';

    root.innerHTML = `
      <div class="flex justify-end -mt-2 mb-space-md">
        <button type="button" data-refresh class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-card border border-border-subtle hover:bg-surface-subdued font-label-md text-label-md text-text-secondary transition-colors"><span class="material-symbols-outlined text-[18px]">refresh</span>Uppdatera</button>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${stat('group', users.length, 'Konton totalt')}
        ${stat('school', count('student'), 'Elever')}
        ${stat('co_present', count('teacher'), 'Lärare')}
        ${stat('login', active7, 'Inloggade senaste 7 dagarna')}
      </div>
      <div class="mt-12">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-md">
          <h2 class="font-headline-2 text-headline-2 text-text-primary">Konton</h2>
          <div class="flex flex-wrap items-center gap-2">
            ${filterBtn('all', 'Alla', users.length)}
            ${filterBtn('student', 'Elever', count('student'))}
            ${filterBtn('teacher', 'Lärare', count('teacher'))}
            ${filterBtn('admin', 'Admin', count('admin'))}
            <label class="relative"><span class="material-symbols-outlined text-[18px] text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2">search</span><input data-search type="search" placeholder="Sök namn eller e-post" value="${esc(state.query)}" class="pl-8 pr-3 py-1.5 w-52 rounded-full border border-border-subtle bg-surface-card font-body-regular text-[13px] focus:outline-none focus:border-primary-container"/></label>
          </div>
        </div>
        <div class="bg-surface-card rounded-2xl shadow-sm px-space-lg py-2 overflow-x-auto">
          <table class="w-full text-left min-w-[760px]">
            <thead><tr class="font-caption-micro text-caption-micro text-text-tertiary uppercase tracking-wide">
              <th class="py-3 pr-4 font-semibold">Konto</th><th class="py-3 pr-4 font-semibold">Roll</th><th class="py-3 pr-4 font-semibold">Skapat</th><th class="py-3 pr-4 font-semibold">Senast inloggad</th><th class="py-3 pr-4 font-semibold">XP</th><th class="py-3 pr-4 font-semibold">Lektioner</th><th></th>
            </tr></thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
      </div>
      <div class="mt-12">
        <h2 class="font-headline-2 text-headline-2 text-text-primary mb-space-md">Senaste admin-händelser</h2>
        <ul class="bg-surface-card rounded-2xl shadow-sm px-space-lg py-2">${logHtml}</ul>
      </div>`;

    root.querySelector('[data-refresh]').addEventListener('click', load);
    root.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; render(); }));
    root.querySelectorAll('[data-user]').forEach(tr => tr.addEventListener('click', () => openUser(tr.dataset.user)));
    const search = root.querySelector('[data-search]');
    search.addEventListener('input', () => {
      state.query = search.value;
      const pos = search.selectionStart;
      render();
      const again = root.querySelector('[data-search]');
      again.focus();
      again.setSelectionRange(pos, pos);
    });
  }

  async function openUser(id) {
    const listed = state.users.find(u => u.id === id) || {};
    const m = modal(`<p class="font-body-regular text-body-regular text-text-secondary">Hämtar ${esc(listed.email || 'kontot')}…</p>`, { wide: true });
    let data;
    try { data = await api('detail', id); } catch (err) {
      m.el.firstElementChild.innerHTML = `<p class="font-body-regular text-body-regular text-critical-danger">Kunde inte hämta kontot: ${esc(err.message)}</p><div class="flex justify-end mt-space-lg"><button type="button" class="px-5 py-2.5 rounded-xl bg-surface-subdued font-label-md text-label-md" data-x>Stäng</button></div>`;
      m.el.querySelector('[data-x]').addEventListener('click', m.close);
      return;
    }
    const { user, profile = {}, progress = [] } = data;
    const p = profile || {};
    const isTeacher = user.role === 'teacher';
    const canDelete = user.role !== 'admin' && user.id !== me.id;
    const statusChip = s => s === 'completed'
      ? '<span class="px-2 py-0.5 rounded-full bg-positive-wash text-secondary font-caption-micro text-caption-micro">Klar</span>'
      : s === 'in_progress'
        ? '<span class="px-2 py-0.5 rounded-full bg-primary-tint text-primary-deep font-caption-micro text-caption-micro">Pågår</span>'
        : '<span class="px-2 py-0.5 rounded-full bg-surface-subdued text-text-tertiary font-caption-micro text-caption-micro">Ej startad</span>';
    const tile = (v, l) => `<div class="bg-bg-root rounded-xl p-3"><p class="font-headline-3 text-headline-3 text-text-primary">${v}</p><p class="font-caption-micro text-caption-micro text-text-tertiary">${l}</p></div>`;
    const row = (l, v) => `<div class="flex justify-between gap-4 py-2 border-b border-border-subtle last:border-0"><span class="font-body-regular text-[14px] text-text-secondary">${l}</span><span class="font-label-md text-[14px] text-text-primary text-right">${v}</span></div>`;
    const btn = 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md transition-colors';

    m.el.firstElementChild.innerHTML = `
      <div class="flex items-start justify-between gap-space-md">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 shrink-0 rounded-full bg-primary-tint text-primary-deep flex items-center justify-center font-headline-3 text-headline-3">${initials(p.display_name || user.email)}</div>
          <div class="min-w-0">
            <h2 class="font-headline-2 text-headline-2 text-text-primary truncate">${esc(p.display_name || '–')}</h2>
            <p class="font-body-regular text-[14px] text-text-secondary truncate">${esc(user.email)} · ${roleChip(user.role)}</p>
          </div>
        </div>
        <button type="button" data-close aria-label="Stäng" class="w-9 h-9 shrink-0 rounded-full hover:bg-surface-subdued flex items-center justify-center text-text-secondary"><span class="material-symbols-outlined text-[20px]">close</span></button>
      </div>
      <div class="bg-bg-root rounded-xl px-space-md mt-space-lg">
        ${row('Skapat', fmtDate(user.created_at))}
        ${row('Senast inloggad', ago(user.last_sign_in_at))}
        ${isTeacher ? row('Skola', esc(user.school || '–')) : row('Senast aktiv i en lektion', p.last_active_date ? fmtDate(p.last_active_date) : '–')}
      </div>
      ${isTeacher ? '' : `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-space-md">
        ${tile(`${p.xp ?? 0}`, 'XP')}
        ${tile(`${p.streak_days ?? 0}`, 'Streak (dagar)')}
        ${tile(`${p.best_streak_days ?? 0}`, 'Bästa streak')}
        ${tile(`${progress.filter(x => x.status === 'completed').length}`, 'Klara lektioner')}
      </div>
      <h3 class="font-headline-3 text-headline-3 text-text-primary mt-space-lg mb-2">Lektioner</h3>
      ${progress.length ? `<div class="border border-border-subtle rounded-xl divide-y divide-border-subtle">${progress.map(x => `
        <div class="flex items-center justify-between gap-3 px-space-md py-2.5">
          <div class="min-w-0"><p class="font-label-md text-[14px] text-text-primary truncate">${esc(x.title)}</p><p class="font-caption-micro text-caption-micro text-text-tertiary">${x.completed_at ? 'Klar ' + fmtDate(x.completed_at) : 'Uppdaterad ' + fmtDate(x.updated_at)}</p></div>
          <div class="flex items-center gap-3 shrink-0"><span class="font-body-regular text-[14px] ${x.quiz_score !== null && x.quiz_score < 70 ? 'text-[#B45309] font-semibold' : 'text-text-secondary'}">${x.quiz_score !== null ? x.quiz_score + '%' : '–'}</span>${statusChip(x.status)}</div>
        </div>`).join('')}</div>` : '<p class="font-body-regular text-[14px] text-text-tertiary">Har inte påbörjat någon lektion än.</p>'}`}
      <h3 class="font-headline-3 text-headline-3 text-text-primary mt-space-lg mb-2">Åtgärder</h3>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-act="reset-password" class="${btn} bg-surface-subdued hover:bg-surface-container text-text-primary"><span class="material-symbols-outlined text-[18px]">lock_reset</span>Skicka återställningslänk<span class="ml-1 px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[10px] font-semibold uppercase tracking-wide">Förhandsvisning</span></button>
        ${isTeacher ? '' : `<button type="button" data-act="reset-account" class="${btn} bg-surface-subdued hover:bg-surface-container text-text-primary"><span class="material-symbols-outlined text-[18px]">restart_alt</span>Nollställ konto</button>`}
        ${canDelete ? `<button type="button" data-act="delete" class="${btn} border border-border-subtle hover:bg-[#FEF2F2] hover:border-[#FCA5A5] text-critical-danger"><span class="material-symbols-outlined text-[18px]">delete</span>Ta bort konto</button>` : ''}
      </div>`;
    m.el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', m.close));

    m.el.querySelector('[data-act="reset-password"]').addEventListener('click', () => {
      toast(`Förhandsvisning: ingen länk skickades till ${user.email}. Funktionen kopplas på senare.`);
    });
    m.el.querySelector('[data-act="reset-account"]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Nollställ konto?',
        text: `All XP, streak och lektionsframsteg för <strong>${esc(user.email)}</strong> raderas. Själva kontot och lösenordet finns kvar.`,
        confirmLabel: 'Nollställ',
        danger: true,
      });
      if (!ok) return;
      try {
        await api('reset_account', user.id);
        toast('Kontot är nollställt.');
        m.close();
        await load();
        openUser(user.id);
      } catch (err) { toast(`Kunde inte nollställa: ${err.message}`, 'error'); }
    });
    m.el.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Ta bort konto?',
        text: `Kontot <strong>${esc(user.email)}</strong> och all dess data tas bort för gott. Det går inte att ångra.`,
        confirmLabel: 'Ta bort för gott',
        danger: true,
        typeToConfirm: 'TA BORT',
      });
      if (!ok) return;
      try {
        await api('delete_user', user.id);
        toast('Kontot är borttaget.');
        m.close();
        load();
      } catch (err) { toast(`Kunde inte ta bort: ${err.message}`, 'error'); }
    });
  }

  load();
}

// Page shell: title and tabs. Each tab renders into a fresh view element, so a
// late render from a tab you already left lands on a detached node.
function initShell(me) {
  const root = document.getElementById('admin-root');
  const tabs = [
    { key: 'konton', label: 'Konton', icon: 'group' },
    { key: 'skolor', label: 'Skolor', icon: 'domain', demo: true },
  ];
  let current = location.hash === '#skolor' ? 'skolor' : 'konton';
  root.innerHTML = `
    <div class="mb-space-lg">
      <span class="font-label-md text-label-md text-primary-deep uppercase tracking-wider">Admin</span>
      <h1 class="font-display-xl text-display-xl text-text-primary tracking-tight mt-2">Adminpanel</h1>
      <p class="font-body-regular text-body-regular text-text-secondary mt-1">Hantera konton, skolor och vad de har tillgång till.</p>
    </div>
    <div class="flex gap-1 border-b border-border-subtle mb-space-xl" role="tablist" data-tabs></div>
    <div data-view-host></div>`;
  const tabBar = root.querySelector('[data-tabs]');
  const host = root.querySelector('[data-view-host]');
  function show(key) {
    current = key;
    history.replaceState(null, '', key === 'skolor' ? '#skolor' : location.pathname);
    tabBar.innerHTML = tabs.map(t => `
      <button type="button" role="tab" aria-selected="${t.key === current}" data-tab="${t.key}" class="inline-flex items-center gap-1.5 px-4 py-2.5 -mb-px border-b-2 font-label-md text-label-md transition-colors ${t.key === current ? 'border-primary-container text-primary-deep' : 'border-transparent text-text-secondary hover:text-text-primary'}">
        <span class="material-symbols-outlined text-[18px]">${t.icon}</span>${t.label}${t.demo ? '<span class="ml-1 px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[10px] font-semibold uppercase tracking-wide">Demo</span>' : ''}
      </button>`).join('');
    tabBar.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { if (b.dataset.tab !== current) show(b.dataset.tab); }));
    const view = document.createElement('div');
    host.replaceChildren(view);
    if (key === 'skolor') initSchools(view); else initAccounts(me, view);
  }
  show(current);
}

// ---------------------------------------------------------------------
// Skolor (demo): fictional schools, classes and students. Access settings are
// saved only in this browser (localStorage) until schools exist in the database.
// ---------------------------------------------------------------------
const DEMO_SCHOOLS = [
  { id: 'norra', name: 'Norra gymnasiet', city: 'Stockholm', status: 'pilot', contact: 'Maria Lind, rektor', since: '2026-10-06',
    teachers: ['Anna Berg', 'Johan Ek'],
    classes: [
      { id: 'norra-ek24a', name: 'EK24A', course: 'Företagsekonomi 1', teacher: 'Anna Berg', size: 24, seed: 7 },
      { id: 'norra-sa24b', name: 'SA24B', course: 'Samhällskunskap 1b', teacher: 'Johan Ek', size: 20, seed: 23 },
      { id: 'norra-ek23a', name: 'EK23A', course: 'Privatekonomi', teacher: 'Anna Berg', size: 18, seed: 41 },
    ] },
  { id: 'vastra', name: 'Västra skolan', city: 'Göteborg', status: 'active', contact: 'Peter Holm, studierektor', since: '2026-11-02',
    teachers: ['Sara Nilsson'],
    classes: [
      { id: 'vastra-ha24', name: 'HA24', course: 'Handel och service', teacher: 'Sara Nilsson', size: 22, seed: 5 },
      { id: 'vastra-ek24b', name: 'EK24B', course: 'Företagsekonomi 1', teacher: 'Sara Nilsson', size: 26, seed: 61 },
    ] },
  { id: 'soder', name: 'Söderskolan', city: 'Malmö', status: 'pending', contact: 'Lina Ahmed, lärare', since: null,
    teachers: ['Lina Ahmed'],
    classes: [
      { id: 'soder-sa24c', name: 'SA24C', course: 'Samhällskunskap 1b', teacher: 'Lina Ahmed', size: 28, seed: 13 },
    ] },
];
const SCHOOL_STATUS = {
  pilot: ['Pilotskola', 'bg-primary-tint text-primary-deep'],
  active: ['Aktiv', 'bg-positive-wash text-secondary'],
  pending: ['Avtal på gång', 'bg-[#FEF3C7] text-[#B45309]'],
};
const DEMO_FIRST = ['Alva', 'Elias', 'Maja', 'Omar', 'Ella', 'Noah', 'Saga', 'Liam', 'Wilma', 'Hugo', 'Nora', 'Adam', 'Selma', 'Leo', 'Ines', 'Viktor', 'Agnes', 'Melvin', 'Stella', 'Ali', 'Freja', 'William', 'Elsa', 'Isak', 'Juni', 'Sam', 'Tilde', 'Albin'];
const DEMO_LAST = ['Lindqvist', 'Berg', 'Holm', 'Haddad', 'Sjöberg', 'Ek', 'Nyström', 'Karlsson', 'Strand', 'Dahl', 'Lund', 'Ali', 'Åberg', 'Forsberg', 'Persson', 'Engström', 'Holmberg', 'Sandberg', 'Wikström', 'Yilmaz', 'Lindgren', 'Björk', 'Hedlund', 'Nilsson'];
const FEATURES = [
  { key: 'lararvy', label: 'Lärarvy', desc: 'Klassöversikt med framsteg och quizresultat', icon: 'monitoring' },
  { key: 'planering', label: 'Planering', desc: 'Kalender och lektionsplanering', icon: 'calendar_month' },
  { key: 'upplagg', label: 'Färdiga lektionsupplägg', desc: 'Kompletta lektioner för klassrummet', icon: 'menu_book' },
  { key: 'simulator', label: 'Aktiesimulator', desc: 'Köp och sälj aktier med låtsaspengar', icon: 'candlestick_chart' },
  { key: 'artiklar', label: 'Artiklar', desc: 'Fördjupande artiklar om privatekonomi', icon: 'newspaper' },
  { key: 'forelasning', label: 'Gästföreläsningar', desc: 'Boka en föreläsning från UngEkonom', icon: 'co_present' },
];
const FALLBACK_LESSONS = [
  ['aktier', 'Aktier'], ['fonder', 'Fonder'], ['privatekonomi', 'Privatekonomi'], ['vardering', 'Värdering'], ['ranta', 'Ränta på ränta'], ['krypto', 'Krypto & Web3'],
].flatMap(([cat, label]) => [1, 2, 3].map(i => ({ id: `${cat}-${i}`, category: cat, order_index: i, title: `${label} – lektion ${i}` })));
const CATEGORY_LABEL = { aktier: 'Aktier', fonder: 'Fonder', privatekonomi: 'Privatekonomi', vardering: 'Värdering', krypto: 'Krypto & Web3', ranta: 'Ränta på ränta' };
const ACCESS_KEY = 'ue-admin-demo-access';

function demoRandom(seed) {
  let x = seed;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}

function demoStudents(cls, lessonCount = 5) {
  const rnd = demoRandom(cls.seed);
  return Array.from({ length: cls.size }, (_, i) => {
    const name = `${DEMO_FIRST[(i * 5 + cls.seed) % DEMO_FIRST.length]} ${DEMO_LAST[(i * 7 + cls.seed * 3) % DEMO_LAST.length]}`;
    const engagement = rnd();
    const done = Array.from({ length: lessonCount }, (_, j) => engagement > 0.12 && rnd() < engagement + 0.25 - j * 0.08);
    const scores = done.map(d => (d ? Math.round(60 + rnd() * 40) : null)).filter(v => v !== null);
    const quiz = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const lastActive = engagement < 0.12 ? null : Math.floor(rnd() * (engagement > 0.5 ? 4 : 14));
    const completed = done.filter(Boolean).length;
    const status = completed === 0 ? 'none' : ((quiz !== null && quiz < 70) || lastActive > 7) ? 'support' : 'ok';
    return { name, done, completed, quiz, lastActive, status };
  });
}

function classStats(cls, lessonCount = 5) {
  const students = demoStudents(cls, lessonCount);
  const n = students.length;
  const quizzes = students.filter(s => s.quiz !== null);
  return {
    students,
    active: students.filter(s => s.lastActive !== null && s.lastActive <= 7).length,
    progress: Math.round(students.reduce((a, s) => a + s.completed, 0) / (n * lessonCount) * 100),
    quiz: quizzes.length ? Math.round(quizzes.reduce((a, s) => a + s.quiz, 0) / quizzes.length) : null,
    support: students.filter(s => s.status === 'support').length,
  };
}

function loadAccess() {
  try { return JSON.parse(localStorage.getItem(ACCESS_KEY)) || {}; } catch (e) { return {}; }
}
function saveAccess(all) {
  try { localStorage.setItem(ACCESS_KEY, JSON.stringify(all)); return true; } catch (e) { return false; }
}

function initSchools(root) {
  const state = { schoolId: null, classId: null };
  let lessons = FALLBACK_LESSONS;
  let access = loadAccess();

  // Real lesson list from the database, so access can be set per actual lesson
  sb.from('lessons').select('id, category, title, order_index').order('order_index').then(({ data }) => {
    if (data && data.length) { lessons = data; render(); }
  });

  // Default access: what the MVP opens today (first lesson per subject, krypto paused, core features on)
  function defaultAccess() {
    const byCat = {};
    for (const l of lessons) (byCat[l.category] ||= []).push(l);
    const lessonIds = Object.entries(byCat).filter(([c]) => c !== 'krypto')
      .map(([, ls]) => ls.sort((a, b) => a.order_index - b.order_index)[0].id);
    return { lessons: lessonIds, features: ['lararvy', 'planering', 'simulator', 'forelasning'] };
  }
  const schoolAccess = id => access[id] || defaultAccess();
  const classAccess = cls => {
    const own = access[cls.id];
    return own && !own.inherit ? own : { ...schoolAccess(state.schoolId), inherit: true };
  };

  const school = () => DEMO_SCHOOLS.find(s => s.id === state.schoolId);
  const cls = () => school()?.classes.find(c => c.id === state.classId);
  const go = (schoolId = null, classId = null) => { state.schoolId = schoolId; state.classId = classId; render(); window.scrollTo({ top: 0 }); };

  const demoBanner = `
    <div class="flex items-start gap-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl px-space-lg py-space-md mb-space-xl">
      <span class="material-symbols-outlined text-[20px] text-[#B45309] mt-0.5">science</span>
      <p class="font-body-regular text-[14px] text-text-secondary"><strong class="text-text-primary">Demodata.</strong> Skolorna, klasserna och eleverna här är påhittade. Inställningar för tillgång sparas bara i den här webbläsaren tills skolor finns på riktigt i databasen.</p>
    </div>`;
  const statusChip = st => `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full ${SCHOOL_STATUS[st][1]} font-caption-micro text-caption-micro">${SCHOOL_STATUS[st][0]}</span>`;
  const tile = (icon, v, l) => `
    <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col gap-1">
      <span class="material-symbols-outlined text-[22px] text-primary-container">${icon}</span>
      <span class="font-headline-1 text-headline-1 text-text-primary mt-1">${v}</span>
      <span class="font-label-md text-label-md text-text-secondary">${l}</span>
    </div>`;
  const crumbs = parts => `<nav class="flex flex-wrap items-center gap-1 font-label-md text-label-md text-text-secondary mb-space-md">${parts.map((p, i) => i < parts.length - 1
    ? `<button type="button" data-crumb="${i}" class="hover:text-primary-deep hover:underline">${esc(p)}</button><span class="material-symbols-outlined text-[16px] text-text-tertiary">chevron_right</span>`
    : `<span class="text-text-primary">${esc(p)}</span>`).join('')}</nav>`;

  function accessPanel(targetId, current, { isClass = false } = {}) {
    const byCat = {};
    for (const l of lessons) (byCat[l.category] ||= []).push(l);
    const cats = Object.keys(CATEGORY_LABEL).filter(c => byCat[c]);
    const on = new Set(current.lessons);
    const fon = new Set(current.features);
    const disabled = isClass && current.inherit;
    const check = (attr, id, checked) => `<input type="checkbox" ${attr}="${esc(id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} class="w-4 h-4 rounded accent-[#2563eb] disabled:opacity-50"/>`;
    return `
      <div class="bg-surface-card rounded-2xl shadow-sm p-space-lg md:p-space-xl" data-access="${esc(targetId)}">
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-space-md">
          <div>
            <h2 class="font-headline-2 text-headline-2 text-text-primary">Tillgång</h2>
            <p class="font-body-regular text-[14px] text-text-secondary mt-1">${isClass ? 'Vilka lektioner och funktioner den här klassen har tillgång till.' : 'Vad skolans lärare och elever har tillgång till. Gäller alla klasser som inte har egna inställningar.'}</p>
          </div>
          <span class="font-caption-micro text-caption-micro text-text-tertiary whitespace-nowrap" data-access-count>${on.size} lektioner · ${fon.size} funktioner</span>
        </div>
        ${isClass ? `<label class="mt-space-md flex items-center gap-3 bg-bg-root rounded-xl px-space-md py-3 cursor-pointer">
          <input type="checkbox" data-inherit ${current.inherit ? 'checked' : ''} class="w-4 h-4 rounded accent-[#2563eb]"/>
          <span class="font-label-md text-label-md text-text-primary">Använd skolans inställningar</span>
        </label>` : ''}
        <h3 class="font-label-md text-label-md text-text-tertiary uppercase tracking-wide mt-space-lg mb-2">Funktioner</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${FEATURES.map(f => `<label class="flex items-start gap-3 border border-border-subtle rounded-xl px-space-md py-3 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-bg-root'}">
            ${check('data-feature', f.key, fon.has(f.key))}
            <span class="material-symbols-outlined text-[20px] text-primary-container -mt-0.5">${f.icon}</span>
            <span><span class="block font-label-md text-[14px] text-text-primary">${f.label}</span><span class="block font-caption-micro text-caption-micro text-text-tertiary">${f.desc}</span></span>
          </label>`).join('')}
        </div>
        <h3 class="font-label-md text-label-md text-text-tertiary uppercase tracking-wide mt-space-lg mb-2">Lektioner</h3>
        <div class="flex flex-col gap-3">
          ${cats.map(c => {
            const ls = byCat[c].sort((a, b) => a.order_index - b.order_index);
            const all = ls.every(l => on.has(l.id));
            return `<div class="border border-border-subtle rounded-xl ${disabled ? 'opacity-60' : ''}">
              <label class="flex items-center justify-between gap-3 px-space-md py-2.5 bg-bg-root rounded-t-xl ${disabled ? '' : 'cursor-pointer'}">
                <span class="font-label-md text-[14px] text-text-primary">${CATEGORY_LABEL[c]} <span class="font-normal text-text-tertiary">${ls.filter(l => on.has(l.id)).length}/${ls.length}</span></span>
                <span class="flex items-center gap-2 font-caption-micro text-caption-micro text-text-secondary">Alla ${check('data-category', c, all)}</span>
              </label>
              <div class="divide-y divide-border-subtle">${ls.map(l => `<label class="flex items-center gap-3 px-space-md py-2 ${disabled ? '' : 'cursor-pointer hover:bg-bg-root'}">${check('data-lesson', l.id, on.has(l.id))}<span class="font-body-regular text-[14px] text-text-primary">${esc(l.title)}</span></label>`).join('')}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function bindAccess(targetId, isClass) {
    const panel = root.querySelector(`[data-access="${targetId}"]`);
    if (!panel) return;
    const persist = (next, msg) => {
      access = { ...access, [targetId]: next };
      toast(saveAccess(access) ? msg : 'Kunde inte spara i webbläsaren.');
      render();
    };
    const currentFromPanel = () => ({
      lessons: [...panel.querySelectorAll('[data-lesson]:checked')].map(i => i.dataset.lesson),
      features: [...panel.querySelectorAll('[data-feature]:checked')].map(i => i.dataset.feature),
    });
    panel.querySelector('[data-inherit]')?.addEventListener('change', e => {
      persist(e.target.checked ? { inherit: true } : { ...currentFromPanel(), inherit: false },
        e.target.checked ? 'Klassen följer skolans inställningar.' : 'Klassen har nu egna inställningar.');
    });
    panel.querySelectorAll('[data-category]').forEach(cb => cb.addEventListener('change', () => {
      panel.querySelectorAll('[data-lesson]').forEach(l => {
        if (lessons.find(x => x.id === l.dataset.lesson)?.category === cb.dataset.category) l.checked = cb.checked;
      });
      persist({ ...currentFromPanel(), inherit: false }, 'Tillgång sparad.');
    }));
    panel.querySelectorAll('[data-lesson], [data-feature]').forEach(cb => cb.addEventListener('change', () => {
      persist({ ...currentFromPanel(), inherit: false }, 'Tillgång sparad.');
    }));
  }

  function renderList() {
    const all = DEMO_SCHOOLS.flatMap(s => s.classes);
    const students = all.reduce((a, c) => a + c.size, 0);
    root.innerHTML = `
      ${demoBanner}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${tile('domain', DEMO_SCHOOLS.length, 'Skolor')}
        ${tile('groups', all.length, 'Klasser')}
        ${tile('school', students, 'Elever')}
        ${tile('co_present', DEMO_SCHOOLS.reduce((a, s) => a + s.teachers.length, 0), 'Lärare')}
      </div>
      <h2 class="font-headline-2 text-headline-2 text-text-primary mt-12 mb-space-md">Skolor</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${DEMO_SCHOOLS.map(s => {
          const n = s.classes.reduce((a, c) => a + c.size, 0);
          const prog = Math.round(s.classes.reduce((a, c) => a + classStats(c).progress * c.size, 0) / n);
          return `<button type="button" data-school="${s.id}" class="text-left bg-surface-card rounded-2xl p-space-lg shadow-sm hover:shadow-md hover:ring-2 hover:ring-primary-fixed transition-all flex flex-col gap-space-md">
            <div class="flex items-start justify-between gap-2">
              <div class="w-11 h-11 rounded-xl bg-primary-tint text-primary-deep flex items-center justify-center"><span class="material-symbols-outlined text-[24px]">domain</span></div>
              ${statusChip(s.status)}
            </div>
            <div><h3 class="font-headline-3 text-headline-3 text-text-primary">${esc(s.name)}</h3><p class="font-body-regular text-[14px] text-text-secondary">${esc(s.city)}</p></div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 font-caption-micro text-caption-micro text-text-secondary">
              <span>${s.classes.length} klasser</span><span>${n} elever</span><span>${s.teachers.length} lärare</span>
            </div>
            <div class="flex flex-col gap-1.5">
              <div class="flex justify-between font-caption-micro text-caption-micro text-text-tertiary"><span>Snittprogress</span><span>${prog}%</span></div>
              <div class="h-1.5 bg-border-subtle rounded-full overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:${prog}%"></div></div>
            </div>
          </button>`;
        }).join('')}
      </div>`;
    root.querySelectorAll('[data-school]').forEach(b => b.addEventListener('click', () => go(b.dataset.school)));
  }

  function renderSchool() {
    const s = school();
    const n = s.classes.reduce((a, c) => a + c.size, 0);
    const stats = s.classes.map(c => ({ c, st: classStats(c) }));
    const active = stats.reduce((a, x) => a + x.st.active, 0);
    const quizzes = stats.filter(x => x.st.quiz !== null);
    const quiz = quizzes.length ? Math.round(quizzes.reduce((a, x) => a + x.st.quiz * x.c.size, 0) / quizzes.reduce((a, x) => a + x.c.size, 0)) : null;
    root.innerHTML = `
      ${demoBanner}
      ${crumbs(['Skolor', s.name])}
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
        <div>
          <h2 class="font-headline-1 text-headline-1 text-text-primary">${esc(s.name)}</h2>
          <p class="font-body-regular text-body-regular text-text-secondary mt-1">${esc(s.city)} · Kontakt: ${esc(s.contact)}${s.since ? ` · Med sedan ${fmtDate(s.since)}` : ''}</p>
        </div>
        ${statusChip(s.status)}
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${tile('groups', s.classes.length, 'Klasser')}
        ${tile('school', n, 'Elever')}
        ${tile('login', `${Math.round(active / n * 100)}%`, 'Aktiva senaste 7 dagarna')}
        ${tile('quiz', quiz === null ? '–' : `${quiz}%`, 'Quizsnitt')}
      </div>
      <h2 class="font-headline-2 text-headline-2 text-text-primary mt-12 mb-space-md">Klasser</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${stats.map(({ c, st }) => `<button type="button" data-class="${c.id}" class="text-left bg-surface-card rounded-2xl p-space-lg shadow-sm hover:shadow-md hover:ring-2 hover:ring-primary-fixed transition-all flex flex-col gap-space-sm">
          <div class="flex items-center justify-between gap-2"><h3 class="font-headline-3 text-headline-3 text-text-primary">${esc(c.name)}</h3>${access[c.id] && !access[c.id].inherit ? '<span class="px-2 py-0.5 rounded-full bg-surface-subdued text-text-secondary font-caption-micro text-caption-micro">Egen tillgång</span>' : ''}</div>
          <p class="font-body-regular text-[14px] text-text-secondary">${esc(c.course)} · ${esc(c.teacher)}</p>
          <div class="flex flex-wrap gap-x-4 gap-y-1 font-caption-micro text-caption-micro text-text-secondary"><span>${c.size} elever</span><span>Quiz ${st.quiz ?? '–'}%</span><span class="${st.support ? 'text-[#B45309] font-semibold' : ''}">${st.support} behöver stöd</span></div>
          <div class="flex flex-col gap-1.5 mt-1">
            <div class="flex justify-between font-caption-micro text-caption-micro text-text-tertiary"><span>Progress</span><span>${st.progress}%</span></div>
            <div class="h-1.5 bg-border-subtle rounded-full overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:${st.progress}%"></div></div>
          </div>
        </button>`).join('')}
      </div>
      <h2 class="font-headline-2 text-headline-2 text-text-primary mt-12 mb-space-md">Lärare</h2>
      <div class="bg-surface-card rounded-2xl shadow-sm px-space-lg py-1">
        ${s.teachers.map(t => `<div class="flex items-center justify-between gap-3 py-3 border-t border-border-subtle first:border-0">
          <div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-positive-wash text-secondary flex items-center justify-center font-label-md text-[12px]">${initials(t)}</div><span class="font-label-md text-[14px] text-text-primary">${esc(t)}</span></div>
          <span class="font-caption-micro text-caption-micro text-text-tertiary">${s.classes.filter(c => c.teacher === t).map(c => c.name).join(', ')}</span>
        </div>`).join('')}
      </div>
      <div class="mt-12">${accessPanel(s.id, schoolAccess(s.id))}</div>`;
    root.querySelector('[data-crumb="0"]').addEventListener('click', () => go());
    root.querySelectorAll('[data-class]').forEach(b => b.addEventListener('click', () => go(s.id, b.dataset.class)));
    bindAccess(s.id, false);
  }

  function renderClass() {
    const s = school();
    const c = cls();
    const st = classStats(c);
    const lastActive = d => d === null ? '–' : d === 0 ? 'Idag' : d === 1 ? 'Igår' : `${d} dagar sedan`;
    const chip = x => ({
      ok: '<span class="px-2.5 py-0.5 rounded-full bg-positive-wash text-secondary font-caption-micro text-caption-micro">I fas</span>',
      support: '<span class="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-caption-micro text-caption-micro">Behöver stöd</span>',
      none: '<span class="px-2.5 py-0.5 rounded-full bg-surface-subdued text-text-tertiary font-caption-micro text-caption-micro">Inte startat</span>',
    }[x]);
    root.innerHTML = `
      ${demoBanner}
      ${crumbs(['Skolor', s.name, c.name])}
      <div class="mb-space-lg">
        <h2 class="font-headline-1 text-headline-1 text-text-primary">${esc(c.name)} · ${esc(c.course)}</h2>
        <p class="font-body-regular text-body-regular text-text-secondary mt-1">${esc(s.name)} · Lärare: ${esc(c.teacher)} · ${c.size} elever</p>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${tile('group', `${st.active}/${c.size}`, 'Aktiva senaste 7 dagarna')}
        ${tile('donut_large', `${st.progress}%`, 'Snittprogress')}
        ${tile('quiz', st.quiz === null ? '–' : `${st.quiz}%`, 'Quizsnitt')}
        ${tile('support', st.support, 'Behöver stöd')}
      </div>
      <h2 class="font-headline-2 text-headline-2 text-text-primary mt-12 mb-space-md">Elever</h2>
      <div class="bg-surface-card rounded-2xl shadow-sm px-space-lg py-2 overflow-x-auto">
        <table class="w-full text-left min-w-[640px]">
          <thead><tr class="font-caption-micro text-caption-micro text-text-tertiary uppercase tracking-wide">
            <th class="py-3 pr-4 font-semibold">Elev</th><th class="py-3 pr-4 font-semibold">Lektioner</th><th class="py-3 pr-4 font-semibold">Quiz</th><th class="py-3 pr-4 font-semibold">Senast aktiv</th><th class="py-3 font-semibold">Status</th>
          </tr></thead>
          <tbody>${st.students.map(x => `<tr class="border-t border-border-subtle">
            <td class="py-3 pr-4"><div class="flex items-center gap-3"><div class="w-8 h-8 shrink-0 rounded-full bg-surface-subdued flex items-center justify-center font-label-md text-[12px] text-text-primary">${initials(x.name)}</div><span class="font-label-md text-[14px] text-text-primary whitespace-nowrap">${esc(x.name)}</span></div></td>
            <td class="py-3 pr-4"><div class="flex items-center gap-1">${x.done.map(d => `<span class="w-4 h-1.5 rounded-full ${d ? 'bg-primary-container' : 'bg-border-subtle'}"></span>`).join('')}<span class="ml-2 font-caption-micro text-caption-micro text-text-secondary">${x.completed}/${x.done.length}</span></div></td>
            <td class="py-3 pr-4 font-body-regular text-[14px] ${x.quiz !== null && x.quiz < 70 ? 'text-[#B45309] font-semibold' : 'text-text-primary'}">${x.quiz === null ? '–' : x.quiz + '%'}</td>
            <td class="py-3 pr-4 font-body-regular text-[14px] text-text-secondary whitespace-nowrap">${lastActive(x.lastActive)}</td>
            <td class="py-3">${chip(x.status)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="mt-12">${accessPanel(c.id, classAccess(c), { isClass: true })}</div>`;
    root.querySelector('[data-crumb="0"]').addEventListener('click', () => go());
    root.querySelector('[data-crumb="1"]').addEventListener('click', () => go(s.id));
    bindAccess(c.id, true);
  }

  function render() {
    if (!root.isConnected) return;
    if (state.classId) renderClass();
    else if (state.schoolId) renderSchool();
    else renderList();
  }
  render();
}

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = 'auth.html'; return; }
  const user = session.user;
  if (user.app_metadata?.role !== 'admin') {
    location.replace(user.user_metadata?.role === 'teacher' ? 'larare.html' : 'oversikt.html');
    return;
  }
  renderAccountMenu(user);
  initShell(user);
});
