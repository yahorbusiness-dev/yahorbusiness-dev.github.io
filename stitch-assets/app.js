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

function levelFromXp(xp) {
  const level = Math.floor(xp / 500) + 1;
  const xpIntoLevel = xp % 500;
  const xpToNext = 500 - xpIntoLevel;
  return { level, xpToNext };
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
  const { level } = levelFromXp(profile.xp);
  const sbLevelXp = document.getElementById('sb-level-xp');
  if (sbLevelXp) sbLevelXp.textContent = `Nivå ${level} • ${profile.xp.toLocaleString('sv-SE')} XP`;
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
  const { level, xpToNext } = levelFromXp(profile.xp);

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
  if (journeyXpNext) journeyXpNext.innerHTML = `${xpToNext} XP kvar till <strong>Nivå ${level + 1}</strong>`;
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
        await saveProgress('in_progress', stepIndex);
        renderStep();
      } else {
        await saveProgress('in_progress', steps.length);
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
function initProfilePage(ctx) {
  const { user, profile, lessons, progress } = ctx;
  const root = document.getElementById('profile-root');
  if (!root) return;
  const { level } = levelFromXp(profile.xp);
  const completed = progress.filter(p => p.status === 'completed').length;

  root.innerHTML = `
    <div class="bg-surface-card rounded-2xl p-space-xl shadow-sm">
      <div class="flex items-center gap-4 mb-space-lg">
        <div class="w-16 h-16 rounded-full bg-primary-tint text-primary-deep flex items-center justify-center font-headline-1 text-headline-1">${initialsFromName(profile.display_name)}</div>
        <div>
          <h1 class="font-headline-1 text-headline-1 text-text-primary">${profile.display_name}</h1>
          <p class="font-body-regular text-body-regular text-text-secondary">${user.email}</p>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-space-lg">
        <div class="bg-surface-subdued rounded-xl p-space-md text-center">
          <div class="font-headline-2 text-headline-2 text-text-primary">${profile.xp.toLocaleString('sv-SE')}</div>
          <div class="font-caption-micro text-caption-micro text-text-tertiary">XP · Nivå ${level}</div>
        </div>
        <div class="bg-surface-subdued rounded-xl p-space-md text-center">
          <div class="font-headline-2 text-headline-2 text-text-primary">${completed}</div>
          <div class="font-caption-micro text-caption-micro text-text-tertiary">Lektioner klara</div>
        </div>
        <div class="bg-surface-subdued rounded-xl p-space-md text-center">
          <div class="font-headline-2 text-headline-2 text-text-primary">${profile.streak_days}</div>
          <div class="font-caption-micro text-caption-micro text-text-tertiary">Dagars streak</div>
        </div>
      </div>
      <button id="signout-btn" class="w-full px-6 py-3 rounded-xl bg-surface-subdued hover:bg-surface-container text-text-primary font-label-md text-label-md transition-all flex items-center justify-center gap-2">
        <span class="material-symbols-outlined text-[18px]">logout</span>
        <span>Logga ut</span>
      </button>
    </div>`;
  document.getElementById('signout-btn').addEventListener('click', signOut);
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

async function initArticleReaderPage() {
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
  const crumb = document.getElementById('article-crumb');
  if (crumb) crumb.textContent = article.title;
  root.innerHTML = `
    <span class="px-2.5 py-0.5 rounded-full bg-primary-tint text-primary-deep font-caption-micro text-caption-micro">${ARTICLE_CATEGORY_LABELS[article.category] || article.category}</span>
    <h1 class="font-headline-1 text-headline-1 text-text-primary mt-3 mb-2">${article.title}</h1>
    <p class="font-body-medium text-body-medium text-text-secondary mb-space-lg">${article.intro}</p>
    <div class="prose-lesson">${article.body}</div>
    <div class="mt-space-xl pt-space-lg border-t border-border-subtle">
      <a href="stitch-preview-artiklar.html" class="px-6 py-3 rounded-xl bg-surface-subdued hover:bg-surface-container text-text-primary font-label-md text-label-md transition-all inline-flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">arrow_back</span><span>Fler artiklar</span></a>
    </div>`;
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

  const safeProfile = profile || { display_name: user.email?.split('@')[0] || 'Medlem', xp: 0, streak_days: 0, daily_goal_minutes: 15, minutes_today: 0, last_active_date: null };
  renderSidebarChrome(safeProfile);

  const ctx = { user, profile: safeProfile, lessons: lessons || [], progress: progress || [] };

  if (document.getElementById('subjects-grid')) renderDashboard(ctx);
  else if (document.getElementById('lesson-root')) initLessonPage(ctx);
  else if (document.getElementById('courses-root')) initCoursesPage(ctx);
  else if (document.getElementById('journey-root')) initJourneyPage(ctx);
  else if (document.getElementById('profile-root')) initProfilePage(ctx);
  else if (document.getElementById('articles-root')) initArticlesPage();
  else if (document.getElementById('article-root')) initArticleReaderPage();
});
