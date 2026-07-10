import React from 'react';
import ReactMarkdown from 'react-markdown';
import './TaskDetailsModal.css';
import { formatTimestamp, getDeterministicColorIndex } from '../utils/helpers';

export default function TaskDetailsModal({
  maximizedTask,
  setMaximizedTask,
  isMacEditing,
  setIsMacEditing,
  currentUserId,
  peers,
  editTitle, setEditTitle,
  editDesc, setEditDesc,
  editAssigneeId, setEditAssigneeId,
  editDueDate, setEditDueDate,
  handleMacSave,
  handleDelete,
  handleReject,
  taskActivities
}) {
  const colors = [
    "162, 178, 150",
    "224, 122, 95",
    "61, 90, 128",
    "129, 178, 154",
    "242, 204, 143",
    "212, 163, 115",
    "157, 129, 137"
  ];
  const colorIndex = getDeterministicColorIndex(maximizedTask.id);
  const taskColorRGB = colors[colorIndex % colors.length];

  return (
    <div className="mac-modal-overlay">
      <div className="mac-modal fullscreen" style={{ '--task-color': taskColorRGB }}>
        <div className="mac-header" style={{ justifyContent: 'space-between' }}>
          <div className="mac-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isMacEditing ? (
              <button className="mac-pill-select" style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', fontWeight: 600, padding: '6px 16px', height: '32px', display: 'flex', alignItems: 'center' }} onClick={handleMacSave} title="Save">Save</button>
            ) : (
              <>
                <button className="icon-btn edit" onClick={() => setIsMacEditing(true)} title="Edit">✎</button>
                <span style={{ fontSize: '13px', opacity: 0.5, fontFamily: 'var(--sans)', marginLeft: '4px' }}>
                  Last modified {formatTimestamp(maximizedTask.updated_at)}
                </span>
              </>
            )}
          </div>
          <div className="mac-controls" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {maximizedTask.user_id === currentUserId ? (
              <button className="icon-btn delete" onClick={() => { handleDelete(maximizedTask.id); setMaximizedTask(null); }} title="Delete Task" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            ) : (
              <button onClick={() => { handleReject(maximizedTask.id); setMaximizedTask(null); }} title="Reject Task" style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: '600', cursor: 'pointer', fontSize: '13px', padding: '0 8px' }}>
                Reject Task
              </button>
            )}
            <button className="mac-btn red" onClick={() => setMaximizedTask(null)} title="Close"></button>
          </div>
        </div>
        <div className="mac-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flexGrow: 1 }}>
            {isMacEditing ? (
              <>
                <input
                  className="mac-title-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="What needs to be done?"
                />
                <textarea
                  className="mac-desc-input"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Add details, links, or notes..."
                  rows={5}
                />

              </>
            ) : (
              <>
                <h1 className="mac-title">{maximizedTask.title}</h1>
                
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-h)', opacity: 0.9, marginTop: '8px', marginBottom: '16px' }}>
                  {maximizedTask.assigned_to_id && (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>👤</span>
                        <span>{peers.find(p => p.peer_id === maximizedTask.assigned_to_id)?.peer_name || 'Assigned'}</span>
                     </div>
                  )}
                  {maximizedTask.due_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Due:</span>
                      <span>{new Date(maximizedTask.due_date.substring(0, 10)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span>
                    </div>
                  )}
                </div>
                

                {maximizedTask.description ? (
                  <div className="mac-desc">
                    <ReactMarkdown>{maximizedTask.description}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="mac-desc" style={{ opacity: 0.5 }}>No description provided.</p>
                )}
              </>
            )}
          </div>

          <div className="mac-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: '32px', fontSize: '13px', fontFamily: 'var(--sans)', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              {isMacEditing && (
                <>
                  {maximizedTask.user_id === currentUserId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.7, transition: 'opacity 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
                      <span>👤</span>
                      <select
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
                        value={editAssigneeId}
                        onChange={(e) => setEditAssigneeId(e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {peers.filter(p => p.status === 'accepted').map(p => (
                          <option key={p.peer_id} value={p.peer_id}>{p.peer_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.7, transition: 'opacity 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
                    <span>Due:</span>
                    <input
                      type="date"
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--sans)', padding: 0 }}
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                    />
                  </div>
                </>
              )}
            </div>

            {isMacEditing && (
              <div style={{ opacity: 0.5, textAlign: 'right', width: '100%' }}>
                Created on: {maximizedTask.created_at ? new Date(maximizedTask.created_at + 'Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
              </div>
            )}
          </div>

          {!isMacEditing && (
            <div className="task-activity-panel" style={{ marginTop: '24px', paddingBottom: '32px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-h)', marginBottom: '16px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Activity History</h3>
              {taskActivities[maximizedTask.id] ? (
                taskActivities[maximizedTask.id].length > 0 ? (
                  <div className="activity-list">
                    {taskActivities[maximizedTask.id].map(evt => {
                      let messageNode;
                      if (evt.event_type === "ASSIGNED") {
                        if (evt.details && evt.details.includes("Assigned to peer")) {
                          const peerId = evt.details.replace("Assigned to peer ", "");
                          let peerName = "someone";
                          if (peerId === currentUserId) {
                            peerName = "you";
                          } else {
                            const peerObj = peers.find(p => p.peer_id === peerId);
                            if (peerObj) peerName = peerObj.peer_name;
                          }
                          messageNode = <span className="activity-message"> - {evt.user_name} <strong>assigned</strong> the task to {peerName}.</span>;
                        } else {
                          messageNode = <span className="activity-message"> - {evt.user_name} <strong>assigned</strong> the task{evt.details ? ` - ${evt.details}` : ''}</span>;
                        }
                      } else {
                        messageNode = <span className="activity-message"> - {evt.user_name} <strong>{evt.event_type.toLowerCase()}</strong>{['REOPENED', 'COMPLETED', 'CREATED', 'REJECTED'].includes(evt.event_type) ? ' the task.' : ''}{evt.details && evt.event_type !== 'TIPPED' ? ` - ${evt.details}` : ''}{evt.event_type === 'TIPPED' ? ` ${evt.details.replace('Tipped ', '')}` : ''}</span>;
                      }

                      return (
                        <div key={evt.id} className="activity-item">
                          <span className="activity-time">{formatTimestamp(evt.created_at)}</span>
                          {messageNode}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="activity-empty">No activity recorded.</div>
                )
              ) : (
                <div className="activity-loading">Loading...</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
