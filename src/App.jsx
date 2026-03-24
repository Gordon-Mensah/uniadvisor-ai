// ═══════════════════════════════════════════════════════════
// App.jsx v3 — UniAdvisor AI
// NEW: JWT auth, onboarding tour, progress tracker, feedback,
//      events calendar, escalation replies, HU/EN UI toggle,
//      campus map, profile-aware chat
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import StaffPortal  from "./StaffPortal";
import AdminPortal  from "./AdminPortal";
import CampusMapPanel from "./CampusMapPanel";
import SurveyPanel    from "./SurveyPanel";
import PublicSurvey   from "./PublicSurvey";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// On Render, frontend and backend are on the same domain —
// so we use a relative URL ("") which means requests go to
// the same origin automatically. In local dev, Vite proxies
// all API calls to localhost:8000 (see vite.config.js).
const API = import.meta.env.VITE_API_URL || "";

// ── Token storage (sessionStorage only — not localStorage) ─
const TokenStore = {
  set: (t) => sessionStorage.setItem("ua_token", t),
  get: ()  => sessionStorage.getItem("ua_token"),
  del: ()  => sessionStorage.removeItem("ua_token"),
};

// ── Bilingual UI strings ───────────────────────────────────
const T = {
  en: {
    appName:"UniAdvisor", university:"Dunaújváros Egyetem",
    newChat:"+ New Conversation",
    nav:[
      {icon:"📚",label:"Courses & Curriculum"},
      {icon:"🏛️",label:"Policies & Rules"},
      {icon:"📅",label:"Academic Calendar"},
      {icon:"💰",label:"Fees & Scholarships"},
      {icon:"🎯",label:"Career Guidance"},
    ],
    navQuery:(l)=>`Tell me about ${l} at Dunaújváros Egyetem`,
    language:"LANGUAGE", darkMode:"Dark Mode", lightMode:"Light Mode",
    topbarTitle:"AI Academic Advisor", topbarSub:"RAG · Groq LLaMA3 · ChromaDB",
    export:"Export Chat", online:"Online",
    welcomeHi:(n)=>`Hi ${n}, I'm your AI Advisor!`,
    welcomeSub:"Ask me anything about courses, deadlines, scholarships, or university policies.",
    suggestions:["What courses are available?","How do I apply for a scholarship?","What are the exam rules?","When does registration close?"],
    placeholder:"Ask me anything about university life…",
    thinking:"Thinking…", send:"Send",
    exportFilename:"chat_export.txt",
    signOut:"Sign Out",
    progress:"My Progress",
    events:"Events",
    map:"Campus Map",
    myReplies:"My Replies",
    helpful:"Was this helpful?",
    loginTitle:"Sign In", loginBack:"← Back",
    loginRoles:[
      {id:"student",icon:"🎓",label:"Student",color:"#0D9488",desc:"Access your AI academic advisor"},
      {id:"staff",  icon:"👩‍🏫",label:"Staff Member",color:"#0EA5E9",desc:"Manage announcements & students"},
      {id:"admin",  icon:"⚙️",label:"Administrator",color:"#8B5CF6",desc:"Full system access & analytics"},
    ],
    onboarding:[
      {icon:"🎓",title:"Welcome to UniAdvisor AI!",body:"Your personal AI academic advisor for Dunaújváros Egyetem. Available 24/7 to answer your questions."},
      {icon:"💬",title:"Ask Anything",body:"Questions about courses, scholarships, deadlines, fees, visa — just type in the chat. The AI understands both English and Hungarian."},
      {icon:"📋",title:"Track Your Progress",body:"Use the Progress Tracker in the sidebar to tick off important tasks like registering for courses, paying fees, and more."},
      {icon:"📅",title:"Stay Updated",body:"Check the Events tab for upcoming campus events, and keep an eye on announcement banners for urgent news from staff."},
      {icon:"🗺️",title:"Find Your Way",body:"Use Campus Map to locate any university office. Click a pin to see the room number and office hours."},
      {icon:"🚀",title:"You're All Set!",body:"Start chatting now. If the AI can't help, use the escalation button to reach a real advisor directly."},
    ],
  },
  hu: {
    appName:"UniAdvisor", university:"Dunaújvárosi Egyetem",
    newChat:"+ Új Beszélgetés",
    nav:[
      {icon:"📚",label:"Kurzusok"},
      {icon:"🏛️",label:"Szabályzatok"},
      {icon:"📅",label:"Akadémiai Naptár"},
      {icon:"💰",label:"Díjak & Ösztöndíjak"},
      {icon:"🎯",label:"Karriertanácsadás"},
    ],
    navQuery:(l)=>`Mesélj erről: ${l} a Dunaújvárosi Egyetemen`,
    language:"NYELV", darkMode:"Sötét mód", lightMode:"Világos mód",
    topbarTitle:"AI Tanulmányi Tanácsadó", topbarSub:"RAG · Groq LLaMA3 · ChromaDB",
    export:"Chat exportálása", online:"Online",
    welcomeHi:(n)=>`Szia ${n}, az AI tanácsadód vagyok!`,
    welcomeSub:"Kérdezz bármit kurzusokról, határidőkről, ösztöndíjakról vagy az egyetem szabályzatairól.",
    suggestions:["Milyen kurzusok érhetők el?","Hogyan igényelhetek ösztöndíjat?","Mik a vizsgaszabályok?","Mikor zár a beiratkozás?"],
    placeholder:"Kérdezz bármit az egyetemi életről…",
    thinking:"Gondolkodás…", send:"Küldés",
    exportFilename:"chat_export.txt",
    signOut:"Kijelentkezés",
    progress:"Feladataim",
    events:"Események",
    map:"Kampusz térkép",
    myReplies:"Válaszaim",
    helpful:"Hasznos volt?",
    loginTitle:"Bejelentkezés", loginBack:"← Vissza",
    loginRoles:[
      {id:"student",icon:"🎓",label:"Hallgató",color:"#0D9488",desc:"AI tanulmányi tanácsadó"},
      {id:"staff",  icon:"👩‍🏫",label:"Oktatói személyzet",color:"#0EA5E9",desc:"Hirdetések és hallgatók kezelése"},
      {id:"admin",  icon:"⚙️",label:"Adminisztrátor",color:"#8B5CF6",desc:"Teljes rendszer hozzáférés"},
    ],
    onboarding:[
      {icon:"🎓",title:"Üdvözlünk az UniAdvisor AI-ban!",body:"Személyes AI tanulmányi tanácsadód a Dunaújvárosi Egyetemen. Éjjel-nappal elérhető."},
      {icon:"💬",title:"Kérdezz bármit",body:"Kurzusokról, ösztöndíjakról, határidőkről, díjakról — csak írd a chatbe. Az AI magyarul és angolul is ért."},
      {icon:"📋",title:"Kövesd a haladásod",body:"Használd az oldalsávban a Feladatlista funkciót a fontos teendők kipipálásához."},
      {icon:"📅",title:"Maradj naprakész",body:"Nézd meg az Események fület a közelgő kampusz eseményekért, és figyelj a hirdetményekre."},
      {icon:"🗺️",title:"Találd meg az irodákat",body:"Használd a Kampusz Térképet bármelyik irodai helyszín megkereséséhez."},
      {icon:"🚀",title:"Kész vagy!",body:"Kezdj el csevegni most. Ha az AI nem tud segíteni, jelezd egy valódi tanácsadónak."},
    ],
  },
};

