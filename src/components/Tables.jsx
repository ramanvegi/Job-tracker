import React, { useState, useEffect, useRef } from 'react';
import {
  STATUS_OPTIONS,
  TYPE_COLORS,
  STATUS_COLORS,
  formatDisplay,
  normType,
  daysInMonth,
  monthLabel,
  formatWeekLabel
} from '../JobTracker';

export default function Tables({
  tab,
  filteredApps,
  dailyData,
  weeklyData,
  monthlyData,
  targetTotal,
  startEdit,
  doDelete,
  editingId,
  search,
  setSearch,
  statusFilter,
  setStatusFilter
}) {
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const tableRef = useRef(null);
  const tableWrapRef = useRef(null);
  const topScrollRef = useRef(null);

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
  }, [filteredApps, dailyData, weeklyData, monthlyData, tab]);

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

  const renderTopScrollbar = () => {
    if (tableScrollWidth <= 0) return null;
    return (
      <div 
        ref={topScrollRef} 
        onScroll={handleTopScroll} 
        className="jat-top-scroll-wrap"
      >
        <div style={{ width: tableScrollWidth + 'px', height: '1px' }} />
      </div>
    );
  };

  if (tab === 'log') {
    return (
      <>
        <div className="jat-toolbar">
          <input
            className="jat-input"
            placeholder="Search company, role, source…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="jat-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {renderTopScrollbar()}
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
    );
  }

  if (tab === 'daily') {
    return (
      <>
        {renderTopScrollbar()}
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
    );
  }

  if (tab === 'weekly') {
    return (
      <>
        {renderTopScrollbar()}
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
    );
  }

  if (tab === 'monthly') {
    return (
      <>
        {renderTopScrollbar()}
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
    );
  }

  return null;
}
