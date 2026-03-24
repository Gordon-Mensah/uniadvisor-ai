// SurveyPanel.jsx — International Student Pain-Point Survey
// Saves to Supabase `survey_responses` table
// Used for TDK research data + improves UniAdvisor content

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Questions ─────────────────────────────────────────────
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
    min: 1,
    max: 5,
    minLabel: "Very poor",
    maxLabel: "Excellent",
  },
  {
    id: "uniadvisor_usefulness",
    type: "scale",
    label: "How useful do you find UniAdvisor compared to searching yourself?",
    min: 1,
    max: 5,
    minLabel: "Not useful",
    maxLabel: "Much better",
  },
  {
    id: "missing_feature",
    type: "radio",
    label: "What would make UniAdvisor most valuable to you?",
    options: [
      "Step-by-step Neptun guide",
      "Visa / residence permit deadline tracker",
      "Pre-arrival checklist (what to do before you arrive)",
      "Translate Hungarian university letters",
      "Cost of living calculator",
      "Connect me with other international students",
      "WhatsApp / Telegram version",
    ],
  },
  {
    id: "open_feedback",
    type: "text",
    label: "What is the one thing you wish someone had told you before or when you arrived?",
    placeholder: "Write anything — this directly improves the system…",
  },
];

export default function SurveyPanel({ C, user, onClose }) {
  const [answers, setAnswers]   = useState({});
  const [step, setStep]         = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  const q = QUESTIONS[step];
  const total = QUESTIONS.length;
  const progress = ((step) / total) * 100;

  // ── Answer handlers ───────────────────────────────────
  const toggleCheckbox = (id, val) => {
    setAnswers(prev => {
      const cur = prev[id] || [];
      return { ...prev, [id]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
    });
  };

  const setRadio = (id, val) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  const setScale = (id, val) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  const setText = (id, val) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  // ── Navigation ────────────────────────────────────────
  const canNext = () => {
    const a = answers[q.id];
    if (q.type === "text") return true; // optional
    if (q.type === "checkbox") return (a || []).length > 0;
    if (q.type === "radio")    return !!a;
    if (q.type === "scale")    return !!a;
    return false;
  };

  const next = () => {
    if (step < total - 1) setStep(s => s + 1);
    else submit();
  };

  const back = () => setStep(s => s - 1);

  // ── Submit ────────────────────────────────────────────
  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        student_email:       user?.email || "anonymous",
        student_name:        user?.full_name || "Anonymous",
        student_nationality: user?.nationality || "Unknown",
        student_major:       user?.major || "Unknown",
        student_year:        user?.year_of_study || "Unknown",
        arrival_confusion:   (answers.arrival_confusion || []).join(", "),
        info_source:         (answers.info_source || []).join(", "),
        hardest_topic:       answers.hardest_topic || "",
        info_quality:        answers.info_quality || null,
        uniadvisor_usefulness: answers.uniadvisor_usefulness || null,
        missing_feature:     answers.missing_feature || "",
        open_feedback:       answers.open_feedback || "",
        submitted_at:        new Date().toISOString(),
      };
      const { error: err } = await supabase.from("survey_responses").insert(payload);
      if (err) throw err;
      setDone(true);
    } catch (e) {
      setError("Could not save — please try again. (" + (e.message || e) + ")");
    }
    setSubmitting(false);
  };

  // ── Styles ────────────────────────────────────────────
  const overlay = {
    position:"fixed", inset:0, background:"rgba(0,0,0,0.55)",
    zIndex:200, display:"flex", alignItems:"center", justifyContent:"center",
    padding:16,
  };
  const card = {
    background:C.surface, borderRadius:20, width:"100%", maxWidth:560,
    maxHeight:"90vh", overflowY:"auto", padding:"32px 32px 28px",
    border:`1px solid ${C.border}`, position:"relative",
  };
  const btnPrimary = {
    padding:"11px 28px", borderRadius:12, border:"none",
    background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
    color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
  };
  const btnGhost = {
    padding:"11px 20px", borderRadius:12, border:`1px solid ${C.border}`,
    background:"transparent", color:C.muted, fontSize:14, cursor:"pointer", fontFamily:"inherit",
  };
  const optionBase = (selected) => ({
    display:"flex", alignItems:"flex-start", gap:10, padding:"10px 14px",
    borderRadius:10, border:`1.5px solid ${selected ? C.accent : C.border}`,
    background: selected ? `${C.accent}12` : "transparent",
    cursor:"pointer", marginBottom:8, transition:"all 0.15s",
  });

  // ── Done screen ───────────────────────────────────────
  if (done) return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign:"center", padding:"20px 0" }}>
          <div style={{ fontSize:52, marginBottom:16 }}>🎉</div>
          <div style={{ fontSize:20, fontWeight:700, color:C.text, marginBottom:10 }}>
            Thank you!
          </div>
          <div style={{ fontSize:14, color:C.muted, lineHeight:1.7, marginBottom:24 }}>
            Your responses help improve UniAdvisor and contribute to real research
            on international student experience at Dunaújváros Egyetem.
          </div>
          <button style={btnPrimary} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );

  // ── Main survey ───────────────────────────────────────
  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.accent, letterSpacing:"0.08em", marginBottom:4 }}>
              INTERNATIONAL STUDENT SURVEY · {step + 1} OF {total}
            </div>
            <div style={{ fontSize:17, fontWeight:700, color:C.text, lineHeight:1.4 }}>
              {q.label}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer", padding:4, flexShrink:0, marginLeft:12 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height:4, background:C.border, borderRadius:4, marginBottom:24, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg,${C.accent},${C.accent2})`, borderRadius:4, transition:"width 0.3s" }} />
        </div>

        {/* Question body */}
        <div style={{ marginBottom:24 }}>

          {/* Checkbox */}
          {q.type === "checkbox" && q.options.map(opt => {
            const selected = (answers[q.id] || []).includes(opt);
            return (
              <div key={opt} style={optionBase(selected)} onClick={() => toggleCheckbox(q.id, opt)}>
                <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${selected ? C.accent : C.border}`, background: selected ? C.accent : "transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", marginTop:1 }}>
                  {selected && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>✓</span>}
                </div>
                <span style={{ fontSize:14, color:C.text, lineHeight:1.4 }}>{opt}</span>
              </div>
            );
          })}

          {/* Radio */}
          {q.type === "radio" && q.options.map(opt => {
            const selected = answers[q.id] === opt;
            return (
              <div key={opt} style={optionBase(selected)} onClick={() => setRadio(q.id, opt)}>
                <div style={{ width:18, height:18, borderRadius:"50%", border:`2px solid ${selected ? C.accent : C.border}`, background:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", marginTop:1 }}>
                  {selected && <div style={{ width:8, height:8, borderRadius:"50%", background:C.accent }} />}
                </div>
                <span style={{ fontSize:14, color:C.text }}>{opt}</span>
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
                    <button key={n} onClick={() => setScale(q.id, n)}
                      style={{ width:52, height:52, borderRadius:12, border:`2px solid ${sel ? C.accent : C.border}`,
                        background: sel ? `linear-gradient(135deg,${C.accent},${C.accent2})` : C.bg,
                        color: sel ? "#fff" : C.text, fontSize:18, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted }}>
                <span>{q.minLabel}</span>
                <span>{q.maxLabel}</span>
              </div>
            </div>
          )}

          {/* Text */}
          {q.type === "text" && (
            <textarea
              value={answers[q.id] || ""}
              onChange={e => setText(q.id, e.target.value)}
              placeholder={q.placeholder}
              rows={4}
              style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1.5px solid ${C.inputBorder}`,
                background:C.input, color:C.text, fontSize:14, fontFamily:"inherit",
                resize:"vertical", outline:"none", lineHeight:1.6, boxSizing:"border-box" }}
            />
          )}
        </div>

        {/* Error */}
        {error && <div style={{ fontSize:13, color:"#E53E3E", marginBottom:12 }}>{error}</div>}

        {/* Navigation */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <button style={btnGhost} onClick={step === 0 ? onClose : back}>
            {step === 0 ? "Cancel" : "← Back"}
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* dot indicators */}
            {QUESTIONS.map((_, i) => (
              <div key={i} style={{ width: i === step ? 18 : 6, height:6, borderRadius:3,
                background: i < step ? C.accent : i === step ? C.accent : C.border,
                opacity: i < step ? 0.5 : 1, transition:"all 0.2s" }} />
            ))}
          </div>
          <button style={{ ...btnPrimary, opacity: (!canNext() && q.type !== "text") ? 0.4 : 1 }}
            disabled={submitting || (!canNext() && q.type !== "text")}
            onClick={next}>
            {submitting ? "Saving…" : step === total - 1 ? "Submit ✓" : "Next →"}
          </button>
        </div>

        {/* Anonymous note */}
        <div style={{ textAlign:"center", fontSize:11, color:C.muted, marginTop:16, opacity:0.7 }}>
           Your responses are used only for research and improving UniAdvisor
        </div>

      </div>
    </div>
  );
}