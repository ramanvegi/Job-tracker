import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, setDoc, getDoc
} from 'firebase/firestore';
import { db } from './firebase';

const STATUS_OPTIONS = ['Applied', 'Waiting', 'Exam Completed', 'Phone Screen', 'Interviewing', 'Offer', 'Accepted', 'Rejected', 'Withdrawn', 'Wishlist'];
const TYPE_OPTIONS = ['Referral', 'Cold Mail', 'Manual'];
const LOG_TYPE_OPTIONS = ['Referral', 'Cold Mail', 'Manual', 'Manual Easy'];
const TYPE_COLORS = { Referral: '#5B8DEF', 'Cold Mail': '#F5A623', Manual: '#2DD4BF' };
const STATUS_COLORS = {
  Applied: '#8B93A1', Waiting: '#38BDF8', 'Exam Completed': '#10B981', 'Phone Screen': '#5B8DEF', Interviewing: '#F5A623',
  Offer: '#4ADE80', Accepted: '#4ADE80', Rejected: '#F0556B', Withdrawn: '#5B616F', Wishlist: '#A78BFA'
};

function toLocalYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const todayStr = () => toLocalYMD(new Date());

const emptyForm = () => ({
  date: todayStr(), applicationType: 'Manual', source: '', companyName: '', role: '',
  jobLink: '', referralReqSent: '', responsesReceived: '', referralsGiven: '',
  status: 'Applied', avgSalary: '', followUpDate: '', applied: 'YES', remarks: ''
});

