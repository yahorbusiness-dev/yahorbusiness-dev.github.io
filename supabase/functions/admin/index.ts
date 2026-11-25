// Admin API for admin.html. Runs with the service role, so every request is
// checked first: the caller's JWT must belong to a user whose app_metadata.role
// is "admin" (app_metadata can only be changed server-side, never by the user).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Where the reset e-mail's link lands (must be in Auth > URL Configuration > Redirect URLs)
const RESET_REDIRECT = 'https://yahorbusiness-dev.github.io/nytt-losenord.html';

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

function jwtClaims(token: string): any {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part + '='.repeat((4 - part.length % 4) % 4)));
  } catch {
    return {};
  }
}

async function allUsers(admin: any) {
  const users: any[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user: caller } } = await admin.auth.getUser(token);
  if (!caller || caller.app_metadata?.role !== 'admin') return json({ error: 'Endast för admin.' }, 403);
  // Admins must have passed two-factor authentication (TOTP) in this session.
  // getUser above verified the token, so its own claims can be trusted here.
  if (jwtClaims(token).aal !== 'aal2') {
    return json({ error: 'Tvåstegsverifiering krävs. Logga in igen i adminpanelen.', code: 'mfa_required' }, 403);
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const { action, id, school_id, class_id, name, city } = body;

  const log = (act: string, target?: { id: string; email?: string | null }) =>
    admin.from('admin_audit_log').insert({
      admin_id: caller.id, admin_email: caller.email, action: act,
      target_id: target?.id ?? null, target_email: target?.email ?? null,
    });

  try {
    if (action === 'list') {
      const users = await allUsers(admin);
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

    // ---- Schools & classes ----
    if (action === 'schools') {
      const [{ data: schools }, { data: links }, { data: classes }, { data: members }, { data: lessons }, users] = await Promise.all([
        admin.from('schools').select('id, name, city, created_at').order('created_at'),
        admin.from('school_teachers').select('user_id, school_id'),
        admin.from('classes').select('id, school_id, teacher_id, name, join_code, package_id, created_at').order('created_at'),
        admin.from('class_members').select('class_id, user_id'),
        admin.from('lessons').select('id, package_id').not('package_id', 'is', null),
        allUsers(admin),
      ]);
      const memberIds = [...new Set((members || []).map((m: any) => m.user_id))];
      const { data: progress } = memberIds.length
        ? await admin.from('user_lesson_progress').select('user_id, lesson_id, status').in('user_id', memberIds)
        : { data: [] as any[] };
      const userById = new Map(users.map((u: any) => [u.id, u]));
      const pkgLessons = (pkg: string) => (lessons || []).filter((l: any) => l.package_id === pkg).map((l: any) => l.id);
      const done = new Set((progress || []).filter((p: any) => p.status === 'completed').map((p: any) => p.user_id + '|' + p.lesson_id));
      const person = (uid: string) => { const u: any = userById.get(uid); return { id: uid, email: u?.email || null, name: u?.user_metadata?.display_name || null }; };
      const classInfo = (c: any) => {
        const ms = (members || []).filter((m: any) => m.class_id === c.id).map((m: any) => m.user_id);
        const ls = pkgLessons(c.package_id);
        const completed = ms.reduce((a: number, uid: string) => a + ls.filter((l: string) => done.has(uid + '|' + l)).length, 0);
        return { ...c, teacher: person(c.teacher_id), students: ms.length, progress: ms.length && ls.length ? Math.round(completed / (ms.length * ls.length) * 100) : 0 };
      };
      const teachers = users.filter((u: any) => roleOf(u) === 'teacher').map((u: any) => ({ ...person(u.id), school: u.user_metadata?.school || null, school_id: (links || []).find((l: any) => l.user_id === u.id)?.school_id || null }));
      return json({
        schools: (schools || []).map((s: any) => ({
          ...s,
          teachers: (links || []).filter((l: any) => l.school_id === s.id).map((l: any) => person(l.user_id)),
          classes: (classes || []).filter((c: any) => c.school_id === s.id).map(classInfo),
        })),
        teachers,
      });
    }

    if (action === 'create_school') {
      if (!name || typeof name !== 'string' || !name.trim()) return json({ error: 'Skolan behöver ett namn.' }, 400);
      const { data, error } = await admin.from('schools').insert({ name: name.trim(), city: (city || '').trim() || null }).select().single();
      if (error) throw error;
      await log('create_school', { id: caller.id, email: data.name });
      return json({ school: data });
    }

    if (action === 'delete_school') {
      const { data: s } = await admin.from('schools').select('name').eq('id', school_id).maybeSingle();
      if (!s) return json({ error: 'Skolan finns inte.' }, 404);
      const { error } = await admin.from('schools').delete().eq('id', school_id);
      if (error) throw error;
      await log('delete_school', { id: caller.id, email: s.name });
      return json({ ok: true });
    }

    if (action === 'set_teacher_school') {
      const { data: target } = await admin.auth.admin.getUserById(id);
      if (!target?.user || roleOf(target.user) !== 'teacher') return json({ error: 'Kontot är inte en godkänd lärare.' }, 400);
      if (school_id) {
        const { error } = await admin.from('school_teachers').upsert({ user_id: id, school_id });
        if (error) throw error;
      } else {
        await admin.from('school_teachers').delete().eq('user_id', id);
      }
      await log(school_id ? 'set_teacher_school' : 'remove_teacher_school', target.user);
      return json({ ok: true });
    }

    if (action === 'class_detail') {
      const { data: c } = await admin.from('classes').select('*').eq('id', class_id).maybeSingle();
      if (!c) return json({ error: 'Klassen finns inte.' }, 404);
      const [{ data: ms }, { data: ls }, users] = await Promise.all([
        admin.from('class_members').select('user_id, joined_at').eq('class_id', class_id),
        admin.from('lessons').select('id, title, order_index').eq('package_id', c.package_id).order('order_index'),
        allUsers(admin),
      ]);
      const ids = (ms || []).map((m: any) => m.user_id);
      const [{ data: progress }, { data: profiles }] = ids.length
        ? await Promise.all([
            admin.from('user_lesson_progress').select('user_id, lesson_id, status, quiz_score, updated_at').in('user_id', ids),
            admin.from('profiles').select('id, display_name, last_active_date').in('id', ids),
          ])
        : [{ data: [] as any[] }, { data: [] as any[] }];
      const userById = new Map(users.map((u: any) => [u.id, u]));
      return json({
        class: c,
        lessons: ls || [],
        students: (ms || []).map((m: any) => {
          const u: any = userById.get(m.user_id);
          const prof: any = (profiles || []).find((p: any) => p.id === m.user_id) || {};
          return {
            id: m.user_id, email: u?.email || null, name: prof.display_name || u?.user_metadata?.display_name || null,
            joined_at: m.joined_at, last_sign_in_at: u?.last_sign_in_at || null,
            progress: (progress || []).filter((p: any) => p.user_id === m.user_id),
          };
        }),
      });
    }

    // ---- Lesson packages: the teacher file (PDF) in the private "teacher-files" bucket ----
    if (action === 'packages') {
      const [{ data: pkgs }, { data: lessons }, { data: files }] = await Promise.all([
        admin.from('lesson_packages').select('id, title, teacher_file, created_at').order('created_at'),
        admin.from('lessons').select('id, title, package_id, order_index').not('package_id', 'is', null).order('order_index'),
        admin.storage.from('teacher-files').list('', { limit: 1000 }),
      ]);
      const fileByName = new Map((files || []).map((f: any) => [f.name, f]));
      return json({
        packages: (pkgs || []).map((p: any) => {
          const f: any = p.teacher_file ? fileByName.get(p.teacher_file) : null;
          return {
            ...p,
            lessons: (lessons || []).filter((l: any) => l.package_id === p.id).map((l: any) => ({ id: l.id, title: l.title })),
            file: f ? { size: f.metadata?.size ?? null, updated_at: f.updated_at || f.created_at } : null,
          };
        }),
      });
    }

    if (action === 'upload_teacher_file' || action === 'remove_teacher_file') {
      const { data: pkg } = await admin.from('lesson_packages').select('id, title').eq('id', body.package_id || '').maybeSingle();
      if (!pkg) return json({ error: 'Lektionspaketet finns inte.' }, 404);
      const path = `${pkg.id}.pdf`;
      if (action === 'remove_teacher_file') {
        const { error } = await admin.storage.from('teacher-files').remove([path]);
        if (error) throw error;
        await log('remove_teacher_file', { id: caller.id, email: pkg.title });
        return json({ ok: true });
      }
      if (typeof body.file_base64 !== 'string' || !body.file_base64) return json({ error: 'Ingen fil skickades.' }, 400);
      let bytes: Uint8Array;
      try { bytes = Uint8Array.from(atob(body.file_base64), c => c.charCodeAt(0)); } catch { return json({ error: 'Filen kunde inte läsas.' }, 400); }
      if (bytes.length > 15 * 1024 * 1024) return json({ error: 'Filen är för stor (max 15 MB).' }, 400);
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return json({ error: 'Filen måste vara en PDF.' }, 400);
      const { error } = await admin.storage.from('teacher-files').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
      if (error) throw error;
      const { error: e2 } = await admin.from('lesson_packages').update({ teacher_file: path }).eq('id', pkg.id);
      if (e2) throw e2;
      await log('upload_teacher_file', { id: caller.id, email: pkg.title });
      return json({ ok: true });
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

    if (action === 'send_password_reset') {
      if (!t.email) return json({ error: 'Kontot saknar e-postadress.' }, 400);
      const { error } = await admin.auth.resetPasswordForEmail(t.email, { redirectTo: RESET_REDIRECT });
      if (error) throw error;
      await log('send_password_reset', t);
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
