const DEMO_DATA = { sections: [], students: [], records: [] };

const STATUSES = ['Present', 'Late', 'Absent', 'Excused'];
const COLORS = { Present: '#10b981', Late: '#f59e0b', Absent: '#ef4444', Excused: '#0ea5e9' };

class Section {
  constructor({ id, name, subject, days, time, room, adviser }) { Object.assign(this, { id, name, subject, days, time, room, adviser }); }
}
class Student {
  constructor({ id, name, sectionId, lrn }) { Object.assign(this, { id, name, sectionId, lrn }); }
}
class AttendanceRecord {
  constructor({ id, studentId, sectionId, date, time, status }) { Object.assign(this, { id, studentId, sectionId, date, time, status }); }
}

class Store {
  constructor(key) {
    this.key = key;
    const raw = localStorage.getItem(key);
    this.data = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEMO_DATA));
    if (!raw) this.save();
  }
  save() { localStorage.setItem(this.key, JSON.stringify(this.data)); }
  reset() { this.data = JSON.parse(JSON.stringify(DEMO_DATA)); this.save(); }
}

class AttendanceSystem {
  constructor(store) { this.store = store; }
  get sections() { return this.store.data.sections.map(x => new Section(x)); }
  get students() { return this.store.data.students.map(x => new Student(x)); }
  get records() { return this.store.data.records.map(x => new AttendanceRecord(x)); }
  uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  section(id) { return this.sections.find(s => s.id === id); }
  student(id) { return this.students.find(s => s.id === id); }
  addSection(o) { this.store.data.sections.push({ id: this.uid('s'), ...o }); this.store.save(); }
  updateSection(id, o) { Object.assign(this.store.data.sections.find(s => s.id === id), o); this.store.save(); }
  deleteSection(id) {
    const d = this.store.data;
    d.sections = d.sections.filter(s => s.id !== id);
    const ids = d.students.filter(s => s.sectionId === id).map(s => s.id);
    d.students = d.students.filter(s => s.sectionId !== id);
    d.records = d.records.filter(r => r.sectionId !== id && !ids.includes(r.studentId));
    this.store.save();
  }
  addStudent(o) { this.store.data.students.push({ id: this.uid('st'), ...o }); this.store.save(); }
  updateStudent(id, o) {
    const s = this.store.data.students.find(s => s.id === id);
    Object.assign(s, o);
    this.store.data.records.forEach(r => { if (r.studentId === id) r.sectionId = s.sectionId; });
    this.store.save();
  }
  reorderStudents(ids) {
    const arr = this.store.data.students;
    const set = new Set(ids);
    const slots = [];
    arr.forEach((s, i) => { if (set.has(s.id)) slots.push(i); });
    const ordered = ids.map(id => arr.find(s => s.id === id)).filter(Boolean);
    slots.forEach((pos, i) => { arr[pos] = ordered[i]; });
    this.store.save();
  }
  deleteStudent(id) {
    this.store.data.students = this.store.data.students.filter(s => s.id !== id);
    this.store.data.records = this.store.data.records.filter(r => r.studentId !== id);
    this.store.save();
  }
  mark(studentId, date, status) {
    const st = this.student(studentId);
    const now = new Date();
    const time = (status === 'Present' || status === 'Late') ? now.toTimeString().slice(0, 5) : '';
    let r = this.store.data.records.find(r => r.studentId === studentId && r.date === date);
    if (r) { r.status = status; r.time = time; }
    else this.store.data.records.push({ id: this.uid('r'), studentId, sectionId: st.sectionId, date, time, status });
    this.store.save();
  }
  deleteRecord(id) { this.store.data.records = this.store.data.records.filter(r => r.id !== id); this.store.save(); }
  recordsFor(studentId) { return this.records.filter(r => r.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date)); }
  percent(studentId) {
    const rs = this.recordsFor(studentId);
    if (!rs.length) return 0;
    const ok = rs.filter(r => r.status === 'Present' || r.status === 'Late' || r.status === 'Excused').length;
    return Math.round(ok / rs.length * 100);
  }
  latest(studentId) { return this.recordsFor(studentId)[0]; }
  daily(date) {
    return this.sections.map(sec => {
      const studs = this.students.filter(s => s.sectionId === sec.id);
      const rs = this.records.filter(r => r.sectionId === sec.id && r.date === date && studs.some(s => s.id === r.studentId));
      const c = {}; STATUSES.forEach(s => c[s] = rs.filter(r => r.status === s).length);
      const unmarked = studs.length - rs.length;
      const rate = rs.length ? Math.round((c.Present + c.Late + c.Excused) / rs.length * 100) : 0;
      return { date, section: sec.name, ...c, unmarked, rate, marked: rs.length };
    });
  }
  overall() {
    return this.sections.map(sec => {
      const studs = this.students.filter(s => s.sectionId === sec.id);
      const rs = this.records.filter(r => studs.some(s => s.id === r.studentId));
      const c = {}; STATUSES.forEach(s => c[s] = rs.filter(r => r.status === s).length);
      const pct = rs.length ? Math.round((c.Present + c.Late + c.Excused) / rs.length * 100) : 0;
      return { section: sec.name, students: studs.length, records: rs.length, ...c, pct };
    });
  }
}

