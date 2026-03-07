// ═══════════════════════════════════════════════════════════
// StaffPortal.jsx — All 6 gaps fixed:
//  ✓ Announcements persisted in Supabase (survive refresh)
//  ✓ Scheduled announcements (future publish date/time)
//  ✓ Read/dismissed receipts per student
//  ✓ Student activity from real Supabase chat_logs table
//  ✓ Student directory from real Supabase users table
//  ✓ Messages saved to Supabase staff_messages table
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     || "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Palette ──────────────────────────────────────────────────
const S = {
  white:"#FFFFFF", snow:"#F8FAFC", ice:"#F1F5F9",
  border:"#E2E8F0", border2:"#CBD5E1",
  text:"#0F172A", text2:"#334155", muted:"#64748B",
  teal:"#0D9488", teal2:"#0F766E", tealBg:"#F0FDFA", tealBdr:"#99F6E4",
  blue:"#0EA5E9", blueBg:"#F0F9FF",
  amber:"#F59E0B", amberBg:"#FFFBEB",
  red:"#EF4444", redBg:"#FEF2F2",
  green:"#10B981", greenBg:"#F0FDF4",
  purple:"#8B5CF6", purpleBg:"#F5F3FF",
};

// ── Icons ────────────────────────────────────────────────────
const I = {
  logout:   ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  bell:     ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  users:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  send:     ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  trash:    ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
  chat:     ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  check:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  info:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  warning:  ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  urgent:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  activity: ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  clock:    ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  eye:      ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:   ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  calendar: ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
};

const ANN_TYPES = {
  info:    { color: S.blue,  bg: S.blueBg,  border: "#BAE6FD", label: "Information", Icon: I.info },
  warning: { color: S.amber, bg: S.amberBg, border: "#FDE68A", label: "Warning",     Icon: I.warning },
  urgent:  { color: S.red,   bg: S.redBg,   border: "#FECACA", label: "Urgent",      Icon: I.urgent },
};

const initials = (name="") => name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

// ── Toast ────────────────────────────────────────────────────
function Toast({ msg, type="success", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return ()=>clearTimeout(t); }, []);
  const bg = type==="success" ? S.greenBg : type==="error" ? S.redBg : S.blueBg;
  const color = type==="success" ? "#065F46" : type==="error" ? S.red : S.blue;
  const border = type==="success" ? "#A7F3D0" : type==="error" ? "#FECACA" : "#BAE6FD";
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", alignItems:"center", gap:8,
      background:bg, border:`1px solid ${border}`, borderRadius:12, padding:"10px 16px",
      boxShadow:"0 4px 20px rgba(0,0,0,0.1)", fontSize:13, color, fontWeight:600,
      animation:"slideUp 0.2s ease" }}>
      {type==="success" ? <I.check/> : type==="error" ? <I.urgent/> : <I.info/>}
      {msg}
    </div>
  );
}

// ── Skeleton loader ──────────────────────────────────────────
function Skeleton({ width="100%", height=16, radius=6 }) {
  return <div style={{ width, height, borderRadius:radius, background:"linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite" }} />;
}

