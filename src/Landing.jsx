// ═══════════════════════════════════════════════════════════
// Landing.jsx — UniAdvisor AI Public Landing Page
// Shown as the first screen before login.
// Converted from landing.html — fully self-contained JSX.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";

export default function Landing({ onEnter }) {
  const [scrolled, setScrolled] = useState(false);
  const revealRefs = useRef([]);

  // Sticky nav shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Intersection observer for reveal animations
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add("l-visible"), i * 60);
          }
        });
      },
      { threshold: 0.1 }
    );
    revealRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const reveal = (i = 0) => ({
    ref: (el) => { revealRefs.current[revealRefs.current.length] = el; },
    className: "l-reveal",
    style: { animationDelay: `${i * 0.08}s` },
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');

        :root {
          --navy: #1B3A6B;
          --navy-dark: #0F2347;
          --navy-mid: #2A4F8A;
          --red: #C8321A;
          --red-light: #E04020;
          --gold: #D4A017;
          --white: #FFFFFF;
          --off-white: #F5F6F8;
          --gray-100: #EEF0F4;
          --gray-200: #D8DCE6;
          --gray-500: #6B7490;
          --gray-700: #3A3F52;
          --ink: #12172B;
          --border: rgba(27,58,107,0.12);
        }

        .l-page { font-family:'Inter',sans-serif; background:var(--white); color:var(--ink); overflow-x:hidden; line-height:1.6; }
        .l-page * { box-sizing:border-box; margin:0; padding:0; }

        /* NAV */
        .l-nav {
          position:fixed; top:0; left:0; right:0; z-index:100;
          display:flex; align-items:center; justify-content:space-between;
          padding:0 56px; height:64px;
          background:rgba(15,35,71,0.97);
          backdrop-filter:blur(8px);
          transition:box-shadow 0.2s;
        }
        .l-nav.scrolled { box-shadow:0 2px 20px rgba(0,0,0,0.3); }
        .l-nav-logo {
          font-family:'Syne',sans-serif; font-size:17px; font-weight:800;
          color:var(--white); text-decoration:none; letter-spacing:0.3px;
          display:flex; align-items:center; gap:10px;
        }
        .l-nav-logo-mark {
          width:32px; height:32px; border-radius:6px;
          background:var(--red);
          display:flex; align-items:center; justify-content:center;
          font-size:15px; font-weight:800; color:#fff; font-family:'Syne',sans-serif;
        }
        .l-nav-links { display:flex; gap:28px; align-items:center; }
        .l-nav-links a {
          font-size:13px; font-weight:400; color:rgba(255,255,255,0.65);
          text-decoration:none; transition:color 0.2s; letter-spacing:0.2px;
          background:none; border:none; cursor:pointer; font-family:'Inter',sans-serif;
        }
        .l-nav-links a:hover { color:#fff; }
        .l-nav-cta {
          background:var(--red) !important; color:#fff !important;
          padding:8px 20px; border-radius:6px;
          font-size:13px !important; font-weight:600 !important;
          transition:background 0.2s, transform 0.15s !important;
        }
        .l-nav-cta:hover { background:var(--red-light) !important; transform:translateY(-1px); }

        /* HERO */
        .l-hero {
          min-height:100vh;
          background:var(--navy-dark);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding:100px 56px 80px; text-align:center;
          position:relative; overflow:hidden;
        }
        .l-hero-stripes {
          position:absolute; inset:0;
          background:repeating-linear-gradient(
            105deg, transparent, transparent 48px,
            rgba(255,255,255,0.018) 48px, rgba(255,255,255,0.018) 50px
          );
        }
        .l-hero-glow {
          position:absolute; width:700px; height:700px; border-radius:50%;
          background:radial-gradient(circle, rgba(200,50,26,0.14) 0%, transparent 70%);
          top:-200px; left:50%; transform:translateX(-50%);
        }
        .l-hero-content { position:relative; z-index:1; max-width:780px; }
        .l-eyebrow {
          display:inline-flex; align-items:center; gap:8px;
          border:1px solid rgba(255,255,255,0.15);
          color:rgba(255,255,255,0.55);
          padding:5px 16px; border-radius:4px;
          font-size:11px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase;
          margin-bottom:32px;
          animation:lFadeUp 0.5s ease both;
        }
        .l-eyebrow-dot { width:6px; height:6px; border-radius:50%; background:var(--red); animation:lPulse 2s infinite; }
        .l-h1 {
          font-family:'Syne',sans-serif;
          font-size:clamp(44px,7vw,84px);
          font-weight:800; line-height:1.0; letter-spacing:-2px;
          color:var(--white); margin-bottom:24px;
          animation:lFadeUp 0.5s 0.1s ease both;
        }
        .l-h1 em { color:var(--red); font-style:normal; }
        .l-hero-sub {
          font-size:18px; font-weight:300; color:rgba(255,255,255,0.55);
          max-width:540px; margin:0 auto 48px; line-height:1.8;
          animation:lFadeUp 0.5s 0.2s ease both;
        }
        .l-hero-sub strong { color:rgba(255,255,255,0.85); font-weight:500; }
        .l-hero-actions {
          display:flex; gap:12px; justify-content:center; flex-wrap:wrap;
          animation:lFadeUp 0.5s 0.3s ease both;
        }
        .l-btn-primary {
          display:inline-flex; align-items:center; gap:8px;
          background:var(--red); color:#fff;
          padding:13px 30px; border-radius:6px;
          font-size:14px; font-weight:600; font-family:'Inter',sans-serif;
          text-decoration:none; transition:all 0.2s; letter-spacing:0.2px;
          border:none; cursor:pointer;
        }
        .l-btn-primary:hover { background:var(--red-light); transform:translateY(-2px); }
        .l-btn-outline {
          display:inline-flex; align-items:center; gap:8px;
          background:transparent; color:rgba(255,255,255,0.75);
          padding:13px 30px; border-radius:6px;
          font-size:14px; font-weight:500; font-family:'Inter',sans-serif;
          text-decoration:none; transition:all 0.2s;
          border:1px solid rgba(255,255,255,0.2); cursor:pointer;
        }
        .l-btn-outline:hover { border-color:rgba(255,255,255,0.5); color:#fff; transform:translateY(-2px); }
        .l-hero-stats {
          display:flex; justify-content:center; margin-top:72px;
          border:1px solid rgba(255,255,255,0.1); border-radius:8px; overflow:hidden;
          animation:lFadeUp 0.5s 0.4s ease both;
        }
        .l-stat {
          padding:20px 40px; text-align:center;
          border-right:1px solid rgba(255,255,255,0.1);
        }
        .l-stat:last-child { border-right:none; }
        .l-stat-num {
          font-family:'Syne',sans-serif; font-size:32px; font-weight:800;
          color:var(--white); line-height:1;
        }
        .l-stat-num span { color:var(--red); }
        .l-stat-label { font-size:11px; color:rgba(255,255,255,0.4); margin-top:5px; text-transform:uppercase; letter-spacing:0.08em; }

        /* SHARED */
        .l-wrap { max-width:1080px; margin:0 auto; padding:0 56px; }
        .l-section-tag { font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--red); margin-bottom:14px; }
        .l-section-title {
          font-family:'Syne',sans-serif; font-size:clamp(28px,3.5vw,46px);
          font-weight:700; letter-spacing:-1px; line-height:1.1; margin-bottom:16px;
          color:var(--navy-dark);
        }
        .l-section-sub { font-size:16px; color:var(--gray-500); max-width:520px; line-height:1.7; margin-bottom:52px; }

        /* PROBLEM */
        .l-problem { background:var(--white); padding:96px 0; }
        .l-problem-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; }
        .l-problem-card {
          padding:36px 32px; background:var(--off-white); transition:background 0.2s;
        }
        .l-problem-card:first-child { border-radius:8px 0 0 8px; }
        .l-problem-card:last-child { border-radius:0 8px 8px 0; }
        .l-problem-card:hover { background:var(--gray-100); }
        .l-problem-num { font-family:'Syne',sans-serif; font-size:48px; font-weight:800; color:var(--navy); line-height:1; margin-bottom:10px; }
        .l-problem-num span { color:var(--red); }
        .l-problem-label { font-size:15px; font-weight:600; color:var(--ink); margin-bottom:10px; }
        .l-problem-desc { font-size:13px; color:var(--gray-500); line-height:1.65; }

        /* HOW */
        .l-how { background:var(--navy-dark); padding:96px 0; }
        .l-how .l-section-title { color:var(--white); }
        .l-how .l-section-sub { color:rgba(255,255,255,0.45); }
        .l-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:rgba(255,255,255,0.07); border-radius:8px; overflow:hidden; }
        .l-step { background:var(--navy-dark); padding:32px 28px; transition:background 0.2s; }
        .l-step:hover { background:rgba(255,255,255,0.04); }
        .l-step-line { width:28px; height:3px; border-radius:2px; background:var(--red); margin-bottom:22px; }
        .l-step-num { font-family:'Syne',sans-serif; font-size:11px; font-weight:700; color:rgba(255,255,255,0.2); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:12px; }
        .l-step-title { font-family:'Syne',sans-serif; font-size:16px; font-weight:700; color:#fff; margin-bottom:10px; }
        .l-step-desc { font-size:13px; color:rgba(255,255,255,0.45); line-height:1.65; }

        /* FEATURES */
        .l-features { background:var(--white); padding:96px 0; }
        .l-features-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px; }
        .l-feature-card { padding:40px 36px; background:var(--off-white); transition:background 0.2s; }
        .l-feature-card:first-child { border-radius:8px 0 0 0; }
        .l-feature-card:nth-child(2) { border-radius:0 8px 0 0; }
        .l-feature-card:nth-child(3) { border-radius:0 0 0 8px; }
        .l-feature-card:last-child { border-radius:0 0 8px 0; }
        .l-feature-card:hover { background:var(--gray-100); }
        .l-feature-card.navy { background:var(--navy); }
        .l-feature-card.navy:hover { background:var(--navy-mid); }
        .l-feature-tag { display:inline-block; font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:3px 10px; border-radius:3px; margin-bottom:18px; }
        .l-tag-red { background:rgba(200,50,26,0.1); color:var(--red); }
        .l-tag-navy { background:rgba(27,58,107,0.1); color:var(--navy); }
        .l-tag-white { background:rgba(255,255,255,0.12); color:rgba(255,255,255,0.7); }
        .l-feature-title { font-family:'Syne',sans-serif; font-size:20px; font-weight:700; margin-bottom:10px; color:var(--ink); }
        .l-feature-card.navy .l-feature-title { color:#fff; }
        .l-feature-desc { font-size:13px; color:var(--gray-500); line-height:1.7; }
        .l-feature-card.navy .l-feature-desc { color:rgba(255,255,255,0.5); }
        .l-feature-list { list-style:none; margin-top:16px; display:flex; flex-direction:column; gap:8px; }
        .l-feature-list li { font-size:13px; color:var(--gray-500); display:flex; align-items:center; gap:8px; }
        .l-feature-list li::before { content:''; width:14px; height:2px; background:var(--red); flex-shrink:0; }
        .l-feature-card.navy .l-feature-list li { color:rgba(255,255,255,0.5); }
        .l-feature-card.navy .l-feature-list li::before { background:rgba(255,255,255,0.3); }

        /* QUOTES */
        .l-quotes { background:var(--navy-dark); padding:96px 0; }
        .l-quotes .l-section-title { color:#fff; }
        .l-quotes .l-section-sub { color:rgba(255,255,255,0.4); }
        .l-quotes-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; }
        .l-quote-card { background:rgba(255,255,255,0.04); padding:32px; border-left:3px solid var(--red); transition:background 0.2s; }
        .l-quote-card:hover { background:rgba(255,255,255,0.07); }
        .l-quote-text { font-size:14px; line-height:1.75; color:rgba(255,255,255,0.7); margin-bottom:20px; font-style:italic; }
        .l-quote-author { font-size:11px; color:rgba(255,255,255,0.3); font-weight:600; letter-spacing:0.05em; text-transform:uppercase; }

        /* CTA */
        .l-cta { background:var(--red); padding:80px 0; text-align:center; }
        .l-cta-title { font-family:'Syne',sans-serif; font-size:clamp(26px,3.5vw,42px); font-weight:800; color:#fff; letter-spacing:-0.5px; margin-bottom:14px; }
        .l-cta-sub { font-size:16px; color:rgba(255,255,255,0.75); margin-bottom:36px; line-height:1.7; max-width:500px; margin-left:auto; margin-right:auto; }
        .l-btn-white {
          display:inline-flex; align-items:center; gap:8px;
          background:#fff; color:var(--red);
          padding:13px 36px; border-radius:6px;
          font-size:14px; font-weight:700; font-family:'Inter',sans-serif;
          text-decoration:none; transition:all 0.2s; letter-spacing:0.2px;
          border:none; cursor:pointer;
        }
        .l-btn-white:hover { transform:translateY(-2px); box-shadow:0 10px 30px rgba(0,0,0,0.2); }
        .l-cta-note { font-size:12px; color:rgba(255,255,255,0.5); margin-top:14px; }

        /* TECH */
        .l-tech { background:var(--off-white); padding:72px 0; }
        .l-tech-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:0; }
        .l-tech-pill { background:var(--white); border:1px solid var(--gray-200); border-radius:4px; padding:7px 16px; font-size:12px; font-weight:500; color:var(--gray-700); letter-spacing:0.1px; }

        /* FOOTER */
        .l-footer { background:var(--navy-dark); color:rgba(255,255,255,0.35); padding:40px 56px; text-align:center; font-size:12px; line-height:1.8; }
        .l-footer strong { color:rgba(255,255,255,0.65); font-weight:500; }
        .l-footer a { color:rgba(255,255,255,0.45); text-decoration:none; }
        .l-footer a:hover { color:rgba(255,255,255,0.7); }
        .l-footer-divider { width:40px; height:2px; background:var(--red); margin:20px auto; border-radius:2px; }

        /* REVEAL ANIMATION */
        .l-reveal { opacity:0; transform:translateY(24px); transition:opacity 0.55s ease, transform 0.55s ease; }
        .l-visible { opacity:1; transform:translateY(0); }

        @keyframes lFadeUp { from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);} }
        @keyframes lPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }

        /* RESPONSIVE */
        @media(max-width:768px){
          .l-nav { padding:0 20px; }
          .l-nav-links { display:none; }
          .l-hero, .l-wrap { padding-left:24px; padding-right:24px; }
          .l-h1 { letter-spacing:-1.5px; }
          .l-hero-stats { flex-direction:column; border:none; gap:1px; }
          .l-stat { border-right:none; border-bottom:1px solid rgba(255,255,255,0.1); }
          .l-stat:last-child { border-bottom:none; }
          .l-problem-grid, .l-steps, .l-features-grid, .l-quotes-grid { grid-template-columns:1fr; }
          .l-problem-card, .l-feature-card { border-radius:6px !important; }
          .l-cta { padding:60px 24px; }
          .l-footer { padding:32px 20px; }
        }
      `}</style>

      <div className="l-page">

        {/* NAV */}
        <nav className={`l-nav${scrolled ? " scrolled" : ""}`}>
          <div className="l-nav-logo">
            <div className="l-nav-logo-mark">U</div>
            UniAdvisor
          </div>
          <div className="l-nav-links">
            <a href="#problem">Research</a>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <button className="l-nav-cta" onClick={onEnter}>Open App</button>
          </div>
        </nav>

        {/* HERO */}
        <section className="l-hero">
          <div className="l-hero-stripes" />
          <div className="l-hero-glow" />
          <div className="l-hero-content">
            <div className="l-eyebrow">
              <span className="l-eyebrow-dot" />
              Live · Dunaújváros Egyetem · TDK Conference May 2025
            </div>
            <h1 className="l-h1">
              Every answer.<br /><em>In English.</em><br />Instantly.
            </h1>
            <p className="l-hero-sub">
              International students shouldn't spend hours searching for information that{" "}
              <strong>exists but is buried, untranslated, and invisible.</strong>{" "}
              UniAdvisor AI changes that.
            </p>
            <div className="l-hero-actions">
              <button className="l-btn-primary" onClick={onEnter}>Open the app →</button>
              <button className="l-btn-outline" onClick={() => document.getElementById("l-problem")?.scrollIntoView({ behavior:"smooth" })}>
                Learn more
              </button>
            </div>
            <div className="l-hero-stats">
              {[
                { num: "21", sup: "+", label: "Survey responses" },
                { num: "<3", sup: "s",  label: "Response time" },
                { num: "10", sup: "+",  label: "Nationalities reached" },
                { num: "24", sup: "/7", label: "Always available" },
              ].map(s => (
                <div className="l-stat" key={s.label}>
                  <div className="l-stat-num">{s.num}<span>{s.sup}</span></div>
                  <div className="l-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section className="l-problem" id="l-problem">
          <div className="l-wrap">
            <div className="l-section-tag l-reveal" ref={el => revealRefs.current.push(el)}>The documented problem</div>
            <h2 className="l-section-title l-reveal" ref={el => revealRefs.current.push(el)}>
              The information exists.<br />Students just cannot find it.
            </h2>
            <p className="l-section-sub l-reveal" ref={el => revealRefs.current.push(el)}>
              A survey of 21 international students at Dunaújváros Egyetem identified clear, systematic
              failures in information access — with real consequences for student wellbeing and academic performance.
            </p>
            <div className="l-problem-grid l-reveal" ref={el => revealRefs.current.push(el)}>
              {[
                { num: "52", sup: "%", label: "Language barrier as primary confusion source", desc: "Over half of respondents cited Hungarian-only forms, official letters, and Neptun messages as their biggest source of confusion on arrival." },
                { num: "43", sup: "%", label: "Could not find the right office", desc: "Students did not know which office handled which problem — and were frequently redirected between departments without a resolution." },
                { num: "38", sup: "%", label: "Banking and administrative failures", desc: '"The international office had no solution." Students resolved critical administrative problems through peer networks, not institutional support.' },
              ].map((c, i) => (
                <div className={`l-problem-card`} key={i}>
                  <div className="l-problem-num">{c.num}<span>{c.sup}</span></div>
                  <div className="l-problem-label">{c.label}</div>
                  <div className="l-problem-desc">{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW */}
        <section className="l-how" id="how">
          <div className="l-wrap">
            <div className="l-section-tag l-reveal" ref={el => revealRefs.current.push(el)} style={{ color:"#E06050" }}>System architecture</div>
            <h2 className="l-section-title l-reveal" ref={el => revealRefs.current.push(el)}>
              Retrieval-Augmented Generation<br />built for this context.
            </h2>
            <p className="l-section-sub l-reveal" ref={el => revealRefs.current.push(el)}>
              Not a generic chatbot. A university-specific information engine built on BM25 retrieval over a curated
              knowledge base of institutional documents, powered by Llama 3 via the Groq API.
            </p>
            <div className="l-steps l-reveal" ref={el => revealRefs.current.push(el)}>
              {[
                { num: "Step 01", title: "Student query", desc: "Any question in English or Hungarian — about Neptun, deadlines, scholarships, visas, fees, or any administrative process." },
                { num: "Step 02", title: "Office routing", desc: "A keyword classifier detects which of ten university offices is relevant and filters the knowledge base accordingly before retrieval begins." },
                { num: "Step 03", title: "BM25 retrieval", desc: "The top matching document chunks are retrieved in milliseconds. No embeddings, no GPU — fully deployable on free-tier infrastructure." },
                { num: "Step 04", title: "Grounded answer", desc: "Llama 3 generates a precise, source-attributed response locked to the student's chosen language. The model cannot switch languages regardless of query content." },
              ].map(s => (
                <div className="l-step" key={s.num}>
                  <div className="l-step-line" />
                  <div className="l-step-num">{s.num}</div>
                  <div className="l-step-title">{s.title}</div>
                  <div className="l-step-desc">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="l-features" id="features">
          <div className="l-wrap">
            <div className="l-section-tag l-reveal" ref={el => revealRefs.current.push(el)}>What is built</div>
            <h2 className="l-section-title l-reveal" ref={el => revealRefs.current.push(el)}>
              Three portals.<br />One integrated system.
            </h2>
            <p className="l-section-sub l-reveal" ref={el => revealRefs.current.push(el)}>
              UniAdvisor is not just a chat interface — it is a full platform with distinct roles
              for students, academic staff, and administrators.
            </p>
            <div className="l-features-grid l-reveal" ref={el => revealRefs.current.push(el)}>
              <div className="l-feature-card navy">
                <div className="l-feature-tag l-tag-white">Student portal</div>
                <div className="l-feature-title">Conversational AI advisor</div>
                <div className="l-feature-desc">24/7 access to accurate, sourced answers about university procedures without requiring Hungarian language proficiency.</div>
                <ul className="l-feature-list">
                  <li>English and Hungarian language lock</li>
                  <li>10 office categories auto-detected</li>
                  <li>Conversation history and follow-up suggestions</li>
                  <li>Escalation to human advisor</li>
                  <li>Thumbs up/down feedback on every response</li>
                </ul>
              </div>
              <div className="l-feature-card">
                <div className="l-feature-tag l-tag-navy">Admin command centre</div>
                <div className="l-feature-title">Analytics and oversight</div>
                <div className="l-feature-desc">Real-time visibility into student information needs, satisfaction scores, escalation management, and document knowledge base.</div>
                <ul className="l-feature-list">
                  <li>Per-office question volume and ratings</li>
                  <li>Survey results and research data dashboard</li>
                  <li>Document upload and knowledge base management</li>
                  <li>Full audit log of all staff actions</li>
                </ul>
              </div>
              <div className="l-feature-card">
                <div className="l-feature-tag l-tag-red">Staff portal</div>
                <div className="l-feature-title">Communication tools</div>
                <div className="l-feature-desc">Publishing interface for announcements, live student activity monitoring, and direct student messaging.</div>
                <ul className="l-feature-list">
                  <li>Scheduled and urgent announcements</li>
                  <li>Live activity feed</li>
                  <li>Student directory with nationality data</li>
                </ul>
              </div>
              <div className="l-feature-card">
                <div className="l-feature-tag l-tag-navy">International focus</div>
                <div className="l-feature-title">Built for the underserved cohort</div>
                <div className="l-feature-desc">Every feature is designed for students arriving without Hungarian language skills or prior institutional knowledge.</div>
                <ul className="l-feature-list">
                  <li>Visa and residence permit guidance</li>
                  <li>Stipendium Hungaricum information</li>
                  <li>Neptun step-by-step guide in English</li>
                  <li>Pre-arrival checklist</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* QUOTES */}
        <section className="l-quotes">
          <div className="l-wrap">
            <div className="l-section-tag l-reveal" ref={el => revealRefs.current.push(el)} style={{ color:"#E06050" }}>Primary research — student voices</div>
            <h2 className="l-section-title l-reveal" ref={el => revealRefs.current.push(el)}>
              Their words.<br />The motivation for this project.
            </h2>
            <p className="l-section-sub l-reveal" ref={el => revealRefs.current.push(el)}>
              Direct verbatim responses from the international student survey. These accounts document
              the real cost of poor information access.
            </p>
            <div className="l-quotes-grid l-reveal" ref={el => revealRefs.current.push(el)}>
              {[
                { text: '"The international office failed to give me my insurance for an entire year. The residence permit checklist requires much more detail."', author: "Tunisia · Communication and Media · Year 3" },
                { text: '"How hard it was to open a Hungarian bank account. Due to sanctions every bank refused and only the Russian student community helped — the international office had no solution."', author: "Russia · Communication and Media · Year 1" },
                { text: '"The registration on Neptun and Moodle — nobody explained how it worked and I had to figure everything out myself."', author: "Nigeria · Computer Science Engineering · Year 2" },
              ].map((q, i) => (
                <div className="l-quote-card" key={i}>
                  <div className="l-quote-text">{q.text}</div>
                  <div className="l-quote-author">{q.author}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="l-cta">
          <div className="l-wrap">
            <h2 className="l-cta-title l-reveal" ref={el => revealRefs.current.push(el)}>
              Are you an international student at UoD?
            </h2>
            <p className="l-cta-sub l-reveal" ref={el => revealRefs.current.push(el)}>
              3 minutes. Completely anonymous. Your response contributes to ongoing research and
              directly improves UniAdvisor for every student who follows.
            </p>
            <button className="l-btn-white l-reveal" ref={el => revealRefs.current.push(el)} onClick={onEnter}>
              Open UniAdvisor →
            </button>
            <p className="l-cta-note">21 students have responded · No login required for the survey</p>
          </div>
        </section>

        {/* TECH */}
        <section className="l-tech">
          <div className="l-wrap">
            <div className="l-section-tag l-reveal" ref={el => revealRefs.current.push(el)}>Technical foundation</div>
            <h2 className="l-section-title l-reveal" ref={el => revealRefs.current.push(el)} style={{ fontSize:24 }}>
              Open-source stack. Zero operating cost.<br />Fully replicable by any similar institution.
            </h2>
            <p className="l-section-sub l-reveal" ref={el => revealRefs.current.push(el)} style={{ marginBottom:28 }}>
              Every component runs on free-tier infrastructure. The methodology is documented and
              transferable to universities across Central and Eastern Europe.
            </p>
            <div className="l-tech-row l-reveal" ref={el => revealRefs.current.push(el)}>
              {["Python 3.11","FastAPI","React 18 + Vite","Groq API","Llama 3 (8B + 70B)","BM25 retrieval","Supabase / PostgreSQL","JWT authentication","RAG pipeline","pypdf","python-docx","Render (free tier)"].map(t => (
                <div className="l-tech-pill" key={t}>{t}</div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="l-footer">
          <div className="l-footer-divider" />
          <p><strong>UniAdvisor AI</strong> · BSc Computer Science Engineering · TDK Research Project</p>
          <p style={{ marginTop:6 }}><strong>Dunaújváros Egyetem</strong> · Student: <strong>John Jerry Gordon-Mensah</strong> · Supervisor: <strong>Dr. Váraljai Mariann</strong></p>
          <p style={{ marginTop:6 }}>TDK Conference: <strong>May 13, 2025</strong> · Registration deadline: <strong>April 24, 2025</strong></p>
          <p style={{ marginTop:16 }}>
            <button onClick={onEnter} style={{ background:"none",border:"none",color:"rgba(255,255,255,0.45)",cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif" }}>Open app</button>
            {" · "}
            <a href="https://www.uniduna.hu/en/" target="_blank" rel="noopener noreferrer">University website</a>
          </p>
        </footer>

      </div>
    </>
  );
}