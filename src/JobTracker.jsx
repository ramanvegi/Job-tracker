import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db } from './firebase';

import ProgressBar from './components/ProgressBar';
import LogForm from './components/LogForm';
import Tables from './components/Tables';
import './JobTracker.css';

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

export {
  STATUS_OPTIONS,
  TYPE_COLORS,
  STATUS_COLORS,
  formatDisplay,
  normType,
  daysInMonth,
  monthLabel,
  formatWeekLabel
};

export default function JobTracker({ user, onSignOut }) {
  const [applications, setApplications] = useState([]);
  const [targets, setTargets] = useState({ Manual: 25, Referral: 5, 'Cold Mail': 5 });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [tab, setTab] = useState('log');
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

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
        <LogForm
          editingId={editingId}
          form={form}
          setForm={setForm}
          handleAdd={handleAdd}
          cancelEdit={cancelEdit}
          doDelete={doDelete}
          STATUS_OPTIONS={STATUS_OPTIONS}
          LOG_TYPE_OPTIONS={LOG_TYPE_OPTIONS}
          inputCls={inputCls}
        />
      )}

      {dataLoaded && ['log', 'daily', 'weekly', 'monthly'].includes(tab) && (
        <Tables
          tab={tab}
          filteredApps={filteredApps}
          dailyData={dailyData}
          weeklyData={weeklyData}
          monthlyData={monthlyData}
          targetTotal={targetTotal}
          startEdit={startEdit}
          doDelete={doDelete}
          editingId={editingId}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />
      )}

      {dataLoaded && tab === 'summary' && (
        <>
          <div className="jat-kpi-row">
            <div className="jat-kpi"><div className="jat-kpi-label">Total Applications</div><div className="jat-kpi-value">{summary.total}</div></div>
            <div className="jat-kpi"><div className="jat-kpi-label">Referral Requests Sent</div><div className="jat-kpi-value">{summary.referralSent}</div></div>
            <div className="jat-kpi"><div className="jat-kpi-label">Responses Received</div><div className="jat-kpi-value">{summary.responses}</div></div>
            <div className="jat-kpi"><div className="jat-kpi-label">Referrals Given</div><div className="jat-kpi-value">{summary.referralsGiven}</div></div>
          </div>

          <div className="jat-kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div className="jat-card">
              <h3 className="jat-card-title">Status Breakdown</h3>
              <div className="jat-status-list">
                {STATUS_OPTIONS.map(s => {
                  const count = summary.statusCounts[s] || 0;
                  return (
                    <div className="jat-status-row" key={s}>
                      <div className="jat-status-dot" style={{ background: STATUS_COLORS[s] }} />
                      <div className="jat-status-name">{s}</div>
                      <div className="jat-status-count">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="jat-card">
              <h3 className="jat-card-title">Application Type Breakdown</h3>
              <div className="jat-status-list">
                {TYPE_OPTIONS.map(t => {
                  const count = summary.typeCounts[t] || 0;
                  return (
                    <div className="jat-status-row" key={t}>
                      <div className="jat-status-dot" style={{ background: TYPE_COLORS[t] }} />
                      <div className="jat-status-name">{t}</div>
                      <div className="jat-status-count">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {dataLoaded && tab === 'targets' && (
        <div className="jat-card">
          <h3 className="jat-card-title">Configure Daily Targets</h3>
          <div className="jat-target-form">
            <div className="jat-target-field">
              <label>Manual Applications</label>
              <input className={inputCls} type="number" min="0" value={targets.Manual} onChange={e => updateTarget('Manual', e.target.value)} />
            </div>
            <div className="jat-target-field">
              <label>Referral Requests</label>
              <input className={inputCls} type="number" min="0" value={targets.Referral} onChange={e => updateTarget('Referral', e.target.value)} />
            </div>
            <div className="jat-target-field">
              <label>Cold Mails</label>
              <input className={inputCls} type="number" min="0" value={targets.Cold_Mail || targets['Cold Mail']} onChange={e => updateTarget('Cold Mail', e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
