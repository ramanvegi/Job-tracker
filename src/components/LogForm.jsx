import React from 'react';

export default function LogForm({
  editingId,
  form,
  setForm,
  handleAdd,
  cancelEdit,
  doDelete,
  STATUS_OPTIONS,
  LOG_TYPE_OPTIONS,
  inputCls
}) {
  return (
    <div className="jat-card">
      <h3 className="jat-card-title">
        {editingId ? 'Edit application details' : 'Log a new application (adds to the top of the table)'}
      </h3>
      <form onSubmit={handleAdd}>
        <div className="jat-form-grid">
          <input
            className={inputCls}
            type="date"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            required
          />
          <select
            className="jat-select"
            value={form.applicationType}
            onChange={e => setForm({ ...form, applicationType: e.target.value })}
          >
            {LOG_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            className={inputCls}
            placeholder="Source (e.g. LinkedIn)"
            value={form.source}
            onChange={e => setForm({ ...form, source: e.target.value })}
            maxLength={300}
          />
          <input
            className={inputCls}
            placeholder="Company name"
            value={form.companyName}
            onChange={e => setForm({ ...form, companyName: e.target.value })}
            required
            maxLength={300}
          />
          <input
            className={inputCls}
            placeholder="Role"
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
            required
            maxLength={300}
          />
          <input
            className={inputCls}
            placeholder="Job link (URL)"
            value={form.jobLink}
            onChange={e => setForm({ ...form, jobLink: e.target.value })}
            maxLength={1000}
          />
          <input
            className={inputCls}
            placeholder="Referral req sent"
            value={form.referralReqSent}
            onChange={e => setForm({ ...form, referralReqSent: e.target.value })}
            maxLength={300}
          />
          <input
            className={inputCls}
            placeholder="Responses received"
            value={form.responsesReceived}
            onChange={e => setForm({ ...form, responsesReceived: e.target.value })}
            maxLength={300}
          />
          <input
            className={inputCls}
            placeholder="Referrals given"
            value={form.referralsGiven}
            onChange={e => setForm({ ...form, referralsGiven: e.target.value })}
            maxLength={300}
          />
          <select
            className="jat-select"
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            className={inputCls}
            placeholder="Avg salary"
            value={form.avgSalary}
            onChange={e => setForm({ ...form, avgSalary: e.target.value })}
            maxLength={300}
          />
          <input
            className={inputCls}
            type="date"
            placeholder="Follow-up date"
            value={form.followUpDate}
            onChange={e => setForm({ ...form, followUpDate: e.target.value })}
          />
          <select
            className="jat-select"
            value={form.applied}
            onChange={e => setForm({ ...form, applied: e.target.value })}
          >
            <option value="YES">Applied: YES</option>
            <option value="NO">Applied: NO</option>
          </select>
          <textarea
            className="jat-textarea"
            placeholder="Remarks"
            rows={3}
            value={form.remarks}
            onChange={e => setForm({ ...form, remarks: e.target.value })}
            style={{ gridColumn: '1 / -1' }}
            maxLength={500}
          />
        </div>
        {editingId ? (
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button type="submit" className="jat-add-btn" style={{ margin: 0 }}>Save changes</button>
            <button
              type="button"
              className="jat-add-btn danger"
              style={{ margin: 0, background: 'var(--danger)', color: '#fff' }}
              onClick={() => doDelete(editingId)}
            >
              Delete application
            </button>
            <button
              type="button"
              className="jat-add-btn"
              style={{ margin: 0, background: 'var(--surface-2)', color: 'var(--text)' }}
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button type="submit" className="jat-add-btn">Add to top</button>
        )}
      </form>
    </div>
  );
}
