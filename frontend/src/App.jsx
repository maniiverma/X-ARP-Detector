// ====================================================================
// X-ARP DEFENSOR — NEXT-GEN SOC INTERFACE v3.0
// ====================================================================
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const socket = io('http://localhost:5000');

// ── Palette ──────────────────────────────────────────────────────────
const C = {
  bg:        '#04080f',
  panel:     '#080e18',
  card:      '#0b1422',
  border:    '#112240',
  borderHi:  '#1e3a5f',
  cyan:      '#00e5ff',
  cyanDim:   '#0891b2',
  cyanFaint: '#00e5ff18',
  red:       '#ff3366',
  redDim:    '#991b3e',
  redFaint:  '#ff336614',
  green:     '#00ff9d',
  greenDim:  '#059669',
  greenFaint:'#00ff9d14',
  amber:     '#ffb300',
  amberFaint:'#ffb30014',
  text:      '#cdd9f0',
  textMuted: '#4a6080',
  textDim:   '#7a94b8',
  white:     '#eaf2ff',
};

const font = "'JetBrains Mono', 'Fira Code', monospace";

// ── Reusable micro-components ────────────────────────────────────────
const Tag = ({ color, children }) => (
  <span style={{
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    border: `1px solid ${color}60`,
    backgroundColor: `${color}18`,
    color: color,
    fontFamily: font,
  }}>{children}</span>
);

const PanelHeader = ({ icon, label, accent = C.cyan, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: `1px solid ${C.border}`,
    background: `linear-gradient(90deg, ${accent}0d 0%, transparent 60%)`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: accent, fontSize: 13 }}>{icon}</span>
      <span style={{ color: accent, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', fontFamily: font }}>{label}</span>
    </div>
    {children}
  </div>
);

const MetricCard = ({ label, value, color, icon }) => (
  <div style={{
    background: C.card,
    border: `1px solid ${C.border}`,
    borderTop: `2px solid ${color}`,
    borderRadius: 8,
    padding: '16px 20px',
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 20, opacity: 0.15 }}>{icon}</div>
    <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', fontFamily: font, marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 32, fontWeight: 700, color, fontFamily: font, lineHeight: 1 }}>{value}</div>
  </div>
);

const GlowBtn = ({ onClick, color = C.cyan, children, style = {} }) => (
  <button onClick={onClick} style={{
    background: `${color}22`,
    border: `1px solid ${color}80`,
    borderRadius: 4,
    color,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '5px 12px',
    cursor: 'pointer',
    fontFamily: font,
    transition: 'all 0.15s',
    ...style,
  }}
    onMouseEnter={e => { e.currentTarget.style.background = `${color}40`; e.currentTarget.style.borderColor = color; }}
    onMouseLeave={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = `${color}80`; }}
  >{children}</button>
);

const ToggleSwitch = ({ active, onToggle, colorOn, colorOff = C.textMuted }) => {
  const color = active ? colorOn : colorOff;
  return (
    <div onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 44, height: 22, borderRadius: 11,
        background: active ? `${colorOn}33` : '#111827',
        border: `1px solid ${color}`,
        position: 'relative', transition: 'all 0.25s',
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          background: color,
          position: 'absolute', top: 2,
          left: active ? 24 : 2,
          transition: 'left 0.25s',
          boxShadow: active ? `0 0 8px ${colorOn}` : 'none',
        }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: font, letterSpacing: '0.1em' }}>
        {active ? 'ARMED' : 'STANDBY'}
      </span>
    </div>
  );
};

const CyberInput = ({ label, value, onChange, placeholder }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{ color: C.cyanDim, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', fontFamily: font }}>{label}</span>
    <input
      type="text" value={value} onChange={onChange} placeholder={placeholder}
      style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4,
        padding: '9px 12px', color: C.white, outline: 'none',
        fontFamily: font, fontSize: 11,
        transition: 'border-color 0.2s',
      }}
      onFocus={e => e.target.style.borderColor = C.cyan}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  </div>
);

// ── Scanline overlay ─────────────────────────────────────────────────
const Scanlines = () => (
  <div style={{
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999,
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
  }} />
);

