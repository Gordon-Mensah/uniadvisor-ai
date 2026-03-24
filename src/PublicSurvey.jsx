// PublicSurvey.jsx — No login required
// Accessible at /survey — for sharing with international students
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ACCENT  = "#0D9488";
const ACCENT2 = "#0EA5E9";

const QUESTIONS = [
  {
    id: "arrival_confusion",
    type: "checkbox",
    label: "When you first arrived, what was most confusing? (select all that apply)",
    options: [
      "Registering in Neptun",
      "Finding accommodation",
      "Opening a Hungarian bank account",
      "Getting a residence permit / visa",
      "Understanding the course structure",
      "Finding the right office to go to",
      "Language barrier (forms/letters in Hungarian)",
      "Healthcare / insurance registration",
      "Getting a local SIM card",
      "Understanding scholarship conditions",
    ],
  },
  {
    id: "info_source",
    type: "checkbox",
    label: "How did you find information when you were confused? (select all that apply)",
    options: [
      "Asked other international students",
      "Asked the university office directly",
      "Searched Google",
      "University website",
      "Facebook / WhatsApp group",
      "Asked a Hungarian classmate",
      "I couldn't find it at all",
    ],
  },
  {
    id: "hardest_topic",
    type: "radio",
    label: "What ONE topic was hardest to get information about?",
    options: [
      "Visa / residence permit",
      "Neptun system",
      "Scholarship (Stipendium Hungaricum)",
      "Course registration / exams",
      "Accommodation / dormitory",
      "Health insurance",
      "Financial / tuition fees",
      "Moodle / e-learning",
    ],
  },
  {
    id: "info_quality",
    type: "scale",
    label: "How would you rate the university's information for international students?",
    min: 1, max: 5, minLabel: "Very poor", maxLabel: "Excellent",
  },
  {
    id: "missing_feature",
    type: "radio",
    label: "What would help you most?",
    options: [
      "Step-by-step Neptun guide in English",
      "Visa / residence permit deadline tracker",
      "Pre-arrival checklist (what to do before you arrive)",
      "Translate Hungarian university letters to English",
      "Cost of living calculator",
      "Connect me with other international students",
      "AI chatbot available 24/7 in English",
    ],
  },
  {
    id: "open_feedback",
    type: "text",
    label: "What is the ONE thing you wish someone had told you before or when you arrived?",
    placeholder: "Write anything — this directly shapes the research…",
  },
];

// Optional identity questions shown on first step
const IDENTITY_FIELDS = [
  { id: "nationality", label: "Your nationality (country)", placeholder: "e.g. Nigeria, Vietnam, Turkey…" },
  { id: "major",       label: "Your study programme",       placeholder: "e.g. Computer Science, Engineering…" },
  { id: "year",        label: "Which year are you in?",     placeholder: "e.g. Year 1, Year 2…" },
];