function toDateObj(str) { return new Date(str + 'T00:00:00'); }
function getMonday(dateStr) {
  const d = toDateObj(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalYMD(d);
}
function formatDisplay(str) {
  if (!str) return '—';
  const d = toDateObj(str);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatWeekLabel(mondayStr) {
  const start = toDateObj(mondayStr);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${s} – ${e}`;
}
function daysInMonth(year, monthIdx) { return new Date(year, monthIdx + 1, 0).getDate(); }
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function normType(t) { if (t === 'Manual Easy') return 'Manual'; return TYPE_OPTIONS.includes(t) ? t : 'Manual'; }

function ProgressBar({ value, target, color }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="jat-bar-track">
      <div className="jat-bar-fill" style={{ width: pct + '%', background: color }} />
    </div>
  );
}

export default function JobTracker({ user, onSignOut }) {
  const [applications, setApplications] = useState([]);
  const [targets, setTargets] = useState({ Manual: 25, Referral: 5, 'Cold Mail': 5 });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [tab, setTab] = useState('log');
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const tableRef = React.useRef(null);
  const tableWrapRef = React.useRef(null);
  const topScrollRef = React.useRef(null);

  useEffect(() => {
    if (tableRef.current) {
      setTableScrollWidth(tableRef.current.scrollWidth);
    }
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setTableScrollWidth(entry.target.scrollWidth);
      }
    });
    if (tableRef.current) observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [applications, tab, search, statusFilter, editingId]);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableWrapRef.current) {
      tableWrapRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableWrapRef.current) {
      topScrollRef.current.scrollLeft = tableWrapRef.current.scrollLeft;
    }
  };

  const appsCol = collection(db, 'users', user.uid, 'applications');
  const targetsDocRef = doc(db, 'users', user.uid, 'settings', 'targets');

  // Live sync: applications, ordered newest-entered-first
  useEffect(() => {
    const q = query(appsCol, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDataLoaded(true);
    }, () => setDataLoaded(true));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  // Live sync: targets
  useEffect(() => {
    const unsub = onSnapshot(targetsDocRef, snap => {
      if (snap.exists()) setTargets(snap.data());
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const interval = setInterval(() => {
      const t = todayStr();
      setToday(prevToday => {
        if (t !== prevToday) {
          setForm(f => (f.date === prevToday ? { ...f, date: t } : f));
        }
        return t;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const targetTotal = Number(targets.Manual) || 0;

  async function handleAdd(e) {
    e.preventDefault();
    if (editingId) {
      await saveEdit();
      return;
    }
    if (!form.companyName.trim() || !form.role.trim()) return;
    try {
      await addDoc(appsCol, { ...form, createdAt: serverTimestamp() });
      setForm(emptyForm());
    } catch (err) {
      alert('Could not save: ' + err.message);
    }
  }

  function startEdit(a) { setEditingId(a.id); setForm({ ...a }); }
  async function saveEdit() {
    const { id, createdAt, ...fields } = form;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'applications', editingId), fields);
      setEditingId(null);
      setForm(emptyForm());
    } catch (err) {
      alert('Could not save: ' + err.message);
    }
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm()); }
  async function doDelete(id) {
    if (!window.confirm("Are you sure you want to delete this application?")) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'applications', id));
      if (id === editingId) {
        setEditingId(null);
        setForm(emptyForm());
      }
    } catch (err) {
      alert('Could not delete: ' + err.message);
    }
  }

  async function updateTarget(key, value) {
    const next = { ...targets, [key]: value };
    setTargets(next);
    try {
      await setDoc(targetsDocRef, next, { merge: true });
    } catch (err) {
      console.error('Could not save target:', err);
    }
  }

  const dailyData = useMemo(() => {
    const map = {};
    applications.forEach(a => {
      if (!a.date) return;
      if (!map[a.date]) map[a.date] = { Referral: 0, 'Cold Mail': 0, Manual: 0, total: 0 };
      const t = normType(a.applicationType);
      map[a.date][t]++; map[a.date].total++;
    });
    return Object.entries(map).sort((x, y) => y[0].localeCompare(x[0]));
  }, [applications]);

  const weeklyData = useMemo(() => {
    const map = {};
    applications.forEach(a => {
      if (!a.date) return;
      const wk = getMonday(a.date);
      if (!map[wk]) map[wk] = { Referral: 0, 'Cold Mail': 0, Manual: 0, total: 0 };
      const t = normType(a.applicationType);
      map[wk][t]++; map[wk].total++;
    });
    return Object.entries(map).sort((x, y) => y[0].localeCompare(x[0]));
  }, [applications]);

  const monthlyData = useMemo(() => {
    const map = {};
    applications.forEach(a => {
      if (!a.date) return;
      const key = a.date.slice(0, 7);
      if (!map[key]) map[key] = { Referral: 0, 'Cold Mail': 0, Manual: 0, total: 0 };
      const t = normType(a.applicationType);
      map[key][t]++; map[key].total++;
    });
    return Object.entries(map).sort((x, y) => y[0].localeCompare(x[0]));
  }, [applications]);

  const summary = useMemo(() => {
    const statusCounts = {}; STATUS_OPTIONS.forEach(s => statusCounts[s] = 0);
    const typeCounts = {}; TYPE_OPTIONS.forEach(t => typeCounts[t] = 0);
    let referralSent = 0, responses = 0, referralsGiven = 0;
    applications.forEach(a => {
      if (statusCounts[a.status] !== undefined) statusCounts[a.status]++;
      typeCounts[normType(a.applicationType)]++;
      referralSent += Number(a.referralReqSent) || 0;
      responses += Number(a.responsesReceived) || 0;
      referralsGiven += Number(a.referralsGiven) || 0;
    });
    return { statusCounts, typeCounts, total: applications.length, referralSent, responses, referralsGiven };
  }, [applications]);

  const todayCounts = dailyData.find(([d]) => d === today)?.[1] || { Referral: 0, 'Cold Mail': 0, Manual: 0, total: 0 };

  const filteredApps = useMemo(() => {
    return applications.filter(a => {
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (a.companyName || '').toLowerCase().includes(q) || (a.role || '').toLowerCase().includes(q) || (a.source || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [applications, search, statusFilter]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const logRows = applications.map(a => ({
      Date: a.date, 'Application Type': a.applicationType, Source: a.source, 'Company Name': a.companyName,
      Role: a.role, 'Job Link': a.jobLink, 'Referral Req Sent': a.referralReqSent, 'Responses Received': a.responsesReceived,
      'Referrals Given': a.referralsGiven, Status: a.status, 'Avg Salary': a.avgSalary, 'Follow-up Date': a.followUpDate,
      Applied: a.applied, Remarks: a.remarks
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logRows), 'Main Log');

    const dailyRows = dailyData.map(([date, v]) => ({
      Date: date, Referral: v.Referral, 'Cold Mail': v['Cold Mail'], Manual: v.Manual, 'Total Applied': v.total,
      'Manual Target': targetTotal, Status: v.Manual >= targetTotal ? 'Target Met' : 'Below Target'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyRows), 'Daily Tracker');

    const weeklyRows = weeklyData.map(([wk, v]) => ({
      'Week Of': wk, Referral: v.Referral, 'Cold Mail': v['Cold Mail'], Manual: v.Manual, 'Total Applied': v.total,
      'Manual Target': targetTotal * 7, Status: v.Manual >= targetTotal * 7 ? 'Target Met' : 'Below Target'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weeklyRows), 'Weekly Tracker');

    const monthlyRows = monthlyData.map(([key, v]) => {
      const [y, m] = key.split('-').map(Number);
      const target = targetTotal * daysInMonth(y, m - 1);
      return {
        Month: monthLabel(key), Referral: v.Referral, 'Cold Mail': v['Cold Mail'], Manual: v.Manual,
        'Total Applied': v.total, 'Manual Target': target, Status: v.Manual >= target ? 'Target Met' : 'Below Target'
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyRows), 'Monthly Tracker');

    const summaryRows = [
      ...STATUS_OPTIONS.map(s => ({ Status: s, Count: summary.statusCounts[s] })),
      { Status: 'Total Applications', Count: summary.total },
      {}, { 'Application Type': 'Referral', Count: summary.typeCounts.Referral },
      { 'Application Type': 'Cold Mail', Count: summary.typeCounts['Cold Mail'] },
      { 'Application Type': 'Manual', Count: summary.typeCounts.Manual }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Overall Summary');

    XLSX.writeFile(wb, 'job-application-tracker.xlsx');
  }

  const inputCls = 'jat-input';

  return (
    <div className="jat-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .jat-root {
          --bg: #0F1115; --surface: #171B22; --surface-2: #1D222B; --border: #262B35;
          --text: #EDEFF3; --text-dim: #8B93A1; --text-faint: #5B616F;
          --referral: #5B8DEF; --coldmail: #F5A623; --manual: #2DD4BF;
          --success: #4ADE80; --danger: #F0556B;
          background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif;
          min-height: 100vh; padding: 24px; box-sizing: border-box;
        }
        .jat-root * { box-sizing: border-box; }
        .jat-display { font-family: 'Space Grotesk', sans-serif; }
        .jat-mono { font-family: 'IBM Plex Mono', monospace; }
        .jat-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
        .jat-title { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
        .jat-subtitle { color: var(--text-dim); font-size: 13px; margin-top: 4px; }
        .jat-header-actions { display: flex; gap: 10px; align-items: center; }
        .jat-user-email { color: var(--text-dim); font-size: 12px; }
        .jat-export-btn, .jat-signout-btn { background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; }
        .jat-export-btn:hover, .jat-signout-btn:hover { border-color: var(--text-faint); }
        .jat-pulse { 
          display: flex; gap: 14px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; 
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 8px 30px rgba(0,0,0,0.6);
        }
        .jat-pulse-item { min-width: 130px; flex: 1; }
        .jat-pulse-label { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
        .jat-pulse-count { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--text); }
        .jat-bar-track { height: 6px; background: var(--surface-2); border-radius: 3px; overflow: hidden; }
        .jat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
        .jat-tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .jat-tab { padding: 10px 16px; background: none; border: none; color: var(--text-dim); font-size: 13px;
          font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; font-family: 'Inter', sans-serif; }
        .jat-tab.active { color: var(--text); border-bottom-color: var(--referral); }
        .jat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 18px; }
        .jat-card-title { font-size: 14px; font-weight: 600; margin: 0 0 14px 0; }
        .jat-form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
        .jat-input, .jat-select { background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          padding: 8px 10px; border-radius: 6px; font-size: 13px; width: 100%; font-family: 'Inter', sans-serif; }
        .jat-input::placeholder { color: var(--text-faint); }
        .jat-input:focus, .jat-select:focus { outline: none; border-color: var(--referral); }
        .jat-textarea { background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          padding: 8px 10px; border-radius: 6px; font-size: 13px; width: 100%; font-family: 'Inter', sans-serif;
          resize: vertical; min-height: 60px; }
        .jat-textarea::placeholder { color: var(--text-faint); }
        .jat-textarea:focus { outline: none; border-color: var(--referral); }
        .jat-add-btn { background: var(--referral); color: #0F1115; border: none; padding: 9px 18px; border-radius: 6px;
          font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 12px; }
        .jat-add-btn:hover { opacity: 0.9; }
        .jat-toolbar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .jat-toolbar .jat-input, .jat-toolbar .jat-select { width: auto; min-width: 160px; }
        .jat-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
        .jat-top-scroll-wrap {
          overflow-x: auto;
          overflow-y: hidden;
          width: 100%;
          height: 10px;
          margin-bottom: 4px;
          position: sticky;
          top: 62px; /* Adds spacing gap below the sticky header bar */
          z-index: 99;
          background: var(--bg);
        }
        .jat-top-scroll-wrap::-webkit-scrollbar,
        .jat-table-wrap::-webkit-scrollbar {
          height: 6px;
        }
        .jat-top-scroll-wrap::-webkit-scrollbar-track,
        .jat-table-wrap::-webkit-scrollbar-track {
          background: var(--surface-2);
          border-radius: 3px;
        }
        .jat-top-scroll-wrap::-webkit-scrollbar-thumb,
        .jat-table-wrap::-webkit-scrollbar-thumb {
          background: #ffffff;
          border-radius: 3px;
        }
        .jat-top-scroll-wrap::-webkit-scrollbar-thumb:hover,
        .jat-table-wrap::-webkit-scrollbar-thumb:hover {
          background: #e2e8f0;
        }
        table.jat-table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
        table.jat-table th { background: var(--surface-2); color: var(--text-dim); text-align: left; padding: 10px 12px;
          font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
        table.jat-table td { padding: 9px 12px; border-top: 1px solid var(--border); vertical-align: top; }
        table.jat-table tr:hover td { background: rgba(255,255,255,0.02); }
        .jat-tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .jat-link { color: var(--referral); text-decoration: none; max-width: 200px; display: inline-block;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
        .jat-link:hover { text-decoration: underline; }
        .jat-icon-btn { background: none; border: 1px solid var(--border); color: var(--text-dim); border-radius: 5px;
          padding: 4px 8px; font-size: 11px; cursor: pointer; margin-right: 4px; font-family: 'Inter', sans-serif; }
        .jat-icon-btn:hover { color: var(--text); border-color: var(--text-faint); }
        .jat-icon-btn.danger:hover { color: var(--danger); border-color: var(--danger); }
        .jat-empty { text-align: center; color: var(--text-faint); padding: 30px; font-size: 13px; }
        .jat-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 18px; }
        .jat-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
        .jat-kpi-label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 6px; }
        .jat-kpi-value { font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 500; }
        .jat-status-list { display: flex; flex-direction: column; gap: 8px; }
        .jat-status-row { display: flex; align-items: center; gap: 10px; }
        .jat-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .jat-status-name { flex: 1; font-size: 13px; color: var(--text-dim); }
        .jat-status-count { font-family: 'IBM Plex Mono', monospace; font-size: 13px; }
        .jat-target-form { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
        .jat-target-field label { display: block; font-size: 11px; color: var(--text-dim); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
        .jat-target-field input { width: 100px; }
        .jat-met { color: var(--success); font-weight: 600; }
        .jat-notmet { color: var(--text-faint); }
        
        @media (max-width: 768px) {
          .jat-root { padding: 12px; }
          .jat-header { flex-direction: column; align-items: stretch; gap: 12px; }
          .jat-header-actions { flex-direction: column; align-items: stretch; width: 100%; gap: 8px; }
          .jat-user-email { text-align: left; }
          .jat-pulse { padding: 12px; gap: 12px; }
          .jat-pulse-item { min-width: calc(50% - 6px); }
          .jat-pulse-item:last-child { min-width: 100%; }
           .jat-toolbar { flex-direction: column; align-items: stretch; }
          .jat-toolbar .jat-input, .jat-toolbar .jat-select { width: 100%; }
          .jat-form-grid { grid-template-columns: 1fr; }
          .jat-kpi-row { grid-template-columns: 1fr 1fr; }
           .jat-top-scroll-wrap { top: 112px; } /* Mobile adjustments for wrapped stats layout with gap */
        }
      `}</style>

      <div className="jat-header">
        <div>
          <h1 className="jat-title jat-display">Job Applications Tracker</h1>
          <div className="jat-subtitle">{formatDisplay(today)} · {applications.length} total applications logged</div>
        </div>
        <div className="jat-header-actions">
          <span className="jat-user-email">{user.email}</span>
          <button className="jat-export-btn" onClick={exportExcel}>Export to Excel</button>
          <button className="jat-signout-btn" onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      <div className="jat-pulse">
        <div className="jat-pulse-item">
          <div className="jat-pulse-label">
            <span>Referral</span>
            <span className="jat-pulse-count">{todayCounts.Referral} / {targets.Referral || 5}</span>
          </div>
          <ProgressBar value={todayCounts.Referral} target={Number(targets.Referral) || 5} color={TYPE_COLORS.Referral} />
        </div>
        <div className="jat-pulse-item">
          <div className="jat-pulse-label">
            <span>Cold Mail</span>
            <span className="jat-pulse-count">{todayCounts['Cold Mail']} / {targets['Cold Mail'] || 5}</span>
          </div>
          <ProgressBar value={todayCounts['Cold Mail']} target={Number(targets['Cold Mail']) || 5} color={TYPE_COLORS['Cold Mail']} />
        </div>
        <div className="jat-pulse-item">
          <div className="jat-pulse-label">
            <span>Manual</span>
            <span className="jat-pulse-count">{todayCounts.Manual} / {targets.Manual || 25}</span>
          </div>
          <ProgressBar value={todayCounts.Manual} target={Number(targets.Manual) || 25} color={TYPE_COLORS.Manual} />
        </div>
        <div className="jat-pulse-item" style={{ minWidth: 130 }}>
          <div className="jat-pulse-label">
            <span>Today's Total</span>
            <span className="jat-pulse-count">{todayCounts.total} applied</span>
          </div>
        </div>
      </div>

      <div className="jat-tabs">
        {[
          ['log', 'Main Log'], ['daily', 'Daily'], ['weekly', 'Weekly'],
          ['monthly', 'Monthly'], ['summary', 'Summary'], ['targets', 'Targets']
        ].map(([key, label]) => (
          <button key={key} className={'jat-tab' + (tab === key ? ' active' : '')} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {!dataLoaded && <div className="jat-empty">Loading your data…</div>}

      {dataLoaded && tab === 'log' && (
        <>
          <div className="jat-card">
            <h3 className="jat-card-title">{editingId ? 'Edit application details' : 'Log a new application (adds to the top of the table)'}</h3>
            <form onSubmit={handleAdd}>
              <div className="jat-form-grid">
                <input className={inputCls} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                <select className="jat-select" value={form.applicationType} onChange={e => setForm({ ...form, applicationType: e.target.value })}>
                  {LOG_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className={inputCls} placeholder="Source (e.g. LinkedIn)" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} maxLength={300} />
                <input className={inputCls} placeholder="Company name" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} required maxLength={300} />
                <input className={inputCls} placeholder="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} required maxLength={300} />
                <input className={inputCls} placeholder="Job link (URL)" value={form.jobLink} onChange={e => setForm({ ...form, jobLink: e.target.value })} maxLength={1000} />
                <input className={inputCls} placeholder="Referral req sent" value={form.referralReqSent} onChange={e => setForm({ ...form, referralReqSent: e.target.value })} maxLength={300} />
                <input className={inputCls} placeholder="Responses received" value={form.responsesReceived} onChange={e => setForm({ ...form, responsesReceived: e.target.value })} maxLength={300} />
                <input className={inputCls} placeholder="Referrals given" value={form.referralsGiven} onChange={e => setForm({ ...form, referralsGiven: e.target.value })} maxLength={300} />
                <select className="jat-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className={inputCls} placeholder="Avg salary" value={form.avgSalary} onChange={e => setForm({ ...form, avgSalary: e.target.value })} maxLength={300} />
                <input className={inputCls} type="date" placeholder="Follow-up date" value={form.followUpDate} onChange={e => setForm({ ...form, followUpDate: e.target.value })} />
                <select className="jat-select" value={form.applied} onChange={e => setForm({ ...form, applied: e.target.value })}>
                  <option value="YES">Applied: YES</option>
                  <option value="NO">Applied: NO</option>
                </select>
                <textarea className="jat-textarea" placeholder="Remarks" rows={3} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} style={{ gridColumn: '1 / -1' }} maxLength={500} />
              </div>
              {editingId ? (
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button type="submit" className="jat-add-btn" style={{ margin: 0 }}>Save changes</button>
                  <button type="button" className="jat-add-btn danger" style={{ margin: 0, background: 'var(--danger)', color: '#fff' }} onClick={() => doDelete(editingId)}>Delete application</button>
                  <button type="button" className="jat-add-btn" style={{ margin: 0, background: 'var(--surface-2)', color: 'var(--text)' }} onClick={cancelEdit}>Cancel</button>
                </div>
              ) : (
                <button type="submit" className="jat-add-btn">Add to top</button>
              )}
            </form>
          </div>

          <div className="jat-toolbar">
            <input className="jat-input" placeholder="Search company, role, source…" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="jat-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {tableScrollWidth > 0 && (
            <div 
              ref={topScrollRef} 
              onScroll={handleTopScroll} 
              className="jat-top-scroll-wrap"
            >
              <div style={{ width: tableScrollWidth + 'px', height: '1px' }} />
            </div>
          )}
          <div className="jat-table-wrap" ref={tableWrapRef} onScroll={handleTableScroll}>
            {filteredApps.length === 0 ? (
              <div className="jat-empty">No applications yet. Add your first one above — it'll appear right here at the top.</div>
            ) : (
              <table className="jat-table" ref={tableRef}>
                <thead>
                  <tr>
                    <th>Date</th><th>Type</th><th>Source</th><th>Company</th><th>Role</th><th>Job Link</th>
                    <th>Ref Sent</th><th>Responses</th><th>Ref Given</th><th>Status</th><th>Avg Salary</th>
                    <th>Follow-up</th><th>Applied</th><th>Remarks</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map(a => (
                    <tr key={a.id} style={editingId === a.id ? { background: 'rgba(91, 141, 239, 0.15)' } : {}}>
                      <td className="jat-mono">{formatDisplay(a.date)}</td>
                      <td><span className="jat-tag" style={{ background: TYPE_COLORS[normType(a.applicationType)] + '22', color: TYPE_COLORS[normType(a.applicationType)] }}>{a.applicationType}</span></td>
                      <td>{a.source || '—'}</td>
                      <td>{a.companyName}</td>
                      <td>{a.role}</td>
                      <td>{a.jobLink ? <a className="jat-link" href={a.jobLink} target="_blank" rel="noopener noreferrer">{a.jobLink}</a> : '—'}</td>
                      <td className="jat-mono">{a.referralReqSent || '—'}</td>
                      <td className="jat-mono">{a.responsesReceived || '—'}</td>
                      <td className="jat-mono">{a.referralsGiven || '—'}</td>
                      <td><span className="jat-tag" style={{ background: STATUS_COLORS[a.status] + '22', color: STATUS_COLORS[a.status] }}>{a.status}</span></td>
                      <td>{a.avgSalary || '—'}</td>
                      <td className="jat-mono">{a.followUpDate ? formatDisplay(a.followUpDate) : '—'}</td>
                      <td>{a.applied}</td>
                      <td style={{ maxWidth: 260, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.remarks || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="jat-icon-btn" onClick={() => startEdit(a)}>Edit</button>
                        <button className="jat-icon-btn danger" onClick={() => doDelete(a.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {dataLoaded && tab === 'daily' && (
        <>
          {tableScrollWidth > 0 && (
            <div ref={topScrollRef} onScroll={handleTopScroll} className="jat-top-scroll-wrap">
              <div style={{ width: tableScrollWidth + 'px', height: '1px' }} />
            </div>
          )}
          <div className="jat-table-wrap" ref={tableWrapRef} onScroll={handleTableScroll}>
            {dailyData.length === 0 ? <div className="jat-empty">No data yet.</div> : (
              <table className="jat-table" ref={tableRef}>
                <thead><tr><th>Date</th><th>Referral</th><th>Cold Mail</th><th>Manual</th><th>Manual Target</th><th>Status</th><th>Total</th></tr></thead>
                <tbody>
                  {dailyData.map(([date, v]) => (
                    <tr key={date}>
                      <td className="jat-mono">{formatDisplay(date)}</td>
                      <td className="jat-mono">{v.Referral}</td>
                      <td className="jat-mono">{v['Cold Mail']}</td>
                      <td className="jat-mono">{v.Manual}</td>
                      <td className="jat-mono">{targetTotal}</td>
                      <td className={v.Manual >= targetTotal ? 'jat-met' : 'jat-notmet'}>{v.Manual >= targetTotal ? 'Target Met' : 'Below Target'}</td>
                      <td className="jat-mono">{v.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {dataLoaded && tab === 'weekly' && (
        <>
          {tableScrollWidth > 0 && (
            <div ref={topScrollRef} onScroll={handleTopScroll} className="jat-top-scroll-wrap">
              <div style={{ width: tableScrollWidth + 'px', height: '1px' }} />
            </div>
          )}
          <div className="jat-table-wrap" ref={tableWrapRef} onScroll={handleTableScroll}>
            {weeklyData.length === 0 ? <div className="jat-empty">No data yet.</div> : (
              <table className="jat-table" ref={tableRef}>
                <thead><tr><th>Week</th><th>Referral</th><th>Cold Mail</th><th>Manual</th><th>Manual Target</th><th>Status</th><th>Total</th></tr></thead>
                <tbody>
                  {weeklyData.map(([wk, v]) => {
                    const wTarget = targetTotal * 7;
                    return (
                      <tr key={wk}>
                        <td className="jat-mono">{formatWeekLabel(wk)}</td>
                        <td className="jat-mono">{v.Referral}</td>
                        <td className="jat-mono">{v['Cold Mail']}</td>
                        <td className="jat-mono">{v.Manual}</td>
                        <td className="jat-mono">{wTarget}</td>
                        <td className={v.Manual >= wTarget ? 'jat-met' : 'jat-notmet'}>{v.Manual >= wTarget ? 'Target Met' : 'Below Target'}</td>
                        <td className="jat-mono">{v.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {dataLoaded && tab === 'monthly' && (
        <>
          {tableScrollWidth > 0 && (
            <div ref={topScrollRef} onScroll={handleTopScroll} className="jat-top-scroll-wrap">
              <div style={{ width: tableScrollWidth + 'px', height: '1px' }} />
            </div>
          )}
          <div className="jat-table-wrap" ref={tableWrapRef} onScroll={handleTableScroll}>
            {monthlyData.length === 0 ? <div className="jat-empty">No data yet.</div> : (
              <table className="jat-table" ref={tableRef}>
                <thead><tr><th>Month</th><th>Referral</th><th>Cold Mail</th><th>Manual</th><th>Manual Target</th><th>Status</th><th>Total</th></tr></thead>
                <tbody>
                  {monthlyData.map(([key, v]) => {
                    const [y, m] = key.split('-').map(Number);
                    const mTarget = targetTotal * daysInMonth(y, m - 1);
                    return (
                      <tr key={key}>
                        <td className="jat-mono">{monthLabel(key)}</td>
                        <td className="jat-mono">{v.Referral}</td>
                        <td className="jat-mono">{v['Cold Mail']}</td>
                        <td className="jat-mono">{v.Manual}</td>
                        <td className="jat-mono">{mTarget}</td>
                        <td className={v.Manual >= mTarget ? 'jat-met' : 'jat-notmet'}>{v.Manual >= mTarget ? 'Target Met' : 'Below Target'}</td>
                        <td className="jat-mono">{v.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {dataLoaded && tab === 'summary' && (
        <>
          <div className="jat-kpi-row">
            <div className="jat-kpi"><div className="jat-kpi-label">Total Applications</div><div className="jat-kpi-value">{summary.total}</div></div>
            <div className="jat-kpi"><div className="jat-kpi-label">Referral Requests Sent</div><div className="jat-kpi-value">{summary.referralSent}</div></div>
            <div className="jat-kpi"><div className="jat-kpi-label">Responses Received</div><div className="jat-kpi-value">{summary.responses}</div></div>
            <div className="jat-kpi"><div className="jat-kpi-label">Referrals Given</div><div className="jat-kpi-value">{summary.referralsGiven}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div className="jat-card">
              <h3 className="jat-card-title">Status Breakdown</h3>
              <div className="jat-status-list">
                {STATUS_OPTIONS.map(s => (
                  <div className="jat-status-row" key={s}>
                    <span className="jat-status-dot" style={{ background: STATUS_COLORS[s] }} />
                    <span className="jat-status-name">{s}</span>
                    <span className="jat-status-count">{summary.statusCounts[s]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="jat-card">
              <h3 className="jat-card-title">Application Type Breakdown</h3>
              <div className="jat-status-list">
                {TYPE_OPTIONS.map(t => (
                  <div className="jat-status-row" key={t}>
                    <span className="jat-status-dot" style={{ background: TYPE_COLORS[t] }} />
                    <span className="jat-status-name">{t}</span>
                    <span className="jat-status-count">{summary.typeCounts[t]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {dataLoaded && tab === 'targets' && (
        <div className="jat-card">
          <h3 className="jat-card-title">Daily targets</h3>
          <p className="jat-subtitle" style={{ marginTop: -6, marginBottom: 14 }}>Set your daily target goals for each application type. These sync across all your devices.</p>
          <div className="jat-target-form">
            <div className="jat-target-field">
              <label>Referral</label>
              <input className="jat-input" type="number" min="0" value={targets.Referral !== undefined ? targets.Referral : 5}
                onChange={e => updateTarget('Referral', e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div className="jat-target-field">
              <label>Cold Mail</label>
              <input className="jat-input" type="number" min="0" value={targets['Cold Mail'] !== undefined ? targets['Cold Mail'] : 5}
                onChange={e => updateTarget('Cold Mail', e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div className="jat-target-field">
              <label>Manual</label>
              <input className="jat-input" type="number" min="0" value={targets.Manual !== undefined ? targets.Manual : 25}
                onChange={e => updateTarget('Manual', e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>
          <p className="jat-subtitle" style={{ marginTop: 16 }}>
            Daily Goals — Referral: <span className="jat-mono">{targets.Referral || 5}</span> · Cold Mail: <span className="jat-mono">{targets['Cold Mail'] || 5}</span> · Manual: <span className="jat-mono">{targets.Manual || 25}</span>
          </p>
        </div>
      )}
    </div>
  );
}