const $ = id => document.getElementById(id);
const store = new Store('attendance_monitoring_system');
const app = new AttendanceSystem(store);
const pad2 = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const badge = s => `<span class="badge b-${s || 'None'}">${s || 'No record'}</span>`;
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const fmtTime = t => { if (!t) return '—'; const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + pad2(m) + ' ' + (h >= 12 ? 'PM' : 'AM'); };
const pctBar = p => `<div class="flex items-center gap-2"><div class="w-20 h-2 bg-slate-200 rounded-full overflow-hidden"><div class="h-full ${p >= 90 ? 'bg-emerald-500' : p >= 75 ? 'bg-amber-500' : 'bg-red-500'}" style="width:${p}%"></div></div><span class="font-medium">${p}%</span></div>`;
const icon = {
  ok: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6L9 17l-5-5"/></svg>',
  err: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  empty: '<svg class="w-8 h-8 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h18M5 7v12a2 2 0 002 2h10a2 2 0 002-2V7M9 7V4h6v3"/></svg>',
  edit: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  del: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'
};
const empty = (cols, msg) => `<tr><td colspan="${cols}" class="text-center text-slate-500 py-8" style="white-space:normal">${icon.empty}${msg}</td></tr>`;

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm ' + (type === 'ok' ? 'bg-teal-600' : 'bg-red-600');
  el.innerHTML = (type === 'ok' ? icon.ok : icon.err) + '<span>' + esc(msg) + '</span>';
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function downloadCSV(name, rows) {
  const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
  toast('Exported ' + name);
}

function tickClock() {
  let a = null;
  try {
    const c = localStorage.getItem('ams_current');
    a = JSON.parse(localStorage.getItem('ams_accounts') || '[]').find(x => x.user === c) || null;
  } catch (e) {}
  const d = $('clockDate'), t = $('clockTime');
  if (d) d.textContent = a ? a.name : '';
  if (t) t.textContent = a ? '@' + a.user : '';
}

let currentView = 'dashboard';
const titles = { dashboard: 'Dashboard', attendance: 'Mark Attendance', sections: 'Sections & Schedule', students: 'Students', summary: 'Attendance Summaries', history: 'Student History' };
function show(v) {
  currentView = v;
  document.querySelectorAll('.view').forEach(e => e.classList.add('hidden'));
  $('view-' + v).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('viewTitle').textContent = titles[v];
  $('sidebar').classList.add('-translate-x-full');
  $('overlay').classList.add('hidden');
  render();
}