export default function PublicSurvey() {
  const [step, setStep]           = useState(-1); // -1 = identity step
  const [identity, setIdentity]   = useState({ nationality:"", major:"", year:"" });
  const [answers, setAnswers]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");

  const q     = QUESTIONS[step];
  const total = QUESTIONS.length;
  const progress = step < 0 ? 0 : Math.round(((step + 1) / total) * 100);

  // ── Handlers ──────────────────────────────────────────
  const toggleCheck = (id, val) =>
    setAnswers(p => ({ ...p, [id]: (p[id]||[]).includes(val) ? (p[id]||[]).filter(v=>v!==val) : [...(p[id]||[]), val] }));

  const setRadio  = (id, val) => setAnswers(p => ({ ...p, [id]: val }));
  const setScale  = (id, val) => setAnswers(p => ({ ...p, [id]: val }));
  const setText   = (id, val) => setAnswers(p => ({ ...p, [id]: val }));

  const canNext = () => {
    if (step < 0) return true; // identity optional
    const a = answers[q?.id];
    if (!q) return false;
    if (q.type === "text")     return true;
    if (q.type === "checkbox") return (a||[]).length > 0;
    if (q.type === "radio")    return !!a;
    if (q.type === "scale")    return !!a;
    return false;
  };

  const next = () => {
    if (step < total - 1) setStep(s => s + 1);
    else submit();
  };

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      const { error: err } = await supabase.from("survey_responses").insert({
        student_email:           "anonymous",
        student_name:            "Anonymous",
        student_nationality:     identity.nationality || "Unknown",
        student_major:           identity.major       || "Unknown",
        student_year:            identity.year        || "Unknown",
        arrival_confusion:       (answers.arrival_confusion||[]).join(", "),
        info_source:             (answers.info_source||[]).join(", "),
        hardest_topic:           answers.hardest_topic         || "",
        info_quality:            answers.info_quality          || null,
        uniadvisor_usefulness:   null,
        missing_feature:         answers.missing_feature       || "",
        open_feedback:           answers.open_feedback         || "",
        submitted_at:            new Date().toISOString(),
      });
      if (err) throw err;
      setDone(true);
    } catch(e) {
      setError("Could not save response. Please try again. (" + (e.message||e) + ")");
    }
    setSubmitting(false);
  };

  // ── Styles ─────────────────────────────────────────────
  const S = {
    page: { minHeight:"100vh", background:"#0F172A", display:"flex", alignItems:"center",
            justifyContent:"center", padding:16, fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif" },
    card: { background:"#1E293B", borderRadius:20, width:"100%", maxWidth:540,
            padding:"36px 32px 28px", border:"1px solid rgba(255,255,255,0.08)" },
    label: { fontSize:17, fontWeight:700, color:"#F1F5F9", lineHeight:1.5, marginBottom:20, display:"block" },
    tag:   { fontSize:11, fontWeight:700, color:ACCENT, letterSpacing:"0.08em", marginBottom:10, display:"block" },
    opt: (sel) => ({
      display:"flex", alignItems:"flex-start", gap:10, padding:"10px 14px",
      borderRadius:10, border:`1.5px solid ${sel ? ACCENT : "rgba(255,255,255,0.1)"}`,
      background: sel ? "rgba(13,148,136,0.12)" : "transparent",
      cursor:"pointer", marginBottom:8, transition:"all 0.15s",
    }),
    check: (sel) => ({
      width:18, height:18, borderRadius:5, flexShrink:0, marginTop:1,
      border:`2px solid ${sel ? ACCENT : "rgba(255,255,255,0.25)"}`,
      background: sel ? ACCENT : "transparent",
      display:"flex", alignItems:"center", justifyContent:"center",
    }),
    radio: (sel) => ({
      width:18, height:18, borderRadius:"50%", flexShrink:0, marginTop:1,
      border:`2px solid ${sel ? ACCENT : "rgba(255,255,255,0.25)"}`,
      background:"transparent",
      display:"flex", alignItems:"center", justifyContent:"center",
    }),
    btnPrimary: {
      padding:"11px 28px", borderRadius:12, border:"none",
      background:`linear-gradient(135deg,${ACCENT},${ACCENT2})`,
      color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
    },
    btnGhost: {
      padding:"11px 20px", borderRadius:12,
      border:"1px solid rgba(255,255,255,0.12)",
      background:"transparent", color:"#94A3B8",
      fontSize:14, cursor:"pointer", fontFamily:"inherit",
    },
    input: {
      width:"100%", padding:"10px 14px", borderRadius:10,
      border:"1.5px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)",
      color:"#F1F5F9", fontSize:14, fontFamily:"inherit", outline:"none",
      boxSizing:"border-box", marginBottom:12,
    },
  };

  // ── Done ───────────────────────────────────────────────
  if (done) return (
    <div style={S.page}>
      <div style={{ ...S.card, textAlign:"center", padding:"48px 32px" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
        <div style={{ fontSize:22, fontWeight:700, color:"#F1F5F9", marginBottom:12 }}>Thank you!</div>
        <div style={{ fontSize:14, color:"#94A3B8", lineHeight:1.8, marginBottom:28 }}>
          Your response has been saved and will directly contribute to research on
          international student experience at Dunaújváros Egyetem.
        </div>
        <div style={{ fontSize:13, color:"#64748B", marginBottom:24 }}>
          Want to try the AI assistant?
        </div>
        <a href="/" style={{ ...S.btnPrimary, textDecoration:"none", display:"inline-block" }}>
          Try UniAdvisor AI →
        </a>
      </div>
    </div>
  );

  // ── Identity step (step = -1) ──────────────────────────
  if (step < 0) return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🎓</div>
          <div style={{ fontSize:20, fontWeight:700, color:"#F1F5F9", marginBottom:8 }}>
            International Student Survey
          </div>
          <div style={{ fontSize:13, color:"#94A3B8", lineHeight:1.7 }}>
            Dunaújváros Egyetem · 3 minutes · completely anonymous
          </div>
        </div>

        {/* Progress */}
        <div style={{ height:3, background:"rgba(255,255,255,0.08)", borderRadius:3, marginBottom:24 }}>
          <div style={{ height:"100%", width:"0%", background:`linear-gradient(90deg,${ACCENT},${ACCENT2})`, borderRadius:3 }} />
        </div>

        <span style={S.tag}>OPTIONAL — helps us understand responses better</span>
        <div style={{ marginBottom:20 }}>
          {IDENTITY_FIELDS.map(f => (
            <div key={f.id}>
              <div style={{ fontSize:12, color:"#94A3B8", marginBottom:6 }}>{f.label}</div>
              <input
                style={S.input}
                placeholder={f.placeholder}
                value={identity[f.id]}
                onChange={e => setIdentity(p => ({ ...p, [f.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button style={S.btnPrimary} onClick={next}>Start Survey →</button>
        </div>

        <div style={{ textAlign:"center", fontSize:11, color:"#475569", marginTop:16 }}>
           Anonymous · your data is used only for university research
        </div>
      </div>
    </div>
  );

  // ── Survey steps ───────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Header */}
        <div style={{ marginBottom:16 }}>
          <span style={S.tag}>QUESTION {step + 1} OF {total}</span>
          <span style={{ fontSize:17, fontWeight:700, color:"#F1F5F9", lineHeight:1.5, display:"block" }}>
            {q.label}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height:3, background:"rgba(255,255,255,0.08)", borderRadius:3, marginBottom:24, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg,${ACCENT},${ACCENT2})`, borderRadius:3, transition:"width 0.3s" }} />
        </div>

        {/* Checkbox */}
        {q.type === "checkbox" && q.options.map(opt => {
          const sel = (answers[q.id]||[]).includes(opt);
          return (
            <div key={opt} style={S.opt(sel)} onClick={() => toggleCheck(q.id, opt)}>
              <div style={S.check(sel)}>
                {sel && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>✓</span>}
              </div>
              <span style={{ fontSize:14, color:"#E2E8F0", lineHeight:1.4 }}>{opt}</span>
            </div>
          );
        })}

        {/* Radio */}
        {q.type === "radio" && q.options.map(opt => {
          const sel = answers[q.id] === opt;
          return (
            <div key={opt} style={S.opt(sel)} onClick={() => setRadio(q.id, opt)}>
              <div style={S.radio(sel)}>
                {sel && <div style={{ width:8, height:8, borderRadius:"50%", background:ACCENT }} />}
              </div>
              <span style={{ fontSize:14, color:"#E2E8F0" }}>{opt}</span>
            </div>
          );
        })}

        {/* Scale */}
        {q.type === "scale" && (
          <div>
            <div style={{ display:"flex", gap:10, justifyContent:"center", marginBottom:12 }}>
              {[1,2,3,4,5].map(n => {
                const sel = answers[q.id] === n;
                return (
                  <button key={n} onClick={() => setScale(q.id, n)} style={{
                    width:52, height:52, borderRadius:12,
                    border:`2px solid ${sel ? ACCENT : "rgba(255,255,255,0.12)"}`,
                    background: sel ? `linear-gradient(135deg,${ACCENT},${ACCENT2})` : "rgba(255,255,255,0.03)",
                    color: sel ? "#fff" : "#94A3B8",
                    fontSize:18, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                  }}>{n}</button>
                );
              })}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#64748B" }}>
              <span>{q.minLabel}</span><span>{q.maxLabel}</span>
            </div>
          </div>
        )}

        {/* Text */}
        {q.type === "text" && (
          <textarea value={answers[q.id]||""} onChange={e => setText(q.id, e.target.value)}
            placeholder={q.placeholder} rows={4} style={{
              width:"100%", padding:"12px 14px", borderRadius:12,
              border:"1.5px solid rgba(255,255,255,0.12)",
              background:"rgba(255,255,255,0.05)", color:"#F1F5F9",
              fontSize:14, fontFamily:"inherit", resize:"vertical",
              outline:"none", lineHeight:1.6, boxSizing:"border-box",
            }} />
        )}

        {error && <div style={{ fontSize:13, color:"#F87171", margin:"12px 0" }}>{error}</div>}

        {/* Navigation */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:20 }}>
          <button style={S.btnGhost} onClick={() => setStep(s => s - 1)}>
            {step === 0 ? "← Back" : "← Back"}
          </button>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {QUESTIONS.map((_,i) => (
              <div key={i} style={{ width: i===step?16:6, height:6, borderRadius:3,
                background: i<step ? ACCENT : i===step ? ACCENT : "rgba(255,255,255,0.12)",
                opacity: i<step ? 0.5 : 1, transition:"all 0.2s" }} />
            ))}
          </div>
          <button style={{ ...S.btnPrimary, opacity: !canNext() && q.type !== "text" ? 0.4 : 1 }}
            disabled={submitting || (!canNext() && q.type !== "text")}
            onClick={next}>
            {submitting ? "Saving…" : step === total - 1 ? "Submit ✓" : "Next →"}
          </button>
        </div>

        <div style={{ textAlign:"center", fontSize:11, color:"#475569", marginTop:16 }}>
           Anonymous · Dunaújváros Egyetem research project
        </div>
      </div>
    </div>
  );
}