// ═══════════════════════════════════════════════════════════
// Demo.jsx — UniAdvisor AI Showcase Page
// Route: /demo — designed to be shown to professors / HR
// Self-contained, no props required.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "";

// ── Live demo questions ────────────────────────────────────
const DEMO_QA = [
  {
    q: "How do I register for courses in Neptun?",
    a: "To register for courses in Neptun: log in at neptun.uniduna.hu → go to Studies → Course Registration → select your semester → find the course and click Register. Registration opens at the start of each semester — check the Academic Calendar for exact dates. If you see an error, your credit balance may be blocking registration.",
    office: "📚 Study Office", delay: 1400,
  },
  {
    q: "What documents do I need to renew my residence permit?",
    a: "For residence permit renewal you need: valid passport, completed application form, proof of enrolment (from the Study Office), proof of accommodation, proof of health insurance, and the official fee receipt. Book an appointment at the Dunaújváros Government Office at least 30 days before your current permit expires. The IRO can provide your enrolment letter.",
    office: "🌍 International Relations Office", delay: 1200,
  },
  {
    q: "How do I apply for the Stipendium Hungaricum scholarship?",
    a: "The Stipendium Hungaricum scholarship is managed through your sending country's nominating authority — you cannot apply directly through the university. Applications typically open in October–December each year. Contact the IRO at iro@uniduna.hu for your Letter of Acceptance once nominated. Scholarship conditions include maintaining a minimum GPA and full-time enrolment.",
    office: "💰 Finance & Scholarships", delay: 1600,
  },
];

// ── Architecture pipeline steps ───────────────────────────
const PIPELINE = [
  { id: "query",    icon: "💬", label: "Student query",      sub: "Natural language in English or Hungarian", color: "#C8321A" },
  { id: "router",   icon: "🧭", label: "Office router",      sub: "Keyword classifier → 10 categories",       color: "#D4A017" },
  { id: "bm25",     icon: "🔍", label: "BM25 retrieval",     sub: "Top-k chunks from knowledge base",         color: "#1B6B9A" },
  { id: "llm",      icon: "🤖", label: "LLaMA 3 via Groq",   sub: "Context-grounded generation",             color: "#2A7A4A" },
  { id: "response", icon: "✅", label: "Sourced answer",     sub: "Language-locked · office-attributed",      color: "#C8321A" },
];

// ── Tech stack ─────────────────────────────────────────────
const STACK = [
  { cat: "Backend",    items: ["Python 3.11", "FastAPI", "BM25 retrieval", "pypdf", "rank-bm25"] },
  { cat: "AI / LLM",  items: ["Groq API", "LLaMA 3.3-70B", "LLaMA 3.1-8B", "sentence-transformers"] },
  { cat: "Frontend",  items: ["React 18", "Vite 5", "Supabase JS", "CSS animations"] },
  { cat: "Database",  items: ["Supabase", "PostgreSQL", "Row Level Security", "Realtime"] },
  { cat: "Deploy",    items: ["Render (free)", "GitHub CI", "UptimeRobot", "Zero cost"] },
];

// ── Timeline ───────────────────────────────────────────────
const TIMELINE = [
  { month: "Feb 2025", label: "Research start",       desc: "Literature review, problem scoping, architecture design" },
  { month: "Mar 2025", label: "Build phase",          desc: "Web scraper, knowledge base, RAG engine, core API" },
  { month: "Mar 2025", label: "Frontend complete",    desc: "Student, Staff, Admin portals deployed to Render" },
  { month: "Mar 2025", label: "Survey launched",      desc: "21 international students surveyed, data collected" },
  { month: "Apr 2025", label: "Evaluation phase",     desc: "Accuracy benchmark, SUS usability study underway" },
  { month: "May 2025", label: "TDK Conference",       desc: "Presented at Tudományos Diákköri Konferencia" },
];