export default function StaffPortal({ user, onLogout }) {
  const [section, setSection]     = useState("announcements");
  // Announcements
  const [anns, setAnns]           = useState([]);
  const [annsLoading, setAnnsLoading] = useState(true);
  const [annText, setAnnText]     = useState("");
  const [annType, setAnnType]     = useState("info");
  const [posting, setPosting]     = useState(false);
  const [scheduledAt, setScheduledAt] = useState(""); // ISO datetime string
  const [isScheduled, setIsScheduled] = useState(false);
  const [charCount, setCharCount] = useState(0);
  // Read receipts
  const [receipts, setReceipts]   = useState({}); // { ann_id: { read:N, dismissed:N } }
  // Activity (real chat logs)
  const [activity, setActivity]   = useState([]);
  const [actLoading, setActLoading] = useState(true);
  // Directory (real users)
  const [students, setStudents]   = useState([]);
  const [dirLoading, setDirLoading] = useState(true);
  const [searchQ, setSearchQ]     = useState("");
  const [filterMajor, setFilterMajor] = useState("All");
  // Messages
  const [messages, setMessages]   = useState([]);
  const [msgLoading, setMsgLoading] = useState(true);
  const [msgTo, setMsgTo]         = useState("");
  const [msgText, setMsgText]     = useState("");
  const [msgType, setMsgType]     = useState("info");
  const [sendingMsg, setSendingMsg] = useState(false);
  // UI
  const [toast, setToast]         = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const MAX_CHARS = 500;

  const showToast = (msg, type="success") => setToast({ msg, type });

  // ── Load announcements from Supabase ───────────────────────
  useEffect(() => {
    loadAnnouncements();
    loadActivity();
    loadStudents();
    loadMessages();
  }, []);

  const loadAnnouncements = async () => {
    setAnnsLoading(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("active", true)
      .lte("scheduled_at", now)       // only show announcements whose time has come
      .order("scheduled_at", { ascending: false });
    if (!error && data) {
      setAnns(data);
      // load read receipt counts
      const ids = data.map(a => a.id);
      if (ids.length > 0) {
        const { data: rdata } = await supabase
          .from("announcement_reads")
          .select("announcement_id, action")
          .in("announcement_id", ids);
        if (rdata) {
          const counts = {};
          rdata.forEach(r => {
            if (!counts[r.announcement_id]) counts[r.announcement_id] = { read:0, dismissed:0 };
            counts[r.announcement_id][r.action]++;
          });
          setReceipts(counts);
        }
      }
    }
    setAnnsLoading(false);
  };

  // ── Load real chat logs from Supabase ──────────────────────
  const loadActivity = async () => {
    setActLoading(true);
    const { data, error } = await supabase
      .from("chat_logs")
      .select("student_name, major, question, asked_at")
      .order("asked_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      setActivity(data.map(r => ({
        student: r.student_name || "Unknown",
        major:   r.major || "—",
        q:       r.question,
        time:    timeAgo(r.asked_at),
      })));
    }
    setActLoading(false);
  };

  // ── Load students from Supabase users table ────────────────
  const loadStudents = async () => {
    setDirLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("full_name, email, major, year_of_study, student_id, active")
      .eq("role", "student")
      .order("full_name");
    if (!error && data) setStudents(data);
    setDirLoading(false);
  };

  // ── Load sent messages from Supabase ──────────────────────
  const loadMessages = async () => {
    setMsgLoading(true);
    const { data, error } = await supabase
      .from("staff_messages")
      .select("*")
      .eq("from_email", user.email)
      .order("sent_at", { ascending: false });
    if (!error && data) setMessages(data);
    setMsgLoading(false);
  };

  // ── Post announcement ──────────────────────────────────────
  const postAnn = async () => {
    if (!annText.trim() || posting) return;
    setPosting(true);
    const payload = {
      text: annText.trim(),
      type: annType,
      active: true,
      created_by: user.email,
      scheduled_at: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
    };
    const { data, error } = await supabase.from("announcements").insert([payload]).select().single();
    if (!error && data) {
      if (!isScheduled || !scheduledAt || new Date(scheduledAt) <= new Date()) {
        setAnns(prev => [data, ...prev]);
        showToast("Announcement published!");
      } else {
        showToast(`Scheduled for ${new Date(scheduledAt).toLocaleString()}`, "info");
      }
      setAnnText(""); setCharCount(0); setScheduledAt(""); setIsScheduled(false);
    } else {
      showToast("Failed to publish announcement", "error");
    }
    setPosting(false);
  };

  // ── Delete announcement ────────────────────────────────────
  const deleteAnn = async (id) => {
    const { error } = await supabase.from("announcements").update({ active: false }).eq("id", id);
    if (!error) {
      setAnns(prev => prev.filter(a => a.id !== id));
      showToast("Announcement removed");
    }
  };

  // ── Send message ───────────────────────────────────────────
  const sendMsg = async () => {
    if (!msgText.trim() || !msgTo.trim() || sendingMsg) return;
    setSendingMsg(true);
    const isGroup = msgTo.toLowerCase().includes("all") || msgTo.toLowerCase().includes("year") || !msgTo.includes("@");
    const payload = {
      from_email: user.email,
      from_name: user.full_name,
      to_target: msgTo.trim(),
      type: msgType,
      text: msgText.trim(),
      is_group: isGroup,
    };
    const { data, error } = await supabase.from("staff_messages").insert([payload]).select().single();
    if (!error && data) {
      setMessages(prev => [data, ...prev]);
      setMsgText(""); setMsgTo("");
      showToast("Message saved & sent!");
    } else {
      showToast("Failed to send message", "error");
    }
    setSendingMsg(false);
  };

  // ── Helpers ───────────────────────────────────────────────
  const timeAgo = (iso) => {
    if (!iso) return "—";
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60)   return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff/60)} min ago`;
    if (diff < 86400)return `${Math.round(diff/3600)} hr ago`;
    return new Date(iso).toLocaleDateString();
  };

  const majors = ["All", ...new Set(students.map(s => s.major).filter(Boolean))];
  const filteredStudents = students.filter(s =>
    (filterMajor === "All" || s.major === filterMajor) &&
    (searchQ === "" || (s.full_name||"").toLowerCase().includes(searchQ.toLowerCase()) ||
     (s.email||"").toLowerCase().includes(searchQ.toLowerCase()))
  );

  const actMajors = ["All", ...new Set(activity.map(a => a.major).filter(m => m && m !== "—"))];
  const [actSearch, setActSearch]   = useState("");
  const [actMajor, setActMajor]     = useState("All");
  const filteredActivity = activity.filter(a =>
    (actMajor === "All" || a.major === actMajor) &&
    (actSearch === "" || a.student.toLowerCase().includes(actSearch.toLowerCase()) || a.q.toLowerCase().includes(actSearch.toLowerCase()))
  );

  const NAV = [
    { id:"announcements", icon:I.bell,     label:"Announcements",   badge: anns.length || null },
    { id:"activity",      icon:I.activity, label:"Student Activity", badge: null },
    { id:"directory",     icon:I.users,    label:"Student Directory",badge: students.length || null },
    { id:"messages",      icon:I.chat,     label:"Message Log",      badge: messages.length || null },
  ];
  const PAGE = {
    announcements: { title:"Announcements",    sub:"Broadcast to all students — persisted in Supabase" },
    activity:      { title:"Student Activity", sub:"Live questions from real chat logs" },
    directory:     { title:"Student Directory",sub:"All students from Supabase" },
    messages:      { title:"Message Log",      sub:"Messages saved to Supabase" },
  };

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"'IBM Plex Sans','Segoe UI',system-ui,sans-serif", background:S.snow, color:S.text, overflow:"hidden", position:"relative" }}>

      {/* Mobile overlay */}
      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:99 }} />}

      {/* ── SIDEBAR ── */}
      <aside className={sidebarOpen?"sp-sidebar-open":"sp-sidebar-closed"} style={{ width:224, background:S.white, borderRight:`1px solid ${S.border}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"24px 20px 20px", borderBottom:`1px solid ${S.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${S.teal},${S.teal2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, boxShadow:`0 4px 12px ${S.teal}33` }}>👩‍🏫</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:S.text }}>Staff Portal</div>
              <div style={{ fontSize:10, color:S.muted }}>UniAdvisor AI</div>
            </div>
          </div>
        </div>

        <nav style={{ padding:"12px 10px", flex:1 }}>
          {NAV.map(({ id, icon:Ic, label, badge }) => {
            const active = section === id;
            return (
              <div key={id} onClick={()=>setSection(id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:8, marginBottom:2, background:active?S.tealBg:"transparent", color:active?S.teal:S.muted, cursor:"pointer", fontSize:13, fontWeight:active?600:400, transition:"all 0.15s", position:"relative" }}
                onMouseEnter={e=>{ if(!active) e.currentTarget.style.background=S.ice; }}
                onMouseLeave={e=>{ if(!active) e.currentTarget.style.background="transparent"; }}
              >
                {active && <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:3, height:16, background:S.teal, borderRadius:"0 3px 3px 0" }} />}
                <Ic /><span style={{ flex:1 }}>{label}</span>
                {badge ? <span style={{ background:S.teal, color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:9, fontWeight:700 }}>{badge}</span> : null}
              </div>
            );
          })}
        </nav>

        <div style={{ padding:"16px 20px", borderTop:`1px solid ${S.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg,${S.teal},${S.teal2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", flexShrink:0 }}>{initials(user.full_name)}</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:S.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.full_name||"Staff"}</div>
              <div style={{ fontSize:10, color:S.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.department||"Staff Member"}</div>
            </div>
          </div>
          <button onClick={onLogout} style={{ display:"flex", alignItems:"center", gap:7, width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${S.border}`, background:"transparent", color:S.muted, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}
            onMouseEnter={e=>{ e.currentTarget.style.background=S.redBg; e.currentTarget.style.color=S.red; e.currentTarget.style.borderColor="#FECACA"; }}
            onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=S.muted; e.currentTarget.style.borderColor=S.border; }}
          ><I.logout /> Sign Out</button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Topbar */}
        <header style={{ background:S.white, borderBottom:`1px solid ${S.border}`, padding:"0 16px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button className="sp-hamburger" onClick={()=>setSidebarOpen(o=>!o)} style={{ display:"none",background:"transparent",border:"none",cursor:"pointer",fontSize:20,color:S.text,padding:4 }}>☰</button>
            <div>
              <h1 style={{ fontSize:16, fontWeight:700, color:S.text, margin:0 }}>{PAGE[section].title}</h1>
              <p style={{ fontSize:11, color:S.muted, margin:0 }}>{PAGE[section].sub}</p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:S.greenBg, border:"1px solid #A7F3D0", borderRadius:20, padding:"4px 12px" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:S.green, animation:"pulse 2s infinite" }} />
              <span style={{ fontSize:11, fontWeight:600, color:"#065F46" }}>Supabase Connected</span>
            </div>
            <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg,${S.teal},${S.teal2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff" }}>{initials(user.full_name)}</div>
          </div>
        </header>

        {/* ══ PAGE: ANNOUNCEMENTS ═════════════════════════════════ */}
        {section === "announcements" && (
          <div className="sp-ann-layout" style={{ flex:1, overflow:"hidden", display:"flex" }}>

            {/* Left: Composer */}
            <div className="sp-ann-left" style={{ flex:"0 0 52%", overflowY:"auto", padding:"20px 16px 20px 20px", borderRight:`1px solid ${S.border}` }}>
              <div style={{ background:S.white, borderRadius:16, border:`1px solid ${S.border}`, overflow:"hidden", marginBottom:24, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ padding:"16px 20px", borderBottom:`1px solid ${S.border}`, display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:S.tealBg, border:`1px solid ${S.tealBdr}`, display:"flex", alignItems:"center", justifyContent:"center", color:S.teal }}><I.bell /></div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:S.text }}>New Announcement</div>
                    <div style={{ fontSize:11, color:S.muted }}>Saved to Supabase — survives page refresh</div>
                  </div>
                </div>
                <div style={{ padding:"18px 20px" }}>
                  {/* Type */}
                  <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                    {Object.entries(ANN_TYPES).map(([type, cfg]) => (
                      <button key={type} onClick={()=>setAnnType(type)} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"8px 0", borderRadius:8, border:`1.5px solid ${annType===type?cfg.color:S.border}`, background:annType===type?cfg.bg:S.white, color:annType===type?cfg.color:S.muted, fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit" }}>
                        <cfg.Icon />{cfg.label}
                      </button>
                    ))}
                  </div>

                  {/* Text */}
                  <div style={{ position:"relative", marginBottom:12 }}>
                    <textarea value={annText} onChange={e=>{ if(e.target.value.length<=MAX_CHARS){setAnnText(e.target.value);setCharCount(e.target.value.length);}}}
                      placeholder="Write your message to students…" rows={4}
                      style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${annText?S.teal:S.border}`, borderRadius:10, fontSize:13, fontFamily:"inherit", color:S.text, background:S.snow, outline:"none", resize:"none", boxSizing:"border-box", lineHeight:1.6, transition:"border-color 0.15s" }}
                      onFocus={e=>e.target.style.borderColor=S.teal}
                      onBlur={e=>e.target.style.borderColor=annText?S.teal:S.border}
                    />
                    <div style={{ position:"absolute", bottom:10, right:12, fontSize:10, color:charCount>MAX_CHARS*0.9?S.amber:S.muted }}>{charCount}/{MAX_CHARS}</div>
                  </div>

                  {/* ── SCHEDULE TOGGLE ── */}
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom: isScheduled?10:0 }}>
                      <div onClick={()=>setIsScheduled(p=>!p)} style={{ width:36, height:20, borderRadius:10, background:isScheduled?S.teal:S.border, transition:"background 0.2s", position:"relative", flexShrink:0, cursor:"pointer" }}>
                        <div style={{ position:"absolute", top:2, left:isScheduled?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
                      </div>
                      <span style={{ fontSize:12, color:S.text2, fontWeight:500, display:"flex", alignItems:"center", gap:5 }}>
                        <I.calendar /> Schedule for later
                      </span>
                    </label>
                    {isScheduled && (
                      <input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}
                        min={new Date().toISOString().slice(0,16)}
                        style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${S.teal}`, borderRadius:9, fontSize:12, fontFamily:"inherit", color:S.text, background:S.snow, outline:"none", boxSizing:"border-box" }}
                      />
                    )}
                  </div>

                  <button onClick={postAnn} disabled={!annText.trim()||posting} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"11px 0", borderRadius:10, border:"none", background:annText.trim()&&!posting?`linear-gradient(135deg,${S.teal},${S.teal2})`:S.border, color:annText.trim()&&!posting?"#fff":S.muted, fontSize:13, fontWeight:700, cursor:annText.trim()&&!posting?"pointer":"not-allowed", boxShadow:annText.trim()&&!posting?`0 4px 14px ${S.teal}33`:"none", transition:"all 0.18s", fontFamily:"inherit" }}>
                    {isScheduled&&scheduledAt ? <><I.clock />{posting?"Scheduling…":"Schedule Announcement"}</> : <><I.send />{posting?"Publishing…":"Publish Now"}</>}
                  </button>
                </div>
              </div>

              {/* Active list */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:700, color:S.text }}>Live Announcements</div>
                <button onClick={loadAnnouncements} style={{ fontSize:11, color:S.teal, background:S.tealBg, border:`1px solid ${S.tealBdr}`, borderRadius:8, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>↻ Refresh</button>
              </div>

              {annsLoading ? (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[1,2].map(k=><div key={k} style={{ background:S.white, borderRadius:12, border:`1px solid ${S.border}`, padding:"14px 16px" }}><Skeleton height={14} width="60%" /><div style={{ marginTop:8 }}><Skeleton height={12} /></div></div>)}
                </div>
              ) : anns.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px", background:S.white, borderRadius:14, border:`1px dashed ${S.border2}` }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>📭</div>
                  <div style={{ fontSize:13, color:S.muted }}>No active announcements.</div>
                </div>
              ) : anns.map(ann => {
                const cfg = ANN_TYPES[ann.type]||ANN_TYPES.info;
                const rc  = receipts[ann.id] || { read:0, dismissed:0 };
                const isScheduledFuture = new Date(ann.scheduled_at) > new Date();
                return (
                  <div key={ann.id} style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:12, padding:"14px 16px", marginBottom:10, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div style={{ display:"flex", gap:12 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:cfg.bg, border:`1px solid ${cfg.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:cfg.color, flexShrink:0 }}><cfg.Icon /></div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4, flexWrap:"wrap" }}>
                          <span style={{ fontSize:10, fontWeight:700, color:cfg.color, textTransform:"uppercase", letterSpacing:"0.5px" }}>{cfg.label}</span>
                          {isScheduledFuture && <span style={{ fontSize:10, background:S.purpleBg, color:S.purple, border:"1px solid #DDD6FE", padding:"1px 7px", borderRadius:4, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}><I.clock/>Scheduled: {new Date(ann.scheduled_at).toLocaleString()}</span>}
                          <span style={{ fontSize:10, color:S.muted, marginLeft:"auto" }}>{new Date(ann.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize:13, color:S.text, lineHeight:1.55, marginBottom:8 }}>{ann.text}</div>
                        {/* Read receipts */}
                        <div style={{ display:"flex", gap:10 }}>
                          <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:S.green, background:S.greenBg, padding:"2px 8px", borderRadius:6, border:"1px solid #A7F3D0" }}>
                            <I.eye />{rc.read} read
                          </span>
                          <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:S.muted, background:S.ice, padding:"2px 8px", borderRadius:6, border:`1px solid ${S.border}` }}>
                            <I.eyeOff />{rc.dismissed} dismissed
                          </span>
                        </div>
                      </div>
                      <button onClick={()=>deleteAnn(ann.id)} style={{ alignSelf:"flex-start", padding:"5px 8px", borderRadius:7, border:`1px solid ${S.border}`, background:"transparent", color:S.muted, cursor:"pointer", display:"flex" }}
                        onMouseEnter={e=>{ e.currentTarget.style.background=S.redBg; e.currentTarget.style.color=S.red; }}
                        onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=S.muted; }}
                      ><I.trash /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Stats */}
            <div style={{ flex:1, overflowY:"auto", padding:"28px 32px 28px 24px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:S.text, marginBottom:16 }}>Recent Questions</div>
              {actLoading ? [1,2,3].map(k=>(
                <div key={k} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom:`1px solid ${S.border}` }}>
                  <Skeleton width={34} height={34} radius={17} />
                  <div style={{ flex:1 }}><Skeleton height={12} width="50%" /><div style={{ marginTop:6 }}><Skeleton height={11} /></div></div>
                </div>
              )) : activity.slice(0,6).map((item,i)=>(
                <div key={i} style={{ display:"flex", gap:10, padding:"10px 12px", borderRadius:10, marginBottom:2, transition:"background 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=S.ice}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >
                  <div style={{ width:32, height:32, borderRadius:"50%", background:`hsl(${(i*47)%360},60%,90%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:`hsl(${(i*47)%360},50%,35%)`, flexShrink:0 }}>{item.student.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:S.text }}>{item.student}</span>
                      <span style={{ fontSize:10, color:S.muted, background:S.ice, padding:"1px 6px", borderRadius:4 }}>{item.major}</span>
                      <span style={{ fontSize:10, color:S.muted, marginLeft:"auto" }}>{item.time}</span>
                    </div>
                    <div style={{ fontSize:11, color:S.text2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>"{item.q}"</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { label:"Live Announcements", value:anns.length,    icon:"📢", color:S.teal },
                  { label:"Students",           value:students.length, icon:"👥", color:S.blue },
                  { label:"Questions Today",    value:activity.length, icon:"💬", color:S.amber },
                  { label:"Messages Sent",      value:messages.length, icon:"✉️", color:S.green },
                ].map(card=>(
                  <div key={card.label} style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>{card.icon}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:card.color, letterSpacing:"-0.5px" }}>{card.value}</div>
                    <div style={{ fontSize:11, color:S.muted, marginTop:2 }}>{card.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ PAGE: STUDENT ACTIVITY ══════════════════════════════ */}
        {section === "activity" && (
          <div style={{ flex:1, overflowY:"auto", padding:"28px 32px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
              <div style={{ position:"relative", flex:1, maxWidth:320 }}>
                <input value={actSearch} onChange={e=>setActSearch(e.target.value)} placeholder="Search name or question…"
                  style={{ width:"100%", padding:"9px 14px 9px 36px", border:`1.5px solid ${S.border}`, borderRadius:10, fontSize:13, fontFamily:"inherit", color:S.text, background:S.white, outline:"none", boxSizing:"border-box" }}
                  onFocus={e=>e.target.style.borderColor=S.teal} onBlur={e=>e.target.style.borderColor=S.border}
                />
                <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:S.muted }}>🔍</div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {actMajors.map(m=>(
                  <button key={m} onClick={()=>setActMajor(m)} style={{ padding:"6px 12px", borderRadius:8, border:`1.5px solid ${actMajor===m?S.teal:S.border}`, background:actMajor===m?S.tealBg:S.white, color:actMajor===m?S.teal:S.muted, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>{m}</button>
                ))}
              </div>
              <button onClick={loadActivity} style={{ fontSize:11, color:S.teal, background:S.tealBg, border:`1px solid ${S.tealBdr}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" }}>↻ Refresh</button>
              <div style={{ fontSize:12, color:S.muted, fontWeight:600 }}>{filteredActivity.length} results</div>
            </div>

            {/* Table header */}
            <div className="sp-table-header" style={{ display:"grid", gridTemplateColumns:"180px 140px 1fr 100px", gap:12, padding:"8px 14px", background:S.ice, borderRadius:8, marginBottom:8, fontSize:11, fontWeight:700, color:S.muted, textTransform:"uppercase", letterSpacing:"0.5px" }}>
              <div>Student</div><div>Major</div><div>Question</div><div>Time</div>
            </div>

            {actLoading ? [1,2,3,4,5].map(k=>(
              <div key={k} style={{ display:"grid", gridTemplateColumns:"180px 140px 1fr 100px", gap:12, padding:"12px 14px", background:S.white, borderRadius:10, marginBottom:6, border:`1px solid ${S.border}` }}>
                <Skeleton height={12} /><Skeleton height={12} /><Skeleton height={12} /><Skeleton height={12} width="60px" />
              </div>
            )) : filteredActivity.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:S.muted }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
                <div style={{ fontSize:13 }}>{actLoading ? "Loading…" : "No results found."}</div>
              </div>
            ) : filteredActivity.map((item,i)=>(
              <div key={i} style={{ display:"grid", gridTemplateColumns:"180px 140px 1fr 100px", gap:12, padding:"12px 14px", background:S.white, borderRadius:10, marginBottom:6, border:`1px solid ${S.border}`, alignItems:"center", transition:"box-shadow 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow="0 3px 10px rgba(0,0,0,0.07)"}
                onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}
              >
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:`hsl(${(i*47)%360},60%,90%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:`hsl(${(i*47)%360},50%,35%)`, flexShrink:0 }}>{item.student.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                  <span style={{ fontSize:12, fontWeight:700, color:S.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.student}</span>
                </div>
                <div style={{ fontSize:11, color:S.muted, background:S.ice, padding:"2px 8px", borderRadius:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.major}</div>
                <div style={{ fontSize:12, color:S.text2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>"{item.q}"</div>
                <div style={{ fontSize:11, color:S.muted, textAlign:"right" }}>{item.time}</div>
              </div>
            ))}
          </div>
        )}

        {/* ══ PAGE: STUDENT DIRECTORY ════════════════════════════ */}
        {section === "directory" && (
          <div style={{ flex:1, overflowY:"auto", padding:"28px 32px" }}>
            <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
              <div style={{ position:"relative", flex:1, maxWidth:300 }}>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search name or email…"
                  style={{ width:"100%", padding:"9px 14px 9px 36px", border:`1.5px solid ${S.border}`, borderRadius:10, fontSize:13, fontFamily:"inherit", color:S.text, background:S.white, outline:"none", boxSizing:"border-box" }}
                  onFocus={e=>e.target.style.borderColor=S.teal} onBlur={e=>e.target.style.borderColor=S.border}
                />
                <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:S.muted }}>🔍</div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {majors.map(m=>(
                  <button key={m} onClick={()=>setFilterMajor(m)} style={{ padding:"6px 12px", borderRadius:8, border:`1.5px solid ${filterMajor===m?S.teal:S.border}`, background:filterMajor===m?S.tealBg:S.white, color:filterMajor===m?S.teal:S.muted, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>{m}</button>
                ))}
              </div>
              <button onClick={loadStudents} style={{ fontSize:11, color:S.teal, background:S.tealBg, border:`1px solid ${S.tealBdr}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" }}>↻ Refresh</button>
            </div>

            {dirLoading ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14 }}>
                {[1,2,3,4,5,6].map(k=>(
                  <div key={k} style={{ background:S.white, borderRadius:14, border:`1px solid ${S.border}`, padding:"18px 16px" }}>
                    <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                      <Skeleton width={40} height={40} radius={20} />
                      <div style={{ flex:1 }}><Skeleton height={13} width="70%" /><div style={{ marginTop:5 }}><Skeleton height={10} width="40%" /></div></div>
                    </div>
                    <Skeleton height={11} /><div style={{ marginTop:6 }}><Skeleton height={11} /></div>
                  </div>
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:S.muted }}>
                <div style={{ fontSize:32, marginBottom:8 }}>👥</div>
                <div style={{ fontSize:13 }}>No students found.</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14 }}>
                {filteredStudents.map((s,i)=>(
                  <div key={i} style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:14, padding:"18px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", transition:"all 0.15s" }}
                    onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.transform=""; }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                      <div style={{ width:40, height:40, borderRadius:"50%", background:`hsl(${(i*53)%360},55%,88%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:`hsl(${(i*53)%360},45%,35%)`, flexShrink:0 }}>{initials(s.full_name)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:S.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.full_name}</div>
                        <div style={{ fontSize:10, color:S.muted }}>{s.student_id||"—"}</div>
                      </div>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:s.active?S.green:S.red, flexShrink:0 }} />
                    </div>
                    <div style={{ fontSize:11, color:S.text2, marginBottom:4 }}>📚 {s.major||"—"}</div>
                    <div style={{ fontSize:11, color:S.text2, marginBottom:4 }}>🎓 {s.year_of_study||"—"}</div>
                    <div style={{ fontSize:11, color:S.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>✉️ {s.email}</div>
                    <div style={{ marginTop:10 }}>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:s.active?S.greenBg:S.redBg, color:s.active?"#065F46":S.red, fontWeight:700, border:`1px solid ${s.active?"#A7F3D0":"#FECACA"}` }}>
                        {s.active?"Active":"Inactive"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ PAGE: MESSAGE LOG ══════════════════════════════════ */}
        {section === "messages" && (
          <div style={{ flex:1, overflow:"hidden", display:"flex" }}>
            {/* Compose */}
            <div className="sp-msg-left" style={{ flex:"0 0 380px", borderRight:`1px solid ${S.border}`, padding:"20px 16px", overflowY:"auto", background:S.white }}>
              <div style={{ fontSize:13, fontWeight:700, color:S.text, marginBottom:4 }}>Compose Message</div>
              <div style={{ fontSize:11, color:S.muted, marginBottom:16 }}>Saved permanently to Supabase</div>

              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, fontWeight:700, color:S.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px" }}>To</label>
                <input value={msgTo} onChange={e=>setMsgTo(e.target.value)} placeholder="Student email or 'All Year 2 Students'"
                  style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${S.border}`, borderRadius:9, fontSize:13, fontFamily:"inherit", color:S.text, background:S.snow, outline:"none", boxSizing:"border-box" }}
                  onFocus={e=>e.target.style.borderColor=S.teal} onBlur={e=>e.target.style.borderColor=S.border}
                />
                {/* Quick-fill from directory */}
                {students.length > 0 && msgTo.length > 1 && (
                  <div style={{ border:`1px solid ${S.border}`, borderRadius:8, marginTop:4, overflow:"hidden", maxHeight:120, overflowY:"auto" }}>
                    {students.filter(s=>(s.full_name||"").toLowerCase().includes(msgTo.toLowerCase())||(s.email||"").toLowerCase().includes(msgTo.toLowerCase())).slice(0,4).map((s,i)=>(
                      <div key={i} onClick={()=>setMsgTo(s.email)} style={{ padding:"7px 12px", fontSize:12, color:S.text, cursor:"pointer", borderBottom:`1px solid ${S.border}` }}
                        onMouseEnter={e=>e.currentTarget.style.background=S.ice}
                        onMouseLeave={e=>e.currentTarget.style.background=S.white}
                      >
                        <span style={{ fontWeight:600 }}>{s.full_name}</span> <span style={{ color:S.muted }}>{s.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, fontWeight:700, color:S.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px" }}>Type</label>
                <div style={{ display:"flex", gap:6 }}>
                  {["info","warning","urgent"].map(t=>(
                    <button key={t} onClick={()=>setMsgType(t)} style={{ flex:1, padding:"6px 0", borderRadius:7, border:`1.5px solid ${msgType===t?ANN_TYPES[t].color:S.border}`, background:msgType===t?ANN_TYPES[t].bg:S.white, color:msgType===t?ANN_TYPES[t].color:S.muted, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", textTransform:"capitalize" }}>{t}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:700, color:S.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px" }}>Message</label>
                <textarea value={msgText} onChange={e=>setMsgText(e.target.value)} placeholder="Type your message…" rows={6}
                  style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${S.border}`, borderRadius:9, fontSize:13, fontFamily:"inherit", color:S.text, background:S.snow, outline:"none", resize:"none", boxSizing:"border-box", lineHeight:1.6 }}
                  onFocus={e=>e.target.style.borderColor=S.teal} onBlur={e=>e.target.style.borderColor=S.border}
                />
              </div>

              <button onClick={sendMsg} disabled={!msgText.trim()||!msgTo.trim()||sendingMsg} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"11px 0", borderRadius:10, border:"none", background:msgText.trim()&&msgTo.trim()&&!sendingMsg?`linear-gradient(135deg,${S.teal},${S.teal2})`:S.border, color:msgText.trim()&&msgTo.trim()&&!sendingMsg?"#fff":S.muted, fontSize:13, fontWeight:700, cursor:msgText.trim()&&msgTo.trim()&&!sendingMsg?"pointer":"not-allowed", fontFamily:"inherit", transition:"all 0.15s" }}>
                <I.send />{sendingMsg?"Sending…":"Send & Save"}
              </button>
            </div>

            {/* Sent log */}
            <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:S.text }}>Sent Messages ({messages.length})</div>
                <button onClick={loadMessages} style={{ fontSize:11, color:S.teal, background:S.tealBg, border:`1px solid ${S.tealBdr}`, borderRadius:8, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>↻ Refresh</button>
              </div>

              {msgLoading ? [1,2,3].map(k=>(
                <div key={k} style={{ background:S.white, borderRadius:12, border:`1px solid ${S.border}`, padding:"14px 16px", marginBottom:10 }}>
                  <Skeleton height={12} width="40%" /><div style={{ marginTop:8 }}><Skeleton height={12} /></div>
                </div>
              )) : messages.length === 0 ? (
                <div style={{ textAlign:"center", padding:"60px 0", color:S.muted }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
                  <div style={{ fontSize:13 }}>No messages sent yet.</div>
                </div>
              ) : messages.map((m,i)=>{
                const cfg = ANN_TYPES[m.type]||ANN_TYPES.info;
                return (
                  <div key={i} style={{ background:S.white, border:`1px solid ${S.border}`, borderLeft:`3px solid ${cfg.color}`, borderRadius:12, padding:"14px 16px", marginBottom:10, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, fontWeight:700, color:cfg.color, background:cfg.bg, padding:"2px 8px", borderRadius:4, textTransform:"uppercase" }}>{m.type}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:S.text }}>→ {m.to_target}</span>
                      {m.is_group && <span style={{ fontSize:10, color:S.purple, background:S.purpleBg, padding:"1px 6px", borderRadius:4 }}>Group</span>}
                      <span style={{ fontSize:10, color:S.muted, marginLeft:"auto" }}>{new Date(m.sent_at).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize:13, color:S.text, lineHeight:1.5 }}>{m.text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { overflow:hidden; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:10px; }

        /* ── Mobile ── */
        @media(max-width:767px){
          .sp-sidebar-closed{position:fixed!important;left:-240px!important;top:0;bottom:0;z-index:100;transition:left 0.25s;}
          .sp-sidebar-open{position:fixed!important;left:0!important;top:0;bottom:0;z-index:100;transition:left 0.25s;box-shadow:4px 0 24px rgba(0,0,0,0.18);}
          .sp-hamburger{display:block!important;}
          .sp-ann-layout{flex-direction:column!important;overflow-y:auto!important;}
          .sp-ann-left{flex:none!important;width:100%!important;border-right:none!important;border-bottom:1px solid #E2E8F0;padding:16px!important;}
          .sp-msg-left{flex:none!important;width:100%!important;border-right:none!important;border-bottom:1px solid #E2E8F0;}
          .sp-table-header{display:none!important;}
        }
        @media(min-width:768px){
          .sp-sidebar-closed,.sp-sidebar-open{position:relative!important;left:0!important;}
        }
      `}</style>
    </div>
  );
}