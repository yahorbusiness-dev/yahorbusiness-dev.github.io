// Teacher file for a lesson package (e.g. "Test lektion"). Only approved
// teachers (app_metadata.role = 'teacher') get it. If the package's file has been
// uploaded to the private Storage bucket "teacher-files" it is served from there;
// until then a placeholder PDF is generated here.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-disposition',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ---- Minimal one-page PDF (Helvetica, WinAnsi so å/ä/ö work) ----
const WIN: Record<string, number> = { '–': 0x96, '—': 0x97, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '…': 0x85 };
function winBytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (WIN[ch]) out.push(WIN[ch]);
    else if (c < 256) out.push(c);
    else out.push(0x3f);
  }
  return out;
}
function pdfStr(s: string): number[] {
  const out: number[] = [0x28];
  for (const b of winBytes(s)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c);
    out.push(b);
  }
  out.push(0x29);
  return out;
}
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) { lines.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}
export function placeholderPdf(title: string, studentLessons: string[]): Uint8Array {
  const parts: (string | number[])[] = [];
  const text = (font: string, size: number, rgb: string, x: number, y: number, s: string) =>
    parts.push(`BT /${font} ${size} Tf ${rgb} rg ${x} ${y} Td `, pdfStr(s), ' Tj ET\n');
  const dark = '0.059 0.090 0.165', grey = '0.278 0.333 0.412', blue = '0.145 0.388 0.922';
  parts.push(`${blue} rg 0 790 595 52 re f\n`);
  text('F2', 11, '1 1 1', 56, 811, 'UngEkonom  ·  Lärarmaterial');
  text('F2', 28, dark, 56, 720, title);
  text('F1', 12, grey, 56, 696, 'Lektionspaket för lärare');
  parts.push('0.937 0.965 1 rg 56 560 483 104 re f\n');
  parts.push(`${blue} rg 56 560 4 104 re f\n`);
  text('F2', 15, dark, 76, 630, 'Här kommer det att komma en lektion');
  text('F2', 15, dark, 76, 610, 'för er att hålla.');
  text('F1', 11, grey, 76, 584, 'Lärarmaterialet till det här paketet är under arbete.');
  let y = 520;
  text('F2', 13, dark, 56, y, 'Det här hör till paketet');
  y -= 24;
  for (const line of wrap('Eleverna har fem lektioner som hör ihop med den här lektionen. De hittar dem på sin översikt i UngEkonom när de har gått med i er klass med klasskoden.', 88)) {
    text('F1', 11, grey, 56, y, line); y -= 16;
  }
  y -= 8;
  for (const l of studentLessons) { text('F1', 11, dark, 66, y, '•  ' + l); y -= 18; }
  text('F1', 9, grey, 56, 50, '© 2026 UngEkonom  ·  Innehållet är utbildning, inte finansiell rådgivning.');

  const content: number[] = [];
  for (const p of parts) content.push(...(typeof p === 'string' ? winBytes(p) : p));
  const objs: number[][] = [
    winBytes('<< /Type /Catalog /Pages 2 0 R >>'),
    winBytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    winBytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>'),
    winBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    winBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
    [...winBytes(`<< /Length ${content.length} >>\nstream\n`), ...content, ...winBytes('\nendstream')],
  ];
  const out: number[] = [...winBytes('%PDF-1.4\n'), 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a];
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out.push(...winBytes(`${i + 1} 0 obj\n`), ...o, ...winBytes('\nendobj\n')); });
  const xref = out.length;
  let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) x += String(off).padStart(10, '0') + ' 00000 n \n';
  x += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  out.push(...winBytes(x));
  return new Uint8Array(out);
}

if (typeof Deno !== 'undefined') Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user || user.app_metadata?.role !== 'teacher') return json({ error: 'Lärarfilen är bara för godkända lärare.' }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const packageId = typeof body.package_id === 'string' ? body.package_id : 'test-lektion';
  const { data: pkg } = await admin.from('lesson_packages').select('id, title, teacher_file').eq('id', packageId).maybeSingle();
  if (!pkg) return json({ error: 'Lektionspaketet finns inte.' }, 404);
  const filename = (pkg.teacher_file || `${pkg.id}.pdf`).replace(/[^\w.-]/g, '_');
  const headers = { ...cors, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` };

  if (pkg.teacher_file) {
    const { data: file } = await admin.storage.from('teacher-files').download(pkg.teacher_file);
    if (file) return new Response(file, { headers });
  }
  const { data: lessons } = await admin.from('lessons').select('title').eq('package_id', pkg.id).order('order_index');
  return new Response(placeholderPdf(pkg.title, (lessons || []).map((l: any) => l.title)), { headers });
});