const THEMES = {
  light:{ bg:"#F8FAFC",surface:"#FFFFFF",sidebar:"#FFFFFF",border:"#E2E8F0",border2:"#CBD5E1",text:"#0F172A",text2:"#334155",muted:"#64748B",bubble_user:"#0D9488",bubble_ai:"#FFFFFF",bubble_user_text:"#FFFFFF",bubble_ai_text:"#0F172A",input:"#FFFFFF",inputBorder:"#E2E8F0",accent:"#0D9488",accent2:"#0F766E",badge:"#F0FDFA",badgeText:"#0D9488" },
  dark: { bg:"#0F172A",surface:"#1E293B",sidebar:"#1E293B",border:"#334155",border2:"#475569",text:"#F1F5F9",text2:"#CBD5E1",muted:"#64748B",bubble_user:"#0D9488",bubble_ai:"#1E293B",bubble_user_text:"#FFFFFF",bubble_ai_text:"#F1F5F9",input:"#1E293B",inputBorder:"#334155",accent:"#0D9488",accent2:"#0F766E",badge:"#134E4A",badgeText:"#5EEAD4" },
};

function detectLang(text) {
  const huChars = /[áéíóöőüűÁÉÍÓÖŐÜŰ]/;
  const huWords = /\b(az|egy|és|hogy|nem|van|mi|de|ezt|azt|kérem|köszönöm|mikor|hogyan|hol|melyik)\b/i;
  return (huChars.test(text)||huWords.test(text))?"hu":"en";
}

// ── Small shared helpers ───────────────────────────────────
function TypingDots({ C }) {
  return (
    <div style={{ display:"flex",gap:4,alignItems:"center",padding:"4px 0" }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ width:7,height:7,borderRadius:"50%",background:C.muted,animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
      ))}
    </div>
  );
}

function StreamingText({ text, C }) {
  const [displayed,setDisplayed] = useState("");
  const idx = useRef(0);
  useEffect(()=>{
    idx.current=0; setDisplayed("");
    const iv=setInterval(()=>{ if(idx.current<text.length){setDisplayed(text.slice(0,++idx.current));}else clearInterval(iv); },8);
    return()=>clearInterval(iv);
  },[text]);
  return <span style={{ color:C.bubble_ai_text,whiteSpace:"pre-wrap",lineHeight:1.65,fontSize:14 }}>{displayed}</span>;
}

