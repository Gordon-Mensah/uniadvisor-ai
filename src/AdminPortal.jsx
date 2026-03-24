// ═══════════════════════════════════════════════════════════
// AdminPortal.jsx — Dark Command-Center Design
// Standalone file — imported by App.jsx
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
const _sb = createClient(import.meta.env.VITE_SUPABASE_URL||"", import.meta.env.VITE_SUPABASE_ANON_KEY||"");

const API = import.meta.env.VITE_API_URL || "";

// ── Dark palette ───────────────────────────────────────────────
const D = {
  bg:       "#070B14",
  surface:  "#0D1321",
  card:     "#111827",
  card2:    "#1A2235",
  border:   "#1E2D45",
  border2:  "#243349",
  text:     "#E2E8F0",
  text2:    "#94A3B8",
  muted:    "#4B5563",
  purple:   "#8B5CF6",
  purple2:  "#7C3AED",
  purpleGl: "rgba(139,92,246,0.12)",
  purpleBr: "rgba(139,92,246,0.25)",
  violet:   "#A78BFA",
  cyan:     "#22D3EE",
  cyanGl:   "rgba(34,211,238,0.08)",
  green:    "#10B981",
  greenGl:  "rgba(16,185,129,0.1)",
  amber:    "#F59E0B",
  amberGl:  "rgba(245,158,11,0.1)",
  red:      "#EF4444",
  redGl:    "rgba(239,68,68,0.1)",
  blue:     "#3B82F6",
  blueGl:   "rgba(59,130,246,0.1)",
};

// ── Icons ──────────────────────────────────────────────────────
const DIcon = {
  dashboard: ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  bell:      ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  doc:       ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  faq:       ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  translate: ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>,
  logout:    ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  upload:    ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  trash:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
  send:      ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  copy:      ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  chevron:   ()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>,
  alert:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

// ── Animated counter ───────────────────────────────────────────
function AnimatedCounter({ target, duration = 1400, suffix = "" }) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || target === 0) return;
    started.current = true;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return <span>{val.toLocaleString()}{suffix}</span>;
}

// ── Sparkline ──────────────────────────────────────────────────
function Sparkline({ data, color, height = 36 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 80, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity="0.08" stroke="none" />
    </svg>
  );
}

// ── Donut chart ────────────────────────────────────────────────
function Donut({ percent, color, size = 56 }) {
  const r = 20, circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke={D.border2} strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.22,1,.36,1)" }} />
      <text x="22" y="26" textAnchor="middle" fill={color} fontSize="9" fontWeight="700">{percent}%</text>
    </svg>
  );
}

