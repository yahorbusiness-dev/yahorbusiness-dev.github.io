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
  location.href = 'stitch-preview-lektion.html?id=' + encodeURIComponent(id);
};

// Legacy lesson content ("Du har klarat allt!") calls this to return home.
window.goHome = function () {
  location.href = 'index-stitch-preview.html';
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
  const progressByLesson = new Map(progress.map(p => [p.lesson_id, p]));

  const totalLessons = lessons.length;
  const completedLessons = progress.filter(p => p.status === 'completed').length;
  const pct = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const { level, xpToNext, next: nextLevel } = levelFromXp(profile.xp);

  const scored = progress.filter(p => p.quiz_score !== null && p.quiz_score !== undefined);
  const avgQuizScore = scored.length ? Math.round(scored.reduce((s, p) => s + p.quiz_score, 0) / scored.length) : null;

  const greetingName = document.getElementById('greeting-name');
  if (greetingName) greetingName.textContent = `God morgon, ${profile.display_name} 👋`;

  const journeyBadge = document.getElementById('journey-pct-badge');
  if (journeyBadge) journeyBadge.textContent = `${pct}% klart`;
  const journeyCenter = document.getElementById('journey-pct-center');
  if (journeyCenter) journeyCenter.textContent = `${pct}%`;
  const ring = document.getElementById('journey-donut-ring');
  if (ring) {
    const circumference = 251.2;
    ring.setAttribute('stroke-dashoffset', String(circumference * (1 - pct / 100)));
  }
  const journeyCount = document.getElementById('journey-count');
  if (journeyCount) journeyCount.textContent = `${completedLessons} av ${totalLessons}`;
  const journeyXpNext = document.getElementById('journey-xp-next');
  if (journeyXpNext) journeyXpNext.innerHTML = nextLevel
    ? `Nivå ${level} · ${xpToNext} XP kvar till <strong>Nivå ${nextLevel.level}: ${nextLevel.title}</strong>`
    : `Nivå ${level} · <strong>Högsta nivån uppnådd</strong>`;
  const journeyQuizScore = document.getElementById('journey-quiz-score');
  const journeyQuizLabel = document.getElementById('journey-quiz-label');
  if (journeyQuizScore) journeyQuizScore.textContent = avgQuizScore === null ? '–' : `${avgQuizScore}%`;
  if (journeyQuizLabel) journeyQuizLabel.textContent = avgQuizScore === null ? 'Gör ett quiz för att se resultat' : (avgQuizScore >= 80 ? 'Hög precision' : 'Fortsätt öva');
  const journeyXpTotal = document.getElementById('journey-xp-total');
  if (journeyXpTotal) journeyXpTotal.textContent = profile.xp.toLocaleString('sv-SE');

  // Continue card: prefer an in-progress lesson, else the first not-started lesson
  const inProgress = lessons
    .map(l => ({ lesson: l, p: progressByLesson.get(l.id) }))
    .filter(x => x.p && x.p.status === 'in_progress')
    .sort((a, b) => new Date(b.p.updated_at) - new Date(a.p.updated_at))[0];
  const nextUp = inProgress || lessons.map(l => ({ lesson: l, p: progressByLesson.get(l.id) })).find(x => !x.p || x.p.status === 'not_started');

  const continueTop = document.getElementById('continue-top');
  const continueSubtitle = document.getElementById('continue-subtitle');
  const continueCta = document.getElementById('continue-cta');
  if (nextUp && continueTop) {
    const meta = CATEGORY_META[nextUp.lesson.category] || CATEGORY_META.aktier;
    const isResume = !!inProgress;
    continueTop.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-full bg-primary-tint text-primary-deep font-label-md text-label-md uppercase tracking-wider">${meta.label}</span>
          <span class="inline-flex items-center text-text-tertiary font-caption-micro text-caption-micro">
            <span class="material-symbols-outlined text-[15px] mr-1">schedule</span> ~${nextUp.lesson.estimated_minutes} minuter
          </span>
        </div>
        <span class="font-label-md text-label-md text-text-tertiary">${isResume ? 'Fortsätt där du slutade' : 'Nästa lektion'}</span>
      </div>
      <div class="flex flex-col gap-2 max-w-xl">
        <h3 class="font-headline-1 text-headline-1 text-text-primary leading-tight">${nextUp.lesson.title}</h3>
        <p class="font-body-regular text-body-regular text-text-secondary">${nextUp.lesson.description}</p>
      </div>`;
    if (continueSubtitle) continueSubtitle.textContent = `Delkurs: ${meta.label}`;
    if (continueCta) {
      continueCta.href = `stitch-preview-lektion.html?id=${encodeURIComponent(nextUp.lesson.id)}`;
      continueCta.innerHTML = `<span>${isResume ? 'Fortsätt lära' : 'Starta lektion'}</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>`;
    }
  } else if (continueTop) {
    continueTop.innerHTML = `<p class="font-body-regular text-body-regular text-text-secondary">Alla lektioner klara – grymt jobbat! 🎉</p>`;
  }

  // Subject cards, one per category, computed from real lesson/progress data
  const grid = document.getElementById('subjects-grid');
  if (grid) {
    const byCategory = {};
    for (const l of lessons) {
      (byCategory[l.category] ||= []).push(l);
    }
    grid.innerHTML = Object.entries(CATEGORY_META).map(([key, meta]) => {
      const catLessons = byCategory[key] || [];
      const catCompleted = catLessons.filter(l => progressByLesson.get(l.id)?.status === 'completed').length;
      const catTotal = catLessons.length;
      const catPct = catTotal ? Math.round((catCompleted / catTotal) * 100) : 0;
      const done = catTotal > 0 && catCompleted === catTotal;
      const firstLesson = catLessons[0];
      const href = firstLesson ? `stitch-preview-lektion.html?id=${encodeURIComponent(firstLesson.id)}` : 'stitch-preview-kurser.html';
      return `
        <a href="${href}" class="bg-surface-card rounded-2xl p-space-lg shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer">
          <div class="flex flex-col gap-space-md">
            <div class="flex items-center justify-between">
              <div class="w-11 h-11 rounded-xl ${meta.iconBg} ${meta.iconColor} flex items-center justify-center">
                <span class="material-symbols-outlined text-[24px]">${meta.icon}</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-full ${done ? 'bg-positive-wash text-secondary' : 'bg-surface-subdued text-text-secondary'} font-caption-micro text-caption-micro flex items-center gap-1">
                ${done ? '<span class="material-symbols-outlined text-[14px]">check</span> Avklarad' : `${catTotal} lektioner`}
              </span>
            </div>
            <div class="flex flex-col gap-1">
              <h3 class="font-headline-3 text-headline-3 text-text-primary group-hover:text-primary-deep transition-colors">${meta.label}</h3>
              <p class="font-body-regular text-[14px] leading-relaxed text-text-secondary">${meta.desc}</p>
            </div>
          </div>
          <div class="mt-6 flex flex-col gap-1.5">
            <div class="flex justify-between text-caption-micro font-caption-micro text-text-tertiary">
              <span>${catTotal ? `${catCompleted} av ${catTotal} lektioner` : 'Kommer snart'}</span>
              <span class="font-medium ${done ? 'text-positive-spruce' : 'text-text-primary'}">${catPct}%</span>
            </div>
            <div class="w-full h-1.5 bg-surface-subdued rounded-full overflow-hidden">
              <div class="h-full ${done ? 'bg-positive-spruce' : 'bg-primary-container'} rounded-full" style="width:${catPct}%"></div>
            </div>
          </div>
        </a>`;
    }).join('');
  }

  const articlesGrid = document.getElementById('dashboard-articles-grid');
  if (articlesGrid) {
    sb.from('articles').select('id, category, title, intro, read_minutes').order('order_index').limit(3).then(({ data: articles }) => {
      if (!articles || !articles.length) return;
      articlesGrid.innerHTML = articles.map(a => `
        <a href="stitch-preview-artikel.html?id=${encodeURIComponent(a.id)}" class="bg-surface-card rounded-2xl p-space-lg shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col gap-2 group">
          <span class="self-start px-2.5 py-1 rounded-full bg-primary-tint text-primary-deep font-label-md text-label-md">${ARTICLE_CATEGORY_LABELS[a.category] || a.category}</span>
          <h3 class="font-headline-3 text-headline-3 text-text-primary group-hover:text-primary-deep transition-colors leading-snug mt-2">${a.title}</h3>
          <p class="font-body-regular text-[14px] leading-relaxed text-text-secondary line-clamp-2">${a.intro}</p>
          <div class="flex items-center text-primary-deep font-label-md text-label-md gap-1 pt-2">
            <span>Läs artikel</span>
            <span class="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </div>
        </a>`).join('');
    });
  }
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
    root.innerHTML = '<p class="font-body-regular text-body-regular text-text-secondary">Ingen lektion vald. <a class="text-primary underline" href="stitch-preview-kurser.html">Gå till kurser →</a></p>';
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

  // Previous/next lesson within the same category, ordered by order_index
  const sameCategory = lessons.filter(l => l.category === lesson.category).sort((a, b) => a.order_index - b.order_index);
  const posInCat = sameCategory.findIndex(l => l.id === lessonId);
  const prevLesson = posInCat > 0 ? sameCategory[posInCat - 1] : null;
  const nextLesson = posInCat >= 0 && posInCat < sameCategory.length - 1 ? sameCategory[posInCat + 1] : null;

  const crumb = document.getElementById('lesson-crumb');
  if (crumb) crumb.textContent = `${(CATEGORY_META[lesson.category] || {}).label || lesson.category} • ${lesson.title}`;

  const navEl = document.getElementById('lesson-nav');
  if (navEl) {
    navEl.innerHTML = `
      ${prevLesson
        ? `<a href="stitch-preview-lektion.html?id=${encodeURIComponent(prevLesson.id)}" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-card hover:bg-surface-subdued shadow-sm font-label-md text-label-md text-text-secondary transition-all"><span class="material-symbols-outlined text-[16px]">arrow_back</span><span>${prevLesson.title}</span></a>`
        : '<span></span>'}
      ${nextLesson
        ? `<a href="stitch-preview-lektion.html?id=${encodeURIComponent(nextLesson.id)}" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-card hover:bg-surface-subdued shadow-sm font-label-md text-label-md text-text-secondary transition-all"><span>${nextLesson.title}</span><span class="material-symbols-outlined text-[16px]">arrow_forward</span></a>`
        : '<a href="stitch-preview-kurser.html" class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-card hover:bg-surface-subdued shadow-sm font-label-md text-label-md text-text-secondary transition-all"><span>Till kurser</span><span class="material-symbols-outlined text-[16px]">arrow_forward</span></a>'}
    `;
  }

  const steps = lesson.content.steps;
  const quiz = lesson.content.quiz;
  const alreadyCompleted = existingProgress?.status === 'completed';
  let stepIndex = alreadyCompleted ? 0 : Math.min(existingProgress?.current_step || 0, steps.length - 1);
  let quizIndex = 0;
  let correctCount = 0;

  async function saveProgress(status, currentStep, quizScore) {
    const payload = { user_id: user.id, lesson_id: lessonId, status, current_step: currentStep, updated_at: new Date().toISOString() };
    if (quizScore !== undefined) {
      payload.quiz_score = quizScore;
      payload.completed_at = new Date().toISOString();
    }
    await sb.from('user_lesson_progress').upsert(payload);
  }

  async function awardCompletion(score) {
    if (alreadyCompleted) return; // no double XP on retakes
    const today = new Date().toISOString().slice(0, 10);
    const sameDay = profile.last_active_date === today;
    const newStreak = sameDay ? profile.streak_days : (isYesterday(profile.last_active_date) ? profile.streak_days + 1 : 1);
    await sb.from('profiles').update({
      xp: profile.xp + lesson.xp_reward,
      streak_days: newStreak,
      best_streak_days: Math.max(profile.best_streak_days || 0, newStreak),
      last_active_date: today,
      minutes_today: sameDay ? profile.minutes_today + lesson.estimated_minutes : lesson.estimated_minutes,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
  }

  function renderStep() {
    const s = steps[stepIndex];
    root.innerHTML = `
      <div class="mb-space-lg">
        <div class="flex items-center justify-between mb-2">
          <span class="font-caption-micro text-caption-micro text-primary uppercase tracking-wider">${s.label}</span>
          <span class="font-caption-micro text-caption-micro text-text-tertiary">Steg ${stepIndex + 1} av ${steps.length}</span>
        </div>
        <div class="w-full h-1.5 bg-surface-subdued rounded-full overflow-hidden">
          <div class="h-full bg-primary-container rounded-full transition-all duration-300" style="width:${((stepIndex + 1) / (steps.length + 1)) * 100}%"></div>
        </div>
      </div>
      <h1 class="font-headline-1 text-headline-1 text-text-primary mb-4">${s.title}</h1>
      <div class="prose-lesson">${s.body}</div>
      <div class="flex items-center justify-between mt-space-xl pt-space-lg border-t border-border-subtle">
        <button id="lesson-back" class="px-5 py-2.5 rounded-xl font-label-md text-label-md text-text-secondary hover:bg-surface-subdued transition-all ${stepIndex === 0 ? 'invisible' : ''}">← Tillbaka</button>
        <button id="lesson-next" class="px-6 py-3 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm flex items-center gap-2">
          <span>${stepIndex === steps.length - 1 ? 'Till quiz' : 'Nästa'}</span>
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>`;
    document.getElementById('lesson-back').addEventListener('click', () => { stepIndex--; renderStep(); });
    document.getElementById('lesson-next').addEventListener('click', async () => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        if (!alreadyCompleted) await saveProgress('in_progress', stepIndex);
        renderStep();
      } else {
        if (!alreadyCompleted) await saveProgress('in_progress', steps.length);
        renderQuiz();
      }
    });
  }

  function renderQuiz() {
    let answered = false;
    const q = quiz[quizIndex];
    root.innerHTML = `
      <div class="mb-space-lg">
        <div class="flex items-center justify-between mb-2">
          <span class="font-caption-micro text-caption-micro text-primary uppercase tracking-wider">Quiz</span>
          <span class="font-caption-micro text-caption-micro text-text-tertiary">Fråga ${quizIndex + 1} av ${quiz.length}</span>
        </div>
        <div class="w-full h-1.5 bg-surface-subdued rounded-full overflow-hidden">
          <div class="h-full bg-primary-container rounded-full" style="width:100%"></div>
        </div>
      </div>
      <h2 class="font-headline-2 text-headline-2 text-text-primary mb-6">${q.question}</h2>
      <div id="quiz-options" class="flex flex-col gap-3"></div>
      <p id="quiz-feedback" class="mt-4 font-body-medium text-body-medium hidden"></p>
      <div class="flex justify-end mt-space-xl">
        <button id="quiz-next" class="hidden px-6 py-3 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm">${quizIndex === quiz.length - 1 ? 'Se resultat' : 'Nästa fråga'}</button>
      </div>`;
    const optionsEl = document.getElementById('quiz-options');
    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'text-left px-5 py-3.5 rounded-xl border border-border-subtle hover:border-primary-container hover:bg-primary-tint transition-all font-body-regular text-body-regular text-text-primary';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const correct = idx === q.correct_index;
        if (correct) correctCount++;
        Array.from(optionsEl.children).forEach((b, i) => {
          b.disabled = true;
          if (i === q.correct_index) { b.style.borderColor = '#10B981'; b.style.background = '#ECFDF5'; }
          else if (i === idx) { b.style.borderColor = '#DC2626'; b.style.background = '#ffdad6'; }
        });
        const fb = document.getElementById('quiz-feedback');
        fb.textContent = (correct ? '✓ Rätt! ' : '✗ Fel. ') + (q.feedback || '');
        fb.className = 'mt-4 font-body-medium text-body-medium ' + (correct ? 'text-positive-spruce' : 'text-critical-danger');
        fb.classList.remove('hidden');
        document.getElementById('quiz-next').classList.remove('hidden');
      });
      optionsEl.appendChild(btn);
    });
    document.getElementById('quiz-next').addEventListener('click', async () => {
      if (quizIndex < quiz.length - 1) {
        quizIndex++;
        renderQuiz();
      } else {
        const score = Math.round((correctCount / quiz.length) * 100);
        await saveProgress('completed', steps.length, score);
        await awardCompletion(score);
        renderDone(score);
      }
    });
  }

  function renderDone(score) {
    root.innerHTML = `
      <div class="text-center py-space-xl">
        <div class="w-20 h-20 rounded-full bg-positive-wash text-positive-spruce flex items-center justify-center mx-auto mb-6">
          <span class="material-symbols-outlined text-[40px]">celebration</span>
        </div>
        <h2 class="font-headline-1 text-headline-1 text-text-primary mb-2">Lektion slutförd!</h2>
        <p class="font-body-regular text-body-regular text-text-secondary mb-6">Du fick ${correctCount} av ${quiz.length} rätt (${score}%)${alreadyCompleted ? '' : ` och tjänade <strong>+${lesson.xp_reward} XP</strong>`}.</p>
        <div class="flex items-center justify-center gap-3">
          ${nextLesson
            ? `<a href="stitch-preview-lektion.html?id=${encodeURIComponent(nextLesson.id)}" class="px-6 py-3 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm flex items-center gap-2"><span>Nästa: ${nextLesson.title}</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span></a>`
            : `<a href="index-stitch-preview.html" class="px-6 py-3 rounded-xl bg-primary-container hover:bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm">Till Hem</a>`}
          <a href="stitch-preview-kurser.html" class="px-6 py-3 rounded-xl bg-surface-subdued hover:bg-surface-container text-text-primary font-label-md text-label-md transition-all">Fler lektioner</a>
        </div>
      </div>`;
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

  const totalLessons = lessons.length;
  const totalCompleted = progress.filter(p => p.status === 'completed').length;

  const filterBar = `
    <div class="flex flex-wrap gap-2 mb-space-lg" id="courses-filter">
      <button data-filter="alla" class="filter-chip px-3.5 py-1.5 rounded-full bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm">Alla ämnen</button>
      ${Object.entries(CATEGORY_META).map(([key, meta]) => `<button data-filter="${key}" class="filter-chip px-3.5 py-1.5 rounded-full bg-surface-card text-text-secondary hover:bg-surface-subdued font-label-md text-label-md transition-all shadow-sm">${meta.label} (${(byCategory[key] || []).length})</button>`).join('')}
    </div>`;

  const sections = Object.entries(CATEGORY_META).map(([key, meta]) => {
    const catLessons = byCategory[key] || [];
    if (!catLessons.length) return '';
    return `
      <section class="course-section mb-space-xl" data-category="${key}">
        <div class="flex items-center gap-3 mb-space-md">
          <div class="w-10 h-10 rounded-xl ${meta.iconBg} ${meta.iconColor} flex items-center justify-center">
            <span class="material-symbols-outlined text-[22px]">${meta.icon}</span>
          </div>
          <h2 class="font-headline-2 text-headline-2 text-text-primary">${meta.label}</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${catLessons.map(l => {
            const p = progressByLesson.get(l.id);
            const badge = lessonStatusBadge(p?.status);
            return `
            <a href="stitch-preview-lektion.html?id=${encodeURIComponent(l.id)}" class="flex items-center justify-between gap-3 bg-surface-card rounded-xl p-space-md shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div class="flex items-center gap-3 min-w-0">
                <span class="material-symbols-outlined text-[22px] ${badge.cls}">${badge.icon}</span>
                <div class="flex flex-col min-w-0">
                  <span class="font-label-md text-label-md text-text-primary truncate">${l.title}</span>
                  <span class="font-caption-micro text-caption-micro text-text-tertiary">${l.estimated_minutes} min · ${l.xp_reward} XP</span>
                </div>
              </div>
              <span class="material-symbols-outlined text-[18px] text-text-tertiary shrink-0">chevron_right</span>
            </a>`;
          }).join('')}
        </div>
      </section>`;
  }).join('');

  root.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
      <div>
        <span class="font-label-md text-label-md text-primary uppercase tracking-wide">Kurskatalog</span>
        <h1 class="font-headline-1 text-headline-1 text-text-primary tracking-tight mt-1">Lär dig ekonomi</h1>
      </div>
      <div class="flex items-center gap-2 bg-surface-card px-4 py-2.5 rounded-xl shadow-sm">
        <span class="material-symbols-outlined text-positive-spruce text-[20px]">task_alt</span>
        <span class="font-label-md text-label-md text-text-primary">${totalCompleted} av ${totalLessons} lektioner klara</span>
      </div>
    </div>
    ${filterBar}
    <div id="courses-sections">${sections}</div>`;

  document.querySelectorAll('#courses-filter .filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      document.querySelectorAll('#courses-filter .filter-chip').forEach(b => {
        b.className = 'filter-chip px-3.5 py-1.5 rounded-full bg-surface-card text-text-secondary hover:bg-surface-subdued font-label-md text-label-md transition-all shadow-sm';
      });
      btn.className = 'filter-chip px-3.5 py-1.5 rounded-full bg-primary-deep text-on-primary font-label-md text-label-md transition-all shadow-sm';
      document.querySelectorAll('.course-section').forEach(sec => {
        sec.style.display = (filter === 'alla' || sec.dataset.category === filter) ? '' : 'none';
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
      <a href="stitch-preview-lektion.html?id=${encodeURIComponent(lesson.id)}" class="flex items-center justify-between gap-3 bg-surface-card rounded-xl p-space-md shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-[20px] text-positive-spruce">check_circle</span>
          <span class="font-label-md text-label-md text-text-primary">${lesson.title}</span>
        </div>
        <span class="font-caption-micro text-caption-micro text-text-tertiary">Quiz: ${p.quiz_score ?? '–'}%</span>
      </a>`).join('')}</div>` : `<p class="font-body-regular text-body-regular text-text-secondary">Du har inte slutfört någon lektion än. <a class="text-primary underline" href="stitch-preview-kurser.html">Börja här →</a></p>`}
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
      <a href="stitch-preview-lektion.html?id=${encodeURIComponent(lesson.id)}" class="bg-surface-card rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-space-sm">
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
          <a class="hidden sm:inline-flex items-center gap-space-xs font-label-md text-label-md text-primary-container hover:text-primary-deep" href="stitch-preview-kurser.html"><span>Se alla kurser</span><span class="material-symbols-outlined text-[18px]">chevron_right</span></a>
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

  if (document.getElementById('subjects-grid')) renderDashboard(ctx);
  else if (document.getElementById('lesson-root')) initLessonPage(ctx);
  else if (document.getElementById('courses-root')) initCoursesPage(ctx);
  else if (document.getElementById('journey-root')) initJourneyPage(ctx);
  else if (document.getElementById('profile-root')) initProfilePage(ctx);
  else if (document.getElementById('articles-root')) initArticlesPage();
  else if (document.getElementById('article-root')) initArticleReaderPage(ctx);
});