function secOptions(sel, all) {
  const cur = sel.value;
  sel.innerHTML = (all ? '<option value="">All sections</option>' : '') + app.sections.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function renderKPIs() {
  const studs = app.students, recs = app.records;
  const td = recs.filter(r => r.date === todayStr());
  const ok = recs.filter(r => r.status !== 'Absent').length;
  const rate = recs.length ? Math.round(ok / recs.length * 100) : 0;
  const abs = recs.filter(r => r.status === 'Absent').length;
  const items = [
    ['Total students', studs.length, 'M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8z', 'text-teal-600 bg-teal-50'],
    ['Sections', app.sections.length, 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'text-sky-600 bg-sky-50'],
    ['Overall attendance', rate + '%', 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', 'text-emerald-600 bg-emerald-50'],
    ['Total absences', abs, 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z', 'text-red-600 bg-red-50']
  ];
  $('kpis').innerHTML = items.map(i => `<div class="card flex items-center gap-4"><div class="w-12 h-12 rounded-xl flex items-center justify-center ${i[3]}"><svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${i[2]}"/></svg></div><div><p class="text-xs text-slate-500">${i[0]}</p><p class="text-2xl font-bold">${i[1]}</p></div></div>`).join('');
}

function renderCharts() {
  const ov = app.overall();
  const c = $('barChart'), g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const W = c.width, H = c.height, pl = 40, pb = 50, pt = 15;
  g.font = '12px sans-serif'; g.fillStyle = '#64748b'; g.strokeStyle = '#e2e8f0';
  for (let i = 0; i <= 4; i++) {
    const y = pt + (H - pt - pb) * (1 - i / 4);
    g.beginPath(); g.moveTo(pl, y); g.lineTo(W, y); g.stroke();
    g.fillText(i * 25 + '%', 4, y + 4);
  }
  const bw = (W - pl) / Math.max(ov.length, 1);
  ov.forEach((o, i) => {
    const h = (H - pt - pb) * o.pct / 100, x = pl + i * bw + bw * 0.2, w = bw * 0.6, y = H - pb - h;
    g.fillStyle = '#14b8a6'; g.fillRect(x, y, w, h);
    g.fillStyle = '#0f172a'; g.textAlign = 'center'; g.fillText(o.pct + '%', x + w / 2, y - 5);
    g.fillStyle = '#64748b'; g.fillText(o.section.length > 18 ? o.section.slice(0, 17) + '…' : o.section, x + w / 2, H - pb + 18);
  });
  g.textAlign = 'left';
  const p = $('pieChart'), q = p.getContext('2d');
  q.clearRect(0, 0, p.width, p.height);
  const recs = app.records, tot = recs.length || 1;
  let a = -Math.PI / 2;
  STATUSES.forEach(s => {
    const n = recs.filter(r => r.status === s).length, ang = n / tot * Math.PI * 2;
    q.beginPath(); q.moveTo(150, 110); q.arc(150, 110, 95, a, a + ang); q.closePath(); q.fillStyle = COLORS[s]; q.fill(); a += ang;
  });
  q.beginPath(); q.arc(150, 110, 50, 0, Math.PI * 2); q.fillStyle = '#fff'; q.fill();
  $('pieLegend').innerHTML = STATUSES.map(s => `<div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${COLORS[s]}"></span>${s}: <b>${recs.filter(r => r.status === s).length}</b></div>`).join('');
}

function renderDash() {
  renderKPIs(); renderCharts();
  const q = $('dashSearch').value.toLowerCase(), sec = $('dashSection').value, sort = $('dashSort').value;
  let rows = app.students.filter(s => (!sec || s.sectionId === sec) && s.name.toLowerCase().includes(q))
    .map(s => ({ s, sec: app.section(s.sectionId), pct: app.percent(s.id), last: app.latest(s.id) }));
  rows.sort((a, b) => sort === 'pct' ? a.pct - b.pct : sort === 'section' ? a.sec.name.localeCompare(b.sec.name) : a.s.name.localeCompare(b.s.name));
  $('dashBody').innerHTML = rows.length ? rows.map(r => `<tr><td class="font-medium">${esc(r.s.name)}</td><td>${esc(r.sec.name)}</td><td>${esc(r.s.lrn)}</td><td>${r.last ? fmtDate(r.last.date) : '—'}</td><td>${fmtTime(r.last?.time)}</td><td>${badge(r.last?.status)}</td><td>${pctBar(r.pct)}</td></tr>`).join('') : empty(7, 'No students match your filters.');
  const rec = app.records.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 6);
  $('recent').innerHTML = rec.length ? rec.map(r => { const s = app.student(r.studentId); return `<li class="py-2 flex items-center justify-between gap-2 text-sm"><span><b>${esc(s?.name)}</b> <span class="text-slate-500">· ${fmtDate(r.date)} ${fmtTime(r.time)}</span></span>${badge(r.status)}</li>`; }).join('') : '<li class="py-6 text-center text-slate-500">No activity yet.</li>';
}

function renderAtt() {
  secOptions($('attSection'));
  const sec = app.section($('attSection').value), date = $('attDate').value;
  if (!sec) { $('attBody').innerHTML = empty(5, 'Create a section first.'); $('attSched').textContent = ''; return; }
  $('attSched').innerHTML = `Schedule: <b>${esc(sec.days)}</b> at <b>${fmtTime(sec.time)}</b> · ${esc(sec.room)} · Adviser: ${esc(sec.adviser)}`;
  const studs = app.students.filter(s => s.sectionId === sec.id);
  $('attBody').innerHTML = studs.length ? studs.map(s => {
    const r = app.records.find(r => r.studentId === s.id && r.date === date);
    return `<tr><td class="font-medium">${esc(s.name)}</td><td>${esc(s.lrn)}</td><td>${fmtTime(r?.time)}</td><td>${badge(r?.status)}</td><td><div class="flex gap-1">${STATUSES.map(st => `<button class="mk ${r?.status === st ? 'on' : ''}" data-mark="${s.id}|${st}">${st}</button>`).join('')}</div></td></tr>`;
  }).join('') : empty(5, 'No students in this section yet.');
}

function renderSections() {
  const ov = app.overall();
  const secs = app.sections;
  $('sectionGrid').innerHTML = secs.length ? secs.map(s => {
    const o = ov.find(x => x.section === s.name);
    return `<div class="card hover:shadow-md transition"><div class="flex justify-between items-start"><div><h3 class="font-semibold text-lg">${esc(s.name)}</h3><p class="text-sm text-slate-500">${esc(s.adviser)} · ${esc(s.room)}</p></div>${badge(null).replace('No record', o.pct + '%')}</div><div class="mt-4 text-sm space-y-1"><p>Subject: <b>${esc(s.subject) || '—'}</b></p><p>Days: <b>${esc(s.days)}</b></p><p>Time: <b>${fmtTime(s.time)}</b></p><p>Students: <b>${o.students}</b></p></div><div class="flex gap-2 mt-4"><button class="btn-sec" data-editsec="${s.id}">${icon.edit}Edit</button><button class="btn-danger" data-delsec="${s.id}">${icon.del}Delete</button></div></div>`;
  }).join('') : '<div class="card col-span-full text-center text-slate-500">' + icon.empty + 'No sections yet. Create one to begin.</div>';
}

function renderStudents() {
  secOptions($('stuSection'), true);
  const q = $('stuSearch').value.toLowerCase(), sec = $('stuSection').value;
  const rows = app.students.filter(s => (!sec || s.sectionId === sec) && s.name.toLowerCase().includes(q));
  $('stuBody').innerHTML = rows.length ? rows.map(s => `<tr><td class="font-medium">${esc(s.name)}</td><td>${esc(app.section(s.sectionId)?.name)}</td><td>${esc(s.lrn)}</td><td>${pctBar(app.percent(s.id))}</td><td><div class="flex gap-2 justify-end"><button class="btn-sec" data-hist="${s.id}">History</button><button class="btn-sec" data-editstu="${s.id}">${icon.edit}</button><button class="btn-danger" data-delstu="${s.id}">${icon.del}</button></div></td></tr>`).join('') : empty(5, 'No students found.');
}

function renderSummary() {
  const d = $('sumDate').value;
  const dl = app.daily(d);
  $('dailyBody').innerHTML = dl.length ? dl.map(r => `<tr><td>${fmtDate(r.date)}</td><td class="font-medium">${esc(r.section)}</td><td>${r.Present}</td><td>${r.Late}</td><td>${r.Absent}</td><td>${r.Excused}</td><td>${r.unmarked}</td><td>${r.marked ? pctBar(r.rate) : '<span class="text-slate-400">No data</span>'}</td></tr>`).join('') : empty(8, 'No sections.');
  const ov = app.overall();
  $('overallBody').innerHTML = ov.length ? ov.map(o => `<tr><td class="font-medium">${esc(o.section)}</td><td>${o.students}</td><td>${o.records}</td><td>${o.Present}</td><td>${o.Late}</td><td>${o.Absent}</td><td>${o.Excused}</td><td>${pctBar(o.pct)}</td></tr>`).join('') : empty(8, 'No sections.');
}

function renderHistory() {
  const headRow = $('histBody').parentNode.querySelector('thead tr');
  if (headRow && !headRow.querySelector('[data-subj]') && headRow.children[1]) headRow.children[1].insertAdjacentHTML('afterend', '<th data-subj="1">Subject</th>');
  const sel = $('histStudent'), cur = sel.value;
  sel.innerHTML = app.students.map(s => `<option value="${s.id}">${esc(s.name)} — ${esc(app.section(s.sectionId)?.name)}</option>`).join('');
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  const s = app.student(sel.value);
  if (!s) { $('histInfo').innerHTML = ''; $('histBody').innerHTML = empty(6, 'No students available.'); return; }
  const sec = app.section(s.sectionId);
  const subj = sec?.subject || '';
  const all = app.recordsFor(s.id), f = $('histStatus').value;
  const rs = all.filter(r => !f || r.status === f);
  const cnt = st => all.filter(r => r.status === st).length;
  $('histInfo').innerHTML = `<div class="flex flex-wrap items-center gap-4 p-4 bg-slate-50 rounded-xl"><div><p class="font-semibold">${esc(s.name)}</p><p class="text-xs text-slate-500">${esc(sec?.name)}${subj ? ' · ' + esc(subj) : ''}</p></div>${pctBar(app.percent(s.id))}${STATUSES.map(st => badge(st).replace(st, st + ': ' + cnt(st))).join('')}</div>`;
  $('histBody').innerHTML = rs.length ? rs.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${new Date(r.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })}</td><td>${esc(subj) || '—'}</td><td>${fmtTime(r.time)}</td><td>${badge(r.status)}</td><td class="text-right"><button class="btn-danger" data-delrec="${r.id}">${icon.del}</button></td></tr>`).join('') : empty(6, 'No attendance records for this filter.');
}

function render() {
  secOptions($('dashSection'), true);
  if (currentView === 'dashboard') renderDash();
  if (currentView === 'attendance') renderAtt();
  if (currentView === 'sections') renderSections();
  if (currentView === 'students') renderStudents();
  if (currentView === 'summary') renderSummary();
  if (currentView === 'history') renderHistory();
}

/* Modal */
let modalSubmit = null;
function openModal(title, fields, values, onSave) {
  $('modalTitle').textContent = title;
  $('modalErr').classList.add('hidden');
  $('modalFields').innerHTML = fields.map(f => {
    const v = values[f.name] ?? '';
    const input = f.type === 'select'
      ? `<select name="${f.name}" class="inp w-full mt-1">${f.options.map(o => `<option value="${o[0]}" ${o[0] === v ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`
      : `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${f.ph || ''}" class="inp w-full mt-1">`;
    return `<label class="block text-sm font-medium">${f.label}${input}</label>`;
  }).join('');
  modalSubmit = onSave;
  $('modal').classList.remove('hidden'); $('modal').classList.add('flex');
}
function closeModal() {
  $('modal').classList.add('hidden'); $('modal').classList.remove('flex');
  $('modalForm').classList.remove('max-w-2xl'); $('modalForm').classList.add('max-w-md');
}

$('modalForm').addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData($('modalForm')).entries());
  Object.keys(data).forEach(k => data[k] = String(data[k]).trim());
  const err = modalSubmit(data);
  if (err) { $('modalErr').textContent = err; $('modalErr').classList.remove('hidden'); return; }
  closeModal(); render();
});
$('modalCancel').onclick = closeModal;
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });

