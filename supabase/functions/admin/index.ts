// Admin API for admin.html. Runs with the service role, so every request is
// checked first: the caller's JWT must belong to a user whose app_metadata.role
// is "admin" (app_metadata can only be changed server-side, never by the user).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Teacher access lives in app_metadata (only this function sets it). A teacher
// sign-up only sets user_metadata.requested_role, so it shows up as "pending".
const roleOf = (u: any) => {
  const app = u.app_metadata || {};
  const meta = u.user_metadata || {};
  if (app.role === 'admin') return 'admin';
  if (app.role === 'teacher') return 'teacher';
  if (meta.requested_role === 'teacher' || meta.role === 'teacher') return app.teacher_status === 'rejected' ? 'rejected' : 'pending';
  return 'student';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user: caller } } = await admin.auth.getUser(token);
  if (!caller || caller.app_metadata?.role !== 'admin') return json({ error: 'Endast för admin.' }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const { action, id } = body;

  const log = (act: string, target?: { id: string; email?: string | null }) =>
    admin.from('admin_audit_log').insert({
      admin_id: caller.id, admin_email: caller.email, action: act,
      target_id: target?.id ?? null, target_email: target?.email ?? null,
    });

  try {
    if (action === 'list') {
      const users: any[] = [];
      for (let page = 1; page < 50; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 1000) break;
      }
      const [{ data: profiles }, { data: progress }, { data: logRows }] = await Promise.all([
        admin.from('profiles').select('id, display_name, xp, streak_days, last_active_date'),
        admin.from('user_lesson_progress').select('user_id, status, quiz_score'),
        admin.from('admin_audit_log').select('action, admin_email, target_email, created_at').order('created_at', { ascending: false }).limit(15),
      ]);
      const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));
      const stats = new Map<string, { completed: number; scores: number[] }>();
      for (const p of progress || []) {
        const s = stats.get(p.user_id) || { completed: 0, scores: [] };
        if (p.status === 'completed') s.completed++;
        if (p.quiz_score !== null) s.scores.push(p.quiz_score);
        stats.set(p.user_id, s);
      }
      return json({
        users: users.map(u => {
          const p: any = profileById.get(u.id) || {};
          const s = stats.get(u.id);
          return {
            id: u.id, email: u.email, role: roleOf(u), school: u.user_metadata?.school || null,
            name: p.display_name || u.user_metadata?.display_name || null,
            created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
            xp: p.xp ?? 0, streak: p.streak_days ?? 0, last_active_date: p.last_active_date ?? null,
            completed: s?.completed ?? 0,
            quiz: s && s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : null,
          };
        }),
        log: logRows || [],
      });
    }

    if (!id || typeof id !== 'string') return json({ error: 'Saknar konto-id.' }, 400);
    const { data: target, error: targetErr } = await admin.auth.admin.getUserById(id);
    if (targetErr || !target?.user) return json({ error: 'Kontot finns inte.' }, 404);
    const t = target.user;

    if (action === 'detail') {
      const [{ data: profile }, { data: progress }, { data: lessons }] = await Promise.all([
        admin.from('profiles').select('*').eq('id', id).maybeSingle(),
        admin.from('user_lesson_progress').select('lesson_id, status, current_step, quiz_score, completed_at, updated_at').eq('user_id', id),
        admin.from('lessons').select('id, category, title, order_index'),
      ]);
      const lessonById = new Map((lessons || []).map((l: any) => [l.id, l]));
      return json({
        user: {
          id: t.id, email: t.email, role: roleOf(t), school: t.user_metadata?.school || null,
          created_at: t.created_at, last_sign_in_at: t.last_sign_in_at,
        },
        profile,
        progress: (progress || []).map((p: any) => ({ ...p, title: lessonById.get(p.lesson_id)?.title || p.lesson_id, category: lessonById.get(p.lesson_id)?.category || null }))
          .sort((a: any, b: any) => (b.updated_at || '').localeCompare(a.updated_at || '')),
      });
    }

    if (action === 'reset_account') {
      await Promise.all([
        admin.from('user_lesson_progress').delete().eq('user_id', id),
        admin.from('user_article_reads').delete().eq('user_id', id),
        admin.from('user_saved_articles').delete().eq('user_id', id),
      ]);
      const { error } = await admin.from('profiles').update({
        xp: 0, streak_days: 0, best_streak_days: 0, minutes_today: 0, last_active_date: null, updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      await log('reset_account', t);
      return json({ ok: true });
    }

    if (action === 'approve_teacher' || action === 'reject_teacher') {
      const role = roleOf(t);
      if (role === 'admin') return json({ error: 'Adminkonton kan inte ändras härifrån.' }, 400);
      if (role === 'student') return json({ error: 'Kontot har inte ansökt om att bli lärare.' }, 400);
      const approve = action === 'approve_teacher';
      const { error } = await admin.auth.admin.updateUserById(id, {
        app_metadata: { ...t.app_metadata, role: approve ? 'teacher' : null, teacher_status: approve ? 'approved' : 'rejected' },
      });
      if (error) throw error;
      await log(approve ? 'approve_teacher' : (role === 'teacher' ? 'revoke_teacher' : 'reject_teacher'), t);
      return json({ ok: true });
    }

    if (action === 'delete_user') {
      if (id === caller.id) return json({ error: 'Du kan inte ta bort ditt eget adminkonto.' }, 400);
      if (roleOf(t) === 'admin') return json({ error: 'Adminkonton kan inte tas bort härifrån.' }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      await log('delete_user', t);
      return json({ ok: true });
    }

    return json({ error: 'Okänd åtgärd.' }, 400);
  } catch (err) {
    return json({ error: (err as Error).message || 'Något gick fel.' }, 500);
  }
});
