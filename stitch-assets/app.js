// Shared Supabase client + auth/data helpers for the UngEkonom platform pages.
const SUPABASE_URL = 'https://psvjlxqdqcuhmafqorlv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yuBvIFJ1sU3sfLpC0P3rmA_lNdgxITd';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORY_META = {
  aktier: { label: 'Aktier', icon: 'show_chart', iconBg: 'bg-primary-tint', iconColor: 'text-primary-deep', desc: 'Från nybörjare till trygg investerare på börsen med rätt riskhantering.' },
  fonder: { label: 'Fonder', icon: 'pie_chart', iconBg: 'bg-positive-wash', iconColor: 'text-secondary', desc: 'Bred riskspridning för långsiktigt sparande och indexföljande portföljer.' },
  privatekonomi: { label: 'Privatekonomi', icon: 'account_balance_wallet', iconBg: 'bg-surface-subdued', iconColor: 'text-text-primary', desc: 'Budget, buffert och smart studentekonomi som skapar lugn i vardagen.' },
  vardering: { label: 'Värdering', icon: 'calculate', iconBg: 'bg-surface-container-low', iconColor: 'text-primary-deep', desc: 'P/E-tal, kassaflöde och multiplar för att avgöra om ett bolag är prisvärt.' },
  krypto: { label: 'Krypto & Web3', icon: 'currency_bitcoin', iconBg: 'bg-surface-subdued', iconColor: 'text-text-secondary', desc: 'Blockkedjor, volatilitet och riskhantering i digitala tillgångar.' },
  ranta: { label: 'Ränta på ränta', icon: 'auto_graph', iconBg: 'bg-positive-wash', iconColor: 'text-secondary', desc: 'Matematiken bakom exponentiell förmögenhetstillväxt över tid.' },
};

// MVP scope: only the first lesson in each category is open; paused
// categories are fully locked. Everything else shows "Under utveckling".
const PAUSED_CATEGORIES = new Set(['krypto']);
const OPEN_LESSONS_PER_CATEGORY = 1;
// Minimum quiz score (%) to complete a lesson and earn XP. 0 = always pass.
const PASS_THRESHOLD = 90;
function isLessonOpen(lesson, lessons) {
  if (!lesson || PAUSED_CATEGORIES.has(lesson.category)) return false;
  const sameCategory = lessons.filter(l => l.category === lesson.category).sort((a, b) => a.order_index - b.order_index);
  const pos = sameCategory.findIndex(l => l.id === lesson.id);
  return pos >= 0 && pos < OPEN_LESSONS_PER_CATEGORY;
}

