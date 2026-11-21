// Adminpanel. Not published on GitHub Pages (folders starting with "_" are
// skipped); it is opened from a Claude session, see CLAUDE.md. Every action goes
// through the "admin" Edge Function, which checks server-side that the caller is
// an admin; this page only renders.
const SUPABASE_URL = 'https://psvjlxqdqcuhmafqorlv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yuBvIFJ1sU3sfLpC0P3rmA_lNdgxITd';
// Captcha is OFF in Supabase for now; put the public site key back here to turn it on
const HCAPTCHA_SITE_KEY = '';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ROLE_LABEL = { student: 'Elev', teacher: 'Lärare', admin: 'Admin', pending: 'Vill bli lärare', rejected: 'Nekad lärare' };
const ROLE_CHIP = {
  student: 'bg-primary-tint text-primary-deep',
  teacher: 'bg-positive-wash text-secondary',
  admin: 'bg-text-primary text-on-primary',
  pending: 'bg-[#FEF3C7] text-[#B45309]',
  rejected: 'bg-surface-subdued text-text-tertiary',
};
const LOG_LABEL = {
  reset_account: 'Nollställde', delete_user: 'Tog bort',
  send_password_reset: 'Skickade återställningslänk till',
  create_school: 'Skapade skolan', delete_school: 'Tog bort skolan',
  set_teacher_school: 'Kopplade till skola:', remove_teacher_school: 'Kopplade bort från skola:',
  approve_teacher: 'Godkände läraren', reject_teacher: 'Nekade läraren', revoke_teacher: 'Tog bort lärarbehörighet för',
};
const TEACHERISH = new Set(['teacher', 'pending', 'rejected']);

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
  menu.querySelector('[data-signout]').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });
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
        <td class="py-3 pr-4 font-body-regular text-[14px] text-text-primary">${TEACHERISH.has(u.role) ? '–' : `${u.xp} XP`}</td>
        <td class="py-3 pr-4 font-body-regular text-[14px] text-text-primary">${TEACHERISH.has(u.role) ? '–' : `${u.completed} klara${u.quiz !== null ? ` · ${u.quiz}%` : ''}`}</td>
        <td class="py-3 text-right"><span class="inline-flex items-center gap-0.5 font-label-md text-[13px] text-primary-container">Visa<span class="material-symbols-outlined text-[18px]">chevron_right</span></span></td>
      </tr>`).join('');

    const pending = users.filter(u => u.role === 'pending').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const requestsHtml = state.loading || state.error ? '' : `
      <div class="mb-space-xl">
        <div class="flex items-center gap-2 mb-space-md">
          <h2 class="font-headline-2 text-headline-2 text-text-primary">Lärarförfrågningar</h2>
          ${pending.length ? `<span class="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-label-md text-[12px]">${pending.length}</span>` : ''}
        </div>
        ${pending.length ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">${pending.map(u => `
          <div class="bg-surface-card rounded-2xl shadow-sm border border-[#FDE68A] p-space-lg flex flex-col gap-space-md">
            <div class="flex items-start gap-3 min-w-0">
              <div class="w-10 h-10 shrink-0 rounded-full bg-[#FEF3C7] text-[#B45309] flex items-center justify-center font-label-md text-[13px]">${initials(u.name || u.email)}</div>
              <div class="min-w-0">
                <p class="font-label-md text-[15px] text-text-primary truncate">${esc(u.name || '–')}</p>
                <p class="font-body-regular text-[14px] text-text-secondary truncate">${esc(u.email)}</p>
                <p class="font-caption-micro text-caption-micro text-text-tertiary mt-1"><span class="material-symbols-outlined text-[14px] align-[-3px]">domain</span> ${esc(u.school || 'Ingen skola angiven')} · Ansökte ${fmtDate(u.created_at)}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-approve="${u.id}" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-colors"><span class="material-symbols-outlined text-[18px]">check</span>Godkänn</button>
              <button type="button" data-reject="${u.id}" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border-subtle hover:bg-surface-subdued text-text-secondary font-label-md text-label-md transition-colors"><span class="material-symbols-outlined text-[18px]">close</span>Neka</button>
              <button type="button" data-user-open="${u.id}" class="inline-flex items-center px-3 py-2 rounded-xl text-primary-container hover:underline font-label-md text-label-md">Visa konto</button>
            </div>
          </div>`).join('')}</div>`
        : '<div class="bg-surface-card rounded-2xl shadow-sm px-space-lg py-space-md flex items-center gap-2 font-body-regular text-[14px] text-text-tertiary"><span class="material-symbols-outlined text-[18px] text-positive-spruce">check_circle</span>Inga lärare väntar på granskning.</div>'}
      </div>`;

    const logHtml = state.log.length
      ? state.log.map(l => `<li class="flex items-center justify-between gap-4 py-2.5 border-t border-border-subtle first:border-0"><span class="font-body-regular text-[14px] text-text-primary">${LOG_LABEL[l.action] || esc(l.action)} <strong>${esc(l.target_email || '–')}</strong></span><span class="font-caption-micro text-caption-micro text-text-tertiary whitespace-nowrap">${fmtDateTime(l.created_at)}</span></li>`).join('')
      : '<li class="py-2.5 font-body-regular text-[14px] text-text-tertiary">Inga händelser än.</li>';

    root.innerHTML = `
      ${requestsHtml}
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
            ${filterBtn('pending', 'Väntar', count('pending'))}
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
    root.querySelectorAll('[data-user-open]').forEach(b => b.addEventListener('click', () => openUser(b.dataset.userOpen)));
    root.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => reviewTeacher(b.dataset.approve, true)));
    root.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => reviewTeacher(b.dataset.reject, false)));
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

  // Approve or reject a teacher request (also used to revoke an approved teacher)
  async function reviewTeacher(id, approve, after) {
    const u = state.users.find(x => x.id === id) || {};
    const revoking = !approve && u.role === 'teacher';
    const ok = await confirmDialog(approve
      ? { title: 'Godkänn lärare?', text: `<strong>${esc(u.email)}</strong>${u.school ? ` (${esc(u.school)})` : ''} får tillgång till lärarvyn nästa gång hen loggar in.`, confirmLabel: 'Godkänn' }
      : revoking
        ? { title: 'Ta bort lärarbehörighet?', text: `<strong>${esc(u.email)}</strong> förlorar tillgången till lärarvyn. Kontot finns kvar.`, confirmLabel: 'Ta bort behörighet', danger: true }
        : { title: 'Neka lärare?', text: `<strong>${esc(u.email)}</strong> får inte tillgång till lärarvyn. Kontot finns kvar och du kan godkänna det senare.`, confirmLabel: 'Neka', danger: true });
    if (!ok) return;
    try {
      await api(approve ? 'approve_teacher' : 'reject_teacher', id);
      toast(approve ? 'Läraren är godkänd.' : revoking ? 'Lärarbehörigheten är borttagen.' : 'Förfrågan är nekad.');
      await load();
      if (after) after();
    } catch (err) { toast(`Det gick inte: ${err.message}`, 'error'); }
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
    const isTeacher = TEACHERISH.has(user.role);
    const canDelete = user.role !== 'admin' && user.id !== me.id;
    const reviewButtons = user.role === 'pending' || user.role === 'rejected'
      ? `<button type="button" data-act="approve" class="${'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md transition-colors'} bg-primary-container hover:bg-primary-deep text-on-primary"><span class="material-symbols-outlined text-[18px]">check</span>Godkänn som lärare</button>
         ${user.role === 'pending' ? `<button type="button" data-act="reject" class="${'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md transition-colors'} border border-border-subtle hover:bg-surface-subdued text-text-secondary"><span class="material-symbols-outlined text-[18px]">close</span>Neka</button>` : ''}`
      : user.role === 'teacher'
        ? `<button type="button" data-act="reject" class="${'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-label-md text-label-md transition-colors'} border border-border-subtle hover:bg-surface-subdued text-text-secondary"><span class="material-symbols-outlined text-[18px]">person_remove</span>Ta bort lärarbehörighet</button>`
        : '';
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
        ${reviewButtons}
        <button type="button" data-act="reset-password" class="${btn} bg-surface-subdued hover:bg-surface-container text-text-primary"><span class="material-symbols-outlined text-[18px]">lock_reset</span>Skicka återställningslänk</button>
        ${isTeacher ? '' : `<button type="button" data-act="reset-account" class="${btn} bg-surface-subdued hover:bg-surface-container text-text-primary"><span class="material-symbols-outlined text-[18px]">restart_alt</span>Nollställ konto</button>`}
        ${canDelete ? `<button type="button" data-act="delete" class="${btn} border border-border-subtle hover:bg-[#FEF2F2] hover:border-[#FCA5A5] text-critical-danger"><span class="material-symbols-outlined text-[18px]">delete</span>Ta bort konto</button>` : ''}
      </div>`;
    m.el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', m.close));

    m.el.querySelector('[data-act="approve"]')?.addEventListener('click', () => reviewTeacher(user.id, true, () => { m.close(); openUser(user.id); }));
    m.el.querySelector('[data-act="reject"]')?.addEventListener('click', () => reviewTeacher(user.id, false, () => { m.close(); openUser(user.id); }));
    m.el.querySelector('[data-act="reset-password"]').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Skicka återställningslänk?',
        text: `Vi mejlar en länk till <strong>${esc(user.email)}</strong> där personen väljer ett nytt lösenord. Det nuvarande lösenordet fungerar tills dess.`,
        confirmLabel: 'Skicka länk',
      });
      if (!ok) return;
      try {
        await api('send_password_reset', user.id);
        toast(`Länken är skickad till ${user.email}.`);
        load();
      } catch (err) { toast(`Kunde inte skicka: ${err.message}`, 'error'); }
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
    { key: 'skolor', label: 'Skolor', icon: 'domain' },
  ];
  let current = location.hash === '#skolor' ? 'skolor' : 'konton';
  root.innerHTML = `
    <div class="mb-space-lg">
      <span class="font-label-md text-label-md text-primary-deep uppercase tracking-wider">Admin</span>
      <h1 class="font-display-xl text-display-xl text-text-primary tracking-tight mt-2">Adminpanel</h1>
      <p class="font-body-regular text-body-regular text-text-secondary mt-1">Hantera konton, skolor och klasser.</p>
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
// Skolor: real schools from the database. Admins create schools and attach
// approved teachers; teachers create their own classes (with a join code) in
// the teacher view, and students join with that code.
// ---------------------------------------------------------------------
async function schoolApi(action, extra = {}) {
  const { data, error } = await sb.functions.invoke('admin', { body: { action, ...extra } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch (e) { /* not JSON */ }
    throw new Error(msg);
  }
  return data;
}

function initSchools(root) {
  const state = { schoolId: null, classId: null, data: null, error: null };
  const card = 'bg-surface-card rounded-2xl shadow-sm';
  const btnPrimary = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-colors';
  const btnQuiet = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border-subtle hover:bg-surface-subdued text-text-secondary font-label-md text-label-md transition-colors';
  const tile = (icon, v, l) => `
    <div class="${card} p-space-lg flex flex-col gap-1">
      <span class="material-symbols-outlined text-[22px] text-primary-container">${icon}</span>
      <span class="font-headline-1 text-headline-1 text-text-primary mt-1">${v}</span>
      <span class="font-label-md text-label-md text-text-secondary">${l}</span>
    </div>`;
  const bar = pct => `<div class="h-1.5 bg-border-subtle rounded-full overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:${pct}%"></div></div>`;
  const crumbs = parts => `<nav class="flex flex-wrap items-center gap-1 font-label-md text-label-md text-text-secondary mb-space-md">${parts.map((p, i) => i < parts.length - 1
    ? `<button type="button" data-crumb="${i}" class="hover:text-primary-deep hover:underline">${esc(p)}</button><span class="material-symbols-outlined text-[16px] text-text-tertiary">chevron_right</span>`
    : `<span class="text-text-primary">${esc(p)}</span>`).join('')}</nav>`;
  const who = p => esc(p?.name || p?.email || '–');

  async function load() {
    root.innerHTML = '<p class="font-body-regular text-body-regular text-text-secondary">Hämtar skolor…</p>';
    try { state.data = await schoolApi('schools'); state.error = null; } catch (err) { state.error = err.message; }
    render();
  }
  const go = (schoolId = null, classId = null) => { state.schoolId = schoolId; state.classId = classId; render(); window.scrollTo({ top: 0 }); };

  function newSchoolDialog() {
    const m = modal(`
      <h2 class="font-headline-2 text-headline-2 text-text-primary">Ny skola</h2>
      <form data-new-school class="flex flex-col gap-space-md mt-space-md">
        <label class="flex flex-col gap-1.5 font-label-md text-label-md text-text-secondary">Namn
          <input name="name" required class="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-surface-subdued/50 font-body-regular text-body-regular text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container" placeholder="t.ex. Norra gymnasiet"/></label>
        <label class="flex flex-col gap-1.5 font-label-md text-label-md text-text-secondary">Ort (valfritt)
          <input name="city" class="w-full px-4 py-2.5 rounded-xl border border-border-subtle bg-surface-subdued/50 font-body-regular text-body-regular text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container" placeholder="t.ex. Stockholm"/></label>
        <div class="flex justify-end gap-2 mt-1">
          <button type="button" data-close class="${btnQuiet}">Avbryt</button>
          <button type="submit" class="${btnPrimary}">Skapa skola</button>
        </div>
      </form>`);
    const form = m.el.querySelector('[data-new-school]');
    form.name.focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      form.querySelector('[type=submit]').disabled = true;
      try {
        const { school } = await schoolApi('create_school', { name: form.name.value, city: form.city.value });
        m.close();
        toast(`Skolan ${school.name} är skapad.`);
        await load();
        go(school.id);
      } catch (err) { toast(err.message, 'error'); form.querySelector('[type=submit]').disabled = false; }
    });
  }

  async function setTeacherSchool(teacherId, schoolId, msg) {
    try {
      await schoolApi('set_teacher_school', { id: teacherId, school_id: schoolId });
      toast(msg);
      await load();
    } catch (err) { toast(err.message, 'error'); }
  }

  function renderList() {
    const { schools, teachers } = state.data;
    const classes = schools.flatMap(s => s.classes);
    const students = classes.reduce((a, c) => a + c.students, 0);
    const loose = teachers.filter(t => !t.school_id);
    root.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
        <p class="font-body-regular text-body-regular text-text-secondary">Skapa skolan, koppla dess godkända lärare – lärarna skapar sedan sina klasser själva.</p>
        <button type="button" data-new class="${btnPrimary} self-start md:self-auto"><span class="material-symbols-outlined text-[18px]">add</span>Ny skola</button>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${tile('domain', schools.length, 'Skolor')}
        ${tile('groups', classes.length, 'Klasser')}
        ${tile('school', students, 'Elever i klasser')}
        ${tile('co_present', teachers.length - loose.length, 'Lärare kopplade')}
      </div>
      ${loose.length ? `
      <div class="mt-space-xl ${card} border border-[#FDE68A] p-space-lg">
        <h2 class="font-headline-3 text-headline-3 text-text-primary">Lärare utan skola</h2>
        <p class="font-body-regular text-[14px] text-text-secondary mt-1 mb-space-md">De kan inte skapa klasser förrän de är kopplade till en skola.</p>
        <div class="flex flex-col gap-2">${loose.map(t => `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border-subtle first:border-0 pt-2 first:pt-0">
            <div class="min-w-0"><p class="font-label-md text-[14px] text-text-primary truncate">${who(t)}</p><p class="font-caption-micro text-caption-micro text-text-tertiary truncate">${esc(t.email)}${t.school ? ` · angav ${esc(t.school)}` : ''}</p></div>
            <div class="flex gap-2 shrink-0">
              <select data-assign-select="${t.id}" class="px-3 py-2 rounded-xl border border-border-subtle bg-surface-card font-body-regular text-[14px]" ${schools.length ? '' : 'disabled'}>
                ${schools.length ? schools.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') : '<option>Skapa en skola först</option>'}
              </select>
              <button type="button" data-assign="${t.id}" class="${btnPrimary}" ${schools.length ? '' : 'disabled'}>Koppla</button>
            </div>
          </div>`).join('')}</div>
      </div>` : ''}
      <h2 class="font-headline-2 text-headline-2 text-text-primary mt-12 mb-space-md">Skolor</h2>
      ${schools.length ? `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${schools.map(s => {
        const n = s.classes.reduce((a, c) => a + c.students, 0);
        const prog = n ? Math.round(s.classes.reduce((a, c) => a + c.progress * c.students, 0) / n) : 0;
        return `<button type="button" data-school="${s.id}" class="text-left ${card} p-space-lg hover:shadow-md hover:ring-2 hover:ring-primary-fixed transition-all flex flex-col gap-space-md">
          <div class="w-11 h-11 rounded-xl bg-primary-tint text-primary-deep flex items-center justify-center"><span class="material-symbols-outlined text-[24px]">domain</span></div>
          <div><h3 class="font-headline-3 text-headline-3 text-text-primary">${esc(s.name)}</h3><p class="font-body-regular text-[14px] text-text-secondary">${esc(s.city || '–')}</p></div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 font-caption-micro text-caption-micro text-text-secondary"><span>${s.classes.length} klasser</span><span>${n} elever</span><span>${s.teachers.length} lärare</span></div>
          <div class="flex flex-col gap-1.5"><div class="flex justify-between font-caption-micro text-caption-micro text-text-tertiary"><span>Snittprogress</span><span>${prog}%</span></div>${bar(prog)}</div>
        </button>`;
      }).join('')}</div>` : `<div class="${card} p-space-xl text-center"><p class="font-body-regular text-body-regular text-text-secondary">Inga skolor än. Skapa den första med <strong>Ny skola</strong>.</p></div>`}`;
    root.querySelector('[data-new]').addEventListener('click', newSchoolDialog);
    root.querySelectorAll('[data-school]').forEach(b => b.addEventListener('click', () => go(b.dataset.school)));
    root.querySelectorAll('[data-assign]').forEach(b => b.addEventListener('click', () => {
      const sel = root.querySelector(`[data-assign-select="${b.dataset.assign}"]`);
      setTeacherSchool(b.dataset.assign, sel.value, 'Läraren är kopplad till skolan.');
    }));
  }

  function renderSchool() {
    const s = state.data.schools.find(x => x.id === state.schoolId);
    if (!s) return go();
    const n = s.classes.reduce((a, c) => a + c.students, 0);
    const prog = n ? Math.round(s.classes.reduce((a, c) => a + c.progress * c.students, 0) / n) : 0;
    const free = state.data.teachers.filter(t => !t.school_id);
    root.innerHTML = `
      ${crumbs(['Skolor', s.name])}
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
        <div>
          <h2 class="font-headline-1 text-headline-1 text-text-primary">${esc(s.name)}</h2>
          <p class="font-body-regular text-body-regular text-text-secondary mt-1">${esc(s.city || 'Ingen ort angiven')} · Skapad ${fmtDate(s.created_at)}</p>
        </div>
        <button type="button" data-delete-school class="${btnQuiet} self-start md:self-auto hover:!bg-[#FEF2F2] hover:border-[#FCA5A5] !text-critical-danger"><span class="material-symbols-outlined text-[18px]">delete</span>Ta bort skolan</button>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${tile('groups', s.classes.length, 'Klasser')}
        ${tile('school', n, 'Elever')}
        ${tile('co_present', s.teachers.length, 'Lärare')}
        ${tile('donut_large', `${prog}%`, 'Snittprogress')}
      </div>
      <h2 class="font-headline-2 text-headline-2 text-text-primary mt-12 mb-space-md">Lärare</h2>
      <div class="${card} px-space-lg py-2">
        ${s.teachers.length ? s.teachers.map(t => `
          <div class="flex items-center justify-between gap-3 py-3 border-t border-border-subtle first:border-0">
            <div class="flex items-center gap-3 min-w-0"><div class="w-8 h-8 shrink-0 rounded-full bg-positive-wash text-secondary flex items-center justify-center font-label-md text-[12px]">${initials(t.name || t.email)}</div>
              <div class="min-w-0"><p class="font-label-md text-[14px] text-text-primary truncate">${who(t)}</p><p class="font-caption-micro text-caption-micro text-text-tertiary truncate">${esc(t.email)} · ${s.classes.filter(c => c.teacher_id === t.id).map(c => esc(c.name)).join(', ') || 'inga klasser än'}</p></div></div>
            <button type="button" data-unlink="${t.id}" class="font-label-md text-[13px] text-text-secondary hover:text-critical-danger">Koppla bort</button>
          </div>`).join('') : '<p class="py-3 font-body-regular text-[14px] text-text-tertiary">Inga lärare kopplade än.</p>'}
        ${free.length ? `<div class="flex flex-col sm:flex-row gap-2 py-3 border-t border-border-subtle">
          <select data-link-select class="flex-1 px-3 py-2 rounded-xl border border-border-subtle bg-surface-card font-body-regular text-[14px]">${free.map(t => `<option value="${t.id}">${who(t)} (${esc(t.email)})</option>`).join('')}</select>
          <button type="button" data-link class="${btnPrimary}"><span class="material-symbols-outlined text-[18px]">person_add</span>Koppla lärare</button>
        </div>` : '<p class="py-3 border-t border-border-subtle font-caption-micro text-caption-micro text-text-tertiary">Alla godkända lärare är redan kopplade. Godkänn nya lärare under Konton.</p>'}
      </div>
      <h2 class="font-headline-2 text-headline-2 text-text-primary mt-12 mb-space-md">Klasser</h2>
      ${s.classes.length ? `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${s.classes.map(c => `
        <button type="button" data-class="${c.id}" class="text-left ${card} p-space-lg hover:shadow-md hover:ring-2 hover:ring-primary-fixed transition-all flex flex-col gap-space-sm">
          <div class="flex items-center justify-between gap-2"><h3 class="font-headline-3 text-headline-3 text-text-primary">${esc(c.name)}</h3><span class="px-2 py-0.5 rounded-lg bg-surface-subdued font-label-md text-[12px] text-text-secondary tracking-wider">${esc(c.join_code)}</span></div>
          <p class="font-body-regular text-[14px] text-text-secondary">${who(c.teacher)} · ${c.students} elever</p>
          <div class="flex flex-col gap-1.5 mt-1"><div class="flex justify-between font-caption-micro text-caption-micro text-text-tertiary"><span>Progress</span><span>${c.progress}%</span></div>${bar(c.progress)}</div>
        </button>`).join('')}</div>` : `<div class="${card} p-space-lg"><p class="font-body-regular text-[14px] text-text-tertiary">Inga klasser än. Lärarna skapar sina klasser själva i lärarvyn.</p></div>`}`;
    root.querySelector('[data-crumb="0"]').addEventListener('click', () => go());
    root.querySelectorAll('[data-class]').forEach(b => b.addEventListener('click', () => go(s.id, b.dataset.class)));
    root.querySelector('[data-link]')?.addEventListener('click', () => setTeacherSchool(root.querySelector('[data-link-select]').value, s.id, 'Läraren är kopplad till skolan.'));
    root.querySelectorAll('[data-unlink]').forEach(b => b.addEventListener('click', async () => {
      const t = s.teachers.find(x => x.id === b.dataset.unlink);
      const ok = await confirmDialog({ title: 'Koppla bort läraren?', text: `<strong>${who(t)}</strong> kopplas bort från ${esc(s.name)}. Lärarens klasser och elever finns kvar.`, confirmLabel: 'Koppla bort', danger: true });
      if (ok) setTeacherSchool(t.id, null, 'Läraren är bortkopplad.');
    }));
    root.querySelector('[data-delete-school]').addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Ta bort skolan?', text: `<strong>${esc(s.name)}</strong> och alla dess klasser tas bort. Elevernas och lärarnas konton finns kvar.`, confirmLabel: 'Ta bort för gott', danger: true, typeToConfirm: 'TA BORT' });
      if (!ok) return;
      try { await schoolApi('delete_school', { school_id: s.id }); toast('Skolan är borttagen.'); await load(); go(); } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function renderClass() {
    const s = state.data.schools.find(x => x.id === state.schoolId);
    const c = s?.classes.find(x => x.id === state.classId);
    if (!c) return go(state.schoolId);
    root.innerHTML = `${crumbs(['Skolor', s.name, c.name])}<p class="font-body-regular text-body-regular text-text-secondary">Hämtar klassen…</p>`;
    let d;
    try { d = await schoolApi('class_detail', { class_id: c.id }); } catch (err) { root.innerHTML = `<p class="text-critical-danger">${esc(err.message)}</p>`; return; }
    if (state.classId !== c.id) return;
    const ls = d.lessons;
    const rows = d.students.map(st => {
      const byLesson = new Map(st.progress.map(p => [p.lesson_id, p]));
      const doneN = ls.filter(l => byLesson.get(l.id)?.status === 'completed').length;
      return { st, byLesson, doneN };
    }).sort((a, b) => b.doneN - a.doneN);
    const total = rows.length * ls.length;
    const pct = total ? Math.round(rows.reduce((a, r) => a + r.doneN, 0) / total * 100) : 0;
    root.innerHTML = `
      ${crumbs(['Skolor', s.name, c.name])}
      <div class="mb-space-lg">
        <h2 class="font-headline-1 text-headline-1 text-text-primary">${esc(c.name)}</h2>
        <p class="font-body-regular text-body-regular text-text-secondary mt-1">${esc(s.name)} · Lärare: ${who(c.teacher)} · Klasskod <strong class="tracking-wider">${esc(c.join_code)}</strong></p>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${tile('school', rows.length, 'Elever')}
        ${tile('menu_book', ls.length, 'Lektioner i paketet')}
        ${tile('donut_large', `${pct}%`, 'Snittprogress')}
        ${tile('task_alt', rows.filter(r => ls.length && r.doneN === ls.length).length, 'Klara med allt')}
      </div>
      <h2 class="font-headline-2 text-headline-2 text-text-primary mt-12 mb-space-md">Elever</h2>
      ${rows.length ? `<div class="${card} px-space-lg py-2 overflow-x-auto">
        <table class="w-full text-left min-w-[640px]">
          <thead><tr class="font-caption-micro text-caption-micro text-text-tertiary uppercase tracking-wide"><th class="py-3 pr-4 font-semibold">Elev</th><th class="py-3 pr-4 font-semibold">Lektioner</th><th class="py-3 pr-4 font-semibold">Gick med</th><th class="py-3 font-semibold">Senast inloggad</th></tr></thead>
          <tbody>${rows.map(({ st, byLesson, doneN }) => `<tr class="border-t border-border-subtle">
            <td class="py-3 pr-4"><p class="font-label-md text-[14px] text-text-primary">${who(st)}</p><p class="font-caption-micro text-caption-micro text-text-tertiary">${esc(st.email)}</p></td>
            <td class="py-3 pr-4"><div class="flex items-center gap-1">${ls.map(l => { const p = byLesson.get(l.id); return `<span title="${esc(l.title)}" class="w-4 h-1.5 rounded-full ${p?.status === 'completed' ? 'bg-primary-container' : p ? 'bg-primary-fixed-dim' : 'bg-border-subtle'}"></span>`; }).join('')}<span class="ml-2 font-caption-micro text-caption-micro text-text-secondary">${doneN}/${ls.length}</span></div></td>
            <td class="py-3 pr-4 font-body-regular text-[14px] text-text-secondary whitespace-nowrap">${fmtDate(st.joined_at)}</td>
            <td class="py-3 font-body-regular text-[14px] text-text-secondary whitespace-nowrap">${ago(st.last_sign_in_at)}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : `<div class="${card} p-space-lg"><p class="font-body-regular text-[14px] text-text-tertiary">Inga elever än. Eleverna går med genom att skriva in klasskoden <strong>${esc(c.join_code)}</strong> på sin översikt.</p></div>`}`;
    root.querySelector('[data-crumb="0"]').addEventListener('click', () => go());
    root.querySelector('[data-crumb="1"]').addEventListener('click', () => go(s.id));
  }

  function render() {
    if (!root.isConnected) return;
    if (state.error) { root.innerHTML = `<p class="font-body-regular text-body-regular text-critical-danger">Kunde inte hämta skolor: ${esc(state.error)}</p>`; return; }
    if (!state.data) return;
    if (state.classId) renderClass();
    else if (state.schoolId) renderSchool();
    else renderList();
  }
  load();
}

// The admin panel has its own login and only lets admin accounts in
function renderLogin(message) {
  document.getElementById('hdr-avatar').style.display = 'none';
  const root = document.getElementById('admin-root');
  root.innerHTML = `
    <div class="max-w-md mx-auto bg-surface-card rounded-2xl shadow-lg p-space-xl">
      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-text-primary text-on-primary text-[11px] font-semibold uppercase tracking-wide"><span class="material-symbols-outlined text-[14px]">shield_person</span>Admin</span>
      <h1 class="font-headline-2 text-headline-2 text-text-primary mt-3">Logga in som admin</h1>
      <p class="font-body-regular text-[14px] text-text-secondary mt-1">Endast för UngEkonoms administratörer.</p>
      <form data-login class="flex flex-col gap-space-md mt-space-lg">
        <label class="flex flex-col gap-1.5 font-label-md text-label-md text-text-secondary">E-post
          <input name="email" type="email" required autocomplete="email" class="w-full px-4 py-3 rounded-xl border border-border-subtle bg-surface-subdued/50 font-body-regular text-body-regular text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container"/></label>
        <label class="flex flex-col gap-1.5 font-label-md text-label-md text-text-secondary">Lösenord
          <input name="password" type="password" required autocomplete="current-password" class="w-full px-4 py-3 rounded-xl border border-border-subtle bg-surface-subdued/50 font-body-regular text-body-regular text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-container"/></label>
        <div class="flex justify-center min-h-[78px]" data-captcha></div>
        <p data-login-error class="${message ? '' : 'hidden'} text-[13px] text-critical-danger font-body-medium">${esc(message || '')}</p>
        <button type="submit" class="w-full mt-1 px-6 py-3.5 rounded-xl bg-text-primary hover:opacity-90 text-on-primary font-label-md text-label-md transition-all disabled:opacity-60">Logga in</button>
      </form>
    </div>`;
  const form = root.querySelector('[data-login]');
  const errorEl = root.querySelector('[data-login-error]');
  // hCaptcha: Supabase requires a token for every password sign-in
  let captchaId;
  if (!HCAPTCHA_SITE_KEY) root.querySelector('[data-captcha]').remove();
  window.onHcaptchaLoad = () => { captchaId = hcaptcha.render(root.querySelector('[data-captcha]'), { sitekey: HCAPTCHA_SITE_KEY }); };
  if (!HCAPTCHA_SITE_KEY) { /* captcha off */ }
  else if (window.hcaptcha) window.onHcaptchaLoad();
  else {
    const sc = document.createElement('script');
    sc.src = 'https://js.hcaptcha.com/1/api.js?hl=sv&render=explicit&onload=onHcaptchaLoad';
    sc.async = true;
    document.head.appendChild(sc);
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    errorEl.classList.add('hidden');
    let captchaToken = '';
    try { captchaToken = captchaId !== undefined ? hcaptcha.getResponse(captchaId) : ''; } catch (err) { /* not loaded */ }
    if (HCAPTCHA_SITE_KEY && !captchaToken) {
      errorEl.textContent = 'Bekräfta att du inte är en robot genom att klicka i rutan ovan.';
      errorEl.classList.remove('hidden');
      return;
    }
    btn.disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value, options: HCAPTCHA_SITE_KEY ? { captchaToken } : undefined });
    try { hcaptcha.reset(captchaId); } catch (err) { /* ignore */ }
    if (!error && data.user?.app_metadata?.role === 'admin') { location.reload(); return; }
    if (!error) await sb.auth.signOut({ scope: 'local' }); // signed in, but not an admin
    errorEl.textContent = error
      ? (error.message === 'Invalid login credentials' ? 'Fel e-post eller lösenord.' : /captcha/i.test(error.message) ? 'Captcha-kontrollen gick inte igenom. Klicka i rutan och försök igen.' : error.message)
      : 'Det här kontot har inte admin-behörighet.';
    errorEl.classList.remove('hidden');
    btn.disabled = false;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();
  const user = session?.user;
  if (!user) { renderLogin(); return; }
  if (user.app_metadata?.role !== 'admin') {
    await sb.auth.signOut({ scope: 'local' });
    renderLogin('Det här kontot har inte admin-behörighet.');
    return;
  }
  renderAccountMenu(user);
  initShell(user);
});
