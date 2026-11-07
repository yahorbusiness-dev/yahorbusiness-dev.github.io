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
const LOG_LABEL = { reset_account: 'Nollställde', delete_user: 'Tog bort', approve_teacher: 'Godkände lärare', reject_teacher: 'Avslog läraransökan' };

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
// Teacher application status next to the role (set by the Edge Function)
const teacherChip = s => s === 'pending'
  ? ' <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-caption-micro text-caption-micro">Ansöker om lärare</span>'
  : s === 'rejected'
    ? ' <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-subdued text-text-tertiary font-caption-micro text-caption-micro">Läraransökan avslagen</span>'
    : '';

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

function initAdmin(me) {
  const root = document.getElementById('admin-root');
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

  // Approve or reject a teacher application. Returns true when it went through.
  async function decideTeacher(u, approve) {
    const ok = await confirmDialog(approve ? {
      title: 'Godkänn som lärare?',
      text: `<strong>${esc(u.email)}</strong>${u.school ? ` (${esc(u.school)})` : ''} får tillgång till lärarvyn. Kontrollera att personen verkligen är lärare innan du godkänner.`,
      confirmLabel: 'Godkänn',
    } : {
      title: 'Avslå läraransökan?',
      text: `<strong>${esc(u.email)}</strong> får inte tillgång till lärarvyn. Du kan godkänna kontot senare om du ändrar dig.`,
      confirmLabel: 'Avslå',
      danger: true,
    });
    if (!ok) return false;
    try {
      await api(approve ? 'approve_teacher' : 'reject_teacher', u.id);
      toast(approve ? `${u.email} är godkänd som lärare.` : `Ansökan från ${u.email} är avslagen.`);
      await load();
      return true;
    } catch (err) {
      toast(`Kunde inte spara beslutet: ${err.message}`, 'error');
      return false;
    }
  }

  function render() {
    const { users } = state;
    const pending = users.filter(u => u.teacher_status === 'pending').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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
        <td class="py-3 pr-4 whitespace-nowrap">${roleChip(u.role)}${teacherChip(u.teacher_status)}</td>
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
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-xl">
        <div>
          <span class="font-label-md text-label-md text-primary-deep uppercase tracking-wider">Admin</span>
          <h1 class="font-display-xl text-display-xl text-text-primary tracking-tight mt-2">Adminpanel</h1>
          <p class="font-body-regular text-body-regular text-text-secondary mt-1">Hantera elev- och lärarkonton och se resultat.</p>
        </div>
        <button type="button" data-refresh class="inline-flex items-center gap-1.5 self-start md:self-auto px-4 py-2 rounded-xl bg-surface-card border border-border-subtle hover:bg-surface-subdued font-label-md text-label-md text-text-secondary transition-colors"><span class="material-symbols-outlined text-[18px]">refresh</span>Uppdatera</button>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${stat('group', users.length, 'Konton totalt')}
        ${stat('school', count('student'), 'Elever')}
        ${stat('co_present', count('teacher'), 'Lärare')}
        ${stat('login', active7, 'Inloggade senaste 7 dagarna')}
      </div>
      <div class="mt-12">
        <h2 class="font-headline-2 text-headline-2 text-text-primary">Väntar på godkännande${!state.loading && pending.length ? ` <span class="text-text-tertiary font-normal">${pending.length}</span>` : ''}</h2>
        <p class="font-body-regular text-[14px] text-text-secondary mt-1 mb-space-md">Konton som har ansökt om att bli lärare. De har ingen tillgång till lärarvyn förrän du godkänner dem.</p>
        <div class="bg-surface-card rounded-2xl shadow-sm px-space-lg py-2">
          ${state.loading ? '<p class="py-4 font-body-regular text-[14px] text-text-tertiary">Hämtar ansökningar…</p>'
            : !pending.length ? '<p class="py-4 font-body-regular text-[14px] text-text-tertiary">Inga ansökningar väntar.</p>'
            : `<ul>${pending.map(u => `
              <li class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-t border-border-subtle first:border-0">
                <div class="min-w-0">
                  <p class="font-label-md text-[14px] text-text-primary truncate">${esc(u.name || '–')} <span class="text-text-tertiary font-normal">· ${esc(u.email)}</span></p>
                  <p class="font-caption-micro text-caption-micro text-text-tertiary">Skola: ${esc(u.school || 'ej angiven')} · Ansökte ${fmtDate(u.created_at)}</p>
                </div>
                <div class="flex gap-2 shrink-0">
                  <button type="button" data-approve="${u.id}" class="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-colors">Godkänn</button>
                  <button type="button" data-reject="${u.id}" class="px-4 py-2 rounded-xl border border-border-subtle hover:bg-[#FEF2F2] text-critical-danger font-label-md text-label-md transition-colors">Avslå</button>
                </div>
              </li>`).join('')}</ul>`}
        </div>
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
    const byId = id => state.users.find(u => u.id === id);
    root.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => decideTeacher(byId(b.dataset.approve), true)));
    root.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => decideTeacher(byId(b.dataset.reject), false)));
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
            <p class="font-body-regular text-[14px] text-text-secondary truncate">${esc(user.email)} · ${roleChip(user.role)}${teacherChip(user.teacher_status)}</p>
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
        ${user.teacher_status ? `<button type="button" data-act="approve" class="${btn} bg-primary-container hover:bg-primary-deep text-on-primary"><span class="material-symbols-outlined text-[18px]">verified</span>Godkänn som lärare</button>` : ''}
        ${user.teacher_status === 'pending' ? `<button type="button" data-act="reject" class="${btn} border border-border-subtle hover:bg-[#FEF2F2] text-critical-danger"><span class="material-symbols-outlined text-[18px]">block</span>Avslå läraransökan</button>` : ''}
        <button type="button" data-act="reset-password" class="${btn} bg-surface-subdued hover:bg-surface-container text-text-primary"><span class="material-symbols-outlined text-[18px]">lock_reset</span>Skicka återställningslänk<span class="ml-1 px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[10px] font-semibold uppercase tracking-wide">Förhandsvisning</span></button>
        ${isTeacher ? '' : `<button type="button" data-act="reset-account" class="${btn} bg-surface-subdued hover:bg-surface-container text-text-primary"><span class="material-symbols-outlined text-[18px]">restart_alt</span>Nollställ konto</button>`}
        ${canDelete ? `<button type="button" data-act="delete" class="${btn} border border-border-subtle hover:bg-[#FEF2F2] hover:border-[#FCA5A5] text-critical-danger"><span class="material-symbols-outlined text-[18px]">delete</span>Ta bort konto</button>` : ''}
      </div>`;
    m.el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', m.close));

    const decided = approve => async () => { if (await decideTeacher({ ...user, name: p.display_name }, approve)) { m.close(); openUser(user.id); } };
    m.el.querySelector('[data-act="approve"]')?.addEventListener('click', decided(true));
    m.el.querySelector('[data-act="reject"]')?.addEventListener('click', decided(false));
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

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = 'auth.html'; return; }
  const user = session.user;
  if (user.app_metadata?.role !== 'admin') {
    location.replace((user.app_metadata?.role === 'teacher' || user.user_metadata?.role === 'teacher') ? 'larare.html' : 'oversikt.html');
    return;
  }
  renderAccountMenu(user);
  initAdmin(user);
});