function initialsFromName(name) {
  if (!name) return '–';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

const XP_LEVELS = [
  { level: 1, xp: 0, title: 'Ekonomi Rookie' },
  { level: 2, xp: 100, title: 'Pengakollare' },
  { level: 3, xp: 250, title: 'Spararen' },
  { level: 4, xp: 500, title: 'Budget Boss' },
  { level: 5, xp: 850, title: 'Pengamästare' },
  { level: 6, xp: 1250, title: 'Investeraren' },
  { level: 7, xp: 1750, title: 'Ekonomisk Strateg' },
  { level: 8, xp: 2500, title: 'Ekonomisk Ninja' },
  { level: 9, xp: 3500, title: 'Money Master' },
  { level: 10, xp: 5000, title: 'Ekonomisk Legend' },
];

function levelFromXp(xp) {
  let current = XP_LEVELS[0];
  let next = null;
  for (const entry of XP_LEVELS) {
    if (xp >= entry.xp) current = entry;
    else { next = entry; break; }
  }
  const xpToNext = next ? next.xp - xp : 0;
  const levelSpan = next ? next.xp - current.xp : 1;
  const levelProgressPct = next ? Math.round(((xp - current.xp) / levelSpan) * 100) : 100;
  return { level: current.level, title: current.title, next, xpToNext, levelProgressPct };
}

async function signOut() {
  await sb.auth.signOut();
  location.href = 'index.html';
}

// Legacy lesson content ("next-up-links") calls this inline via onclick to
// jump straight to another lesson id.
window.openLektion = function (id) {
  location.href = 'lektion.html?id=' + encodeURIComponent(id);
};

// Legacy lesson content ("Du har klarat allt!") calls this to return home.
window.goHome = function () {
  location.href = 'oversikt.html';
};

function renderSidebarChrome(profile) {
  const sbName = document.getElementById('sb-name');
  if (sbName) sbName.textContent = profile.display_name;
  const sbInitials = document.getElementById('sb-initials');
  if (sbInitials) sbInitials.textContent = initialsFromName(profile.display_name);
  const { level, title } = levelFromXp(profile.xp);
  const sbLevelXp = document.getElementById('sb-level-xp');
  if (sbLevelXp) sbLevelXp.textContent = `Nivå ${level} • ${title}`;
  const hdrXp = document.getElementById('hdr-xp');
  if (hdrXp) hdrXp.textContent = `${profile.xp.toLocaleString('sv-SE')} XP`;
  const hdrStreak = document.getElementById('hdr-streak');
  if (hdrStreak) hdrStreak.textContent = profile.streak_days;
  const sbStreak = document.getElementById('sb-streak-days');
  if (sbStreak) sbStreak.textContent = `${profile.streak_days} dagars streak`;
  const goalPct = profile.daily_goal_minutes ? Math.min(100, Math.round((profile.minutes_today / profile.daily_goal_minutes) * 100)) : 0;
  const sbGoalPct = document.getElementById('sb-goal-pct');
  if (sbGoalPct) sbGoalPct.textContent = `${goalPct}%`;
  const sbGoalText = document.getElementById('sb-goal-text');
  if (sbGoalText) sbGoalText.textContent = `${profile.minutes_today} / ${profile.daily_goal_minutes} min idag`;
  const sbGoalBar = document.getElementById('sb-goal-bar');
  if (sbGoalBar) sbGoalBar.style.width = `${goalPct}%`;
  const hdrAvatar = document.getElementById('hdr-avatar');
  if (hdrAvatar) hdrAvatar.textContent = initialsFromName(profile.display_name);
}

// ---------------------------------------------------------------------
// Hem/dashboard page rendering (only runs if the page has #subjects-grid)
// ---------------------------------------------------------------------
async function renderDashboard(data) {
  const { profile, lessons, progress } = data;
  const root = document.getElementById('dashboard-root');
  const progressByLesson = new Map(progress.map(p => [p.lesson_id, p]));
  const statusOf = l => progressByLesson.get(l.id)?.status;

  // MVP: all progress numbers are relative to the open lessons only
  const openLessons = lessons.filter(l => isLessonOpen(l, lessons));
  const openCompleted = openLessons.filter(l => statusOf(l) === 'completed').length;
  const pct = openLessons.length ? Math.round((openCompleted / openLessons.length) * 100) : 0;
  const { level, title: levelTitle, xpToNext, next: nextLevel } = levelFromXp(profile.xp);
  const scored = progress.filter(p => p.quiz_score !== null && p.quiz_score !== undefined && openLessons.some(l => l.id === p.lesson_id));
  const avgQuiz = scored.length ? Math.round(scored.reduce((s, p) => s + p.quiz_score, 0) / scored.length) : null;

  const hour = new Date().getHours();
  const greeting = hour < 10 ? 'God morgon' : hour < 18 ? 'Hej' : 'God kväll';

  // Continue card: latest in-progress open lesson, else first open lesson not yet completed
  const inProgress = openLessons
    .filter(l => statusOf(l) === 'in_progress')
    .sort((a, b) => new Date(progressByLesson.get(b.id).updated_at) - new Date(progressByLesson.get(a.id).updated_at))[0];
  const nextUp = inProgress || openLessons.find(l => statusOf(l) !== 'completed');

  let continueCard;
  if (nextUp) {
    const meta = CATEGORY_META[nextUp.category] || CATEGORY_META.aktier;
    continueCard = `
      <div class="relative overflow-hidden bg-primary-container rounded-3xl p-space-xl md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-space-lg">
        <div class="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 pointer-events-none"></div>
        <div class="relative flex flex-col gap-2 max-w-xl">
          <span class="font-label-md text-label-md text-primary-fixed uppercase tracking-wider">${inProgress ? 'Fortsätt där du slutade' : 'Nästa lektion'} · ${meta.label}</span>
          <h2 class="font-headline-1 text-headline-1 text-on-primary tracking-tight">${nextUp.title}</h2>
          <p class="font-body-regular text-body-regular text-primary-fixed">${nextUp.description || ''}</p>
          <span class="inline-flex items-center gap-1 font-caption-micro text-caption-micro text-primary-fixed"><span class="material-symbols-outlined text-[15px]">schedule</span>~${nextUp.estimated_minutes} min · ${nextUp.xp_reward} XP</span>
        </div>
        <a href="lektion.html?id=${encodeURIComponent(nextUp.id)}" class="relative inline-flex items-center justify-center gap-1.5 shrink-0 bg-surface-card hover:bg-primary-tint text-primary-deep font-label-md text-label-md px-space-lg py-3 rounded-xl transition-all shadow-sm">${inProgress ? 'Fortsätt' : 'Starta lektion'}<span class="material-symbols-outlined text-[16px]">arrow_forward</span></a>
      </div>`;
  } else {
    continueCard = `
      <div class="bg-positive-wash rounded-3xl p-space-xl md:p-12 flex items-center gap-space-md">
        <span class="material-symbols-outlined text-[36px] text-positive-spruce">celebration</span>
        <div>
          <h2 class="font-headline-2 text-headline-2 text-text-primary">Alla öppna lektioner klara – grymt jobbat!</h2>
          <p class="font-body-regular text-body-regular text-text-secondary mt-1">Fler lektioner är under utveckling. Du kan alltid göra om en lektion i Kurser.</p>
        </div>
      </div>`;
  }

  const circumference = 251.2;
  const stat = (icon, value, label, sub) => `
      <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col gap-1">
        <span class="material-symbols-outlined text-[22px] text-primary-container">${icon}</span>
        <span class="font-headline-1 text-headline-1 text-text-primary mt-1">${value}</span>
        <span class="font-label-md text-label-md text-text-primary">${label}</span>
        <span class="font-caption-micro text-caption-micro text-text-tertiary">${sub}</span>
      </div>`;

  const stats = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex items-center gap-space-md">
        <svg class="w-20 h-20 shrink-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F0" stroke-width="10"></circle>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#2563EB" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - pct / 100)}"></circle>
        </svg>
        <div class="flex flex-col">
          <span class="font-headline-1 text-headline-1 text-text-primary">${pct}%</span>
          <span class="font-label-md text-label-md text-text-primary">${openCompleted} av ${openLessons.length} lektioner</span>
          <span class="font-caption-micro text-caption-micro text-text-tertiary">av de öppna lektionerna</span>
        </div>
      </div>
      ${stat('bolt', profile.xp.toLocaleString('sv-SE'), `XP · Nivå ${level}`, nextLevel ? `${xpToNext} XP till ${nextLevel.title}` : levelTitle)}
      ${stat('local_fire_department', profile.streak_days, profile.streak_days === 1 ? 'dag i rad' : 'dagar i rad', `Bästa: ${profile.best_streak_days || 0}`)}
      ${stat('quiz', avgQuiz === null ? '–' : `${avgQuiz}%`, 'Quizsnitt', avgQuiz === null ? 'Gör ett quiz för att se resultat' : (avgQuiz >= 80 ? 'Hög precision' : 'Fortsätt öva'))}
    </div>`;

  const byCategory = {};
  for (const l of lessons) (byCategory[l.category] ||= []).push(l);
  for (const cat in byCategory) byCategory[cat].sort((a, b) => a.order_index - b.order_index);
  const categoryKeys = Object.keys(CATEGORY_META).filter(k => (byCategory[k] || []).length)
    .sort((a, b) => PAUSED_CATEGORIES.has(a) - PAUSED_CATEGORIES.has(b));

  const subjects = categoryKeys.map(key => {
    const meta = CATEGORY_META[key];
    const first = byCategory[key].find(l => isLessonOpen(l, lessons));
    if (!first) {
      return `
        <div class="bg-surface-card rounded-2xl p-space-lg flex flex-col gap-space-md opacity-60">
          <div class="flex items-center justify-between">
            <div class="w-11 h-11 rounded-xl ${meta.iconBg} ${meta.iconColor} flex items-center justify-center"><span class="material-symbols-outlined text-[24px]">${meta.icon}</span></div>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-subdued text-text-tertiary text-[11px] font-semibold uppercase tracking-wide">Under utveckling</span>
          </div>
          <h3 class="font-headline-3 text-headline-3 text-text-secondary">${meta.label}</h3>
        </div>`;
    }
    const done = statusOf(first) === 'completed';
    return `
      <a href="lektion.html?id=${encodeURIComponent(first.id)}" class="bg-surface-card rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-space-md group">
        <div class="flex items-center justify-between">
          <div class="w-11 h-11 rounded-xl ${meta.iconBg} ${meta.iconColor} flex items-center justify-center"><span class="material-symbols-outlined text-[24px]">${meta.icon}</span></div>
          <span class="px-2.5 py-0.5 rounded-full ${done ? 'bg-positive-wash text-secondary' : 'bg-primary-tint text-primary-deep'} font-caption-micro text-caption-micro flex items-center gap-1">${done ? '<span class="material-symbols-outlined text-[14px]">check</span> Klar' : 'Lektion 1'}</span>
        </div>
        <div class="flex flex-col gap-1">
          <h3 class="font-headline-3 text-headline-3 text-text-primary group-hover:text-primary-deep transition-colors">${meta.label}</h3>
          <p class="font-body-regular text-[14px] leading-relaxed text-text-secondary">${first.title}</p>
        </div>
      </a>`;
  }).join('');

  root.innerHTML = `
    <div class="mb-space-xl">
      <span class="font-label-md text-label-md text-primary-deep uppercase tracking-wider">Översikt</span>
      <h1 class="font-display-xl text-display-xl text-text-primary tracking-tight mt-2">${greeting}, ${profile.display_name} 👋</h1>
    </div>
    ${continueCard}
    <div class="mt-12">
      <h2 class="font-headline-2 text-headline-2 text-text-primary mb-space-md">Din resa</h2>
      ${stats}
    </div>
    <div class="mt-12">
      <div class="flex items-end justify-between mb-space-md">
        <h2 class="font-headline-2 text-headline-2 text-text-primary">Ämnen</h2>
        <a href="kurser.html" class="inline-flex items-center gap-1 font-label-md text-label-md text-primary-container hover:underline">Alla kurser<span class="material-symbols-outlined text-[18px]">arrow_forward</span></a>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${subjects}</div>
    </div>`;
}

// ---------------------------------------------------------------------
// Lektion page: steps -> quiz -> completion, backed by real progress rows
// ---------------------------------------------------------------------
function isYesterday(dateStr) {
  if (!dateStr) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dateStr === y.toISOString().slice(0, 10);
}

async function initLessonPage(ctx) {
  const { user, profile, lessons } = ctx;
  const root = document.getElementById('lesson-root');
  const lessonId = new URLSearchParams(location.search).get('id');
  if (!lessonId) {
    root.innerHTML = '<p class="font-body-regular text-body-regular text-text-secondary">Ingen lektion vald. <a class="text-primary underline" href="kurser.html">Gå till kurser →</a></p>';
    return;
  }

  const [{ data: lesson, error: lessonError }, { data: existingProgress }] = await Promise.all([
    sb.from('lessons').select('*').eq('id', lessonId).single(),
    sb.from('user_lesson_progress').select('*').eq('user_id', user.id).eq('lesson_id', lessonId).maybeSingle(),
  ]);

  if (lessonError || !lesson) {
    root.innerHTML = '<p class="font-body-regular text-body-regular text-text-secondary">Kunde inte hitta lektionen.</p>';
    return;
  }

  if (!isLessonOpen(lesson, lessons)) {
    root.innerHTML = `
      <div class="text-center py-space-xl">
        <div class="w-16 h-16 rounded-full bg-surface-subdued text-text-tertiary flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-[32px]">lock</span>
        </div>
        <h1 class="font-headline-1 text-headline-1 text-text-primary mb-2">Under utveckling</h1>
        <p class="font-body-regular text-body-regular text-text-secondary mb-6">Den här lektionen är inte klar än. Börja med första lektionen i ett ämne så länge.</p>
        <a href="kurser.html" class="inline-flex px-6 py-3 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm">Till kurser</a>
      </div>`;
    return;
  }

  const catMeta = CATEGORY_META[lesson.category] || CATEGORY_META.aktier;

  const steps = lesson.content.steps;
  const quiz = lesson.content.quiz;
  // Mutable: becomes true once this visit completes, so retakes never award XP twice
  let alreadyCompleted = existingProgress?.status === 'completed';
  let saving = false;
  let stepIndex = alreadyCompleted ? 0 : Math.min(existingProgress?.current_step || 0, steps.length - 1);
  // Furthest step reached; step dots let you jump back to any of these
  let maxStep = alreadyCompleted ? steps.length - 1 : stepIndex;

  // One key handler for the page; each view swaps in its own behaviour
  let onKey = null;
  document.addEventListener('keydown', e => {
    if (!onKey || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    // Enter on a focused button/link already clicks it natively
    if (e.key === 'Enter' && /^(BUTTON|A)$/.test(tag)) return;
    onKey(e);
  });

  function toTop() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  // Shared header: subject chip, label, counter and a bar covering steps + quiz
  function lessonHeader(label, counter, position) {
    const total = steps.length + quiz.length;
    // During the quiz the dots are a static indicator; jumping back is only via
    // "Tillbaka till lektionen", which restarts the quiz.
    const inQuiz = position >= steps.length;
    const dots = steps.map((_, i) => {
      if (inQuiz) return `<span class="w-2.5 h-2.5 rounded-full bg-primary-fixed" aria-hidden="true"></span>`;
      const state = i === stepIndex ? 'bg-primary-container' : i <= maxStep ? 'bg-primary-fixed hover:bg-primary-deep' : 'bg-surface-subdued';
      return `<button type="button" class="step-dot w-2.5 h-2.5 rounded-full ${state} transition-all" data-step="${i}" aria-label="Steg ${i + 1}" ${i > maxStep ? 'disabled' : ''}></button>`;
    }).join('');
    return `
      <div class="mb-space-lg">
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <span class="px-2.5 py-1 rounded-full ${catMeta.iconBg} ${catMeta.iconColor} font-label-md text-label-md shrink-0">${catMeta.label}</span>
            <span class="font-body-regular text-body-regular text-text-secondary truncate">${lesson.title}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">${dots}</div>
        </div>
        <div class="flex items-center justify-between mb-2">
          <span class="font-caption-micro text-caption-micro text-primary uppercase tracking-wider">${label}</span>
          <span class="font-caption-micro text-caption-micro text-text-tertiary">${counter}</span>
        </div>
        <div class="w-full h-1.5 bg-surface-subdued rounded-full overflow-hidden">
          <div class="h-full bg-primary-container rounded-full transition-all duration-300" style="width:${((position + 1) / total) * 100}%"></div>
        </div>
      </div>`;
  }

  function bindStepDots() {
    root.querySelectorAll('.step-dot').forEach(dot => dot.addEventListener('click', () => {
      const i = Number(dot.dataset.step);
      if (i > maxStep) return;
      stepIndex = i;
      renderStep();
    }));
  }
  let quizIndex = 0;
  let correctCount = 0;
  let answers = []; // per question: { chosen, correct } in original option indexes
  let quizOrders = []; // per question: shuffled display order of option indexes

  function shuffled(n) {
    const a = [...Array(n).keys()];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Feedback strings in the content are written as if the answer was right
  // ("Rätt! …", "Precis – …"); strip that so it reads as a plain explanation.
  function explanation(text) {
    const t = (text || '').replace(/^(Helt rätt|Rätt|Precis|Korrekt|Exakt)\s*[!.]?\s*[–-]?\s*/i, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function resetQuiz() {
    quizIndex = 0;
    correctCount = 0;
    answers = [];
    quizOrders = quiz.map(q => shuffled(q.options.length));
  }
  resetQuiz();

  async function saveProgress(status, currentStep, quizScore) {
    const payload = { user_id: user.id, lesson_id: lessonId, status, current_step: currentStep, updated_at: new Date().toISOString() };
    if (quizScore !== undefined) {
      payload.quiz_score = quizScore;
      payload.completed_at = new Date().toISOString();
    }
    const { error } = await sb.from('user_lesson_progress').upsert(payload);
    if (error) throw error;
  }

  // Step progress is saved in the background so "Nästa" never waits on the network
  function saveInBackground(status, currentStep) {
    saveProgress(status, currentStep).catch(() => toast('Kunde inte spara ditt framsteg – kontrollera din uppkoppling.'));
  }

  function toast(message) {
    let el = document.getElementById('lesson-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lesson-toast';
      el.setAttribute('role', 'status');
      el.className = 'fixed z-50 px-4 py-3 rounded-xl bg-text-primary text-on-primary font-label-md text-label-md shadow-lg';
      el.style.cssText = 'left:50%;bottom:24px;transform:translateX(-50%);max-width:calc(100% - 32px)';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 5000);
  }

  async function awardCompletion(score) {
    if (alreadyCompleted) return; // no double XP on retakes
    const today = new Date().toISOString().slice(0, 10);
    const sameDay = profile.last_active_date === today;
    const newStreak = sameDay ? profile.streak_days : (isYesterday(profile.last_active_date) ? profile.streak_days + 1 : 1);
    const update = {
      xp: profile.xp + lesson.xp_reward,
      streak_days: newStreak,
      best_streak_days: Math.max(profile.best_streak_days || 0, newStreak),
      last_active_date: today,
      minutes_today: sameDay ? profile.minutes_today + lesson.estimated_minutes : lesson.estimated_minutes,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('profiles').update(update).eq('id', user.id);
    if (error) throw error;
    Object.assign(profile, update);
    renderSidebarChrome(profile); // refresh XP / streak in the header right away
  }

  // Legacy lesson bodies link onward via onclick="openLektion('id')"; disable
  // links to lessons that are still locked in the MVP.
  function lockClosedLinks() {
    root.querySelectorAll('[onclick*="openLektion"]').forEach(el => {
      const m = el.getAttribute('onclick').match(/openLektion\(\s*['"]([^'"]+)/);
      const target = m && lessons.find(l => l.id === m[1]);
      if (isLessonOpen(target, lessons)) return;
      el.removeAttribute('onclick');
      el.disabled = true;
      el.style.opacity = '.55';
      el.style.cursor = 'default';
      el.textContent += ' · under utveckling';
    });
  }

  function renderStep() {
    const s = steps[stepIndex];
    const stepLabel = (s.label || '').replace(/^Steg \d+ av \d+\s*[–-]\s*/, '');
    root.innerHTML = `
      ${lessonHeader(stepLabel, `Steg ${stepIndex + 1} av ${steps.length}`, stepIndex)}
      <h1 class="font-headline-1 text-headline-1 text-text-primary mb-4">${s.title}</h1>
      <div class="prose-lesson">${s.body}</div>
      <div class="flex items-center justify-between mt-space-xl pt-space-lg border-t border-border-subtle">
        <button id="lesson-back" class="px-5 py-2.5 rounded-xl font-label-md text-label-md text-text-secondary hover:bg-surface-subdued transition-all ${stepIndex === 0 ? 'invisible' : ''}">← Tillbaka</button>
        <button id="lesson-next" class="px-6 py-3 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm flex items-center gap-2">
          <span>${stepIndex === steps.length - 1 ? 'Till quiz' : 'Nästa'}</span>
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>`;
    // The "Vad du ska kunna / Fortsätt med" box is shown on the done screen after
    // a passed quiz instead, so hide it while reading.
    root.querySelectorAll('.prose-lesson .section-next-up').forEach(el => el.remove());
    lockClosedLinks();
    bindStepDots();
    toTop();
    const back = () => { if (stepIndex > 0) { stepIndex--; renderStep(); } };
    const next = async () => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        maxStep = Math.max(maxStep, stepIndex);
        if (!alreadyCompleted) saveInBackground('in_progress', maxStep);
        renderStep();
      } else {
        if (!alreadyCompleted) saveInBackground('in_progress', steps.length);
        resetQuiz();
        renderQuiz();
      }
    };
    document.getElementById('lesson-back').addEventListener('click', back);
    document.getElementById('lesson-next').addEventListener('click', next);
    onKey = e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
  }

  function renderQuiz() {
    let answered = false;
    const q = quiz[quizIndex];
    root.innerHTML = `
      ${lessonHeader('Quiz', `Fråga ${quizIndex + 1} av ${quiz.length}`, steps.length + quizIndex)}
      <h2 class="font-headline-2 text-headline-2 text-text-primary mb-6">${q.question}</h2>
      <div id="quiz-options" class="flex flex-col gap-3"></div>
      <div id="quiz-feedback" class="mt-4 flex flex-col gap-1 hidden" aria-live="polite"></div>
      <div class="flex items-center justify-between gap-3 mt-space-xl pt-space-lg border-t border-border-subtle">
        <button id="quiz-back" type="button" class="px-5 py-2.5 rounded-xl font-label-md text-label-md text-text-secondary hover:bg-surface-subdued transition-all" title="Quizet börjar om när du kommer tillbaka">← Tillbaka till lektionen</button>
        <button id="quiz-next" class="invisible px-6 py-3 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm">${quizIndex === quiz.length - 1 ? 'Se resultat' : 'Nästa fråga'}</button>
      </div>`;
    bindStepDots();
    toTop();
    document.getElementById('quiz-back').addEventListener('click', () => { stepIndex = steps.length - 1; renderStep(); });
    const optionsEl = document.getElementById('quiz-options');
    quizOrders[quizIndex].forEach(idx => {
      const opt = q.options[idx];
      const btn = document.createElement('button');
      btn.className = 'text-left px-5 py-3.5 rounded-xl border border-border-subtle hover:border-primary-container hover:bg-primary-tint transition-all font-body-regular text-body-regular text-text-primary';
      btn.textContent = opt;
      btn.dataset.idx = idx;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const correct = idx === q.correct_index;
        if (correct) correctCount++;
        answers[quizIndex] = { chosen: idx, correct };
        Array.from(optionsEl.children).forEach(b => {
          const i = Number(b.dataset.idx);
          b.disabled = true;
          if (i === q.correct_index) { b.style.borderColor = '#10B981'; b.style.background = '#ECFDF5'; }
          else if (i === idx) { b.style.borderColor = '#DC2626'; b.style.background = '#ffdad6'; }
        });
        const fb = document.getElementById('quiz-feedback');
        // Verdict on its own line (green/red), right answer in green below, explanation in grey
        const line = (cls, text) => { const p = document.createElement('p'); p.className = cls; p.textContent = text; return p; };
        const why = explanation(q.feedback);
        fb.replaceChildren(
          correct
            ? line('font-label-md text-label-md text-positive-spruce', '✓ Rätt!')
            : line('font-label-md text-label-md text-critical-danger', '✗ Inte riktigt.'),
          ...(correct ? [] : [line('font-body-medium text-body-medium text-positive-spruce', `Rätt svar: ${q.options[q.correct_index]}`)]),
          ...(why ? [line('font-body-regular text-body-regular text-text-secondary', why)] : []),
        );
        fb.classList.remove('hidden');
        document.getElementById('quiz-next').classList.remove('invisible');
      });
      optionsEl.appendChild(btn);
    });
    const goNext = async () => {
      if (!answered || saving) return;
      if (quizIndex < quiz.length - 1) {
        quizIndex++;
        renderQuiz();
      } else {
        const score = Math.round((correctCount / quiz.length) * 100);
        if (score < PASS_THRESHOLD) { renderDone(score, false); return; }
        const btn = document.getElementById('quiz-next');
        btn.disabled = true;
        btn.textContent = 'Sparar…';
        saving = true;
        try {
          await saveProgress('completed', steps.length, score);
          await awardCompletion(score);
        } catch (err) {
          saving = false;
          btn.disabled = false;
          btn.textContent = 'Försök igen';
          toast('Kunde inte spara resultatet. Kontrollera din uppkoppling och försök igen.');
          return;
        }
        saving = false;
        const earnedXp = !alreadyCompleted;
        alreadyCompleted = true;
        renderDone(score, earnedXp);
      }
    };
    document.getElementById('quiz-next').addEventListener('click', goNext);
    // 1–4 picks an answer, Enter / → moves on once answered
    onKey = e => {
      const n = Number(e.key);
      if (n >= 1 && n <= optionsEl.children.length) { e.preventDefault(); optionsEl.children[n - 1].click(); }
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && answered) { e.preventDefault(); goNext(); }
    };
  }

  // "Vad du ska kunna" bullets from the lesson's own next-up box, reused as a recap
  function masteryPoints() {
    const tmp = document.createElement('div');
    tmp.innerHTML = steps.map(s => s.body).join('');
    const el = tmp.querySelector('.next-up-mastery');
    return el ? el.textContent.split('·').map(t => t.trim()).filter(Boolean) : [];
  }

  // Suggest the first open, not yet completed lesson in another subject
  function suggestedNext() {
    const done = new Set(ctx.progress.filter(p => p.status === 'completed').map(p => p.lesson_id));
    done.add(lesson.id);
    const order = Object.keys(CATEGORY_META);
    return lessons
      .filter(l => l.category !== lesson.category && isLessonOpen(l, lessons) && !done.has(l.id))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))[0] || null;
  }

  function renderDone(score, earnedXp) {
    onKey = null;
    const passed = score >= PASS_THRESHOLD;
    const points = passed ? masteryPoints() : [];
    const missed = quiz.map((q, i) => ({ q, a: answers[i] })).filter(x => x.a && !x.a.correct);
    const next = suggestedNext();
    const nextMeta = next && (CATEGORY_META[next.category] || CATEGORY_META.aktier);
    const btnPrimary = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm';
    const btnSecondary = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface-subdued hover:bg-surface-container text-text-primary font-label-md text-label-md transition-all';

    root.innerHTML = `
      <div class="text-center pt-4">
        <span class="px-2.5 py-1 rounded-full ${catMeta.iconBg} ${catMeta.iconColor} font-label-md text-label-md">${catMeta.label}</span>
        <div class="w-20 h-20 rounded-full ${passed ? 'bg-positive-wash text-positive-spruce' : 'bg-primary-tint text-primary-deep'} flex items-center justify-center mx-auto mt-6 mb-4">
          <span class="material-symbols-outlined text-[40px]">${passed ? 'celebration' : 'school'}</span>
        </div>
        <h2 class="font-headline-1 text-headline-1 text-text-primary mb-2">${passed ? 'Lektion klar!' : 'Nästan där!'}</h2>
        <p class="font-body-medium text-body-medium text-text-secondary">Du fick <strong>${correctCount} av ${quiz.length}</strong> rätt (${score}%)${earnedXp ? ` och tjänade <strong class="text-primary-deep">+${lesson.xp_reward} XP</strong>` : ''}.</p>
        ${passed ? '' : `<p class="font-body-regular text-body-regular text-text-secondary mt-1">Du behöver minst ${Math.ceil(quiz.length * PASS_THRESHOLD / 100)} av ${quiz.length} rätt för att gå vidare.</p>`}
      </div>
      ${points.length ? `
      <div class="mt-space-xl bg-positive-wash rounded-2xl p-space-lg">
        <p class="font-label-md text-label-md text-positive-spruce uppercase tracking-wider mb-2">Det här kan du nu</p>
        <ul class="flex flex-col gap-1.5">
          ${points.map(p => `<li class="flex items-start gap-2 font-body-regular text-body-regular text-text-primary"><span class="material-symbols-outlined text-[20px] text-positive-spruce">check_circle</span>${p}</li>`).join('')}
        </ul>
      </div>` : ''}
      ${missed.length ? `
      <div class="mt-space-lg">
        <p class="font-label-md text-label-md text-text-primary mb-3">Frågor att titta på igen</p>
        <div class="flex flex-col gap-3">
          ${missed.map(({ q, a }) => `
          <div class="border border-border-subtle rounded-xl p-space-md">
            <p class="font-label-md text-label-md text-text-primary">${q.question}</p>
            <p class="font-body-regular text-[14px] text-critical-danger mt-1">Ditt svar: ${q.options[a.chosen]}</p>
            <p class="font-body-regular text-[14px] text-positive-spruce">Rätt svar: ${q.options[q.correct_index]}</p>
            ${q.feedback ? `<p class="font-body-regular text-[14px] text-text-secondary mt-1">${explanation(q.feedback)}</p>` : ''}
          </div>`).join('')}
        </div>
      </div>` : ''}
      <div class="mt-space-xl pt-space-lg border-t border-border-subtle flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
        ${passed && next
          ? `<a href="lektion.html?id=${encodeURIComponent(next.id)}" class="${btnPrimary}"><span>Nästa: ${nextMeta.label}</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span></a>`
          : ''}
        <button id="done-retake" type="button" class="${passed && next ? btnSecondary : btnPrimary}"><span class="material-symbols-outlined text-[18px]">replay</span><span>Gör om quizet</span></button>
        ${passed ? '' : `<button id="done-reread" type="button" class="${btnSecondary}"><span class="material-symbols-outlined text-[18px]">menu_book</span><span>Läs lektionen igen</span></button>`}
        <a href="oversikt.html" class="${btnSecondary}">Till översikten</a>
      </div>
      ${passed && !next ? '<p class="text-center font-body-regular text-body-regular text-text-secondary mt-space-md">Du har klarat alla öppna lektioner – fler är under utveckling!</p>' : ''}`;
    toTop();
    document.getElementById('done-retake').addEventListener('click', () => { resetQuiz(); renderQuiz(); });
    document.getElementById('done-reread')?.addEventListener('click', () => { stepIndex = 0; renderStep(); });
  }

  if (existingProgress?.status === 'in_progress' && existingProgress.current_step >= steps.length) {
    renderQuiz();
  } else {
    renderStep();
  }
}

// ---------------------------------------------------------------------
// Kurser page: every lesson, grouped by category, with real progress
// ---------------------------------------------------------------------
function lessonStatusBadge(status) {
  if (status === 'completed') return { icon: 'check_circle', label: 'Klar', cls: 'text-positive-spruce' };
  if (status === 'in_progress') return { icon: 'radio_button_unchecked', label: 'Pågår', cls: 'text-primary' };
  return { icon: 'radio_button_unchecked', label: '', cls: 'text-text-tertiary' };
}

function initCoursesPage(ctx) {
  const { lessons, progress } = ctx;
  const progressByLesson = new Map(progress.map(p => [p.lesson_id, p]));
  const root = document.getElementById('courses-root');

  const byCategory = {};
  for (const l of lessons) (byCategory[l.category] ||= []).push(l);
  for (const cat in byCategory) byCategory[cat].sort((a, b) => a.order_index - b.order_index);

  // Open categories first, paused ones last
  const categoryKeys = Object.keys(CATEGORY_META).filter(k => (byCategory[k] || []).length)
    .sort((a, b) => PAUSED_CATEGORIES.has(a) - PAUSED_CATEGORIES.has(b));

  const openLessons = lessons.filter(l => isLessonOpen(l, lessons));
  const openCompleted = openLessons.filter(l => progressByLesson.get(l.id)?.status === 'completed').length;
  const underDev = '<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-subdued text-text-tertiary text-[11px] font-semibold uppercase tracking-wide">Under utveckling</span>';

  const chipBase = 'filter-chip px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-all shadow-sm';
  const chipIdle = `${chipBase} bg-surface-card text-text-secondary hover:bg-surface-subdued`;
  const chipActive = `${chipBase} bg-primary-deep text-on-primary`;
  const filterBar = `
    <div class="flex flex-wrap gap-2 mb-space-xl" id="courses-filter">
      <button data-filter="alla" class="${chipActive}">Alla ämnen</button>
      ${categoryKeys.map(key => `<button data-filter="${key}" class="${chipIdle}">${CATEGORY_META[key].label}</button>`).join('')}
    </div>`;

  const sections = categoryKeys.map(key => {
    const meta = CATEGORY_META[key];
    const paused = PAUSED_CATEGORIES.has(key);
    return `
      <section class="course-section mb-12" data-category="${key}">
        <div class="flex items-center gap-3 mb-space-md">
          <div class="w-10 h-10 rounded-xl ${meta.iconBg} ${meta.iconColor} flex items-center justify-center">
            <span class="material-symbols-outlined text-[22px]">${meta.icon}</span>
          </div>
          <h2 class="font-headline-2 text-headline-2 text-text-primary">${meta.label}</h2>
          ${paused ? underDev : ''}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${byCategory[key].map(l => {
            if (!isLessonOpen(l, lessons)) {
              return `
            <div class="flex items-center justify-between gap-3 bg-surface-card rounded-xl p-space-md opacity-60" title="Under utveckling">
              <div class="flex items-center gap-3 min-w-0">
                <span class="material-symbols-outlined text-[22px] text-text-tertiary">lock</span>
                <div class="flex flex-col min-w-0">
                  <span class="font-label-md text-label-md text-text-secondary truncate">${l.title}</span>
                  <span class="font-caption-micro text-caption-micro text-text-tertiary">Under utveckling</span>
                </div>
              </div>
            </div>`;
            }
            const badge = lessonStatusBadge(progressByLesson.get(l.id)?.status);
            return `
            <a href="lektion.html?id=${encodeURIComponent(l.id)}" class="flex items-center justify-between gap-3 bg-surface-card rounded-xl p-space-md shadow-sm hover:shadow-md transition-all">
              <div class="flex items-center gap-3 min-w-0">
                <span class="material-symbols-outlined text-[22px] ${badge.cls}">${badge.icon}</span>
                <div class="flex flex-col min-w-0">
                  <span class="font-label-md text-label-md text-text-primary truncate">${l.title}</span>
                  <span class="font-caption-micro text-caption-micro text-text-tertiary">${l.estimated_minutes} min · ${l.xp_reward} XP${badge.label ? ' · ' + badge.label : ''}</span>
                </div>
              </div>
              <span class="material-symbols-outlined text-[18px] text-primary-container shrink-0">chevron_right</span>
            </a>`;
          }).join('')}
        </div>
      </section>`;
  }).join('');

  root.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
      <div>
        <span class="font-label-md text-label-md text-primary-deep uppercase tracking-wider">Kurser</span>
        <h1 class="font-display-xl text-display-xl text-text-primary tracking-tight mt-2">Lär dig ekonomi</h1>
        <p class="font-body-medium text-body-medium text-text-secondary mt-2 max-w-2xl">Första lektionen i varje ämne är öppen. Fler lektioner är under utveckling.</p>
      </div>
      <div class="flex items-center gap-2 bg-surface-card px-4 py-2.5 rounded-xl shadow-sm shrink-0">
        <span class="material-symbols-outlined text-positive-spruce text-[20px]">task_alt</span>
        <span class="font-label-md text-label-md text-text-primary">${openCompleted} av ${openLessons.length} lektioner klara</span>
      </div>
    </div>
    ${filterBar}
    <div id="courses-sections">${sections}</div>`;

  document.querySelectorAll('#courses-filter .filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      document.querySelectorAll('#courses-filter .filter-chip').forEach(b => { b.className = chipIdle; });
      btn.className = chipActive;
      document.querySelectorAll('.course-section').forEach(sec => {
        sec.hidden = !(filter === 'alla' || sec.dataset.category === filter);
      });
    });
  });
}

