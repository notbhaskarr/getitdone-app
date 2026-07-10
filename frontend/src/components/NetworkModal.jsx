import React from 'react';
import './NetworkModal.css';

export default function NetworkModal({
  isNetworkModalOpen,
  setIsNetworkModalOpen,
  peerEmail,
  setPeerEmail,
  requestBtnText,
  handlePeerRequest,
  peers,
  onlinePeers,
  handlePeerRemove,
  handlePeerAccept
}) {
  return (
    <>
      {isNetworkModalOpen && (
        <div className="subtask-modal-overlay">
          <div className="subtask-modal" style={{ '--task-color': '253, 246, 227', width: '400px', height: 'auto', minHeight: '300px', padding: 0, overflow: 'hidden' }}>
            <div className="mac-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="mac-title" style={{ fontSize: '16px', margin: 0, lineHeight: 1 }}>Peer Network</h2>
              <div className="mac-controls" style={{ display: 'flex', alignItems: 'center' }}>
                <button className="mac-btn red" onClick={() => setIsNetworkModalOpen(false)} title="Close"></button>
              </div>
            </div>
            <div className="mac-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', background: 'transparent' }}>
              <form onSubmit={handlePeerRequest} style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <input
                  type="text"
                  value={peerEmail}
                  onChange={(e) => setPeerEmail(e.target.value)}
                  placeholder="Peer username"
                  style={{ flexGrow: 1, padding: '10px 12px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', borderRadius: '6px', color: 'var(--text)', boxSizing: 'border-box' }}
                />
                <button type="submit" className="icon-btn edit" style={{ width: 'auto', padding: '0 16px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>{requestBtnText}</button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.5, margin: '8px 0 0' }}>Your Connections</h3>
                {peers.length === 0 ? (
                  <p style={{ opacity: 0.5, fontSize: '14px' }}>No peers yet.</p>
                ) : (
                  peers.map(p => (
                    <div key={p.id} className="peer-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'rgba(253, 246, 227, 0.03)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.2 }}>
                          {p.peer_name}
                          {p.status === 'accepted' && onlinePeers.has(p.peer_id) && (
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ade80', boxShadow: '0 0 6px #4ade80' }} title="Online"></span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '2px', lineHeight: 1 }}>@{p.peer_email}</div>
                      </div>
                      <div className="peer-status-container" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        {p.status === 'accepted' ? (
                          <>
                            <button className="peer-remove-btn" onClick={() => handlePeerRemove(p.id)} title="Remove Peer">✖</button>
                          </>
                        ) : p.is_requester ? (
                          <span style={{ fontSize: '12px', opacity: 0.5 }}>Pending</span>
                        ) : (
                          <button className="icon-btn edit" style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center' }} onClick={() => handlePeerAccept(p.id)}>Accept</button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