const dayOpts = 'Mon, Tue, Wed, Thu, Fri, Sat'.split(', ');
function sectionForm(sec) {
  const fields = [
    { name: 'name', label: 'Section name', ph: 'Grade 10 - Rizal' },
    { name: 'subject', label: 'Subject', ph: 'Mathematics' },
    { name: 'days', label: 'Class days', ph: 'Mon, Wed, Fri' },
    { name: 'time', label: 'Class time', type: 'time' },
    { name: 'room', label: 'Room', ph: 'Room 201' },
    { name: 'adviser', label: 'Teacher / Adviser', ph: 'Ms. Reyes' }
  ];
  openModal(sec ? 'Edit section' : 'New section', fields, sec || { time: '08:00' }, d => {
    if (!d.name || !d.days || !d.time) return 'Name, class days and time are required.';
    const bad = d.days.split(',').map(x => x.trim()).filter(x => !dayOpts.includes(x));
    if (bad.length) return 'Use day abbreviations like Mon, Tue, Wed, Thu, Fri, Sat.';
    if (app.sections.some(s => s.name.toLowerCase() === d.name.toLowerCase() && s.id !== sec?.id)) return 'A section with this name already exists.';
    sec ? app.updateSection(sec.id, d) : app.addSection(d);
    toast(sec ? 'Section updated' : 'Section created');
  });
}
function studentForm(stu) {
  if (!app.sections.length) return toast('Create a section first', 'err');
  const fields = [
    { name: 'name', label: 'Full name', ph: 'Juan Dela Cruz' },
    { name: 'sectionId', label: 'Section', type: 'select', options: app.sections.map(s => [s.id, s.name]) }
  ];
  openModal(stu ? 'Edit student' : 'Add student', fields, stu || {}, d => {
    if (!d.name) return 'Name is required.';
    stu ? app.updateStudent(stu.id, d) : app.addStudent(d);
    toast(stu ? 'Student updated' : 'Student added');
  });
}
function bulkEditForm() {
  const sec = $('stuSection').value;
  const list = app.students.filter(s => !sec || s.sectionId === sec);
  if (!list.length) return toast('No students to edit', 'err');
  const secs = app.sections;
  openModal('Edit students', [], {}, d => {
    let removed = 0;
    for (const s of list) {
      if (!('n_' + s.id in d)) { removed++; continue; }
      if (!d['n_' + s.id]) return 'Names cannot be empty. Remove the row to delete a student.';
    }
    if (removed && !confirm('Delete ' + removed + ' student(s) and their attendance history?')) return 'Cancelled deletion. Review the list and save again.';
    const order = Object.keys(d).filter(k => k.startsWith('n_')).map(k => k.slice(2));
    list.forEach(s => {
      if (!('n_' + s.id in d)) { app.deleteStudent(s.id); return; }
      const name = d['n_' + s.id], sectionId = d['s_' + s.id];
      if (name !== s.name || sectionId !== s.sectionId) app.updateStudent(s.id, { name, sectionId });
    });
    app.reorderStudents(order);
    toast('Students updated');
  });
  $('modalForm').classList.remove('max-w-md'); $('modalForm').classList.add('max-w-2xl');
  $('modalFields').innerHTML = '<p class="text-xs text-slate-500 mb-2">Drag the ☰ handle to reorder students.</p><table class="w-full text-sm"><thead><tr class="th-row"><th></th><th>Name</th><th>Section</th><th></th></tr></thead><tbody>' +
    list.map(s => `<tr><td data-grip="1" class="select-none text-slate-400 text-center" style="cursor:grab;width:2rem" title="Drag to reorder">☰</td><td><input name="n_${s.id}" value="${esc(s.name)}" class="inp w-full"></td><td><select name="s_${s.id}" class="inp w-full">${secs.map(x => `<option value="${x.id}" ${x.id === s.sectionId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></td><td><button type="button" class="btn-danger" data-rmrow="1">${icon.del}</button></td></tr>`).join('') +
    '</tbody></table>';
}

/* Drag to reorder rows in Edit all */
let dragRow = null;
document.addEventListener('mousedown', e => {
  const g = e.target.closest && e.target.closest('[data-grip]');
  if (g) g.closest('tr').draggable = true;
});
document.addEventListener('dragstart', e => {
  const tr = e.target.closest && e.target.closest('tr');
  if (!tr || !tr.querySelector('[data-grip]') || !$('modalFields').contains(tr)) return;
  dragRow = tr;
  tr.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', ''); } catch (x) {}
});
document.addEventListener('dragover', e => {
  if (!dragRow) return;
  const over = e.target.closest && e.target.closest('tr');
  if (!over || over === dragRow || over.parentNode !== dragRow.parentNode) return;
  e.preventDefault();
  const r = over.getBoundingClientRect();
  if (e.clientY > r.top + r.height / 2) over.after(dragRow); else over.before(dragRow);
});
document.addEventListener('drop', e => { if (dragRow) e.preventDefault(); });
document.addEventListener('dragend', () => {
  if (!dragRow) return;
  dragRow.style.opacity = '';
  dragRow.draggable = false;
  dragRow = null;
});

/* Events */
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.rmrow) { t.closest('tr').remove(); return; }
  if (t.dataset.view) return show(t.dataset.view);
  if (t.dataset.mark) {
    const [id, st] = t.dataset.mark.split('|');
    app.mark(id, $('attDate').value, st); toast(app.student(id).name + ' marked ' + st); renderAtt(); return;
  }
  if (t.dataset.editsec) return sectionForm(app.section(t.dataset.editsec));
  if (t.dataset.delsec) {
    const s = app.section(t.dataset.delsec);
    if (confirm('Delete ' + s.name + ' with all its students and records?')) { app.deleteSection(s.id); toast('Section deleted'); render(); }
    return;
  }
  if (t.dataset.editstu) return studentForm(app.student(t.dataset.editstu));
  if (t.dataset.delstu) {
    const s = app.student(t.dataset.delstu);
    if (confirm('Delete ' + s.name + ' and their attendance history?')) { app.deleteStudent(s.id); toast('Student deleted'); render(); }
    return;
  }
  if (t.dataset.hist) { $('histStudent').innerHTML = app.students.map(s => `<option value="${s.id}">x</option>`).join(''); $('histStudent').value = t.dataset.hist; const id = t.dataset.hist; show('history'); $('histStudent').value = id; renderHistory(); return; }
  if (t.dataset.delrec) { app.deleteRecord(t.dataset.delrec); toast('Record deleted'); renderHistory(); return; }
});

$('menuBtn').onclick = () => { $('sidebar').classList.remove('-translate-x-full'); $('overlay').classList.remove('hidden'); };
$('overlay').onclick = () => { $('sidebar').classList.add('-translate-x-full'); $('overlay').classList.add('hidden'); };
$('addSectionBtn').onclick = () => sectionForm(null);
$('addStudentBtn').onclick = () => studentForm(null);
(function () {
  const add = $('addStudentBtn');
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'editAllBtn';
  b.className = 'btn-sec justify-center';
  b.innerHTML = icon.edit + 'Edit all';
  b.onclick = bulkEditForm;
  add.parentNode.insertBefore(b, add);
})();
(function () {
  const st = document.createElement('style');
  st.textContent = '@media (min-width:1024px){#sidebar{position:sticky;top:0;height:100vh;align-self:flex-start;overflow-y:auto;flex-shrink:0}}';
  document.head.appendChild(st);
})();
['dashSearch', 'dashSection', 'dashSort'].forEach(i => $(i).addEventListener('input', renderDash));
['stuSearch', 'stuSection'].forEach(i => $(i).addEventListener('input', renderStudents));
['attSection', 'attDate'].forEach(i => $(i).addEventListener('input', renderAtt));
$('sumDate').addEventListener('input', renderSummary);
['histStudent', 'histStatus'].forEach(i => $(i).addEventListener('input', renderHistory));
$('markAllPresent').onclick = () => {
  const sec = $('attSection').value, d = $('attDate').value;
  const studs = app.students.filter(s => s.sectionId === sec);
  if (!studs.length) return toast('No students to mark', 'err');
  studs.forEach(s => app.mark(s.id, d, 'Present'));
  toast('All students marked Present'); renderAtt();
};
$('exportDaily').onclick = () => {
  const d = $('sumDate').value;
  downloadCSV('daily-summary-' + d + '.csv', [['Date', 'Section', 'Present', 'Late', 'Absent', 'Excused', 'Unmarked', 'Rate %']].concat(app.daily(d).map(r => [r.date, r.section, r.Present, r.Late, r.Absent, r.Excused, r.unmarked, r.rate])));
};
$('exportOverall').onclick = () => downloadCSV('overall-summary.csv', [['Section', 'Students', 'Records', 'Present', 'Late', 'Absent', 'Excused', 'Overall %']].concat(app.overall().map(o => [o.section, o.students, o.records, o.Present, o.Late, o.Absent, o.Excused, o.pct])));
$('exportHist').onclick = () => {
  const s = app.student($('histStudent').value);
  if (!s) return toast('Select a student first', 'err');
  const subj = app.section(s.sectionId)?.subject || '';
  downloadCSV('history-' + s.name.replace(/\s+/g, '-') + '.csv', [['Student', 'Date', 'Subject', 'Time-in', 'Status']].concat(app.recordsFor(s.id).map(r => [s.name, r.date, subj, r.time, r.status])));
};

(function () {
  const screen = $('loginScreen'), form = $('loginForm');
  if (!screen || !form) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'loginBack';
  b.className = 'w-full text-sm text-slate-500 hover:underline hidden';
  b.textContent = '← Back';
  form.appendChild(b);
  const sync = () => {
    const open = !screen.classList.contains('hidden');
    let has = false;
    try {
      const c = localStorage.getItem('ams_current');
      has = !!c && JSON.parse(localStorage.getItem('ams_accounts') || '[]').some(a => a.user === c);
    } catch (e) {}
    b.classList.toggle('hidden', !(open && has));
  };
  new MutationObserver(sync).observe(screen, { attributes: true, attributeFilter: ['class'] });
  b.onclick = () => { screen.classList.add('hidden'); screen.classList.remove('flex'); };
  sync();
})();

(function () {
  const screen = $('loginScreen'), form = $('loginForm');
  if (!screen || !form) return;
  const KA = 'ams_accounts', KL = 'ams_forgot_lock';
  const link = document.createElement('button');
  link.type = 'button'; link.id = 'loginForgot';
  link.className = 'w-full text-sm text-slate-500 hover:underline';
  link.textContent = 'Forgot password?';
  form.appendChild(link);

  const box = document.createElement('form');
  box.id = 'forgotForm'; box.noValidate = true;
  box.className = 'bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 hidden';
  box.innerHTML = '<div><p class="font-semibold">Reset password</p><p class="text-xs text-slate-500">Enter your username and full name to set a new password.</p></div>' +
    '<label class="block text-sm font-medium">Username<input id="fpUser" class="inp w-full mt-1" autocomplete="off"></label>' +
    '<label class="block text-sm font-medium">Full name<input id="fpName" class="inp w-full mt-1" autocomplete="off"></label>' +
    '<label class="block text-sm font-medium">New password<input id="fpPass" type="password" class="inp w-full mt-1" autocomplete="new-password"></label>' +
    '<label class="block text-sm font-medium">Confirm new password<input id="fpPass2" type="password" class="inp w-full mt-1" autocomplete="new-password"></label>' +
    '<p id="fpErr" class="text-sm text-red-600 hidden"></p>' +
    '<button type="submit" class="btn w-full justify-center">Change password</button>' +
    '<button type="button" id="fpCancel" class="w-full text-sm text-slate-500 hover:underline">← Back to sign in</button>';
  screen.appendChild(box);

  const err = m => { const e = $('fpErr'); e.textContent = m; e.classList.remove('hidden'); };
  const syncLink = () => {
    const signup = !$('loginNameWrap').classList.contains('hidden');
    let has = false;
    try { has = JSON.parse(localStorage.getItem(KA) || '[]').length > 0; } catch (e) {}
    link.classList.toggle('hidden', signup || !has);
  };
  new MutationObserver(syncLink).observe($('loginNameWrap'), { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(() => {
    if (screen.classList.contains('hidden')) { box.classList.add('hidden'); form.classList.remove('hidden'); }
    syncLink();
  }).observe(screen, { attributes: true, attributeFilter: ['class'] });
  syncLink();

  link.onclick = () => {
    form.classList.add('hidden'); box.classList.remove('hidden');
    ['fpUser', 'fpName', 'fpPass', 'fpPass2'].forEach(i => $(i).value = '');
    $('fpErr').classList.add('hidden');
    const u = $('loginUser').value.trim(); if (u) $('fpUser').value = u;
  };
  $('fpCancel').onclick = () => { box.classList.add('hidden'); form.classList.remove('hidden'); };

  box.addEventListener('submit', e => {
    e.preventDefault();
    let lock = { n: 0, until: 0 };
    try { lock = JSON.parse(localStorage.getItem(KL) || 'null') || lock; } catch (x) {}
    if (Date.now() < lock.until) return err('Too many attempts. Try again in ' + Math.ceil((lock.until - Date.now()) / 1000) + 's.');
    const user = $('fpUser').value.trim(), name = $('fpName').value.trim().toLowerCase();
    const p1 = $('fpPass').value, p2 = $('fpPass2').value;
    let accs = [];
    try { accs = JSON.parse(localStorage.getItem(KA) || '[]'); } catch (x) {}
    const acc = accs.find(a => a.user === user && String(a.name || '').trim().toLowerCase() === name);
    if (!acc) {
      lock.n = (lock.n || 0) + 1;
      if (lock.n >= 3) { lock = { n: 0, until: Date.now() + 60000 }; localStorage.setItem(KL, JSON.stringify(lock)); return err('Too many attempts. Locked for 1 minute.'); }
      localStorage.setItem(KL, JSON.stringify(lock));
      return err('Username and full name do not match. ' + (3 - lock.n) + ' attempt(s) left.');
    }
    if (p1.length < 4) return err('New password must be at least 4 characters.');
    if (p1 !== p2) return err('Passwords do not match.');
    const key = ['pass', 'password', 'pw', 'pwd'].find(k => k in acc);
    if (!key) return err('Cannot reset password for this account.');
    acc[key] = p1;
    localStorage.setItem(KA, JSON.stringify(accs));
    localStorage.removeItem(KL);
    toast('Password changed. Please sign in.');
    setTimeout(() => location.reload(), 600);
  });
})();

$('attDate').value = todayStr();
$('sumDate').value = todayStr();
tickClock(); setInterval(tickClock, 1000);
show('dashboard');