// ═══════════════════════════════════════════════════════════
// ONBOARDING TOUR MODAL
// ═══════════════════════════════════════════════════════════
function OnboardingModal({ C, uiLang, onDone }) {
  const [step,setStep] = useState(0);
  const steps = T[uiLang]?.onboarding || T.en.onboarding;
  const s = steps[step];
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:C.surface,borderRadius:24,width:"min(480px,90vw)",padding:40,boxShadow:"0 30px 80px rgba(0,0,0,0.4)",border:`1px solid ${C.border}`,textAlign:"center" }}>
        <div style={{ fontSize:52,marginBottom:16 }}>{s.icon}</div>
        <div style={{ fontSize:20,fontWeight:800,color:C.text,marginBottom:12 }}>{s.title}</div>
        <div style={{ fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:28 }}>{s.body}</div>
        {/* Step dots */}
        <div style={{ display:"flex",justifyContent:"center",gap:6,marginBottom:24 }}>
          {steps.map((_,i)=>(
            <div key={i} style={{ width:i===step?20:7,height:7,borderRadius:4,background:i===step?C.accent:C.border,transition:"all 0.3s" }} />
          ))}
        </div>
        <button onClick={()=>{ if(step<steps.length-1)setStep(s=>s+1); else onDone(); }}
          style={{ padding:"13px 40px",borderRadius:12,border:"none",background:C.accent,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
          {step<steps.length-1 ? "Next →" : "Get Started 🚀"}
        </button>
        {step>0 && <button onClick={()=>setStep(s=>s-1)} style={{ display:"block",margin:"12px auto 0",background:"transparent",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>← Back</button>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PROGRESS TRACKER PANEL
// ═══════════════════════════════════════════════════════════
function ProgressPanel({ C, user, uiLang, onClose }) {
  const [tasks,setTasks] = useState([]);
  const [done,setDone]   = useState(0);
  const [total,setTotal] = useState(0);
  const [saving,setSaving] = useState(null);

  useEffect(()=>{
    fetch(`${API}/progress/${encodeURIComponent(user.email)}`)
      .then(r=>r.json()).then(d=>{ setTasks(d.tasks||[]); setDone(d.done||0); setTotal(d.total||0); })
      .catch(()=>{});
  },[user.email]);

  const toggle = async (task) => {
    const newDone = !task.done;
    setSaving(task.task_key);
    setTasks(prev=>prev.map(t=>t.task_key===task.task_key?{...t,done:newDone}:t));
    setDone(prev=>prev+(newDone?1:-1));
    await fetch(`${API}/progress`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({student_email:user.email,task_key:task.task_key,label:task.label,done:newDone})}).catch(()=>{});
    setSaving(null);
  };

  const pct = total>0?Math.round((done/total)*100):0;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:C.surface,borderRadius:20,width:"min(480px,92vw)",maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",border:`1px solid ${C.border}` }}>
        <div style={{ padding:"20px 24px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:16,fontWeight:700,color:C.text }}>📋 {uiLang==="hu"?"Feladataim":"My Progress"}</div>
            <div style={{ fontSize:12,color:C.muted,marginTop:2 }}>{done}/{total} tasks complete</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent",border:"none",fontSize:20,cursor:"pointer",color:C.muted }}>×</button>
        </div>
        {/* Progress bar */}
        <div style={{ padding:"12px 24px 0",flexShrink:0 }}>
          <div style={{ height:8,background:C.border,borderRadius:4,overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.accent},${C.accent2})`,borderRadius:4,transition:"width 0.5s ease" }} />
          </div>
          <div style={{ fontSize:12,color:C.accent,fontWeight:700,textAlign:"right",marginTop:4 }}>{pct}%</div>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:"12px 24px 20px" }}>
          {tasks.map(task=>(
            <div key={task.task_key} onClick={()=>toggle(task)}
              style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:`1px solid ${task.done?C.accent+"44":C.border}`,background:task.done?`${C.accent}08`:C.bg,marginBottom:8,cursor:"pointer",transition:"all 0.2s",opacity:saving===task.task_key?0.6:1 }}>
              <div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${task.done?C.accent:C.border}`,background:task.done?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s" }}>
                {task.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <span style={{ fontSize:13,color:task.done?C.muted:C.text,textDecoration:task.done?"line-through":"none",transition:"all 0.2s" }}>{task.label}</span>
              {task.done_at && <span style={{ marginLeft:"auto",fontSize:10,color:C.muted }}>✓ {new Date(task.done_at).toLocaleDateString()}</span>}
            </div>
          ))}
          {done===total && total>0 && (
            <div style={{ textAlign:"center",padding:"20px 0",fontSize:32 }}>🎉<div style={{ fontSize:14,color:C.accent,fontWeight:700,marginTop:6 }}>All tasks complete!</div></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EVENTS CALENDAR PANEL
// ═══════════════════════════════════════════════════════════
const EVENT_COLORS = { academic:"#0D9488",social:"#8B5CF6",sports:"#F59E0B",career:"#3B82F6",admin:"#EF4444" };
const EVENT_ICONS  = { academic:"📚",social:"🎉",sports:"⚽",career:"💼",admin:"📋" };

function EventsPanel({ C, uiLang, onClose }) {
  const [events,setEvents] = useState([]);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    fetch(`${API}/events`).then(r=>r.json()).then(d=>{ setEvents(d.events||[]); setLoading(false); }).catch(()=>setLoading(false));
  },[]);

  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(uiLang==="hu"?"hu-HU":"en-GB",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:C.surface,borderRadius:20,width:"min(560px,93vw)",maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",border:`1px solid ${C.border}` }}>
        <div style={{ padding:"20px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <div style={{ fontSize:16,fontWeight:700,color:C.text }}>📅 {uiLang==="hu"?"Közelgő Események":"Upcoming Events"}</div>
          <button onClick={onClose} style={{ background:"transparent",border:"none",fontSize:20,cursor:"pointer",color:C.muted }}>×</button>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:"16px 24px" }}>
          {loading && <div style={{ textAlign:"center",color:C.muted,fontSize:13,padding:40 }}>Loading events…</div>}
          {!loading && events.length===0 && <div style={{ textAlign:"center",color:C.muted,fontSize:13,padding:40 }}>No upcoming events.</div>}
          {events.map(ev=>{
            const color = EVENT_COLORS[ev.category]||"#0D9488";
            const icon  = EVENT_ICONS[ev.category]||"📅";
            return (
              <div key={ev.id} style={{ display:"flex",gap:14,padding:"14px 16px",borderRadius:14,border:`1px solid ${C.border}`,background:C.bg,marginBottom:10 }}>
                <div style={{ width:44,height:44,borderRadius:12,background:`${color}18`,border:`1px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{icon}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:3 }}>{ev.title}</div>
                  {ev.description && <div style={{ fontSize:12,color:C.muted,marginBottom:5,lineHeight:1.5 }}>{ev.description}</div>}
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                    <span style={{ fontSize:11,color:color,background:`${color}18`,padding:"2px 8px",borderRadius:4,fontWeight:600 }}>{(ev.category||"").toUpperCase()}</span>
                    <span style={{ fontSize:11,color:C.muted }}>🕐 {fmt(ev.starts_at)}</span>
                    {ev.location && <span style={{ fontSize:11,color:C.muted }}>📍 {ev.location}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CAMPUS MAP PANEL
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// ESCALATION REPLIES PANEL
// ═══════════════════════════════════════════════════════════
function RepliesPanel({ C, user, uiLang, onClose }) {
  const [replies,setReplies] = useState([]);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    fetch(`${API}/escalations/student/${encodeURIComponent(user.email)}`)
      .then(r=>r.json()).then(d=>{ setReplies((d.escalations||[]).filter(e=>e.admin_reply)); setLoading(false); })
      .catch(()=>setLoading(false));
  },[user.email]);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:C.surface,borderRadius:20,width:"min(540px,93vw)",maxHeight:"78vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",border:`1px solid ${C.border}` }}>
        <div style={{ padding:"20px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <div style={{ fontSize:16,fontWeight:700,color:C.text }}>📬 {uiLang==="hu"?"Tanácsadói Válaszaim":"Advisor Replies"}</div>
          <button onClick={onClose} style={{ background:"transparent",border:"none",fontSize:20,cursor:"pointer",color:C.muted }}>×</button>
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:20 }}>
          {loading && <div style={{ textAlign:"center",color:C.muted,padding:40,fontSize:13 }}>Loading…</div>}
          {!loading&&replies.length===0 && <div style={{ textAlign:"center",color:C.muted,padding:40,fontSize:13 }}>No replies yet. Escalations you send will appear here once answered.</div>}
          {replies.map(r=>(
            <div key={r.id} style={{ background:C.bg,borderRadius:14,border:`1px solid ${C.border}`,padding:16,marginBottom:12 }}>
              <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:6 }}>Re: {r.subject}</div>
              <div style={{ fontSize:12,color:C.muted,marginBottom:10,lineHeight:1.5,padding:"8px 12px",background:`${C.surface}`,borderRadius:8,border:`1px solid ${C.border}` }}>
                <span style={{ fontWeight:600,color:C.text2 }}>Your message: </span>{r.message}
              </div>
              <div style={{ fontSize:12,lineHeight:1.6,color:C.text,padding:"10px 12px",background:`${C.accent}08`,borderRadius:8,border:`1px solid ${C.accent}33` }}>
                <span style={{ fontWeight:700,color:C.accent }}>🎓 {r.replied_by||"Advisor"}: </span>{r.admin_reply}
              </div>
              <div style={{ fontSize:10,color:C.muted,marginTop:6,textAlign:"right" }}>{r.replied_at?new Date(r.replied_at).toLocaleString():""}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ANNOUNCEMENT BANNER
// ═══════════════════════════════════════════════════════════
function AnnouncementBanner({ C, userEmail }) {
  const [banners,setBanners]     = useState([]);
  const [dismissed,setDismissed] = useState(new Set());

  useEffect(()=>{
    const now = new Date().toISOString();
    supabase.from("announcements").select("*").eq("active",true).lte("scheduled_at",now).order("scheduled_at",{ascending:false})
      .then(({data})=>{ if(data) setBanners(data); });
  },[]);

  const dismiss = async (id) => {
    setDismissed(prev=>new Set([...prev,id]));
    if(userEmail) await supabase.from("announcement_reads").upsert({announcement_id:id,student_email:userEmail,action:"dismissed"},{onConflict:"announcement_id,student_email"});
  };
  const markRead = async (id) => {
    if(userEmail) await supabase.from("announcement_reads").upsert({announcement_id:id,student_email:userEmail,action:"read"},{onConflict:"announcement_id,student_email"});
  };

  const TYPE_COLORS = {
    info:   {bg:"#EFF6FF",border:"#BFDBFE",text:"#1D4ED8",icon:"ℹ️"},
    warning:{bg:"#FFFBEB",border:"#FDE68A",text:"#B45309",icon:"⚠️"},
    urgent: {bg:"#FEF2F2",border:"#FECACA",text:"#DC2626",icon:"🚨"},
  };

  const visible = banners.filter(b=>!dismissed.has(b.id));
  if(!visible.length) return null;

  return (
    <div style={{ flexShrink:0 }}>
      {visible.map(b=>{
        const tc = TYPE_COLORS[b.type]||TYPE_COLORS.info;
        return (
          <div key={b.id} onMouseEnter={()=>markRead(b.id)}
            style={{ background:tc.bg,borderBottom:`1px solid ${tc.border}`,padding:"10px 24px",display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontSize:14 }}>{tc.icon}</span>
            <span style={{ fontSize:13,color:tc.text,fontWeight:500,flex:1 }}>{b.text}</span>
            <button onClick={()=>dismiss(b.id)} style={{ background:"transparent",border:"none",color:tc.text,opacity:0.6,cursor:"pointer",fontSize:16,padding:"0 4px" }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CHAT BUBBLE (with thumbs feedback)
// ═══════════════════════════════════════════════════════════
function Bubble({ msg, C, isNew, onFeedback, uiLang }) {
  const isUser = msg.role==="user";
  const [voted,setVoted] = useState(null);
  const t = T[uiLang]||T.en;

  const vote = (rating) => {
    setVoted(rating);
    if(onFeedback) onFeedback(rating,msg);
  };

  return (
    <div style={{ marginBottom:16, animation:isNew?"fadeIn 0.3s ease":"none" }}>
      <div style={{ display:"flex",justifyContent:isUser?"flex-end":"flex-start" }}>
        {!isUser && (
          <div style={{ width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,#0D9488,#0F766E)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,marginRight:10,flexShrink:0,marginTop:2 }}>🤖</div>
        )}
        <div style={{ maxWidth:"85%",padding:"10px 14px",borderRadius:isUser?"18px 18px 4px 18px":"18px 18px 18px 4px",background:isUser?`linear-gradient(135deg,${C.bubble_user},${C.bubble_user}dd)`:C.bubble_ai,color:isUser?C.bubble_user_text:C.bubble_ai_text,fontSize:14,lineHeight:1.65,boxShadow:isUser?`0 4px 14px ${C.accent}33`:`0 1px 4px rgba(0,0,0,0.06)`,border:!isUser?`1px solid ${C.border}`:"none",whiteSpace:"pre-wrap" }}>
          {isUser ? msg.content : (isNew ? <StreamingText text={msg.content} C={C} /> : <span style={{ whiteSpace:"pre-wrap",lineHeight:1.65,fontSize:14 }}>{msg.content}</span>)}
        </div>
      </div>
      {/* Feedback row for AI messages */}
      {!isUser && !isNew && (
        <div style={{ display:"flex",alignItems:"center",gap:6,paddingLeft:40,marginTop:6 }}>
          <span style={{ fontSize:11,color:C.muted }}>{t.helpful}</span>
          {[["up","👍"],["down","👎"]].map(([r,icon])=>(
            <button key={r} onClick={()=>vote(r)} style={{ padding:"3px 10px",borderRadius:8,border:`1px solid ${voted===r?C.accent:C.border}`,background:voted===r?`${C.accent}15`:"transparent",color:voted===r?C.accent:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s" }}>{icon}</button>
          ))}
          {voted && <span style={{ fontSize:11,color:C.accent }}>✓</span>}
        </div>
      )}
      {/* Office tag */}
      {!isUser && msg.office && (
        <div style={{ paddingLeft:40,marginTop:4 }}>
          <span style={{ fontSize:10,color:C.muted,background:C.badge,padding:"2px 8px",borderRadius:4 }}>{msg.office_emoji||"🏛️"} {msg.office_name||msg.office}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LOGIN SCREEN (JWT-based)
// ═══════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [role,setRole]         = useState(null);
  const [email,setEmail]       = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading]   = useState(false);
  const [error,setError]       = useState("");
  const [uiLang,setUiLang]     = useState("en");

  const t = T[uiLang];

  const DEMO = {
    student:["student@uniduna.hu","password123"],
    staff:  ["staff@uniduna.hu","password123"],
    admin:  ["admin@uniduna.hu","password123"],
  };

  const selectRole = (r) => {
    setRole(r); setError("");
    const [e,p] = DEMO[r];
    setEmail(e); setPassword(p);
  };

  const handleLogin = async () => {
    if(!email.trim()||!password.trim()) { setError("Please enter email and password."); return; }
    setLoading(true); setError("");
    try {
      // Try JWT endpoint first
      const res  = await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),password:password.trim()})});
      const data = await res.json();
      if(!res.ok) throw new Error(data.detail||"Login failed");
      TokenStore.set(data.token);
      onLogin(data.user, data.token);
    } catch(e) {
      // Fallback: direct Supabase query (plaintext passwords for older DB)
      try {
        const { data, error:err } = await supabase.from("users").select("*").eq("email",email.trim()).eq("active",true).single();
        if(err||!data) throw new Error("Invalid credentials");
        // Accept either plaintext match OR role match (demo mode)
        if(data.password===password||data.role===role) {
          onLogin(data, null);
        } else {
          throw new Error("Invalid credentials");
        }
      } catch {
        setError("Invalid email or password.");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh",background:"linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Sans','Segoe UI',system-ui,sans-serif",position:"relative",overflow:"hidden" }}>
      {[["#0D9488","15%","10%",300],["#8B5CF6","80%","20%",200],["#0EA5E9","60%","70%",250]].map(([c,l,tp,s],i)=>(
        <div key={i} style={{ position:"absolute",left:l,top:tp,width:s,height:s,borderRadius:"50%",background:c,opacity:0.06,filter:"blur(60px)",pointerEvents:"none" }} />
      ))}
      {/* Lang toggle */}
      <div style={{ position:"absolute",top:20,right:24,display:"flex",gap:4 }}>
        {[["en","EN"],["hu","HU"]].map(([code,label])=>(
          <button key={code} onClick={()=>setUiLang(code)} style={{ padding:"5px 12px",borderRadius:8,border:`1px solid ${uiLang===code?"#0D9488":"rgba(255,255,255,0.15)"}`,background:uiLang===code?"rgba(13,148,136,0.2)":"transparent",color:uiLang===code?"#5EEAD4":"#64748B",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>{label}</button>
        ))}
      </div>
      <div style={{ width:"100%",maxWidth:480,padding:"24px 16px",position:"relative",zIndex:1 }}>
        <div style={{ textAlign:"center",marginBottom:32 }}>
          <div style={{ fontSize:44,marginBottom:10 }}>🎓</div>
          <h1 style={{ fontSize:26,fontWeight:800,color:"#F1F5F9",margin:"0 0 6px",letterSpacing:"-0.5px" }}>UniAdvisor AI</h1>
          <p style={{ fontSize:14,color:"#64748B",margin:0 }}>{t.university}</p>
        </div>
        {!role ? (
          <div>
            <p style={{ fontSize:13,color:"#94A3B8",textAlign:"center",marginBottom:16 }}>
              {uiLang==="hu"?"Válaszd ki a szerepkörödet":"Select your role to continue"}
            </p>
            {t.loginRoles.map(r=>(
              <div key={r.id} onClick={()=>selectRole(r.id)} style={{ display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderRadius:14,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",cursor:"pointer",marginBottom:10,transition:"all 0.2s" }}
                onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor=r.color+"66"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; }}>
                <div style={{ width:44,height:44,borderRadius:12,background:`${r.color}22`,border:`1px solid ${r.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>{r.icon}</div>
                <div>
                  <div style={{ fontSize:15,fontWeight:700,color:"#F1F5F9" }}>{r.label}</div>
                  <div style={{ fontSize:12,color:"#64748B" }}>{r.desc}</div>
                </div>
                <div style={{ marginLeft:"auto",color:"#64748B",fontSize:18 }}>›</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background:"rgba(255,255,255,0.05)",borderRadius:20,border:"1px solid rgba(255,255,255,0.1)",padding:"28px 28px 24px" }}>
            <button onClick={()=>{setRole(null);setError("");}} style={{ background:"transparent",border:"none",color:"#64748B",cursor:"pointer",fontSize:13,marginBottom:16,display:"flex",alignItems:"center",gap:5,padding:0,fontFamily:"inherit" }}>{t.loginBack}</button>
            <div style={{ fontSize:16,fontWeight:700,color:"#F1F5F9",marginBottom:4 }}>
              {t.loginRoles.find(r=>r.id===role)?.icon} {uiLang==="hu"?"Bejelentkezés mint":"Sign in as"} {t.loginRoles.find(r=>r.id===role)?.label}
            </div>
            <div style={{ fontSize:11,color:"#475569",marginBottom:20,background:"rgba(255,255,255,0.05)",padding:"6px 10px",borderRadius:8 }}>
              Demo: {DEMO[role][0]} / {DEMO[role][1]}
            </div>
            {[["Email","email","email",email,setEmail],[uiLang==="hu"?"Jelszó":"Password","password","password",password,setPassword]].map(([label,type,ph,val,setter])=>(
              <div key={label} style={{ marginBottom:14 }}>
                <div style={{ fontSize:11,color:"#94A3B8",fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px" }}>{label}</div>
                <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                  style={{ width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.07)",color:"#F1F5F9",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit" }} />
              </div>
            ))}
            {error && <div style={{ color:"#F87171",fontSize:12,marginBottom:12,textAlign:"center" }}>{error}</div>}
            <button onClick={handleLogin} disabled={loading} style={{ width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:t.loginRoles.find(r=>r.id===role)?.color||"#0D9488",color:"#fff",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,fontFamily:"inherit",transition:"all 0.15s" }}>
              {loading?(uiLang==="hu"?"Bejelentkezés…":"Signing in…"):(uiLang==="hu"?"Bejelentkezés":"Sign In")}
            </button>
          </div>
        )}
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CHAT APP (Student)
// ═══════════════════════════════════════════════════════════
function ChatApp({ user, token, onLogout, darkMode, setDarkMode }) {
  const C   = THEMES[darkMode?"dark":"light"];
  // UI language: from user preference, or browser, defaults en
  const [uiLang,setUiLang]     = useState(user.language_pref||"en");
  // chatLang = language the AI ALWAYS replies in (explicit, never auto-detected)
  const [chatLang,setChatLang] = useState(user.language_pref||"en");
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const t = T[uiLang]||T.en;
  const isAdmin = user.role==="admin";

  // ── Persist chat history in sessionStorage per user ───────
  const historyKey = `ua_chat_${user.email}`;
  const [messages,setMessages]   = useState(()=>{
    try { return JSON.parse(sessionStorage.getItem(historyKey)||"[]"); } catch{ return []; }
  });
  const [input,setInput]         = useState("");
  const [loading,setLoading]     = useState(false);
  const [newMsgIdx,setNewMsgIdx] = useState(-1);
  const [followups,setFollowups] = useState([]);
  const [office,setOffice]       = useState("auto");
  const [sessionId]              = useState(()=>`s_${Date.now()}`);

  // Save messages to sessionStorage whenever they change
  useEffect(()=>{
    try { sessionStorage.setItem(historyKey, JSON.stringify(messages.slice(-40))); } catch{}
  },[messages, historyKey]);

  // Panel visibility
  const [showProgress,setShowProgress] = useState(false);
  const [showEvents,setShowEvents]     = useState(false);
  const [showMap,setShowMap]           = useState(false);
  const [showSurvey,setShowSurvey]     = useState(false);
  const [showReplies,setShowReplies]   = useState(false);
  const [showOnboarding,setShowOnboarding] = useState(!user.onboarding_done);
  const [repliesCount,setRepliesCount] = useState(0);

  const bottomRef = useRef();
  const inputRef  = useRef();

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  // Check for unread escalation replies
  useEffect(()=>{
    fetch(`${API}/escalations/student/${encodeURIComponent(user.email)}`)
      .then(r=>r.json()).then(d=>{ setRepliesCount((d.escalations||[]).filter(e=>e.admin_reply&&e.status==="replied").length); })
      .catch(()=>{});
  },[user.email]);

  const handleOnboardingDone = async () => {
    setShowOnboarding(false);
    await fetch(`${API}/auth/complete-onboarding`,{method:"POST",headers:{...(token?{Authorization:`Bearer ${token}`}:{})}}).catch(()=>{});
  };

  const sendFeedback = useCallback(async (rating,msg) => {
    await fetch(`${API}/feedback`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({student_email:user.email,question:msg.question||"",answer:msg.content,rating,office:msg.office})}).catch(()=>{});
  },[user.email]);

  const sendMessage = async (text=input) => {
    const q = text.trim(); if(!q||loading) return;

    // ── Language is set explicitly by the user toggle — no auto-detection ──
    const lang = chatLang;

    setInput(""); setFollowups([]);
    const userMsg = {role:"user",content:q};
    setMessages(prev=>[...prev,userMsg]);
    setLoading(true);
    const newIdx = messages.length+1;

    // Send last 10 messages as history (5 exchanges) for better context
    const history = messages.slice(-10).map(m=>({role:m.role,content:m.content}));

    try {
      const res = await fetch(`${API}/chat`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          message:      q,
          student_name: user.full_name,
          student_year: user.year_of_study||"Year 1",
          student_major:user.major||"General",
          student_nationality: user.nationality||"Hungarian",
          office,
          history,
          session_id:   sessionId,
          reply_lang:   chatLang,
        }),
      });
      const data = await res.json();
      const answer = data.answer||"Sorry, I could not get a response.";
      const aiMsg = {role:"assistant",content:answer,office:data.office,office_name:data.office_name,office_emoji:data.office_emoji,question:q};
      setMessages(prev=>[...prev,aiMsg]);
      setNewMsgIdx(newIdx);
      // Follow-up suggestions match the conversation language
      setFollowups(lang==="hu"
        ?["Mondj többet erről","Mi a határidő?","Hogyan kell jelentkezni?"]
        :["Tell me more","What's the deadline?","How do I apply?"]
      );
    } catch {
      setMessages(prev=>[...prev,{role:"assistant",content:"Connection error. Please check the backend is running."}]);
    }
    setLoading(false);
  };

  const exportChat = () => {
    const txt = messages.map(m=>`${m.role==="user"?"You":"AI"}: ${m.content}`).join("\n\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"text/plain"})); a.download=t.exportFilename; a.click();
  };

  const OFFICE_PILLS = [
    {id:"auto",label:"🔍 Auto"},
    {id:"study_office",label:"📚 Study"},
    {id:"iro",label:"🌍 IRO"},
    {id:"finance",label:"💰 Finance"},
    {id:"it_helpdesk",label:"💻 IT"},
    {id:"library",label:"📖 Library"},
  ];

  return (
    <div style={{ display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:"'IBM Plex Sans','Segoe UI',system-ui,sans-serif",overflow:"hidden",position:"relative" }}>

      {/* Mobile overlay */}
      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:99,display:"none" }} className="mobile-overlay" />}

      {/* Sidebar */}
      <aside className={sidebarOpen?"sidebar-open":"sidebar-closed"} style={{ width:240,background:C.sidebar,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0 }}>
        {/* Brand */}
        <div style={{ padding:"20px 16px 16px",borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
            <div style={{ width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>🎓</div>
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:C.text }}>{t.appName}</div>
              <div style={{ fontSize:10,color:C.muted }}>{t.university}</div>
            </div>
          </div>
          <button onClick={()=>{ setMessages([]); try{sessionStorage.removeItem(historyKey);}catch{} }} style={{ width:"100%",padding:"8px 12px",borderRadius:10,border:`1px solid ${C.border}`,background:"transparent",color:C.accent,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>{t.newChat}</button>
        </div>

        {/* Quick nav */}
        <nav style={{ padding:"12px 10px" }}>
          {t.nav.map(({icon,label})=>(
            <div key={label} onClick={()=>sendMessage(t.navQuery(label))} style={{ display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,marginBottom:2,cursor:"pointer",fontSize:12,color:C.muted,transition:"all 0.15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background=darkMode?"rgba(255,255,255,0.06)":"#F1F5F9";e.currentTarget.style.color=C.text;}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.muted;}}>
              {icon} {label}
            </div>
          ))}
        </nav>

        {/* Feature buttons */}
        <div style={{ padding:"8px 10px",borderTop:`1px solid ${C.border}` }}>
          {[
            {icon:"📋",label:t.progress,  onClick:()=>setShowProgress(true)},
            {icon:"📅",label:t.events,    onClick:()=>setShowEvents(true)},
            {icon:"🗺️",label:t.map,       onClick:()=>setShowMap(true)},
            {icon:"📝",label:"Take Survey", onClick:()=>setShowSurvey(true)},
            {icon:"📬",label:t.myReplies, onClick:()=>setShowReplies(true), badge:repliesCount},
          ].map(btn=>(
            <div key={btn.label} onClick={btn.onClick} style={{ display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,marginBottom:2,cursor:"pointer",fontSize:12,color:C.muted,transition:"all 0.15s",position:"relative" }}
              onMouseEnter={e=>{e.currentTarget.style.background=darkMode?"rgba(255,255,255,0.06)":"#F1F5F9";e.currentTarget.style.color=C.text;}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.muted;}}>
              {btn.icon} {btn.label}
              {btn.badge>0 && <span style={{ marginLeft:"auto",background:C.accent,color:"#fff",fontSize:9,fontWeight:700,borderRadius:10,padding:"1px 6px" }}>{btn.badge}</span>}
            </div>
          ))}
        </div>

        {/* Profile footer */}
        <div style={{ padding:"12px 16px",borderTop:`1px solid ${C.border}`,marginTop:"auto" }}>
          {/* Lang toggle */}
          <div style={{ display:"flex",gap:4,marginBottom:10 }}>
            {[["en","EN"],["hu","HU"]].map(([code,label])=>(
              <button key={code} onClick={()=>{setUiLang(code);setChatLang(code);}} style={{ flex:1,padding:"5px 0",borderRadius:7,border:`1px solid ${uiLang===code?C.accent:C.border}`,background:uiLang===code?`${C.accent}18`:"transparent",color:uiLang===code?C.accent:C.muted,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>{label}</button>
            ))}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
            <div style={{ width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0 }}>
              {user.full_name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.full_name}</div>
              <div style={{ fontSize:10,color:C.muted }}>{user.major||user.department}</div>
            </div>
          </div>
          {/* Nationality / year info badge */}
          {user.nationality && (
            <div style={{ fontSize:10,color:C.muted,background:C.badge,borderRadius:6,padding:"3px 8px",marginBottom:8,textAlign:"center" }}>
              {user.nationality} · {user.year_of_study||"Staff"}
            </div>
          )}
          <div style={{ display:"flex",gap:6 }}>
            <button onClick={()=>setDarkMode(d=>!d)} style={{ flex:1,padding:"6px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit" }}>{darkMode?"☀️":"🌙"}</button>
            <button onClick={exportChat} style={{ flex:1,padding:"6px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit" }}>📤</button>
          </div>
          <button onClick={onLogout} style={{ width:"100%",marginTop:6,padding:"7px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit" }}>{t.signOut}</button>
        </div>
      </aside>

      {/* Chat area */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        {/* Topbar */}
        <div style={{ padding:"0 16px",height:54,display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,background:C.surface,flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <button className="hamburger-btn" onClick={()=>setSidebarOpen(o=>!o)} style={{ display:"none",background:"transparent",border:"none",cursor:"pointer",padding:4,color:C.text,fontSize:20 }}>☰</button>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:C.text }}>{t.topbarTitle}</div>
              <div style={{ fontSize:11,color:C.muted }}>{t.topbarSub}</div>
            </div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#059669",background:"#F0FDF4",border:"1px solid #A7F3D0",borderRadius:20,padding:"4px 12px" }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:"#059669",animation:"pulse 2s infinite" }} />
            {t.online}
          </div>
        </div>

        {/* Announcement banner */}
        <AnnouncementBanner C={C} userEmail={user.email} />

        {/* Office pills */}
        <div style={{ padding:"8px 12px 0",display:"flex",gap:6,flexShrink:0,borderBottom:`1px solid ${C.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
          {OFFICE_PILLS.map(p=>(
            <button key={p.id} onClick={()=>setOffice(p.id)} style={{ padding:"4px 12px",borderRadius:20,border:`1px solid ${office===p.id?C.accent:C.border}`,background:office===p.id?`${C.accent}15`:"transparent",color:office===p.id?C.accent:C.muted,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8,transition:"all 0.15s" }}>{p.label}</button>
          ))}
        </div>

        {/* Messages */}
        <div style={{ flex:1,overflowY:"auto",padding:"20px 24px" }}>
          {messages.length===0 && (
            <div style={{ textAlign:"center",paddingTop:48 }}>
              <div style={{ fontSize:48,marginBottom:12 }}>🎓</div>
              <div style={{ fontSize:20,fontWeight:700,color:C.text,marginBottom:6 }}>{t.welcomeHi(user.full_name?.split(" ")[0]||"there")}</div>
              <div style={{ fontSize:14,color:C.muted,marginBottom:6 }}>{t.welcomeSub}</div>
              {/* Profile context badge */}
              {user.major && (
                <div style={{ display:"inline-flex",gap:6,alignItems:"center",background:`${C.accent}10`,border:`1px solid ${C.accent}30`,borderRadius:20,padding:"5px 14px",marginBottom:24,fontSize:12,color:C.accent }}>
                  <span>📚 {user.major}</span>
                  {user.year_of_study && <span>· {user.year_of_study}</span>}
                  {user.nationality && user.nationality!=="Hungarian" && <span>· 🌍 {user.nationality}</span>}
                </div>
              )}
              <div style={{ display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center" }}>
                {t.suggestions.map(s=>(
                  <button key={s} onClick={()=>sendMessage(s)} style={{ padding:"10px 16px",borderRadius:12,border:`1px solid ${C.border}`,background:C.surface,color:C.text2,fontSize:13,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text2;}}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg,i)=>(
            <Bubble key={i} msg={msg} C={C} isNew={i===newMsgIdx} onFeedback={sendFeedback} uiLang={uiLang} />
          ))}
          {loading && (
            <div style={{ display:"flex",alignItems:"flex-start",marginBottom:16 }}>
              <div style={{ width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,marginRight:10,flexShrink:0 }}>🤖</div>
              <div style={{ padding:"12px 16px",borderRadius:"18px 18px 18px 4px",background:C.bubble_ai,border:`1px solid ${C.border}` }}><TypingDots C={C} /></div>
            </div>
          )}
          {followups.length>0&&!loading && (
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,paddingLeft:40 }}>
              {followups.map(fq=>(
                <button key={fq} onClick={()=>sendMessage(fq)} style={{ padding:"6px 12px",borderRadius:20,border:`1px solid ${C.accent}44`,background:`${C.accent}10`,color:C.accent,fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>{fq}</button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding:"10px 24px 16px",borderTop:`1px solid ${C.border}`,background:C.surface,flexShrink:0 }}>
          {/* AI Reply Language toggle */}
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap" }}>
            <span style={{ fontSize:11,color:C.muted,fontWeight:600 }}>
              {chatLang==="en" ? "🤖 AI replies in:" : "🤖 AI válaszol:"}
            </span>
            {[{code:"en",label:"🇬🇧 English"},{code:"hu",label:"🇭🇺 Magyar"}].map(({code,label})=>(
              <button key={code} onClick={()=>setChatLang(code)}
                style={{ padding:"3px 12px",borderRadius:20,
                  border:`1.5px solid ${chatLang===code?C.accent:C.border}`,
                  background:chatLang===code?`${C.accent}18`:"transparent",
                  color:chatLang===code?C.accent:C.muted,
                  fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s" }}>
                {label}
              </button>
            ))}
            <span style={{ fontSize:10,color:C.muted,marginLeft:"auto",fontStyle:"italic" }}>
              {chatLang==="en" ? "AI always replies in English" : "Az AI mindig magyarul válaszol"}
            </span>
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"flex-end" }}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} placeholder={t.placeholder} rows={1}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
              style={{ flex:1,padding:"11px 14px",border:`1.5px solid ${C.inputBorder}`,borderRadius:14,fontSize:14,fontFamily:"inherit",color:C.text,background:C.input,outline:"none",resize:"none",lineHeight:1.5,transition:"border-color 0.15s",maxHeight:120 }}
              onFocus={e=>e.target.style.borderColor=C.accent}
              onBlur={e=>e.target.style.borderColor=C.inputBorder}
            />
            <button onClick={()=>sendMessage()} disabled={!input.trim()||loading}
              style={{ padding:"11px 20px",borderRadius:14,border:"none",background:input.trim()&&!loading?`linear-gradient(135deg,${C.accent},${C.accent2})`:"#E2E8F0",color:input.trim()&&!loading?"#fff":"#94A3B8",fontSize:14,fontWeight:700,cursor:input.trim()&&!loading?"pointer":"not-allowed",fontFamily:"inherit",flexShrink:0,transition:"all 0.15s" }}>
              {loading?"...":t.send}
            </button>
          </div>
        </div>
      </div>

      {/* Panels */}
      {showOnboarding && <OnboardingModal C={C} uiLang={uiLang} onDone={handleOnboardingDone} />}
      {showProgress   && <ProgressPanel  C={C} user={user} uiLang={uiLang} onClose={()=>setShowProgress(false)} />}
      {showEvents     && <EventsPanel    C={C} uiLang={uiLang} onClose={()=>setShowEvents(false)} />}
      {showMap        && <CampusMapPanel C={C} uiLang={uiLang} onClose={()=>setShowMap(false)} />}
      {showReplies    && <RepliesPanel   C={C} user={user} uiLang={uiLang} onClose={()=>setShowReplies(false)} />}
      {showSurvey     && <SurveyPanel    C={C} user={user} onClose={()=>setShowSurvey(false)} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:10px;}

        /* ── Mobile responsive ── */
        @media(max-width:767px){
          .sidebar-closed{
            position:fixed!important;
            left:-260px!important;
            top:0;bottom:0;
            z-index:100;
            transition:left 0.25s ease;
            box-shadow:4px 0 24px rgba(0,0,0,0.18);
          }
          .sidebar-open{
            position:fixed!important;
            left:0!important;
            top:0;bottom:0;
            z-index:100;
            transition:left 0.25s ease;
            box-shadow:4px 0 24px rgba(0,0,0,0.18);
          }
          .mobile-overlay{ display:block!important; }
          .hamburger-btn{ display:block!important; }
        }
        @media(min-width:768px){
          .sidebar-closed,.sidebar-open{ position:relative!important;left:0!important; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser]         = useState(null);
  const [token,setToken]       = useState(()=>TokenStore.get());
  const [darkMode,setDarkMode] = useState(false);

  // Auto-restore session on mount
  useEffect(()=>{
    const saved = TokenStore.get();
    if(saved&&!user) {
      fetch(`${API}/auth/me`,{headers:{Authorization:`Bearer ${saved}`}})
        .then(r=>r.ok?r.json():null)
        .then(u=>{ if(u&&u.email) setUser(u); else TokenStore.del(); })
        .catch(()=>TokenStore.del());
    }
  },[]);

  const handleLogin = (userData, tok) => {
    setUser(userData);
    if(tok) { setToken(tok); TokenStore.set(tok); }
  };

  const handleLogout = () => {
    if(token) fetch(`${API}/auth/logout`,{method:"POST",headers:{Authorization:`Bearer ${token}`}}).catch(()=>{});
    TokenStore.del(); setToken(null); setUser(null);
  };

  // Public survey — accessible without login at /survey
  if(window.location.pathname === "/survey") return <PublicSurvey />;

  if(!user) return <LoginScreen onLogin={handleLogin} />;
  if(user.role==="staff") return <StaffPortal  user={user} token={token} onLogout={handleLogout} />;
  if(user.role==="admin") return <AdminPortal  user={user} token={token} onLogout={handleLogout} />;
  return <ChatApp user={user} token={token} onLogout={handleLogout} darkMode={darkMode} setDarkMode={setDarkMode} />;
}