function useInView(threshold = 0.1) {
  const [v, setV] = useState(false);
  const ref = useCallback((node) => {
    if (!node) return;
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setV(true); o.disconnect(); }
    }, { threshold });
    o.observe(node);
  }, []);
  return [ref, v];
}

function Reveal({ children, delay = 0, y = 24 }) {
  const [ref, v] = useInView();
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    // Fallback: show content after 800ms regardless
    const t = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={ref} style={{
      opacity: (v || ready) ? 1 : 0,
      transform: (v || ready) ? "none" : `translateY(${y}px)`,
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`
    }}>
      {children}
    </div>
  );
}

// ── Live interactive demo widget ───────────────────────────
function LiveDemo() {
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [shown, setShown] = useState(false);
  const [displayQ, setDisplayQ] = useState("");
  const [displayA, setDisplayA] = useState("");
  const [qIdx, setQIdx] = useState(0);

  const runDemo = (idx) => {
    const qa = DEMO_QA[idx];
    setQIdx(idx);
    setShown(false);
    setDisplayQ("");
    setDisplayA("");
    setStep(0);
    setTyping(true);

    // Type the question
    let qi = 0;
    const qInterval = setInterval(() => {
      setDisplayQ(qa.q.slice(0, ++qi));
      if (qi >= qa.q.length) {
        clearInterval(qInterval);
        setStep(1);
        setTimeout(() => {
          setStep(2);
          setTimeout(() => {
            setStep(3);
            setTimeout(() => {
              setStep(4);
              setShown(true);
              setTyping(false);
              // Stream the answer
              let ai = 0;
              const aInterval = setInterval(() => {
                setDisplayA(qa.a.slice(0, ++ai));
                if (ai >= qa.a.length) clearInterval(aInterval);
              }, 10);
            }, 400);
          }, 500);
        }, 300);
      }
    }, 38);
  };

  useEffect(() => { runDemo(0); }, []);

  const qa = DEMO_QA[qIdx];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

      {/* Left: chat window */}
      <div style={{ background: "#0F2347", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        {/* Titlebar */}
        <div style={{ background: "#0a1830", padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#EF4444" }} />
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#F59E0B" }} />
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#10B981" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginLeft: 8, fontFamily: "monospace" }}>UniAdvisor AI — Live Demo</span>
        </div>

        {/* Messages */}
        <div style={{ padding: 16, minHeight: 280 }}>
          {/* User bubble */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: "18px 18px 4px 18px", background: "#C8321A", color: "#fff", fontSize: 13, lineHeight: 1.6 }}>
              {displayQ || <span style={{ color: "rgba(255,255,255,0.3)" }}>Waiting…</span>}
            </div>
          </div>

          {/* Pipeline indicator */}
          {step > 0 && step < 4 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 12, fontSize: 11 }}>
              {PIPELINE.slice(1, 4).map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, opacity: step > i ? 1 : 0.25, transition: "opacity 0.3s" }}>
                  <span>{p.icon}</span>
                  <span style={{ color: step > i ? "#D4A017" : "rgba(255,255,255,0.3)" }}>{p.label}</span>
                  {i < 2 && <span style={{ color: "rgba(255,255,255,0.2)" }}>→</span>}
                </div>
              ))}
            </div>
          )}

          {/* AI bubble */}
          {shown && (
            <div style={{ display: "flex", gap: 10, animation: "dmFadeUp 0.3s ease" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#1B3A6B,#2A4F8A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 2 }}>🤖</div>
              <div>
                <div style={{ padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 13, lineHeight: 1.65, color: "#E2E8F0", whiteSpace: "pre-wrap" }}>
                  {displayA}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: "#D4A017" }}>{qa.office}</div>
              </div>
            </div>
          )}

          {!shown && step === 0 && !displayQ && (
            <div style={{ display: "flex", gap: 6, padding: "8px 14px", alignItems: "center" }}>
              {[0, 1, 2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8321A", opacity: 0.5, animation: `dmBounce 1.2s ease-in-out ${j * 0.2}s infinite` }} />)}
            </div>
          )}
        </div>

        {/* Input mock */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 50, padding: "7px 14px", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            {typing ? "Typing…" : "Ask anything about university life…"}
          </div>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#C8321A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>→</div>
        </div>
      </div>

      {/* Right: question switcher + stats */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C8321A", marginBottom: 12 }}>Try a different question</div>
        {DEMO_QA.map((qa, i) => (
          <button key={i} onClick={() => runDemo(i)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", borderRadius: 10, border: `1px solid ${qIdx === i ? "rgba(200,50,26,0.4)" : "rgba(255,255,255,0.07)"}`, background: qIdx === i ? "rgba(200,50,26,0.08)" : "rgba(255,255,255,0.02)", color: qIdx === i ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 8, transition: "all 0.2s", lineHeight: 1.4 }}>
            {qa.q}
          </button>
        ))}

        <div style={{ marginTop: 20, padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>System info</div>
          {[["Response time", "< 2 seconds"], ["Knowledge base", "60+ UoD pages"], ["Office routing", "10 categories"], ["Languages", "English · Hungarian"], ["Cost", "€0 / month"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>{k}</span>
              <span style={{ color: "#D4A017", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Architecture flow diagram ──────────────────────────────
function ArchDiagram({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", padding: "8px 0" }}>
      {PIPELINE.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", flex: i === 2 ? 1.4 : 1 }}>
          <div style={{ flex: 1, padding: "16px 14px", background: active === i ? `${p.color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${active === i ? p.color + "55" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, textAlign: "center", transition: "all 0.3s", cursor: "default" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{p.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: active === i ? "#fff" : "rgba(255,255,255,0.6)", marginBottom: 4 }}>{p.label}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{p.sub}</div>
          </div>
          {i < PIPELINE.length - 1 && (
            <div style={{ width: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ height: 1, width: "100%", background: active > i ? "#C8321A" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
              <div style={{ position: "absolute", color: active > i ? "#C8321A" : "rgba(255,255,255,0.2)", fontSize: 12, transition: "color 0.3s" }}>▶</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════
export default function Demo() {
  const [archStep, setArchStep] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setArchStep(s => (s + 1) % PIPELINE.length), 1200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ background: "#07101F", color: "#E2E8F0", fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=Syne:wght@700;800&display=swap');
        @keyframes dmFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dmBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes dmSpin { to{transform:rotate(360deg)} }
        @keyframes dmPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing:border-box; margin:0; padding:0; }
        html { scroll-behavior:smooth; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#C8321A; border-radius:4px; }

        .dm-nav {
          position:fixed; top:0; left:0; right:0; z-index:100;
          padding:0 48px; height:60px;
          display:flex; align-items:center; justify-content:space-between;
          transition:all 0.3s;
        }
        .dm-nav.scrolled {
          background:rgba(7,16,31,0.95);
          backdrop-filter:blur(12px);
          border-bottom:1px solid rgba(255,255,255,0.05);
        }

        .dm-btn {
          display:inline-flex; align-items:center; gap:7px;
          padding:10px 24px; border-radius:6px; border:none;
          background:#C8321A; color:#fff;
          font-size:13px; font-weight:700; cursor:pointer;
          font-family:inherit; letter-spacing:0.02em;
          transition:all 0.2s; text-decoration:none;
        }
        .dm-btn:hover { background:#E04020; transform:translateY(-1px); }
        .dm-btn-ghost {
          display:inline-flex; align-items:center; gap:7px;
          padding:9px 20px; border-radius:6px;
          border:1px solid rgba(255,255,255,0.15);
          background:transparent; color:rgba(255,255,255,0.65);
          font-size:13px; cursor:pointer; font-family:inherit;
          transition:all 0.2s; text-decoration:none;
        }
        .dm-btn-ghost:hover { border-color:rgba(255,255,255,0.4); color:#fff; }

        .section { padding:96px 48px; max-width:1100px; margin:0 auto; }

        .tag {
          display:inline-block; font-size:10px; font-weight:700;
          letter-spacing:0.12em; text-transform:uppercase;
          color:#C8321A; margin-bottom:14px;
        }
        .section-title {
          font-family:'Syne',sans-serif; font-size:clamp(28px,3.5vw,44px);
          font-weight:800; letter-spacing:-1px; line-height:1.1;
          color:#fff; margin-bottom:14px;
        }
        .section-sub {
          font-size:16px; color:rgba(255,255,255,0.45);
          max-width:560px; line-height:1.75; margin-bottom:52px;
        }

        .portal-card {
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:16px; overflow:hidden;
          transition:all 0.3s;
        }
        .portal-card:hover {
          border-color:rgba(200,50,26,0.3);
          transform:translateY(-3px);
          background:rgba(255,255,255,0.04);
        }

        .stack-pill {
          display:inline-block; padding:5px 12px; border-radius:4px;
          font-size:11px; font-weight:600; letter-spacing:0.05em;
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.08);
          color:rgba(255,255,255,0.6); margin:3px;
          transition:all 0.2s;
        }
        .stack-pill:hover {
          background:rgba(200,50,26,0.1);
          border-color:rgba(200,50,26,0.3);
          color:#fff;
        }

        .timeline-item { display:flex; gap:24px; margin-bottom:32px; position:relative; }
        .timeline-dot { width:12px; height:12px; border-radius:50%; background:#C8321A; flex-shrink:0; margin-top:5px; position:relative; z-index:1; box-shadow:0 0 0 4px rgba(200,50,26,0.15); }
        .timeline-line { position:absolute; left:5px; top:18px; bottom:-24px; width:2px; background:rgba(255,255,255,0.07); }

        .stat-big { font-family:'Syne',sans-serif; font-size:48px; font-weight:800; color:#C8321A; line-height:1; }

        @media(max-width:768px) {
          .dm-nav { padding:0 20px; }
          .section { padding:64px 20px; }
          .demo-grid { grid-template-columns:1fr !important; }
          .portal-grid { grid-template-columns:1fr !important; }
          .stat-grid { grid-template-columns:1fr 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className={`dm-nav${scrolled ? " scrolled" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#C8321A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "#fff" }}>U</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "#fff" }}>UniAdvisor <span style={{ color: "#C8321A" }}>/ demo</span></span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/" className="dm-btn-ghost">← Landing page</a>
          <a href="/login" className="dm-btn">Open app →</a>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section style={{ paddingTop: 120, paddingBottom: 80, paddingLeft: 48, paddingRight: 48, maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(200,50,26,0.3)", borderRadius: 4, padding: "5px 16px", marginBottom: 28, animation: "dmFadeUp 0.5s ease" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", animation: "dmPulse 2s infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#10B981" }}>LIVE SYSTEM · DEPLOYED ON RENDER</span>
        </div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: "clamp(40px,6vw,76px)", lineHeight: 1.0, letterSpacing: "-2px", color: "#fff", marginBottom: 20, animation: "dmFadeUp 0.5s 0.1s ease both" }}>
          One student.<br />
          <span style={{ color: "#C8321A" }}>One semester.</span><br />
          A full AI platform.
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.45)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.75, animation: "dmFadeUp 0.5s 0.2s ease both" }}>
          Built as a TDK research project at Dunaújváros Egyetem — a production-grade, deployed system serving real international students. Every line of code written by one BSc student.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animation: "dmFadeUp 0.5s 0.3s ease both" }}>
          <a href="/login" className="dm-btn">Try it live →</a>
          <a href="/survey" className="dm-btn-ghost">Student survey</a>
        </div>

        {/* Key stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, marginTop: 64, background: "rgba(255,255,255,0.05)", borderRadius: 12, overflow: "hidden", animation: "dmFadeUp 0.5s 0.4s ease both" }} className="stat-grid">
          {[
            { n: "3", s: "portals", d: "Student · Staff · Admin" },
            { n: "10", s: "offices mapped", d: "Auto-routed by classifier" },
            { n: "60+", s: "pages scraped", d: "Live UoD knowledge base" },
            { n: "€0", s: "monthly cost", d: "All free-tier infrastructure" },
          ].map(({ n, s, d }) => (
            <div key={s} style={{ padding: "28px 20px", background: "rgba(7,16,31,0.8)", textAlign: "center" }}>
              <div className="stat-big">{n}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginTop: 6, marginBottom: 4 }}>{s}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE DEMO ─────────────────────────────────────────── */}
      <section style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "96px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <div className="tag">Interactive demo</div>
            <h2 className="section-title">See it work — live.</h2>
            <p className="section-sub">The same system international students use right now. Select a question to watch the full RAG pipeline in action.</p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="demo-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24 }}>
              <LiveDemo />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── ARCHITECTURE ──────────────────────────────────────── */}
      <div className="section">
        <Reveal>
          <div className="tag">System architecture</div>
          <h2 className="section-title">Retrieval-Augmented Generation<br />built for this context.</h2>
          <p className="section-sub">Not a generic chatbot. A university-specific information engine with BM25 retrieval over a curated knowledge base, locked language selection, and per-office routing.</p>
        </Reveal>
        <Reveal delay={0.1}>
          <ArchDiagram active={archStep} />
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 32 }}>
          {[
            { title: "Why BM25 over dense retrieval?", body: "For a corpus of 500–2,000 chunks, BM25 matches embedding quality while running at zero inference cost — critical for free-tier deployment. No GPU, no latency, no cost." },
            { title: "Why language-locking matters", body: "The AI reply language is set by frontend toggle and passed as a hard constraint. The model cannot switch regardless of what language the student types — preventing mid-session silent switches." },
            { title: "Office routing before retrieval", body: "Questions are classified into one of ten office categories before BM25 runs. The retrieval pool is filtered first — reducing noise and improving precision without changing the retrieval algorithm." },
            { title: "Graceful degradation", body: "If Supabase is unavailable, the system falls back to in-memory stores. If Groq rate limits one key, a rotation manager cycles to the next. The /chat endpoint stays up." },
          ].map((c, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div style={{ padding: "22px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#C8321A", marginBottom: 8 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>{c.body}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── THREE PORTALS ─────────────────────────────────────── */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.04)", padding: "96px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <div className="tag">What was built</div>
            <h2 className="section-title">Three portals.<br />One integrated system.</h2>
            <p className="section-sub">Each role gets a purpose-built interface. Students chat. Staff broadcast. Admins analyse. All sharing the same backend API and database.</p>
          </Reveal>
          <div className="portal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[
              {
                role: "Student", icon: "🎓", color: "#1B6B9A",
                features: ["AI advisor in English and Hungarian", "10 office categories auto-detected", "Progress task tracker", "Campus events calendar", "Interactive campus map with GPS", "Advisor escalation and reply inbox", "Onboarding tour on first login"],
              },
              {
                role: "Staff", icon: "👩‍🏫", color: "#2A7A4A",
                features: ["Publish announcements with scheduling", "Live student activity feed", "Student directory with filters", "Direct messaging to students", "Read receipt tracking", "Supabase-persisted — survives reload"],
              },
              {
                role: "Admin", icon: "⚙️", color: "#C8321A",
                features: ["KPI dashboard with animated counters", "Per-office analytics and satisfaction", "Survey results with TDK data", "Escalation inbox with reply tool", "Full audit log of all actions", "Document upload and KB management", "Campus events CRUD"],
              },
            ].map((p, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="portal-card">
                  <div style={{ padding: "20px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${p.color}22`, border: `1px solid ${p.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{p.icon}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: p.color, textTransform: "uppercase" }}>{p.role}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{p.role} portal</div>
                    </div>
                  </div>
                  <div style={{ padding: "16px 22px" }}>
                    {p.features.map(f => (
                      <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
                        <div style={{ width: 14, height: 2, background: p.color, flexShrink: 0, marginTop: 7 }} />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK ────────────────────────────────────────── */}
      <div className="section">
        <Reveal>
          <div className="tag">Technical foundation</div>
          <h2 className="section-title">Open source.<br />Zero operating cost.</h2>
          <p className="section-sub">Every component runs on free-tier services. The methodology is fully documented and replicable by any similar institution in Central and Eastern Europe.</p>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
          {STACK.map((s, i) => (
            <Reveal key={i} delay={i * 0.07}>
              <div style={{ padding: "18px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C8321A", marginBottom: 12 }}>{s.cat}</div>
                {s.items.map(it => (
                  <div key={it} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#C8321A", flexShrink: 0 }} />
                    {it}
                  </div>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── TIMELINE ──────────────────────────────────────────── */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.04)", padding: "96px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <div className="tag">Project timeline</div>
            <h2 className="section-title">Built in one semester.<br />Deployed and running.</h2>
            <p className="section-sub" style={{ marginBottom: 48 }}>From first commit to a live, publicly accessible system — within a single academic semester alongside full coursework.</p>
          </Reveal>
          <div style={{ maxWidth: 600 }}>
            {TIMELINE.map((t, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div className="timeline-item">
                  <div style={{ position: "relative", flexShrink: 0, paddingTop: 4 }}>
                    <div className="timeline-dot" />
                    {i < TIMELINE.length - 1 && <div className="timeline-line" />}
                  </div>
                  <div style={{ paddingBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#C8321A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{t.month}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{t.label}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>{t.desc}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESEARCHER ────────────────────────────────────────── */}
      <div className="section">
        <Reveal>
          <div className="tag">About the researcher</div>
          <h2 className="section-title">The person<br />behind the project.</h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
          <Reveal delay={0.1}>
            <div style={{ padding: "32px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#C8321A,#1B3A6B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "#fff" }}>JG</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>John Jerry Gordon-Mensah</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>BSc Computer Science Engineering</div>
                  <div style={{ fontSize: 12, color: "#C8321A", marginTop: 2 }}>Dunaújváros Egyetem</div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                {[["Supervisor", "Dr. Váraljai Mariann"], ["Conference", "TDK · May 13, 2025"], ["Programme", "BSc Computer Science"], ["Status", "Active development"]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
                    <span style={{ color: "rgba(255,255,255,0.35)" }}>{k}</span>
                    <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: 24 }}>
                This project addresses a real, documented problem — international students at UoD losing time, missing deadlines, and navigating critical administrative processes alone because institutional information is inaccessible.
              </div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: 32 }}>
                UniAdvisor AI was built to solve that problem completely — not as a proof of concept, but as a production system that works today, is deployed publicly, and has already collected primary research data from 21 enrolled students.
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="/login" className="dm-btn">Open the system →</a>
                <a href="/survey" className="dm-btn-ghost">View survey</a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 48px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
        <div style={{ width: 32, height: 2, background: "#C8321A", margin: "0 auto 16px", borderRadius: 2 }} />
        <div>UniAdvisor AI · TDK Research Project · Dunaújváros Egyetem · 2025</div>
        <div style={{ marginTop: 6 }}>John Jerry Gordon-Mensah · Dr. Váraljai Mariann · <a href="/" style={{ color: "#C8321A", textDecoration: "none" }}>Home</a> · <a href="/login" style={{ color: "#C8321A", textDecoration: "none" }}>App</a></div>
      </footer>
    </div>
  );
}