// ---------------------------------------------------------------------
// Min resa: progress summary per category + full completed-lesson log
// ---------------------------------------------------------------------
function initJourneyPage(ctx) {
  const { lessons, progress, profile } = ctx;
  const root = document.getElementById('journey-root');
  if (!root) return;
  const progressByLesson = new Map(progress.map(p => [p.lesson_id, p]));
  const byCategory = {};
  for (const l of lessons) (byCategory[l.category] ||= []).push(l);

  const completedList = progress
    .filter(p => p.status === 'completed')
    .map(p => ({ p, lesson: lessons.find(l => l.id === p.lesson_id) }))
    .filter(x => x.lesson)
    .sort((a, b) => new Date(b.p.completed_at || b.p.updated_at) - new Date(a.p.completed_at || a.p.updated_at));

  const catCards = Object.entries(CATEGORY_META).map(([key, meta]) => {
    const catLessons = byCategory[key] || [];
    const done = catLessons.filter(l => progressByLesson.get(l.id)?.status === 'completed').length;
    const pct = catLessons.length ? Math.round((done / catLessons.length) * 100) : 0;
    return `
      <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-xl ${meta.iconBg} ${meta.iconColor} flex items-center justify-center"><span class="material-symbols-outlined text-[20px]">${meta.icon}</span></div>
          <h3 class="font-headline-3 text-headline-3 text-text-primary">${meta.label}</h3>
        </div>
        <div class="flex justify-between text-caption-micro font-caption-micro text-text-tertiary mb-1.5">
          <span>${done} av ${catLessons.length}</span><span class="font-medium text-text-primary">${pct}%</span>
        </div>
        <div class="w-full h-1.5 bg-surface-subdued rounded-full overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');

  root.innerHTML = `
    <h1 class="font-headline-1 text-headline-1 text-text-primary tracking-tight mb-2">Min resa</h1>
    <p class="font-body-regular text-body-regular text-text-secondary mb-space-lg">${profile.xp.toLocaleString('sv-SE')} XP samlat · ${profile.streak_days} dagars streak</p>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md mb-space-xl">${catCards}</div>
    <h2 class="font-headline-2 text-headline-2 text-text-primary mb-space-md">Avklarade lektioner</h2>
    ${completedList.length ? `<div class="flex flex-col gap-2">${completedList.map(({ p, lesson }) => `
      <a href="lektion.html?id=${encodeURIComponent(lesson.id)}" class="flex items-center justify-between gap-3 bg-surface-card rounded-xl p-space-md shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-[20px] text-positive-spruce">check_circle</span>
          <span class="font-label-md text-label-md text-text-primary">${lesson.title}</span>
        </div>
        <span class="font-caption-micro text-caption-micro text-text-tertiary">Quiz: ${p.quiz_score ?? '–'}%</span>
      </a>`).join('')}</div>` : `<p class="font-body-regular text-body-regular text-text-secondary">Du har inte slutfört någon lektion än. <a class="text-primary underline" href="kurser.html">Börja här →</a></p>`}
  `;
}

// ---------------------------------------------------------------------
// Profil page: real account info + sign out
// ---------------------------------------------------------------------
const SV_MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
function swedishMonthYear(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${SV_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function computeBadges(ctx, readCount) {
  const { profile, lessons, progress } = ctx;
  const completed = progress.filter(p => p.status === 'completed');
  const perfect = progress.some(p => p.quiz_score === 100);
  const byCategory = {};
  for (const l of lessons) (byCategory[l.category] ||= []).push(l);
  const progressByLesson = new Map(progress.map(p => [p.lesson_id, p]));
  const mastered = Object.entries(CATEGORY_META).find(([key]) => {
    const catLessons = byCategory[key] || [];
    return catLessons.length > 0 && catLessons.every(l => progressByLesson.get(l.id)?.status === 'completed');
  });
  const totalLessons = lessons.length;
  const halfGoal = Math.max(1, Math.ceil(totalLessons / 2));

  return [
    { icon: '🎯', bg: 'bg-indigo-50', color: 'text-indigo-600', title: 'Första lektionen', desc: 'Slutförde din första lektion och tog första steget mot ekonomisk koll.', unlocked: completed.length >= 1, progressText: `${Math.min(completed.length, 1)} / 1 lektion` },
    { icon: '🏆', bg: 'bg-amber-50', color: 'text-amber-600', title: 'Perfekt poäng', desc: 'Fick 100% rätt på ett quiz utan ledtrådar.', unlocked: perfect, progressText: perfect ? null : 'Klara ett quiz med 100%' },
    { icon: '⚡', bg: 'bg-blue-50', color: 'text-blue-600', title: 'Kunskapstörst', desc: 'Läste minst 5 artiklar om sparande, fonder och privatekonomi.', unlocked: readCount >= 5, progressText: `${Math.min(readCount, 5)} / 5 artiklar` },
    { icon: '🔥', bg: 'bg-[#FEF3C7]', color: 'text-[#D97706]', title: 'Vecko-streak', desc: 'Höll igång en aktiv streak i 7 dagar.', unlocked: (profile.best_streak_days || 0) >= 7, progressText: `${Math.min(profile.best_streak_days || 0, 7)} / 7 dagar` },
    { icon: '📈', bg: 'bg-emerald-50', color: 'text-emerald-600', title: 'Halvvägs', desc: 'Slutförde minst hälften av alla lektioner på UngEkonom.', unlocked: completed.length >= halfGoal, progressText: `${Math.min(completed.length, halfGoal)} / ${halfGoal} lektioner` },
    { icon: '👑', bg: 'bg-primary-tint', color: 'text-primary-deep', title: 'Ämnesmästare', desc: mastered ? `Klarade alla lektioner inom ${CATEGORY_META[mastered[0]].label}.` : 'Klara alla lektioner inom ett ämne.', unlocked: !!mastered, progressText: mastered ? null : 'Slutför alla lektioner i ett ämne' },
  ];
}

function computeWeeklyActivity(ctx, readArticles) {
  const dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, count: 0 });
  }
  const events = [
    ...ctx.progress.filter(p => p.status === 'completed').map(p => p.completed_at || p.updated_at),
    ...readArticles.map(r => r.read_at),
  ];
  events.forEach(dateStr => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const bucket = buckets.find(b => b.date.getTime() === d.getTime());
    if (bucket) bucket.count++;
  });
  const max = Math.max(1, ...buckets.map(b => b.count));
  return buckets.map((b, i) => ({
    label: i === 6 ? 'Idag' : dayNames[b.date.getDay()],
    count: b.count,
    pct: b.count ? Math.max(12, Math.round((b.count / max) * 100)) : 4,
    isToday: i === 6,
  }));
}

async function initProfilePage(ctx) {
  const { user, profile, lessons, progress } = ctx;
  const root = document.getElementById('profile-root');
  if (!root) return;
  const { level, title, next, xpToNext, levelProgressPct } = levelFromXp(profile.xp);
  const completedList = progress
    .filter(p => p.status === 'completed')
    .map(p => ({ ...p, lesson: lessons.find(l => l.id === p.lesson_id) }))
    .filter(x => x.lesson);
  const completed = completedList.length;
  const totalLessons = lessons.length;
  const scored = progress.filter(p => p.quiz_score !== null && p.quiz_score !== undefined);
  const avgQuizScore = scored.length ? Math.round(scored.reduce((s, p) => s + p.quiz_score, 0) / scored.length) : null;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const completedThisWeek = completedList.filter(x => new Date(x.completed_at || x.updated_at) >= weekAgo).length;

  const [{ data: articleReads }, { data: allArticles }, { data: savedRows }] = await Promise.all([
    sb.from('user_article_reads').select('article_id, read_at').eq('user_id', user.id),
    sb.from('articles').select('id, title, category, read_minutes').order('order_index'),
    sb.from('user_saved_articles').select('article_id, saved_at').eq('user_id', user.id),
  ]);
  const readArticles = (articleReads || [])
    .map(r => ({ ...r, article: (allArticles || []).find(a => a.id === r.article_id) }))
    .filter(x => x.article);
  const readMinutesTotal = readArticles.reduce((s, x) => s + (x.article.read_minutes || 0), 0);
  const savedArticles = (savedRows || [])
    .map(r => ({ ...r, article: (allArticles || []).find(a => a.id === r.article_id) }))
    .filter(x => x.article)
    .sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));

  const byCategory = {};
  for (const l of lessons) (byCategory[l.category] ||= []).push(l);
  const progressByLesson = new Map(progress.map(p => [p.lesson_id, p]));
  const categoryCards = Object.entries(CATEGORY_META).map(([key, meta]) => {
    const catLessons = byCategory[key] || [];
    if (!catLessons.length) return '';
    const done = catLessons.filter(l => progressByLesson.get(l.id)?.status === 'completed').length;
    const pct = Math.round((done / catLessons.length) * 100);
    return `
      <div class="bg-surface-subdued rounded-xl p-space-md">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg ${meta.iconBg} ${meta.iconColor} flex items-center justify-center"><span class="material-symbols-outlined text-[16px]">${meta.icon}</span></div>
          <span class="font-label-md text-label-md text-text-primary">${meta.label}</span>
        </div>
        <div class="flex justify-between text-caption-micro font-caption-micro text-text-tertiary mb-1">
          <span>${done} av ${catLessons.length}</span><span class="font-medium text-text-primary">${pct}%</span>
        </div>
        <div class="w-full h-1.5 bg-border-subtle rounded-full overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');

  const badges = computeBadges(ctx, readArticles.length);
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const badgesHtml = badges.map(b => `
    <div class="relative bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-all ${b.unlocked ? '' : 'opacity-70'}">
      <div class="flex items-start gap-space-md">
        <div class="w-12 h-12 rounded-2xl ${b.unlocked ? b.bg : 'bg-surface-subdued'} ${b.unlocked ? b.color : 'text-text-tertiary'} flex items-center justify-center text-2xl shadow-sm shrink-0">${b.unlocked ? b.icon : '🔒'}</div>
        <div class="flex flex-col">
          <h3 class="font-headline-3 text-headline-3 text-text-primary">${b.title}</h3>
          <p class="font-body-regular text-body-regular text-text-secondary text-sm mt-0.5">${b.desc}</p>
        </div>
      </div>
      <div class="mt-space-md pt-space-sm flex items-center justify-between">
        ${b.unlocked
          ? `<span class="inline-flex items-center gap-1 font-caption-micro text-caption-micro text-positive-spruce font-semibold"><span class="material-symbols-outlined text-[16px]">check_circle</span> Upplåst</span>`
          : `<span class="font-caption-micro text-caption-micro text-text-tertiary">${b.progressText}</span>`}
      </div>
    </div>`).join('');

  // Pågående kurser & nästa steg: prefer in-progress, then not-started
  const inProgress = lessons
    .map(l => ({ lesson: l, p: progressByLesson.get(l.id) }))
    .filter(x => x.p && x.p.status === 'in_progress')
    .sort((a, b) => new Date(b.p.updated_at) - new Date(a.p.updated_at));
  const notStarted = lessons
    .map(l => ({ lesson: l, p: progressByLesson.get(l.id) }))
    .filter(x => !x.p || x.p.status === 'not_started');
  const nextSteps = [...inProgress, ...notStarted].slice(0, 2);
  const nextStepsHtml = nextSteps.map(({ lesson, p }) => {
    const meta = CATEGORY_META[lesson.category] || CATEGORY_META.aktier;
    const steps = lesson.content?.steps?.length || 1;
    const pct = p ? Math.round(((p.current_step || 0) / steps) * 100) : 0;
    return `
      <a href="lektion.html?id=${encodeURIComponent(lesson.id)}" class="bg-surface-card rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-space-sm">
        <div class="flex items-center gap-space-xs">
          <span class="${meta.iconBg} ${meta.iconColor} font-caption-micro text-caption-micro px-2 py-0.5 rounded-full font-medium">${meta.label}</span>
          <span class="text-text-tertiary text-caption-micro font-caption-micro">• ${lesson.estimated_minutes} min</span>
        </div>
        <h3 class="font-headline-3 text-headline-3 text-text-primary truncate">${lesson.title}</h3>
        <p class="font-body-regular text-body-regular text-text-secondary text-sm line-clamp-1">${lesson.description}</p>
        <div class="mt-1 flex items-center justify-between gap-space-md">
          <div class="flex-1"><div class="w-full h-1.5 bg-surface-subdued rounded-full overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:${pct}%"></div></div></div>
          <span class="inline-flex items-center gap-1 px-space-md py-1.5 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md shrink-0"><span>${p ? 'Fortsätt' : 'Starta'}</span><span class="material-symbols-outlined text-[16px]">play_arrow</span></span>
        </div>
      </a>`;
  }).join('');

  const weekly = computeWeeklyActivity(ctx, readArticles);
  const weeklyHtml = weekly.map(d => `
    <div class="flex flex-col items-center gap-2">
      <div class="w-full h-28 bg-surface-subdued rounded-xl flex items-end p-1 ${d.isToday ? 'ring-2 ring-primary-container' : ''}">
        <div class="w-full ${d.count ? 'bg-primary-container' : 'bg-surface-container'} rounded-lg transition-all" style="height:${d.pct}%"></div>
      </div>
      <span class="font-caption-micro text-caption-micro ${d.isToday ? 'text-primary-deep font-semibold' : 'text-text-secondary'}">${d.label}</span>
      <span class="font-caption-micro text-caption-micro text-text-tertiary">${d.count}</span>
    </div>`).join('');

  const savedHtml = savedArticles.length ? savedArticles.map(x => `
    <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="bg-primary-tint text-primary-deep font-caption-micro text-caption-micro px-2.5 py-0.5 rounded-full font-medium">${ARTICLE_CATEGORY_LABELS[x.article.category] || x.article.category}</span>
          <button data-remove-saved="${x.article.id}" class="text-primary-container hover:text-critical-danger transition-colors p-1" title="Ta bort bokmärke" type="button">
            <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' 1;">bookmark</span>
          </button>
        </div>
        <h3 class="font-headline-3 text-headline-3 text-text-primary mb-1">${x.article.title}</h3>
      </div>
      <div class="mt-4 pt-3 flex items-center justify-between font-caption-micro text-caption-micro text-text-tertiary">
        <span>${x.article.read_minutes} min lästid</span>
        <a class="font-label-md text-label-md text-primary-container hover:underline" href="stitch-preview-artikel.html?id=${encodeURIComponent(x.article.id)}">Läs artikel →</a>
      </div>
    </div>`).join('') : `<p class="font-body-regular text-body-regular text-text-secondary col-span-full">Inga sparade artiklar än. <a class="text-primary underline" href="stitch-preview-artiklar.html">Bläddra bland artiklar →</a></p>`;

  root.innerHTML = `
    <section class="relative bg-surface-card rounded-2xl shadow-sm p-space-xl mb-space-lg overflow-hidden">
      <div class="absolute -right-16 -top-16 w-80 h-80 bg-primary-tint rounded-full filter blur-3xl opacity-70 pointer-events-none"></div>
      <div class="absolute right-40 -bottom-20 w-64 h-64 bg-positive-wash rounded-full filter blur-2xl opacity-60 pointer-events-none"></div>
      <div class="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg">
        <div class="flex items-center gap-space-lg">
          <div class="relative shrink-0">
            <div class="w-24 h-24 rounded-2xl overflow-hidden shadow-sm bg-primary-tint text-primary-deep flex items-center justify-center font-headline-1 text-headline-1">${initialsFromName(profile.display_name)}</div>
            <div class="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-surface-card flex items-center justify-center shadow-sm"><span class="w-3.5 h-3.5 rounded-full bg-positive-spruce"></span></div>
          </div>
          <div class="flex flex-col min-w-0">
            <div class="flex flex-wrap items-center gap-space-sm mb-1">
              <h1 class="font-headline-1 text-headline-1 text-text-primary tracking-tight truncate">${profile.display_name}</h1>
            </div>
            <p class="font-body-regular text-body-regular text-text-secondary mb-3 truncate">${user.email} • Medlem sedan ${swedishMonthYear(profile.created_at)}</p>
            <div class="flex flex-col sm:flex-row sm:items-center gap-space-sm">
              <div class="inline-flex items-center gap-1.5 bg-surface-subdued text-text-primary px-3 py-1 rounded-xl">
                <span class="material-symbols-outlined text-primary-container text-[18px]">verified</span>
                <span class="font-label-md text-label-md">Nivå ${level}: ${title}</span>
              </div>
              <div class="flex items-center gap-space-sm min-w-[220px]">
                <div class="w-36 h-2 bg-surface-subdued rounded-full overflow-hidden"><div class="h-full bg-primary-container rounded-full transition-all duration-700" style="width:${levelProgressPct}%"></div></div>
                <span class="font-caption-micro text-caption-micro text-text-tertiary font-semibold">${next ? `${xpToNext} XP till nästa nivå` : 'Högsta nivå'}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-space-sm self-stretch md:self-auto justify-end">
          <button id="share-profile-btn" class="flex-1 md:flex-initial inline-flex items-center justify-center gap-space-xs px-space-lg py-2.5 rounded-xl bg-surface-subdued text-text-primary hover:bg-border-subtle transition-all font-label-md text-label-md" type="button">
            <span class="material-symbols-outlined text-[18px]">share</span><span>Dela profil</span>
          </button>
          <button id="edit-profile-btn" class="flex-1 md:flex-initial inline-flex items-center justify-center gap-space-xs px-space-lg py-2.5 rounded-xl bg-primary-container text-on-primary hover:bg-primary-deep shadow-sm transition-all font-label-md text-label-md" type="button">
            <span class="material-symbols-outlined text-[18px]">edit</span><span>Redigera profil</span>
          </button>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-xl">
      <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-space-sm">
          <span class="font-label-md text-label-md text-text-secondary">Lektioner klara</span>
          <div class="w-9 h-9 rounded-xl bg-primary-tint flex items-center justify-center text-primary-deep"><span class="material-symbols-outlined text-[20px]">menu_book</span></div>
        </div>
        <div>
          <div class="flex items-baseline gap-space-xs"><span class="font-display-xl text-display-xl text-text-primary tracking-tight">${completed}<span class="text-text-tertiary text-[20px] font-normal"> / ${totalLessons}</span></span></div>
          <div class="mt-2 flex items-center justify-between font-caption-micro text-caption-micro text-text-tertiary">
            <span>${totalLessons ? Math.round((completed / totalLessons) * 100) : 0}% av läroplan</span>
            <span class="text-positive-spruce font-semibold">+${completedThisWeek} denna vecka</span>
          </div>
          <div class="w-full h-1.5 bg-surface-subdued rounded-full mt-2 overflow-hidden"><div class="h-full bg-primary-container rounded-full" style="width:${totalLessons ? Math.round((completed / totalLessons) * 100) : 0}%"></div></div>
        </div>
      </div>
      <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-space-sm">
          <span class="font-label-md text-label-md text-text-secondary">Genomförda quiz</span>
          <div class="w-9 h-9 rounded-xl bg-positive-wash flex items-center justify-center text-positive-spruce"><span class="material-symbols-outlined text-[20px]">task_alt</span></div>
        </div>
        <div>
          <div class="flex items-baseline gap-space-xs"><span class="font-display-xl text-display-xl text-text-primary tracking-tight">${scored.length}</span><span class="font-label-md text-label-md text-text-secondary">st</span></div>
          <div class="mt-2 flex items-center justify-between font-caption-micro text-caption-micro text-text-tertiary">
            <span>Träffsäkerhet</span><span class="text-positive-spruce font-semibold">${avgQuizScore === null ? '–' : `${avgQuizScore}% snitt`}</span>
          </div>
          <div class="w-full h-1.5 bg-surface-subdued rounded-full mt-2 overflow-hidden"><div class="h-full bg-positive-spruce rounded-full" style="width:${avgQuizScore || 0}%"></div></div>
        </div>
      </div>
      <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-space-sm">
          <span class="font-label-md text-label-md text-text-secondary">Artiklar lästa</span>
          <div class="w-9 h-9 rounded-xl bg-surface-subdued flex items-center justify-center text-text-primary"><span class="material-symbols-outlined text-[20px]">newspaper</span></div>
        </div>
        <div>
          <div class="flex items-baseline gap-space-xs"><span class="font-display-xl text-display-xl text-text-primary tracking-tight">${readArticles.length}</span><span class="font-label-md text-label-md text-text-secondary">st</span></div>
          <div class="mt-2 flex items-center justify-between font-caption-micro text-caption-micro text-text-tertiary">
            <span>Motsvarar ~${(readMinutesTotal / 60).toFixed(1)} tim</span><span class="text-text-secondary font-semibold">${savedArticles.length} sparade</span>
          </div>
          <div class="w-full h-1.5 bg-surface-subdued rounded-full mt-2 overflow-hidden"><div class="h-full bg-text-primary rounded-full" style="width:${Math.min(100, readArticles.length * 15)}%"></div></div>
        </div>
      </div>
      <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-space-sm">
          <span class="font-label-md text-label-md text-text-secondary">Aktiv streak</span>
          <div class="w-9 h-9 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#D97706]"><span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">local_fire_department</span></div>
        </div>
        <div>
          <div class="flex items-baseline gap-space-xs"><span class="font-display-xl text-display-xl text-text-primary tracking-tight">${profile.streak_days}</span><span class="font-label-md text-label-md text-text-secondary">dagar</span></div>
          <div class="mt-2 flex items-center justify-between font-caption-micro text-caption-micro text-text-tertiary">
            <span>Personbästa: ${profile.best_streak_days || profile.streak_days} dagar</span><span class="text-[#D97706] font-semibold">${profile.streak_days > 0 ? 'Aktiv idag 🔥' : 'Ingen streak'}</span>
          </div>
          <div class="w-full h-1.5 bg-surface-subdued rounded-full mt-2 overflow-hidden"><div class="h-full bg-[#D97706] rounded-full" style="width:${profile.best_streak_days ? Math.round((profile.streak_days / profile.best_streak_days) * 100) : 0}%"></div></div>
        </div>
      </div>
    </section>

    <div class="flex items-center gap-space-xs bg-surface-card p-1.5 rounded-2xl shadow-sm mb-space-xl overflow-x-auto">
      <button class="tab-btn active inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-xl font-label-md text-label-md bg-primary-tint text-primary-deep transition-all" data-tab="tab-overview" type="button"><span class="material-symbols-outlined text-[18px]">verified</span><span>Översikt &amp; Prestationer</span></button>
      <button class="tab-btn inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-xl font-label-md text-label-md text-text-secondary hover:text-text-primary hover:bg-surface-subdued transition-all" data-tab="tab-saved" type="button"><span class="material-symbols-outlined text-[18px]">bookmark</span><span>Sparade artiklar <span class="bg-surface-subdued text-text-secondary px-2 py-0.5 rounded-full text-caption-micro">${savedArticles.length}</span></span></button>
      <button class="tab-btn inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-xl font-label-md text-label-md text-text-secondary hover:text-text-primary hover:bg-surface-subdued transition-all" data-tab="tab-settings" type="button"><span class="material-symbols-outlined text-[18px]">tune</span><span>Kontoinställningar</span></button>
    </div>

    <div class="flex flex-col gap-space-xl" id="tab-overview">
      <div class="flex flex-col">
        <div class="flex items-center justify-between mb-space-md">
          <div><h2 class="font-headline-2 text-headline-2 text-text-primary tracking-tight">Utmärkelser &amp; Badges</h2><p class="font-body-regular text-body-regular text-text-secondary">Dina milstolpar och bevis på finansiellt kunnande</p></div>
          <span class="bg-positive-wash text-positive-spruce font-label-md text-label-md px-3 py-1 rounded-full">${unlockedCount} av ${badges.length} upplåsta</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">${badgesHtml}</div>
      </div>

      ${nextSteps.length ? `
      <div class="flex flex-col">
        <div class="flex items-center justify-between mb-space-md">
          <div><h2 class="font-headline-2 text-headline-2 text-text-primary tracking-tight">Pågående kurser &amp; Nästa steg</h2><p class="font-body-regular text-body-regular text-text-secondary">Fortsätt där du slutade senast för att behålla din streak</p></div>
          <a class="hidden sm:inline-flex items-center gap-space-xs font-label-md text-label-md text-primary-container hover:text-primary-deep" href="kurser.html"><span>Se alla kurser</span><span class="material-symbols-outlined text-[18px]">chevron_right</span></a>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-space-md">${nextStepsHtml}</div>
      </div>` : ''}

      <div class="bg-surface-card rounded-2xl p-space-xl shadow-sm">
        <h2 class="font-headline-3 text-headline-3 text-text-primary mb-space-md">Framsteg per ämne</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">${categoryCards}</div>
      </div>

      <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm mb-space-lg">
          <div><h3 class="font-headline-3 text-headline-3 text-text-primary">Aktivitet per veckodag</h3><p class="font-body-regular text-body-regular text-text-secondary">Lektioner och artiklar du klarat av de senaste 7 dagarna</p></div>
        </div>
        <div class="grid grid-cols-7 gap-space-sm pt-2">${weeklyHtml}</div>
      </div>
    </div>

    <div class="hidden flex-col gap-space-md" id="tab-saved">
      <div class="flex items-center justify-between mb-space-xs">
        <div><h2 class="font-headline-2 text-headline-2 text-text-primary tracking-tight">Sparade artiklar &amp; guider</h2><p class="font-body-regular text-body-regular text-text-secondary">Artiklar du har bokmärkt för fördjupad läsning</p></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md" id="saved-articles-grid">${savedHtml}</div>
    </div>

    <div class="hidden flex-col gap-space-lg" id="tab-settings">
      <div><h2 class="font-headline-2 text-headline-2 text-text-primary tracking-tight">Kontoinställningar &amp; Preferenser</h2><p class="font-body-regular text-body-regular text-text-secondary">Hantera ditt namn, dagliga mål och konto</p></div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
        <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
          <h3 class="font-headline-3 text-headline-3 text-text-primary">Profil</h3>
          <div>
            <label class="block font-label-md text-label-md text-text-primary mb-1">Visningsnamn</label>
            <div class="flex gap-2">
              <input id="settings-display-name" class="flex-1 bg-surface-subdued px-3 py-2 rounded-xl font-body-regular text-body-regular text-text-primary outline-none focus:ring-2 focus:ring-primary-container" type="text" value="${profile.display_name}"/>
              <button id="save-display-name" class="px-space-md py-2 rounded-xl bg-primary-container text-on-primary hover:bg-primary-deep font-label-md text-label-md transition-all" type="button">Spara</button>
            </div>
          </div>
          <div>
            <label class="block font-label-md text-label-md text-text-primary mb-1">Dagligt lär-mål (minuter)</label>
            <div class="flex gap-2">
              <input id="settings-daily-goal" class="flex-1 bg-surface-subdued px-3 py-2 rounded-xl font-body-regular text-body-regular text-text-primary outline-none focus:ring-2 focus:ring-primary-container" type="number" min="5" max="120" step="5" value="${profile.daily_goal_minutes}"/>
              <button id="save-daily-goal" class="px-space-md py-2 rounded-xl bg-primary-container text-on-primary hover:bg-primary-deep font-label-md text-label-md transition-all" type="button">Spara</button>
            </div>
          </div>
          <p id="settings-saved-msg" class="font-caption-micro text-caption-micro text-positive-spruce hidden">Sparat!</p>
        </div>
        <div class="bg-surface-card rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
          <h3 class="font-headline-3 text-headline-3 text-text-primary">Konto</h3>
          <div>
            <label class="block font-label-md text-label-md text-text-primary mb-1">Registrerad e-post</label>
            <input class="w-full bg-surface-subdued px-3 py-2 rounded-xl font-body-regular text-body-regular text-text-primary outline-none" readonly type="email" value="${user.email}"/>
          </div>
          <div class="pt-2 flex items-center justify-between">
            <span class="text-caption-micro font-caption-micro text-text-tertiary">Medlem sedan ${swedishMonthYear(profile.created_at)}</span>
            <button id="signout-btn" class="font-label-md text-label-md text-critical-danger hover:underline" type="button">Logga ut</button>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('signout-btn').addEventListener('click', signOut);

  document.getElementById('edit-profile-btn').addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="tab-settings"]').click();
    document.getElementById('settings-display-name')?.focus();
  });
  document.getElementById('share-profile-btn').addEventListener('click', async (e) => {
    const text = `Jag är ${title} (Nivå ${level}) på UngEkonom med ${profile.xp.toLocaleString('sv-SE')} XP och ${completed} avklarade lektioner!`;
    try { await navigator.clipboard.writeText(text); } catch (err) { /* clipboard unavailable */ }
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span><span>Kopierat!</span>';
    setTimeout(() => { btn.innerHTML = original; }, 2000);
  });

  document.getElementById('save-display-name').addEventListener('click', async () => {
    const value = document.getElementById('settings-display-name').value.trim();
    if (!value) return;
    await sb.from('profiles').update({ display_name: value, updated_at: new Date().toISOString() }).eq('id', user.id);
    profile.display_name = value;
    renderSidebarChrome(profile);
    const msg = document.getElementById('settings-saved-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2000);
  });
  document.getElementById('save-daily-goal').addEventListener('click', async () => {
    const value = Number(document.getElementById('settings-daily-goal').value) || 15;
    await sb.from('profiles').update({ daily_goal_minutes: value, updated_at: new Date().toISOString() }).eq('id', user.id);
    profile.daily_goal_minutes = value;
    renderSidebarChrome(profile);
    const msg = document.getElementById('settings-saved-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2000);
  });

  document.querySelectorAll('#saved-articles-grid [data-remove-saved]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const articleId = btn.dataset.removeSaved;
      await sb.from('user_saved_articles').delete().eq('user_id', user.id).eq('article_id', articleId);
      initProfilePage(ctx);
    });
  });

  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = {
    'tab-overview': document.getElementById('tab-overview'),
    'tab-saved': document.getElementById('tab-saved'),
    'tab-settings': document.getElementById('tab-settings'),
  };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('bg-primary-tint', 'text-primary-deep'); t.classList.add('text-text-secondary'); });
      Object.values(tabContents).forEach(c => { if (c) { c.classList.add('hidden'); c.classList.remove('flex'); } });
      tab.classList.remove('text-text-secondary');
      tab.classList.add('bg-primary-tint', 'text-primary-deep');
      const target = tabContents[tab.dataset.tab];
      if (target) { target.classList.remove('hidden'); target.classList.add('flex'); }
    });
  });
}

// ---------------------------------------------------------------------
// Artiklar: listing + single-article reader
// ---------------------------------------------------------------------
const ARTICLE_CATEGORY_LABELS = { aktier: 'Aktier', fonder: 'Fonder', privatekonomi: 'Privatekonomi', vardering: 'Värdering', krypto: 'Krypto', ranta: 'Ränta på ränta', risker: 'Risker' };

async function initArticlesPage() {
  const root = document.getElementById('articles-root');
  const { data: articles, error } = await sb.from('articles').select('id, category, order_index, title, intro, read_minutes').order('order_index');
  if (error || !articles) {
    root.innerHTML = '<p class="font-body-regular text-body-regular text-text-secondary">Kunde inte ladda artiklarna.</p>';
    return;
  }
  root.innerHTML = `
    <h1 class="font-headline-1 text-headline-1 text-text-primary tracking-tight mb-1">Artiklar</h1>
    <p class="font-body-regular text-body-regular text-text-secondary mb-space-lg">Fördjupning kring aktier, fonder och sparande.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md">
      ${articles.map(a => `
        <a href="stitch-preview-artikel.html?id=${encodeURIComponent(a.id)}" class="bg-surface-card rounded-2xl p-space-lg shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col gap-2">
          <span class="self-start px-2.5 py-0.5 rounded-full bg-primary-tint text-primary-deep font-caption-micro text-caption-micro">${ARTICLE_CATEGORY_LABELS[a.category] || a.category}</span>
          <h3 class="font-headline-3 text-headline-3 text-text-primary">${a.title}</h3>
          <p class="font-body-regular text-[14px] text-text-secondary leading-relaxed line-clamp-3">${a.intro}</p>
          <span class="font-caption-micro text-caption-micro text-text-tertiary mt-2">${a.read_minutes} min läsning</span>
        </a>`).join('')}
    </div>`;
}

async function initArticleReaderPage(ctx) {
  const root = document.getElementById('article-root');
  const articleId = new URLSearchParams(location.search).get('id');
  if (!articleId) {
    root.innerHTML = '<p class="font-body-regular text-body-regular text-text-secondary">Ingen artikel vald. <a class="text-primary underline" href="stitch-preview-artiklar.html">Till artiklar →</a></p>';
    return;
  }
  const { data: article, error } = await sb.from('articles').select('*').eq('id', articleId).single();
  if (error || !article) {
    root.innerHTML = '<p class="font-body-regular text-body-regular text-text-secondary">Kunde inte hitta artikeln.</p>';
    return;
  }
  let isSaved = false;
  if (ctx?.user) {
    sb.from('user_article_reads').upsert({ user_id: ctx.user.id, article_id: articleId, read_at: new Date().toISOString() });
    const { data: savedRow } = await sb.from('user_saved_articles').select('article_id').eq('user_id', ctx.user.id).eq('article_id', articleId).maybeSingle();
    isSaved = !!savedRow;
  }
  const crumb = document.getElementById('article-crumb');
  if (crumb) crumb.textContent = article.title;
  root.innerHTML = `
    <div class="flex items-center justify-between gap-space-sm">
      <span class="px-2.5 py-0.5 rounded-full bg-primary-tint text-primary-deep font-caption-micro text-caption-micro">${ARTICLE_CATEGORY_LABELS[article.category] || article.category}</span>
      <button id="save-article-btn" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-md text-label-md transition-all ${isSaved ? 'bg-primary-tint text-primary-deep' : 'bg-surface-subdued text-text-secondary hover:text-text-primary'}" type="button">
        <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' ${isSaved ? 1 : 0};">bookmark</span>
        <span>${isSaved ? 'Sparad' : 'Spara artikel'}</span>
      </button>
    </div>
    <h1 class="font-headline-1 text-headline-1 text-text-primary mt-3 mb-2">${article.title}</h1>
    <p class="font-body-medium text-body-medium text-text-secondary mb-space-lg">${article.intro}</p>
    <div class="prose-lesson">${article.body}</div>
    <div class="mt-space-xl pt-space-lg border-t border-border-subtle">
      <a href="stitch-preview-artiklar.html" class="px-6 py-3 rounded-xl bg-surface-subdued hover:bg-surface-container text-text-primary font-label-md text-label-md transition-all inline-flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">arrow_back</span><span>Fler artiklar</span></a>
    </div>`;

  const saveBtn = document.getElementById('save-article-btn');
  if (saveBtn && ctx?.user) {
    saveBtn.addEventListener('click', async () => {
      isSaved = !isSaved;
      if (isSaved) await sb.from('user_saved_articles').upsert({ user_id: ctx.user.id, article_id: articleId, saved_at: new Date().toISOString() });
      else await sb.from('user_saved_articles').delete().eq('user_id', ctx.user.id).eq('article_id', articleId);
      saveBtn.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-label-md text-label-md transition-all ${isSaved ? 'bg-primary-tint text-primary-deep' : 'bg-surface-subdued text-text-secondary hover:text-text-primary'}`;
      saveBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' ${isSaved ? 1 : 0};">bookmark</span><span>${isSaved ? 'Sparad' : 'Spara artikel'}</span>`;
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-signout]').forEach(btn => btn.addEventListener('click', signOut));
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.href = 'auth.html';
    return;
  }
  const user = session.user;

  const [{ data: profile }, { data: lessons }, { data: progress }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).single(),
    sb.from('lessons').select('id, category, order_index, title, description, estimated_minutes, xp_reward').order('order_index'),
    sb.from('user_lesson_progress').select('lesson_id, status, current_step, quiz_score, updated_at, completed_at').eq('user_id', user.id),
  ]);

  const safeProfile = profile || { display_name: user.email?.split('@')[0] || 'Medlem', xp: 0, streak_days: 0, best_streak_days: 0, daily_goal_minutes: 15, minutes_today: 0, last_active_date: null, created_at: new Date().toISOString() };
  renderSidebarChrome(safeProfile);

  const ctx = { user, profile: safeProfile, lessons: lessons || [], progress: progress || [] };

  if (document.getElementById('dashboard-root')) renderDashboard(ctx);
  else if (document.getElementById('lesson-root')) initLessonPage(ctx);
  else if (document.getElementById('courses-root')) initCoursesPage(ctx);
  else if (document.getElementById('journey-root')) initJourneyPage(ctx);
  else if (document.getElementById('profile-root')) initProfilePage(ctx);
  else if (document.getElementById('articles-root')) initArticlesPage();
  else if (document.getElementById('article-root')) initArticleReaderPage(ctx);
});