// ── Pulse dot ────────────────────────────────────────────────────────
const Pulse = ({ color }) => {
  const [big, setBig] = useState(false);
  useEffect(() => { const t = setInterval(() => setBig(p => !p), 900); return () => clearInterval(t); }, []);
  return (
    <div style={{
      width: big ? 8 : 6, height: big ? 8 : 6, borderRadius: '50%',
      background: color, boxShadow: `0 0 ${big ? 10 : 4}px ${color}`,
      transition: 'all 0.4s', display: 'inline-block',
    }} />
  );
};

// ── Live clock ───────────────────────────────────────────────────────
const LiveClock = () => {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <span style={{ color: C.textDim, fontSize: 11, fontFamily: font, letterSpacing: '0.08em' }}>
      {t.toUTCString().replace('GMT', 'UTC')}
    </span>
  );
};

// ── Sparkline graph ──────────────────────────────────────────────────
const SparkGraph = ({ data }) => {
  const max = Math.max(...data.map(d => d.pps || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
      {data.map((d, i) => {
        const h = d.pps ? Math.max((d.pps / max) * 72, 3) : 3;
        const hot = d.pps > 0;
        return (
          <div key={i} style={{
            flex: 1, minWidth: 4, height: h,
            background: hot ? `linear-gradient(180deg, ${C.red}, ${C.redDim})` : C.borderHi,
            borderRadius: '2px 2px 0 0',
            transition: 'height 0.3s',
            boxShadow: hot ? `0 0 6px ${C.red}80` : 'none',
          }} />
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════
function ArpShieldDashboardView() {
  const [stats, setStats] = useState({
    monitoredDevices: 0, whitelistCount: 0,
    autoMitigation: false, antiPoisoning: false,
    networkMap: [], blockedIps: [], blockedMacs: [],
    history: [], subnetMask: '24',
    chatops: { discord_url: '', telegram_token: '', telegram_chat: '' },
  });

  const [selectedInspect, setSelectedInspect] = useState(null);
  const [graphData, setGraphData] = useState(Array(40).fill(0).map(() => ({ pps: 0 })));
  const [discordInput, setDiscordInput] = useState('');
  const [teleTokenInput, setTeleTokenInput] = useState('');
  const [teleChatInput, setTeleChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('incidents');

  useEffect(() => {
    fetchStats();
    socket.on('arp_alert_stream', fetchStats);
    socket.on('agent_registry_update', fetchStats);
    socket.on('graph_metrics_stream', (metrics) => {
      setGraphData(prev => {
        const next = [...prev, metrics];
        if (next.length > 40) next.shift();
        return next;
      });
    });
    return () => {
      socket.off('arp_alert_stream');
      socket.off('agent_registry_update');
      socket.off('graph_metrics_stream');
    };
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/stats');
      const data = await res.json();
      setStats(data);
      if (data.chatops) {
        setDiscordInput(data.chatops.discord_url || '');
        setTeleTokenInput(data.chatops.telegram_token || '');
        setTeleChatInput(data.chatops.telegram_chat || '');
      }
      if (data.history?.length > 0 && !selectedInspect) {
        setSelectedInspect(data.history[0]);
      }
    } catch (err) { console.error('Stats fetch error:', err); }
  };

  const saveChatOpsTokens = async () => {
    try {
      await fetch('http://localhost:5000/api/configure-chatops', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discord_url: discordInput, telegram_token: teleTokenInput, telegram_chat: teleChatInput }),
      });
      alert('[SYNCED] Notification pipelines updated.');
      fetchStats();
    } catch { alert('Config sync failed.'); }
  };

  const toggleFeature = async (name) => {
    try {
      await fetch('http://localhost:5000/api/toggle-feature', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: name }),
      });
      fetchStats();
    } catch { alert('Toggle failed.'); }
  };

  const triggerMitigation = async (target, mode, action = 'block') => {
    try {
      await fetch('http://localhost:5000/api/mitigate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, mode, action }),
      });
      fetchStats();
    } catch { alert('Mitigation error.'); }
  };

  const panelStyle = {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  };

  const tabs = ['incidents', 'nodes', 'firewall'];

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: font, padding: 24 }}>
      <Scanlines />

      {/* ── NAVBAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 16,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: `${C.cyan}18`, border: `1px solid ${C.cyan}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: C.cyan,
          }}>⬡</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white, letterSpacing: '0.08em' }}>
              X-ARP <span style={{ color: C.cyan }}>DEFENSOR</span>
            </div>
            <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.18em' }}>ENTERPRISE SOC SUITE v3.0</div>
          </div>
        </div>

        {/* Center clock */}
        <LiveClock />

        {/* Right badges */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            padding: '5px 12px', borderRadius: 4, fontSize: 10, fontFamily: font,
            background: C.cyanFaint, border: `1px solid ${C.cyanDim}60`, color: C.textDim,
          }}>
            SUBNET&nbsp;<span style={{ color: C.cyan }}>10.74.131.0/{stats.subnetMask}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 4,
            background: C.greenFaint, border: `1px solid ${C.greenDim}60`,
          }}>
            <Pulse color={C.green} />
            <span style={{ fontSize: 10, color: C.green, letterSpacing: '0.1em' }}>SHIELD ONLINE</span>
          </div>
        </div>
      </div>

      {/* ── CONTROL TOGGLES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 20 }}>
        {/* Auto-mitigation */}
        <div style={{
          ...panelStyle,
          border: `1px solid ${stats.autoMitigation ? C.red + '80' : C.border}`,
          background: stats.autoMitigation ? `linear-gradient(135deg, ${C.redFaint}, ${C.panel})` : C.panel,
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'all 0.3s',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: stats.autoMitigation ? C.red : C.textMuted }}>⚡</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: stats.autoMitigation ? C.red : C.white, letterSpacing: '0.05em' }}>
                Autonomous IPS
              </span>
              {stats.autoMitigation && <Tag color={C.red}>ARMED</Tag>}
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, maxWidth: 240 }}>
              Instantly isolates rogue hardware via kernel-level firewall injection
            </div>
          </div>
          <ToggleSwitch active={stats.autoMitigation} onToggle={() => toggleFeature('autoMitigation')} colorOn={C.red} />
        </div>

        {/* Anti-poisoning */}
        <div style={{
          ...panelStyle,
          border: `1px solid ${stats.antiPoisoning ? C.green + '80' : C.border}`,
          background: stats.antiPoisoning ? `linear-gradient(135deg, ${C.greenFaint}, ${C.panel})` : C.panel,
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'all 0.3s',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: stats.antiPoisoning ? C.green : C.textMuted }}>⟳</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: stats.antiPoisoning ? C.green : C.white, letterSpacing: '0.05em' }}>
                Gateway Recovery Engine
              </span>
              {stats.antiPoisoning && <Tag color={C.green}>ACTIVE</Tag>}
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, maxWidth: 240 }}>
              Auto-corrects spoofed ARP tables to preserve active routing paths
            </div>
          </div>
          <ToggleSwitch active={stats.antiPoisoning} onToggle={() => toggleFeature('antiPoisoning')} colorOn={C.green} />
        </div>
      </div>

      {/* ── METRIC CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <MetricCard label="INTERCEPT RECORDS" value={stats.history?.length ?? 0} color={C.red} icon="⚠" />
        <MetricCard label="ACTIVE BANS" value={stats.blockedMacs?.length ?? 0} color={C.amber} icon="⛔" />
        <MetricCard label="SUBNET NODES" value={stats.monitoredDevices} color={C.cyan} icon="◈" />
        <MetricCard label="WHITELIST ENTRIES" value={stats.whitelistCount} color={C.green} icon="✓" />
      </div>

      {/* ── PACKET VELOCITY GRAPH ── */}
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <PanelHeader icon="▲" label="REAL-TIME PACKET VELOCITY — SUBNET MONITOR" accent={C.cyan}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 10, color: C.textMuted }}>LIVE FEED</span>
            <Pulse color={C.cyan} />
          </div>
        </PanelHeader>
        <div style={{ padding: '16px 20px', background: C.bg, borderRadius: '0 0 8px 8px' }}>
          <SparkGraph data={graphData} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 9, color: C.textMuted }}>T-40s</span>
            <span style={{ fontSize: 9, color: C.red }}>■ ARP FLOOD SPIKE</span>
            <span style={{ fontSize: 9, color: C.cyan }}>■ BASELINE</span>
            <span style={{ fontSize: 9, color: C.textMuted }}>NOW</span>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(tab => {
          const active = activeTab === tab;
          const labels = { incidents: '⚠  INCIDENT TELEMETRY', nodes: '◈  NODE REGISTRY', firewall: '⛔  FIREWALL RULES' };
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: active ? `${C.cyan}18` : 'transparent',
              border: 'none',
              borderBottom: active ? `2px solid ${C.cyan}` : '2px solid transparent',
              color: active ? C.cyan : C.textMuted,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              padding: '8px 20px', cursor: 'pointer', fontFamily: font,
              transition: 'all 0.2s',
            }}>{labels[tab]}</button>
          );
        })}
      </div>

      {/* ── INCIDENTS TAB ── */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr', gap: 16, marginBottom: 20 }}>
          {/* Telemetry table */}
          <div style={panelStyle}>
            <PanelHeader icon="⚠" label="LIVE ARP SPOOFING / POISONING TELEMETRY STREAM" accent={C.red}>
              <Tag color={C.red}>{stats.history?.length ?? 0} EVENTS</Tag>
            </PanelHeader>
            <div style={{ padding: 16 }}>
              {!stats.history?.length ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted, fontSize: 11 }}>
                  <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>✓</div>
                  No ARP anomalies detected — subnet clear
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['TIMESTAMP', 'SOURCE IP', 'LEGIT MAC', 'ROGUE MAC', 'ACTION'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textAlign: h === 'ACTION' ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.history.map((h, i) => (
                        <tr key={i} onClick={() => setSelectedInspect(h)}
                          style={{ borderBottom: `1px solid ${C.border}30`, cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = C.cyanFaint}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '10px 12px', color: C.textMuted, fontSize: 10 }}>{h.timestamp}</td>
                          <td style={{ padding: '10px 12px', color: C.cyan, fontWeight: 700, fontSize: 11 }}>{h.ip}</td>
                          <td style={{ padding: '10px 12px', color: C.textDim, fontSize: 10 }}>{h.legitMac}</td>
                          <td style={{ padding: '10px 12px', color: C.red, fontWeight: 700, fontSize: 10 }}>{h.attackerMac}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <GlowBtn color={C.red} onClick={e => { e.stopPropagation(); triggerMitigation(h.attackerMac, 'mac', 'block'); }}>
                              BLOCK
                            </GlowBtn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Forensic inspector */}
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column' }}>
            <PanelHeader icon="⬡" label="FORENSIC FRAME INSPECTOR" accent={C.cyan} />
            <div style={{ padding: 16, flex: 1 }}>
              {selectedInspect ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'TARGET IP', value: selectedInspect.ip, color: C.white },
                    { label: 'ROGUE MAC', value: selectedInspect.attackerMac, color: C.red },
                    { label: 'LEGIT MAC', value: selectedInspect.legitMac, color: C.green },
                    { label: 'TIMESTAMP', value: selectedInspect.timestamp, color: C.textDim },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: C.card, borderRadius: 4, padding: '10px 12px', borderLeft: `2px solid ${color}60` }}>
                      <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 12, color, fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                  <div style={{ background: C.amberFaint, border: `1px solid ${C.amber}40`, borderRadius: 4, padding: '10px 12px', marginTop: 4 }}>
                    <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>SEVERITY</div>
                    <div style={{ fontSize: 13, color: C.amber, fontWeight: 700 }}>{selectedInspect.threatLevel || 'CRITICAL'}</div>
                  </div>
                  <GlowBtn color={C.red} style={{ width: '100%', padding: '8px 0', fontSize: 10, textAlign: 'center' }}
                    onClick={() => triggerMitigation(selectedInspect.attackerMac, 'mac', 'block')}>
                    ISOLATE THREAT
                  </GlowBtn>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: C.textMuted, gap: 10 }}>
                  <div style={{ fontSize: 36, opacity: 0.15 }}>⬡</div>
                  <div style={{ fontSize: 10 }}>Select an incident row to<br />load forensic data</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── NODES TAB ── */}
      {activeTab === 'nodes' && (
        <div style={{ ...panelStyle, marginBottom: 20 }}>
          <PanelHeader icon="◈" label="ENDPOINT NODE REGISTRY — NETWORK TELEMETRY MATRIX" accent={C.cyan}>
            <Tag color={C.cyan}>{stats.networkMap?.length ?? 0} NODES</Tag>
          </PanelHeader>
          <div style={{ padding: 16 }}>
            {!stats.networkMap?.length ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted, fontSize: 11 }}>
                No endpoint nodes registered in the tracking queue
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['NODE IP', 'MAC ADDRESS', 'STATUS', 'ACTIVE PROCESS', 'HARDWARE LOAD'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', color: C.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.networkMap.map((node, i) => {
                    const online = node.status === 'ONLINE';
                    const offline = node.status === 'OFFLINE';
                    const sc = online ? C.green : offline ? C.red : C.textMuted;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}20`, height: 52 }}>
                        <td style={{ padding: '0 14px', color: C.white, fontWeight: 700, fontSize: 12 }}>{node.ip}</td>
                        <td style={{ padding: '0 14px', color: C.textDim, fontSize: 10, textTransform: 'uppercase' }}>{node.mac}</td>
                        <td style={{ padding: '0 14px' }}><Tag color={sc}>{node.status}</Tag></td>
                        <td style={{ padding: '0 14px', color: online ? C.amber : C.textMuted, fontSize: 11 }}>{node.activeTasks || '—'}</td>
                        <td style={{ padding: '0 14px', color: online ? C.green : C.textMuted, fontSize: 11 }}>{node.performance || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── FIREWALL TAB ── */}
      {activeTab === 'firewall' && (
        <div style={{ ...panelStyle, marginBottom: 20 }}>
          <PanelHeader icon="⛔" label="KERNEL FIREWALL DROP RULES — ISOLATION REGISTRY" accent={C.amber}>
            <GlowBtn color={C.cyan} onClick={fetchStats}>↻ REFRESH</GlowBtn>
          </PanelHeader>
          <div style={{ padding: 16 }}>
            {!stats.blockedMacs?.length ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted, fontSize: 11 }}>
                No active isolation rules loaded
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {stats.blockedMacs.map((mac, i) => (
                  <div key={i} style={{
                    background: C.card, border: `1px solid ${C.redDim}60`,
                    borderRadius: 6, padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 3 }}>BLOCKED MAC</div>
                      <div style={{ color: C.red, fontWeight: 700, fontSize: 11 }}>{mac}</div>
                    </div>
                    <GlowBtn color={C.green} onClick={() => triggerMitigation(mac, 'mac', 'unblock')}>
                      RELEASE
                    </GlowBtn>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHATOPS CONFIG ── */}
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <PanelHeader icon="◉" label="CHATOPS NOTIFICATION PIPELINE CONFIGURATION" accent={C.amber} />
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            <CyberInput label="DISCORD WEBHOOK URL" value={discordInput} onChange={e => setDiscordInput(e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
            <CyberInput label="TELEGRAM BOT TOKEN" value={teleTokenInput} onChange={e => setTeleTokenInput(e.target.value)} placeholder="1234567890:AABBcc..." />
            <CyberInput label="TELEGRAM CHAT ID" value={teleChatInput} onChange={e => setTeleChatInput(e.target.value)} placeholder="-100123456" />
          </div>
          <GlowBtn color={C.cyan} onClick={saveChatOpsTokens} style={{ padding: '9px 24px', fontSize: 11 }}>
            ↑ SYNC NOTIFICATION CHANNELS
          </GlowBtn>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.15em' }}>
          X-ARP DEFENSOR ENTERPRISE SUITE — ALL SYSTEMS NOMINAL
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pulse color={C.cyan} />
          <span style={{ fontSize: 9, color: C.textMuted, letterSpacing: '0.12em' }}>SOCKETIO TELEMETRY ACTIVE</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ArpShieldDashboardView />} />
      </Routes>
    </Router>
  );
}