// ── Horizontal bar ─────────────────────────────────────────────
function HBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: D.text2 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: D.text }}>{value}</span>
      </div>
      <div style={{ height: 4, background: D.border2, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 1s cubic-bezier(.22,1,.36,1)" }} />
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function AdminPortal({ user, token, onLogout }) {
  const [section, setSection]   = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats]       = useState(null);
  const [docs, setDocs]         = useState([]);
  const [anns, setAnns]         = useState([]);
  const [faq, setFaq]           = useState([]);
  const [alerts, setAlerts]     = useState([]);
  const [annText, setAnnText]   = useState("");
  const [annType, setAnnType]   = useState("info");
  const [posting, setPosting]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [transFile, setTransFile] = useState(null);
  const [transLang, setTransLang] = useState("en");
  const [translating, setTranslating] = useState(false);
  const [transResult, setTransResult] = useState(null);
  // NEW v3
  const [officeStats, setOfficeStats]   = useState([]);
  const [escalations, setEscalations]   = useState([]);
  const [auditLogs, setAuditLogs]       = useState([]);
  const [feedbackData, setFeedbackData] = useState(null);
  const [surveyData,   setSurveyData]   = useState(null);
  const [events, setEvents]             = useState([]);
  const [replyText, setReplyText]       = useState({});
  const [replying, setReplying]         = useState(null);
  const [newEvent, setNewEvent]         = useState({title:"",description:"",location:"",starts_at:"",category:"academic"});
  const [addingEvent, setAddingEvent]   = useState(false);
  const fileRef  = useRef();
  const transRef = useRef();

  const safeFetch = (url, cb) =>
    fetch(url).then(r => r.ok ? r.json() : null).then(d => { if (d) cb(d); }).catch(() => {});

  useEffect(() => {
    safeFetch(`${API}/stats`,            d => setStats(d));
    safeFetch(`${API}/documents`,        d => setDocs(d.documents || []));
    safeFetch(`${API}/announcements`,    d => setAnns(d.announcements || []));
    safeFetch(`${API}/faq`,              d => setFaq(d.faq || []));
    safeFetch(`${API}/expiry-alerts`,    d => setAlerts(d.alerts || []));
    safeFetch(`${API}/office-analytics`, d => setOfficeStats(d.offices || []));
    safeFetch(`${API}/escalations`,      d => setEscalations(d.escalations || []));
    safeFetch(`${API}/audit-log`,        d => setAuditLogs(d.logs || []));
    safeFetch(`${API}/feedback`,         d => setFeedbackData(d));
    safeFetch(`${API}/events`,           d => setEvents(d.events || []));
    // Survey responses fetched directly from Supabase
    // Survey responses — fetch with error logging
    _sb.from("survey_responses").select("*").order("submitted_at",{ascending:false})
      .then(({data, error}) => {
        if(error) console.error("Survey fetch error:", error);
        if(data)  setSurveyData(data);
        else      setSurveyData([]);
      })
      .catch(e => { console.error("Survey fetch failed:", e); setSurveyData([]); });
  }, []);

  const postAnn = async () => {
    if (!annText.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/announcements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: annText, type: annType }) });
      const data = await res.json();
      if (res.ok) { setAnns(prev => [data.announcement, ...prev]); setAnnText(""); }
    } catch {}
    setPosting(false);
  };

  const deleteAnn = async (id) => {
    try { await fetch(`${API}/announcements/${id}`, { method: "DELETE" }); setAnns(prev => prev.filter(a => a.id !== id)); } catch {}
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true); setUploadMsg("");
    const form = new FormData(); form.append("file", file);
    try {
      const res = await fetch(`${API}/upload-noauth`, {
        method: "POST",
        body: form
      });
      const data = await res.json();
      if (res.status === 401) {
        setUploadMsg("✗ Upload failed (401) — try refreshing the page");
      } else if (res.ok) {
        setUploadMsg(`✓ ${data.message}`);
        setDocs(prev => [...prev, { name: file.name, uploaded_at: new Date().toISOString(), chunks: data.chunks }]);
      } else {
        setUploadMsg(`✗ ${data.detail || "Upload failed"}`);
      }
    } catch { setUploadMsg("✗ Connection failed — check the server is running."); }
    setUploading(false);
  };

  const runTranslate = async () => {
    if (!transFile || translating) return;
    setTranslating(true); setTransResult(null);
    const form = new FormData(); form.append("file", transFile); form.append("target_language", transLang);
    try {
      const res = await fetch(`${API}/translate?target_language=${transLang}`, { method: "POST", body: form });
      setTransResult(await res.json());
    } catch { setTransResult({ error: "Translation failed." }); }
    setTranslating(false);
  };

  // ── Escalation reply helper ───────────────────────────────
  const sendReply = async (esc) => {
    const txt = replyText[esc.id]; if(!txt?.trim()) return;
    setReplying(esc.id);
    try {
      await fetch(`${API}/escalations/${esc.id}/reply`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({admin_reply:txt,replied_by:user.full_name||user.email})});
      setEscalations(prev=>prev.map(e=>e.id===esc.id?{...e,status:"replied",admin_reply:txt}:e));
      setReplyText(prev=>({...prev,[esc.id]:""}));
    } catch {}
    setReplying(null);
  };

  // ── Event create helper ───────────────────────────────────
  const createEvent = async () => {
    if(!newEvent.title||!newEvent.starts_at) return;
    setAddingEvent(true);
    try {
      const res = await fetch(`${API}/events`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...newEvent,created_by:user.email})});
      const d = await res.json();
      if(res.ok) { setEvents(prev=>[...prev,d.event]); setNewEvent({title:"",description:"",location:"",starts_at:"",category:"academic"}); }
    } catch {}
    setAddingEvent(false);
  };

  const deleteEvent = async (id) => {
    await fetch(`${API}/events/${id}`,{method:"DELETE"}).catch(()=>{});
    setEvents(prev=>prev.filter(e=>e.id!==id));
  };

  const initials = (name = "") => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // Nav items
  const openEscalations = escalations.filter(e=>e.status==="open").length;
  const NAV = [
    { id: "dashboard",     icon: DIcon.dashboard, label: "Dashboard",      badge: null },
    { id: "announcements", icon: DIcon.bell,      label: "Announcements",  badge: anns.filter(a=>a.active!==false).length || null },
    { id: "escalations",   icon: DIcon.send,      label: "Escalations",    badge: openEscalations || null },
    { id: "analytics",     icon: DIcon.faq,       label: "Office Analytics",badge: null },
    { id: "feedback",      icon: DIcon.copy,      label: "Satisfaction",   badge: null },
    { id: "survey",        icon: DIcon.faq,       label: "Survey Results", badge: null },
    { id: "events",        icon: DIcon.alert,     label: "Events",         badge: null },
    { id: "documents",     icon: DIcon.doc,       label: "Documents",      badge: alerts.length || null },
    { id: "faq",           icon: DIcon.faq,       label: "FAQ",            badge: null },
    { id: "audit",         icon: DIcon.chevron,   label: "Audit Log",      badge: null },
    { id: "translate",     icon: DIcon.translate, label: "Translate",      badge: null },
  ];

  // Sample sparkline data
  const sparkData = [3, 7, 5, 12, 9, 15, 11, 18, 14, 22, 17, 25];

  const ANN_CFG = {
    info:    { color: D.blue,   gl: D.blueGl,   label: "Information" },
    warning: { color: D.amber,  gl: D.amberGl,  label: "Warning" },
    urgent:  { color: D.red,    gl: D.redGl,    label: "Urgent" },
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace", background: D.bg, color: D.text, overflow: "hidden", position: "relative" }}>

      {/* Mobile overlay */}
      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:99 }} />}

      {/* ── LEFT SIDEBAR ── */}
      <aside className={sidebarOpen?"ap-sidebar-open":"ap-sidebar-closed"} style={{ width: 228, background: D.surface, borderRight: `1px solid ${D.border}`, display: "flex", flexDirection: "column", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        {/* Ambient glow top */}
        <div style={{ position: "absolute", top: -60, left: -60, width: 180, height: 180, borderRadius: "50%", background: D.purpleGl, filter: "blur(40px)", pointerEvents: "none" }} />

        {/* Brand */}
        <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${D.border}`, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${D.purple}, ${D.purple2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 0 20px ${D.purple}44` }}>⚙️</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.text, letterSpacing: "0.5px" }}>ADMIN PORTAL</div>
              <div style={{ fontSize: 9, color: D.purple, letterSpacing: "1px", textTransform: "uppercase" }}>Command Center</div>
            </div>
          </div>
          {/* System status */}
          <div style={{ display: "flex", align: "center", gap: 6, background: D.greenGl, border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "5px 10px", fontSize: 10, color: D.green, letterSpacing: "0.5px" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: D.green, marginTop: 1, animation: "glow 2s infinite" }} />
            &nbsp;SYSTEMS NOMINAL
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          <div style={{ fontSize: 9, color: D.muted, letterSpacing: "1.5px", padding: "0 10px", marginBottom: 8 }}>NAVIGATION</div>
          {NAV.map(({ id, icon: Ic, label, badge }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => setSection(id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 8, marginBottom: 2, background: active ? D.purpleGl : "transparent", border: active ? `1px solid ${D.purpleBr}` : "1px solid transparent", color: active ? D.violet : D.text2, cursor: "pointer", fontSize: 12, fontFamily: "inherit", textAlign: "left", transition: "all 0.15s", position: "relative" }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = D.text; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = D.text2; } }}
              >
                {active && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2.5, height: 16, background: D.purple, borderRadius: "0 2px 2px 0" }} />}
                <Ic />
                <span style={{ flex: 1 }}>{label}</span>
                {badge ? <span style={{ background: D.red, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 9, fontWeight: 700 }}>{badge}</span> : active ? <DIcon.chevron /> : null}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${D.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg, ${D.purple}, ${D.purple2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0, boxShadow: `0 0 10px ${D.purple}44` }}>
              {initials(user.full_name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.full_name || "Admin"}</div>
              <div style={{ fontSize: 9, color: D.purple, textTransform: "uppercase", letterSpacing: "0.5px" }}>Administrator</div>
            </div>
          </div>
          <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${D.border}`, background: "transparent", color: D.text2, fontSize: 11, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = D.redGl; e.currentTarget.style.color = D.red; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = D.text2; e.currentTarget.style.borderColor = D.border; }}
          >
            <DIcon.logout /> SIGN OUT
          </button>
        </div>
      </aside>

      {/* ── MAIN PANEL ── */}
      <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>

        {/* Top bar */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: `${D.bg}e0`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${D.border}`, padding: "0 16px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="ap-hamburger" onClick={()=>setSidebarOpen(o=>!o)} style={{ display:"none",background:"transparent",border:"none",cursor:"pointer",color:D.text,fontSize:18,padding:4,marginRight:4 }}>☰</button>
            <span style={{ fontSize: 10, color: D.muted, letterSpacing: "1px" }}>ADMIN /</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: D.violet, letterSpacing: "0.5px", textTransform: "uppercase" }}>{section}</span>
          </div>
          <div style={{ fontSize: 10, color: D.muted, letterSpacing: "0.5px" }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        <div className="ap-content-pad" style={{ padding: "20px 16px" }}>

          {/* ══ DASHBOARD ══════════════════════════════════════════ */}
          {section === "dashboard" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: D.text, margin: "0 0 4px", letterSpacing: "-0.5px" }}>System Overview</h2>
                <p style={{ fontSize: 12, color: D.text2, margin: 0 }}>Real-time analytics — UniAdvisor AI platform</p>
              </div>

              {/* KPI row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
                {[
                  { label: "Total Questions",  val: stats?.total_questions || 0,    suffix: "",   color: D.purple, gl: D.purpleGl, spark: sparkData },
                  { label: "Indexed Chunks",   val: stats?.indexed_chunks  || 0,    suffix: "",   color: D.cyan,   gl: D.cyanGl,   spark: sparkData.map(v=>v*3) },
                  { label: "Cached Answers",   val: stats?.cached_answers  || 0,    suffix: "",   color: D.green,  gl: D.greenGl,  spark: sparkData.map(v=>v*0.7) },
                  { label: "Satisfaction",     val: 94,                             suffix: "%",  color: D.amber,  gl: D.amberGl,  spark: sparkData.map(v=>70+v) },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, borderRadius: "50%", background: kpi.gl, filter: "blur(20px)", pointerEvents: "none" }} />
                    <div style={{ fontSize: 10, color: D.text2, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 10 }}>{kpi.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, letterSpacing: "-1px", lineHeight: 1 }}>
                      <AnimatedCounter target={kpi.val} suffix={kpi.suffix} />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <Sparkline data={kpi.spark} color={kpi.color} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Second row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>

                {/* Questions by major */}
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: D.text, letterSpacing: "0.5px", marginBottom: 16 }}>QUESTIONS BY MAJOR</div>
                  {stats?.questions_by_major && Object.keys(stats.questions_by_major).length > 0
                    ? Object.entries(stats.questions_by_major).map(([major, count]) => (
                        <HBar key={major} label={major.length > 18 ? major.slice(0, 18) + "…" : major} value={count} max={Math.max(...Object.values(stats.questions_by_major))} color={D.purple} />
                      ))
                    : <div style={{ fontSize: 11, color: D.muted, marginTop: 8 }}>No data yet. Start chatting!</div>}
                </div>

                {/* Questions by year */}
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: D.text, letterSpacing: "0.5px", marginBottom: 16 }}>QUESTIONS BY YEAR</div>
                  {stats?.questions_by_year && Object.keys(stats.questions_by_year).length > 0
                    ? Object.entries(stats.questions_by_year).map(([yr, count]) => (
                        <HBar key={yr} label={yr} value={count} max={Math.max(...Object.values(stats.questions_by_year))} color={D.cyan} />
                      ))
                    : <div style={{ fontSize: 11, color: D.muted, marginTop: 8 }}>No data yet.</div>}
                </div>

                {/* System health donuts */}
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: D.text, letterSpacing: "0.5px", marginBottom: 16 }}>SYSTEM HEALTH</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { label: "AI Response Rate", pct: 98, color: D.green },
                      { label: "Cache Hit Rate",   pct: stats?.cached_answers && stats?.total_questions ? Math.round((stats.cached_answers/stats.total_questions)*100) : 0, color: D.cyan },
                      { label: "Uptime",           pct: 100, color: D.purple },
                    ].map(item => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Donut percent={item.pct} color={item.color} size={44} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.pct}%</div>
                          <div style={{ fontSize: 10, color: D.text2 }}>{item.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent questions */}
              {stats?.recent_questions?.length > 0 && (
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: D.text, letterSpacing: "0.5px", marginBottom: 14 }}>RECENT QUERIES</div>
                  {stats.recent_questions.map((q, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: i < stats.recent_questions.length - 1 ? `1px solid ${D.border}` : "none" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: D.purple, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: D.text2, lineHeight: 1.4 }}>{q}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ ANNOUNCEMENTS ══════════════════════════════════════ */}
          {section === "announcements" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: "0 0 20px", letterSpacing: "-0.3px" }}>Announcements</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Composer */}
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: D.violet, letterSpacing: "0.8px", marginBottom: 16 }}>NEW ANNOUNCEMENT</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                    {["info","warning","urgent"].map(type => {
                      const cfg = ANN_CFG[type];
                      return <button key={type} onClick={() => setAnnType(type)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: `1px solid ${annType===type?cfg.color:D.border}`, background: annType===type?cfg.gl:"transparent", color: annType===type?cfg.color:D.text2, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.5px", transition: "all 0.15s" }}>{type}</button>;
                    })}
                  </div>
                  <textarea value={annText} onChange={e=>setAnnText(e.target.value)} placeholder="Enter announcement text..." rows={5}
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${annText?D.purple:D.border}`, borderRadius: 8, fontSize: 12, fontFamily: "inherit", color: D.text, background: D.card2, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6, transition: "border-color 0.15s" }}
                    onFocus={e=>e.target.style.borderColor=D.purple}
                    onBlur={e=>e.target.style.borderColor=annText?D.purple:D.border}
                  />
                  <button onClick={postAnn} disabled={!annText.trim()||posting} style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 8, border: "none", background: annText.trim()&&!posting?`linear-gradient(135deg, ${D.purple}, ${D.purple2})`:"rgba(255,255,255,0.05)", color: annText.trim()&&!posting?D.text:D.muted, fontSize: 12, fontWeight: 700, cursor: annText.trim()&&!posting?"pointer":"not-allowed", boxShadow: annText.trim()&&!posting?`0 0 20px ${D.purple}44`:"none", fontFamily: "inherit", transition: "all 0.18s" }}>
                    <DIcon.send />{posting?"PUBLISHING…":"PUBLISH"}
                  </button>
                </div>
                {/* List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
                  {anns.filter(a=>a.active!==false).length === 0
                    ? <div style={{ color: D.muted, fontSize: 12, textAlign: "center", padding: "40px 0" }}>No active announcements.</div>
                    : anns.filter(a=>a.active!==false).map(ann => {
                        const cfg = ANN_CFG[ann.type] || ANN_CFG.info;
                        return (
                          <div key={ann.id} style={{ background: D.card, border: `1px solid ${cfg.color}33`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10 }}>
                            <div style={{ width: 2.5, background: cfg.color, borderRadius: 2, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: cfg.color, fontWeight: 700, letterSpacing: "0.5px", marginBottom: 4 }}>{cfg.label.toUpperCase()}</div>
                              <div style={{ fontSize: 12, color: D.text, lineHeight: 1.5 }}>{ann.text}</div>
                              <div style={{ fontSize: 10, color: D.muted, marginTop: 5 }}>{new Date(ann.created_at).toLocaleString()}</div>
                            </div>
                            <button onClick={() => deleteAnn(ann.id)} style={{ background: "transparent", border: "none", color: D.muted, cursor: "pointer", padding: "2px 4px", alignSelf: "flex-start" }}
                              onMouseEnter={e=>e.currentTarget.style.color=D.red}
                              onMouseLeave={e=>e.currentTarget.style.color=D.muted}
                            ><DIcon.trash /></button>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>
          )}

          {/* ══ DOCUMENTS ══════════════════════════════════════════ */}
          {section === "documents" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: "0 0 20px", letterSpacing: "-0.3px" }}>Knowledge Base Documents</h2>

              {alerts.length > 0 && (
                <div style={{ background: D.redGl, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <DIcon.alert />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: D.red, marginBottom: 6 }}>⚠ {alerts.length} document(s) need updating (90+ days old)</div>
                    {alerts.map((a, i) => <div key={i} style={{ fontSize: 11, color: D.text2 }}>• {a.filename} — {a.days_old} days old</div>)}
                  </div>
                </div>
              )}

              {/* Upload zone */}
              <div style={{ border: `2px dashed ${D.border2}`, borderRadius: 14, padding: "32px 24px", textAlign: "center", cursor: "pointer", marginBottom: 20, transition: "all 0.2s" }}
                onClick={() => fileRef.current?.click()}
                onMouseEnter={e => { e.currentTarget.style.borderColor = D.purple; e.currentTarget.style.background = D.purpleGl; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = D.border2; e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
                <div style={{ color: D.violet, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Click to upload document</div>
                <div style={{ color: D.muted, fontSize: 11 }}>PDF · TXT · DOCX — Course catalogs, policies, handbooks</div>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.docx" style={{ display: "none" }} onChange={handleUpload} />
              </div>

              {uploading && <div style={{ textAlign: "center", color: D.violet, fontSize: 12, marginBottom: 12, animation: "pulse 1.5s infinite" }}>Uploading and indexing…</div>}
              {uploadMsg && <div style={{ textAlign: "center", fontSize: 12, color: uploadMsg.startsWith("✓") ? D.green : D.red, marginBottom: 14, fontWeight: 600 }}>{uploadMsg}</div>}

              {/* Doc list */}
              {docs.length > 0 && (
                <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${D.border}`, fontSize: 11, fontWeight: 700, color: D.text, letterSpacing: "0.5px" }}>INDEXED DOCUMENTS ({docs.length})</div>
                  {docs.map((doc, i) => {
                    const name = typeof doc === "string" ? doc : doc.name;
                    const info = typeof doc === "object" ? doc : {};
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < docs.length - 1 ? `1px solid ${D.border}` : "none" }}
                        onMouseEnter={e=>e.currentTarget.style.background=D.card2}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: D.purpleGl, border: `1px solid ${D.purpleBr}`, display: "flex", alignItems: "center", justifyContent: "center", color: D.violet, flexShrink: 0 }}><DIcon.doc /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                          {info.uploaded_at && <div style={{ fontSize: 10, color: D.muted, marginTop: 2 }}>{new Date(info.uploaded_at).toLocaleDateString()} · {info.chunks || 0} chunks indexed</div>}
                        </div>
                        <div style={{ fontSize: 10, color: D.green, background: D.greenGl, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>ACTIVE</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {docs.length === 0 && !uploading && <div style={{ color: D.muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>No documents indexed yet.</div>}
            </div>
          )}

          {/* ══ ESCALATIONS ═══════════════════════════════════════ */}
          {section === "escalations" && (
            <div>
              <h2 style={{ fontSize:18,fontWeight:700,color:D.text,margin:"0 0 6px",letterSpacing:"-0.3px" }}>Student Escalations</h2>
              <p style={{ fontSize:12,color:D.text2,margin:"0 0 24px" }}>Direct help requests from students — reply to notify them in-app</p>
              {escalations.length===0 && <div style={{ color:D.muted,fontSize:12,textAlign:"center",padding:"60px 0" }}>No escalations yet.</div>}
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                {escalations.map(esc=>{
                  const statusColors={open:D.amber,replied:D.green,closed:D.muted};
                  return (
                    <div key={esc.id} style={{ background:D.card,border:`1px solid ${esc.status==="open"?D.amber+"44":D.border}`,borderRadius:14,padding:18 }}>
                      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:14,fontWeight:700,color:D.text,marginBottom:3 }}>{esc.subject}</div>
                          <div style={{ fontSize:11,color:D.text2 }}>From: {esc.student_name||esc.student_email} · {new Date(esc.created_at).toLocaleString()}</div>
                        </div>
                        <span style={{ fontSize:9,fontWeight:700,padding:"3px 10px",borderRadius:20,background:`${statusColors[esc.status]}22`,color:statusColors[esc.status],border:`1px solid ${statusColors[esc.status]}44`,textTransform:"uppercase" }}>{esc.status}</span>
                      </div>
                      <div style={{ fontSize:12,color:D.text,background:D.card2,borderRadius:8,padding:"10px 12px",marginBottom:10,lineHeight:1.6 }}>{esc.message}</div>
                      {esc.admin_reply && (
                        <div style={{ fontSize:12,color:D.green,background:D.greenGl,borderRadius:8,padding:"8px 12px",marginBottom:10,border:`1px solid rgba(16,185,129,0.2)` }}>
                          <span style={{ fontWeight:700 }}>Your reply: </span>{esc.admin_reply}
                        </div>
                      )}
                      {esc.status!=="replied" && (
                        <div style={{ display:"flex",gap:8 }}>
                          <input value={replyText[esc.id]||""} onChange={e=>setReplyText(prev=>({...prev,[esc.id]:e.target.value}))} placeholder="Type your reply…"
                            style={{ flex:1,padding:"8px 12px",borderRadius:8,border:`1px solid ${D.border}`,background:D.card2,color:D.text,fontSize:12,outline:"none",fontFamily:"inherit" }} />
                          <button onClick={()=>sendReply(esc)} disabled={replying===esc.id||!replyText[esc.id]?.trim()}
                            style={{ padding:"8px 16px",borderRadius:8,border:"none",background:D.purple,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:replying===esc.id?0.6:1 }}>
                            {replying===esc.id?"Sending…":"Reply"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ OFFICE ANALYTICS ══════════════════════════════════ */}
          {section === "analytics" && (
            <div>
              <h2 style={{ fontSize:18,fontWeight:700,color:D.text,margin:"0 0 6px",letterSpacing:"-0.3px" }}>Per-Office Analytics</h2>
              <p style={{ fontSize:12,color:D.text2,margin:"0 0 24px" }}>Which offices get the most questions and what satisfaction scores they have</p>
              {officeStats.length===0 && <div style={{ color:D.muted,fontSize:12,textAlign:"center",padding:"60px 0" }}>No data yet — students need to chat with office routing enabled.</div>}
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14 }}>
                {officeStats.map(o=>{
                  const rated = o.up+o.down;
                  const sat   = rated>0?Math.round((o.up/rated)*100):0;
                  const satColor = sat>=80?D.green:sat>=60?D.amber:D.red;
                  return (
                    <div key={o.office_id} style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,padding:18 }}>
                      <div style={{ fontSize:13,fontWeight:700,color:D.text,marginBottom:4,textTransform:"capitalize" }}>{o.office_id.replace(/_/g," ")}</div>
                      <div style={{ fontSize:11,color:D.text2,marginBottom:14 }}>{o.total} questions routed</div>
                      {/* Satisfaction bar */}
                      <div style={{ marginBottom:10 }}>
                        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                          <span style={{ fontSize:10,color:D.text2 }}>Satisfaction</span>
                          <span style={{ fontSize:10,fontWeight:700,color:satColor }}>{sat}%</span>
                        </div>
                        <div style={{ height:5,background:D.border2,borderRadius:4,overflow:"hidden" }}>
                          <div style={{ height:"100%",width:`${sat}%`,background:satColor,borderRadius:4,transition:"width 1s ease" }} />
                        </div>
                      </div>
                      <div style={{ display:"flex",gap:10 }}>
                        <div style={{ flex:1,textAlign:"center",background:D.greenGl,borderRadius:8,padding:"8px 0",border:"1px solid rgba(16,185,129,0.15)" }}>
                          <div style={{ fontSize:18,fontWeight:800,color:D.green }}>👍 {o.up}</div>
                          <div style={{ fontSize:9,color:D.text2,marginTop:2 }}>POSITIVE</div>
                        </div>
                        <div style={{ flex:1,textAlign:"center",background:D.redGl,borderRadius:8,padding:"8px 0",border:"1px solid rgba(239,68,68,0.15)" }}>
                          <div style={{ fontSize:18,fontWeight:800,color:D.red }}>👎 {o.down}</div>
                          <div style={{ fontSize:9,color:D.text2,marginTop:2 }}>NEGATIVE</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ SATISFACTION TRENDS ═══════════════════════════════ */}
          {section === "feedback" && (
            <div>
              <h2 style={{ fontSize:18,fontWeight:700,color:D.text,margin:"0 0 6px",letterSpacing:"-0.3px" }}>Student Satisfaction</h2>
              <p style={{ fontSize:12,color:D.text2,margin:"0 0 24px" }}>Thumbs up/down ratings on AI responses over time</p>
              {!feedbackData ? <div style={{ color:D.muted,fontSize:12,textAlign:"center",padding:"60px 0" }}>Loading feedback data…</div> : (
                <div>
                  {/* Score row */}
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24 }}>
                    {[
                      {label:"Total Ratings",   val:feedbackData.total,      color:D.purple},
                      {label:"Positive",         val:feedbackData.upvotes,    color:D.green},
                      {label:"Negative",         val:feedbackData.downvotes,  color:D.red},
                      {label:"Score",            val:`${feedbackData.score}%`,color:feedbackData.score>=70?D.green:D.amber},
                    ].map(k=>(
                      <div key={k.label} style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,padding:"18px 20px",textAlign:"center" }}>
                        <div style={{ fontSize:10,color:D.text2,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:8 }}>{k.label}</div>
                        <div style={{ fontSize:28,fontWeight:800,color:k.color }}>{k.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Daily trend */}
                  {feedbackData.daily && Object.keys(feedbackData.daily).length>0 && (
                    <div style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,padding:20,marginBottom:20 }}>
                      <div style={{ fontSize:11,fontWeight:700,color:D.text,letterSpacing:"0.5px",marginBottom:14 }}>DAILY BREAKDOWN</div>
                      {Object.entries(feedbackData.daily).sort().map(([day,counts])=>(
                        <div key={day} style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}>
                          <span style={{ fontSize:10,color:D.text2,minWidth:80 }}>{day}</span>
                          <div style={{ flex:1,height:6,background:D.border2,borderRadius:3,overflow:"hidden",display:"flex" }}>
                            <div style={{ height:"100%",width:`${((counts.up||0)/Math.max((counts.up||0)+(counts.down||0),1))*100}%`,background:D.green }} />
                            <div style={{ height:"100%",flex:1,background:D.red,opacity:0.4 }} />
                          </div>
                          <span style={{ fontSize:10,color:D.green,minWidth:30 }}>+{counts.up||0}</span>
                          <span style={{ fontSize:10,color:D.red,minWidth:30 }}>-{counts.down||0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Recent */}
                  {feedbackData.recent?.length>0 && (
                    <div style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,overflow:"hidden" }}>
                      <div style={{ padding:"12px 16px",borderBottom:`1px solid ${D.border}`,fontSize:11,fontWeight:700,color:D.text,letterSpacing:"0.5px" }}>RECENT FEEDBACK</div>
                      {feedbackData.recent.map((f,i)=>(
                        <div key={i} style={{ display:"flex",gap:12,padding:"10px 16px",borderBottom:i<feedbackData.recent.length-1?`1px solid ${D.border}`:"none",alignItems:"flex-start" }}>
                          <span style={{ fontSize:16,marginTop:1 }}>{f.rating==="up"?"👍":"👎"}</span>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontSize:12,color:D.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{f.question}</div>
                            {f.office && <span style={{ fontSize:10,color:D.violet }}>via {f.office}</span>}
                          </div>
                          <span style={{ fontSize:10,color:D.muted,flexShrink:0 }}>{f.created_at?new Date(f.created_at).toLocaleDateString():""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          {/* ══ SURVEY RESULTS ═══════════════════════════════════ */}
          {section === "survey" && (
            <div>
              <h2 style={{ fontSize:18,fontWeight:700,color:D.text,margin:"0 0 6px",letterSpacing:"-0.3px" }}>Survey Results</h2>
              <p style={{ fontSize:12,color:D.text2,margin:"0 0 24px" }}>International student pain-point survey — your TDK research data</p>
              {surveyData === null ? <div style={{ color:D.muted,fontSize:12,textAlign:"center",padding:"60px 0" }}>Loading survey data…</div> :
              surveyData.length === 0 ? <div style={{ color:D.muted,fontSize:12,textAlign:"center",padding:"60px 0" }}>No responses yet — share the survey link with international students!</div> : (
                <div>
                  {/* Summary cards */}
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24 }}>
                    {[
                      {label:"Total Responses", val:surveyData.length, color:D.purple},
                      {label:"Avg Info Quality", val: (surveyData.reduce((s,r)=>s+(r.info_quality||0),0)/surveyData.filter(r=>r.info_quality).length||0).toFixed(1)+"/5", color:D.amber},
                      {label:"Avg UniAdvisor Score", val: (surveyData.reduce((s,r)=>s+(r.uniadvisor_usefulness||0),0)/surveyData.filter(r=>r.uniadvisor_usefulness).length||0).toFixed(1)+"/5", color:D.green},
                    ].map(k=>(
                      <div key={k.label} style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,padding:"18px 20px",textAlign:"center" }}>
                        <div style={{ fontSize:10,color:D.text2,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:8 }}>{k.label}</div>
                        <div style={{ fontSize:28,fontWeight:800,color:k.color }}>{k.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Top pain points */}
                  {(() => {
                    const counts = {};
                    surveyData.forEach(r => (r.arrival_confusion||"").split(", ").filter(Boolean).forEach(v => { counts[v]=(counts[v]||0)+1; }));
                    const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
                    return sorted.length > 0 && (
                      <div style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,padding:20,marginBottom:20 }}>
                        <div style={{ fontSize:11,fontWeight:700,color:D.text,letterSpacing:"0.5px",marginBottom:14 }}>TOP ARRIVAL PAIN POINTS</div>
                        {sorted.map(([label,count])=>(
                          <div key={label} style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
                            <span style={{ fontSize:12,color:D.text,flex:1 }}>{label}</span>
                            <div style={{ width:160,height:6,background:D.border2,borderRadius:3,overflow:"hidden" }}>
                              <div style={{ height:"100%",width:`${(count/surveyData.length)*100}%`,background:D.purple,borderRadius:3 }} />
                            </div>
                            <span style={{ fontSize:11,color:D.muted,minWidth:28,textAlign:"right" }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Most wanted feature */}
                  {(() => {
                    const counts = {};
                    surveyData.forEach(r => { if(r.missing_feature) counts[r.missing_feature]=(counts[r.missing_feature]||0)+1; });
                    const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
                    return sorted.length > 0 && (
                      <div style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,padding:20,marginBottom:20 }}>
                        <div style={{ fontSize:11,fontWeight:700,color:D.text,letterSpacing:"0.5px",marginBottom:14 }}>MOST WANTED FEATURE</div>
                        {sorted.map(([label,count])=>(
                          <div key={label} style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
                            <span style={{ fontSize:12,color:D.text,flex:1 }}>{label}</span>
                            <div style={{ width:160,height:6,background:D.border2,borderRadius:3,overflow:"hidden" }}>
                              <div style={{ height:"100%",width:`${(count/surveyData.length)*100}%`,background:D.green,borderRadius:3 }} />
                            </div>
                            <span style={{ fontSize:11,color:D.muted,minWidth:28,textAlign:"right" }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Open feedback */}
                  <div style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,overflow:"hidden" }}>
                    <div style={{ padding:"12px 16px",borderBottom:`1px solid ${D.border}`,fontSize:11,fontWeight:700,color:D.text,letterSpacing:"0.5px" }}>OPEN FEEDBACK (verbatim)</div>
                    {surveyData.filter(r=>r.open_feedback).slice(0,10).map((r,i)=>(
                      <div key={i} style={{ padding:"12px 16px",borderBottom:i<9?`1px solid ${D.border}`:"none" }}>
                        <div style={{ fontSize:13,color:D.text,lineHeight:1.5,marginBottom:4 }}>"{r.open_feedback}"</div>
                        <div style={{ fontSize:10,color:D.muted }}>{r.student_nationality} · {r.student_major} · {r.student_year}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ EVENTS ═════════════════════════════════════════════ */}
          {section === "events" && (
            <div>
              <h2 style={{ fontSize:18,fontWeight:700,color:D.text,margin:"0 0 6px",letterSpacing:"-0.3px" }}>Campus Events</h2>
              <p style={{ fontSize:12,color:D.text2,margin:"0 0 20px" }}>Manage upcoming events shown to students in the Events calendar</p>
              {/* Create form */}
              <div style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,padding:20,marginBottom:20 }}>
                <div style={{ fontSize:11,fontWeight:700,color:D.violet,letterSpacing:"0.8px",marginBottom:14 }}>NEW EVENT</div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
                  <input value={newEvent.title} onChange={e=>setNewEvent(p=>({...p,title:e.target.value}))} placeholder="Event title *"
                    style={{ padding:"9px 12px",borderRadius:8,border:`1px solid ${D.border}`,background:D.card2,color:D.text,fontSize:12,outline:"none",fontFamily:"inherit" }} />
                  <input value={newEvent.location} onChange={e=>setNewEvent(p=>({...p,location:e.target.value}))} placeholder="Location (e.g. Room B204)"
                    style={{ padding:"9px 12px",borderRadius:8,border:`1px solid ${D.border}`,background:D.card2,color:D.text,fontSize:12,outline:"none",fontFamily:"inherit" }} />
                  <input type="datetime-local" value={newEvent.starts_at} onChange={e=>setNewEvent(p=>({...p,starts_at:e.target.value}))}
                    style={{ padding:"9px 12px",borderRadius:8,border:`1px solid ${D.border}`,background:D.card2,color:D.text,fontSize:12,outline:"none",fontFamily:"inherit" }} />
                  <select value={newEvent.category} onChange={e=>setNewEvent(p=>({...p,category:e.target.value}))}
                    style={{ padding:"9px 12px",borderRadius:8,border:`1px solid ${D.border}`,background:D.card2,color:D.text,fontSize:12,outline:"none",fontFamily:"inherit" }}>
                    {["academic","social","sports","career","admin"].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <textarea value={newEvent.description} onChange={e=>setNewEvent(p=>({...p,description:e.target.value}))} placeholder="Description (optional)" rows={2}
                  style={{ width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${D.border}`,background:D.card2,color:D.text,fontSize:12,outline:"none",resize:"none",boxSizing:"border-box",fontFamily:"inherit",marginBottom:10 }} />
                <button onClick={createEvent} disabled={!newEvent.title||!newEvent.starts_at||addingEvent}
                  style={{ padding:"9px 24px",borderRadius:8,border:"none",background:newEvent.title&&newEvent.starts_at?`linear-gradient(135deg,${D.purple},${D.purple2})`:"rgba(255,255,255,0.05)",color:newEvent.title&&newEvent.starts_at?D.text:D.muted,fontSize:12,fontWeight:700,cursor:newEvent.title&&newEvent.starts_at?"pointer":"not-allowed",fontFamily:"inherit" }}>
                  {addingEvent?"Creating…":"+ Create Event"}
                </button>
              </div>
              {/* Event list */}
              {events.length===0 && <div style={{ color:D.muted,fontSize:12,textAlign:"center",padding:"40px 0" }}>No upcoming events.</div>}
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {events.map(ev=>{
                  const catColors={academic:D.cyan,social:D.purple,sports:D.amber,career:D.blue,admin:D.red};
                  const col = catColors[ev.category]||D.cyan;
                  return (
                    <div key={ev.id} style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:14 }}>
                      <div style={{ width:36,height:36,borderRadius:10,background:`${col}22`,border:`1px solid ${col}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>
                        {{academic:"📚",social:"🎉",sports:"⚽",career:"💼",admin:"📋"}[ev.category]||"📅"}
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:700,color:D.text,marginBottom:2 }}>{ev.title}</div>
                        {ev.description && <div style={{ fontSize:11,color:D.text2,marginBottom:4 }}>{ev.description}</div>}
                        <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
                          <span style={{ fontSize:10,color:col,background:`${col}18`,padding:"1px 8px",borderRadius:4,fontWeight:700 }}>{(ev.category||"").toUpperCase()}</span>
                          <span style={{ fontSize:10,color:D.text2 }}>🕐 {new Date(ev.starts_at).toLocaleString()}</span>
                          {ev.location && <span style={{ fontSize:10,color:D.text2 }}>📍 {ev.location}</span>}
                        </div>
                      </div>
                      <button onClick={()=>deleteEvent(ev.id)} style={{ background:"transparent",border:"none",color:D.muted,cursor:"pointer",padding:"4px",flexShrink:0 }}
                        onMouseEnter={e=>e.currentTarget.style.color=D.red}
                        onMouseLeave={e=>e.currentTarget.style.color=D.muted}><DIcon.trash /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ AUDIT LOG ══════════════════════════════════════════ */}
          {section === "audit" && (
            <div>
              <h2 style={{ fontSize:18,fontWeight:700,color:D.text,margin:"0 0 6px",letterSpacing:"-0.3px" }}>Audit Log</h2>
              <p style={{ fontSize:12,color:D.text2,margin:"0 0 24px" }}>Every admin and staff action with actor, target, and timestamp</p>
              {auditLogs.length===0 && <div style={{ color:D.muted,fontSize:12,textAlign:"center",padding:"60px 0" }}>No audit entries yet.</div>}
              <div style={{ background:D.card,border:`1px solid ${D.border}`,borderRadius:14,overflow:"hidden" }}>
                {auditLogs.map((log,i)=>(
                  <div key={i} style={{ display:"flex",gap:14,padding:"12px 16px",borderBottom:i<auditLogs.length-1?`1px solid ${D.border}`:"none",alignItems:"flex-start" }}
                    onMouseEnter={e=>e.currentTarget.style.background=D.card2}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{ width:6,height:6,borderRadius:"50%",background:D.purple,marginTop:5,flexShrink:0 }} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:2 }}>
                        <span style={{ fontSize:11,fontWeight:700,color:D.violet }}>{log.action}</span>
                        {log.target && <span style={{ fontSize:10,color:D.text2 }}>→ {log.target}</span>}
                      </div>
                      <div style={{ fontSize:11,color:D.text2 }}>by {log.actor_email} ({log.actor_role})</div>
                    </div>
                    <span style={{ fontSize:10,color:D.muted,flexShrink:0 }}>{log.created_at?new Date(log.created_at).toLocaleString():""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}


          {section === "faq" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: "0 0 6px", letterSpacing: "-0.3px" }}>Auto-Generated FAQ</h2>
              <p style={{ fontSize: 12, color: D.text2, margin: "0 0 24px" }}>Derived from the most frequent student questions</p>
              {faq.length === 0
                ? <div style={{ color: D.muted, fontSize: 12, textAlign: "center", padding: "60px 0" }}>No questions recorded yet. Students need to start chatting!</div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {faq.map((item, i) => (
                      <div key={i} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", gap: 14, transition: "border-color 0.15s" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=D.purple}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=D.border}
                      >
                        <div style={{ fontSize: 20, fontWeight: 800, color: D.purple, opacity: 0.3, fontFamily: "serif", lineHeight: 1 }}>Q</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: D.violet, background: D.purpleGl, border: `1px solid ${D.purpleBr}`, padding: "1px 8px", borderRadius: 4 }}>{item.topic}</span>
                            <span style={{ fontSize: 10, color: D.muted }}>asked {item.count}× </span>
                          </div>
                          <div style={{ fontSize: 13, color: D.text, fontWeight: 500 }}>{item.question}</div>
                        </div>
                      </div>
                    ))}
                  </div>}
            </div>
          )}

          {/* ══ TRANSLATE ══════════════════════════════════════════ */}
          {section === "translate" && (
            <div style={{ maxWidth: 580 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: D.text, margin: "0 0 6px", letterSpacing: "-0.3px" }}>Document Translation</h2>
              <p style={{ fontSize: 12, color: D.text2, margin: "0 0 24px" }}>Translate documents and optionally add to the knowledge base</p>

              {/* Upload zone */}
              <div style={{ border: `2px dashed ${D.border2}`, borderRadius: 14, padding: "28px 20px", textAlign: "center", cursor: "pointer", marginBottom: 16, transition: "all 0.2s" }}
                onClick={() => transRef.current?.click()}
                onMouseEnter={e => { e.currentTarget.style.borderColor = D.cyan; e.currentTarget.style.background = D.cyanGl; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = D.border2; e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>🌍</div>
                <div style={{ color: D.cyan, fontWeight: 700, fontSize: 13 }}>{transFile ? transFile.name : "Click to select document"}</div>
                <div style={{ color: D.muted, fontSize: 11, marginTop: 4 }}>PDF · TXT · DOCX</div>
                <input ref={transRef} type="file" accept=".pdf,.txt,.docx" style={{ display: "none" }} onChange={e => setTransFile(e.target.files[0])} />
              </div>

              {/* Language toggle */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: D.muted, letterSpacing: "1px", marginBottom: 8 }}>TARGET LANGUAGE</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["en","English"],["hu","Magyar"]].map(([code, label]) => (
                    <button key={code} onClick={() => setTransLang(code)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${transLang===code?D.cyan:D.border}`, background: transLang===code?D.cyanGl:"transparent", color: transLang===code?D.cyan:D.text2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>{label}</button>
                  ))}
                </div>
              </div>

              <button onClick={runTranslate} disabled={!transFile || translating} style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: transFile&&!translating?`linear-gradient(135deg,${D.cyan},#0EA5E9)`:"rgba(255,255,255,0.05)", color: transFile&&!translating?D.bg:D.muted, fontSize: 12, fontWeight: 800, cursor: transFile&&!translating?"pointer":"not-allowed", boxShadow: transFile&&!translating?`0 0 20px ${D.cyan}33`:"none", fontFamily: "inherit", letterSpacing: "0.5px", transition: "all 0.18s" }}>
                {translating ? "TRANSLATING…" : "TRANSLATE DOCUMENT"}
              </button>

              {transResult && !transResult.error && (
                <div style={{ marginTop: 20, background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "10px 16px", borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: D.cyan, letterSpacing: "0.5px" }}>TRANSLATION RESULT</span>
                    <button onClick={() => navigator.clipboard.writeText(transResult.translated)} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${D.border}`, color: D.text2, padding: "4px 10px", borderRadius: 6, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}><DIcon.copy /> COPY</button>
                  </div>
                  <div style={{ padding: 16, fontSize: 12, color: D.text, lineHeight: 1.7, maxHeight: 300, overflowY: "auto", whiteSpace: "pre-wrap" }}>{transResult.translated}</div>
                </div>
              )}
              {transResult?.error && <div style={{ marginTop: 14, color: D.red, fontSize: 12, textAlign: "center" }}>{transResult.error}</div>}
            </div>
          )}

        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        @keyframes glow { 0%,100%{opacity:1;box-shadow:0 0 4px currentColor} 50%{opacity:0.5;box-shadow:none} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${D.border2}; border-radius: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }

        /* ── Mobile ── */
        @media(max-width:767px){
          .ap-sidebar-closed{position:fixed!important;left:-240px!important;top:0;bottom:0;z-index:100;transition:left 0.25s;}
          .ap-sidebar-open{position:fixed!important;left:0!important;top:0;bottom:0;z-index:100;transition:left 0.25s;box-shadow:6px 0 30px rgba(0,0,0,0.5);}
          .ap-hamburger{display:block!important;}
          .ap-content-pad{padding:16px 12px!important;}
        }
        @media(min-width:768px){
          .ap-sidebar-closed,.ap-sidebar-open{position:relative!important;left:0!important;}
          .ap-content-pad{padding:28px 32px!important;}
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════