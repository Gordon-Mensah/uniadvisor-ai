// CampusMapPanel.jsx — Dunaújváros Egyetem Campus Map
// Features: Real campus map image, live GPS location, Google Maps directions,
//           clickable building overlays, search, bilingual EN/HU

import { useState, useRef } from "react";

// ── Buildings positioned as % of the official campus map image ──
// Calibrated against campus_terkep_ENG.png building positions
const BUILDINGS = [
  { id:"F",  label:"F",  name:"Main Building",                   hu:"Főépület",                       icon:"🏛️", color:"#E53E3E", x:54, y:42, w:7,  h:8,
    room:"Main Building, Ground Floor",        hours:"Mon–Fri 8:00–16:00",              dept:"Rector's Office / Administration",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem+Főépület,+Táncsics+Mihály+u.+1/a,+Dunaújváros" },
  { id:"M1", label:"M₁", name:"Technical Wing 1",                hu:"Műszaki szárny 1",               icon:"⚙️", color:"#DD6B20", x:47, y:38, w:6,  h:6,
    room:"Technical Wing 1",                   hours:"Mon–Fri 8:00–17:00",              dept:"Engineering Faculty – M₁",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem,+Táncsics+Mihály+u.+1/a,+Dunaújváros" },
  { id:"M2", label:"M₂", name:"Technical Wing 2",                hu:"Műszaki szárny 2",               icon:"⚙️", color:"#D69E2E", x:41, y:40, w:6,  h:7,
    room:"Technical Wing 2",                   hours:"Mon–Fri 8:00–17:00",              dept:"Engineering Faculty – M₂",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem,+Táncsics+Mihály+u.+1/a,+Dunaújváros" },
  { id:"I",  label:"I",  name:"IT Building",                     hu:"IT épület",                      icon:"💻", color:"#38A169", x:61, y:38, w:5,  h:7,
    room:"IT Building, 2nd Floor, Room 201",   hours:"Mon–Fri 8:00–16:00",              dept:"IT Helpdesk & Computer Labs",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem+IT+épület,+Dunaújváros" },
  { id:"A",  label:"A",  name:'Building "A" — Study Office',     hu:"A épület — Tanulmányi Iroda",    icon:"📚", color:"#3182CE", x:62, y:55, w:8,  h:8,
    room:"A épület, 1.em. 103.",               hours:"Mon–Thu 9:00–13:00, Fri 9:00–11:00", dept:"Study Office (Tanulmányi Iroda) · Finance",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem+A+épület,+Táncsics+Mihály+u.+1/a,+Dunaújváros" },
  { id:"B",  label:"B",  name:'Building "B" — IRO',              hu:"B épület — Nemzetközi Iroda",    icon:"🌍", color:"#805AD5", x:38, y:44, w:6,  h:6,
    room:"B épület, Ground Floor 002",         hours:"Mon–Fri 9:00–15:00",              dept:"International Relations Office (IRO)",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem+B+épület,+Dunaújváros" },
  { id:"G",  label:"G",  name:"Mechanical Laboratories",         hu:"Gépészeti laborok",              icon:"🔬", color:"#00B5D8", x:30, y:48, w:6,  h:6,
    room:"G Building",                         hours:"Mon–Fri 8:00–16:00",              dept:"Mechanical Laboratories",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem,+Táncsics+Mihály+u.+1/a,+Dunaújváros" },
  { id:"E",  label:"É",  name:"Campus Restaurant",               hu:"Étterem / Menza",                icon:"🍽️", color:"#F6AD55", x:46, y:46, w:6,  h:5,
    room:"Campus Centre",                      hours:"Mon–Fri 11:00–14:00",             dept:"Campus Restaurant / Mensa",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem+Étterem,+Dunaújváros" },
  { id:"C1", label:"C₁", name:"Environmental Labs",              hu:"Környezeti labor",               icon:"🧪", color:"#68D391", x:24, y:58, w:6,  h:6,
    room:"C₁ Building",                        hours:"Mon–Fri 8:00–16:00",              dept:"Environmental Laboratories",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem,+Táncsics+Mihály+u.+1/a,+Dunaújváros" },
  { id:"C3", label:"C₃", name:"János Déri Media Center",        hu:"Média Központ / Rádió 24",       icon:"📻", color:"#76E4F7", x:27, y:65, w:6,  h:6,
    room:"C₃ Building",                        hours:"Mon–Fri 9:00–17:00",              dept:"János Déri Media Center / Rádió 24",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem,+Táncsics+Mihály+u.+1/a,+Dunaújváros" },
  { id:"P",  label:"P",  name:"Laboratories & Covered Parking", hu:"Labor és fedett parkoló",        icon:"🅿️", color:"#FC8181", x:34, y:60, w:8,  h:10,
    room:"P Building / Underground",           hours:"Mon–Fri 7:00–20:00",              dept:"Laboratories & Covered Parking",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem,+Táncsics+Mihály+u.+1/a,+Dunaújváros" },
  { id:"K1", label:"K₁", name:"Kerpely Antal College — No.33",  hu:"Kollégium — Dózsa Gy. u. 33",   icon:"🏠", color:"#F687B3", x:24, y:32, w:7,  h:6,
    room:"Dózsa György út 33.",                hours:"24/7",                            dept:"Student Dormitory K₁",
    gmaps:"https://maps.google.com/?q=Kerpely+Antal+Kollégium,+Dózsa+György+út+33,+Dunaújváros" },
  { id:"K2", label:"K₂", name:"Kerpely Antal College — No.35",  hu:"Kollégium — Dózsa Gy. u. 35",   icon:"🏠", color:"#F687B3", x:31, y:26, w:7,  h:6,
    room:"Dózsa György út 35.",                hours:"24/7",                            dept:"Student Dormitory K₂",
    gmaps:"https://maps.google.com/?q=Dózsa+György+út+35,+Dunaújváros" },
  { id:"K3", label:"K₃", name:"Kerpely Antal College — No.37",  hu:"Kollégium — Dózsa Gy. u. 37",   icon:"🏠", color:"#F687B3", x:39, y:22, w:7,  h:6,
    room:"Dózsa György út 37.",                hours:"24/7",                            dept:"Student Dormitory K₃",
    gmaps:"https://maps.google.com/?q=Dózsa+György+út+37,+Dunaújváros" },
  { id:"S",  label:"S",  name:"Kádár Valley Sports Center",     hu:"Kádár-völgy Sportközpont",      icon:"⚽", color:"#48BB78", x:10, y:40, w:10, h:10,
    room:"Kádár-völgy Sports Area",            hours:"Mon–Fri 7:00–21:00, Sat 8:00–18:00", dept:"Sports Center",
    gmaps:"https://maps.google.com/?q=Kádár-völgy+Sportközpont,+Dunaújváros" },
  { id:"SZ", label:"SZ", name:"Leisure Center — Campus Club",   hu:"Szabadidőközpont",              icon:"🎉", color:"#9AE6B4", x:46, y:25, w:7,  h:6,
    room:"Campus Club Building",               hours:"Mon–Fri 10:00–22:00",             dept:"Leisure Center — Campus Club",
    gmaps:"https://maps.google.com/?q=Dunaújvárosi+Egyetem+Campus+Club,+Dunaújváros" },
];

// Campus GPS centre
const CAMPUS_LAT = 46.9635;
const CAMPUS_LNG = 18.9355;

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

export default function CampusMapPanel({ C, uiLang, onClose }) {
  const [selected,  setSelected]  = useState(null);
  const [hovered,   setHovered]   = useState(null);
  const [search,    setSearch]    = useState("");
  const [userPos,   setUserPos]   = useState(null);
  const [locating,  setLocating]  = useState(false);
  const [locError,  setLocError]  = useState("");

  const filtered     = search.trim()
    ? BUILDINGS.filter(b =>
        [b.name, b.hu, b.label, b.dept, b.room]
          .some(s => s.toLowerCase().includes(search.toLowerCase()))
      )
    : BUILDINGS;
  const highlightIds = new Set(filtered.map(b => b.id));

  const distToCampus = userPos
    ? haversineMetres(userPos.lat, userPos.lng, CAMPUS_LAT, CAMPUS_LNG)
    : null;

  const getLocation = () => {
    if (!navigator.geolocation) { setLocError("Geolocation not supported."); return; }
    setLocating(true); setLocError("");
    navigator.geolocation.getCurrentPosition(
      pos => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }); setLocating(false); },
      ()   => { setLocError(uiLang==="hu" ? "Helyszín hozzáférés megtagadva." : "Location access denied. Please allow in browser settings."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const directionsUrl = (b) => userPos
    ? `https://www.google.com/maps/dir/${userPos.lat},${userPos.lng}/${encodeURIComponent(b.dept + ', Dunaújváros')}`
    : b.gmaps;

  const appleMapsUrl = (b) =>
    `https://maps.apple.com/?daddr=${encodeURIComponent(b.dept + ', Dunaújváros, Hungary')}${userPos ? `&saddr=${userPos.lat},${userPos.lng}` : ""}`;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:2000,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif" }}>

      <div style={{ background:C.surface, borderRadius:22, width:"min(980px,97vw)",
        maxHeight:"93vh", display:"flex", flexDirection:"column", overflow:"hidden",
        boxShadow:"0 32px 90px rgba(0,0,0,0.6)", border:`1px solid ${C.border}` }}>

        {/* Header */}
        <div style={{ padding:"13px 18px", borderBottom:`1px solid ${C.border}`,
          display:"flex", alignItems:"center", gap:10, flexShrink:0, flexWrap:"wrap" }}>

          <div style={{ flex:1, minWidth:140 }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.text }}>
              🗺️ {uiLang==="hu" ? "Kampusz Térkép" : "Campus Map"}
            </div>
            <div style={{ fontSize:10, color:C.muted }}>Dunaújváros Egyetem · Táncsics Mihály u. 1/a</div>
          </div>

          <input value={search} onChange={e=>{ setSearch(e.target.value); setSelected(null); }}
            placeholder={uiLang==="hu" ? "Épület keresése…" : "Search building…"}
            style={{ padding:"7px 12px", borderRadius:10, border:`1px solid ${C.border}`,
              background:C.bg, color:C.text, fontSize:12, outline:"none",
              width:160, fontFamily:"inherit" }} />

          <button onClick={getLocation} disabled={locating}
            style={{ padding:"7px 13px", borderRadius:10,
              border:`1px solid ${userPos ? "#38A169" : C.border}`,
              background: userPos ? "#38A16915" : "transparent",
              color: userPos ? "#38A169" : C.muted,
              fontSize:12, fontWeight:600, cursor: locating ? "wait" : "pointer",
              fontFamily:"inherit", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
            {locating ? "⏳" : "📍"}
            {locating
              ? (uiLang==="hu" ? "Keresés…" : "Locating…")
              : userPos
                ? `${distToCampus}m ${uiLang==="hu" ? "tőled" : "away"}`
                : (uiLang==="hu" ? "Helyzetem" : "My Location")}
          </button>

          <button onClick={onClose}
            style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:10,
              width:32, height:32, fontSize:18, cursor:"pointer", color:C.muted,
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
        </div>

        {locError && (
          <div style={{ padding:"7px 18px", background:"#FEF2F2", borderBottom:"1px solid #FECACA",
            fontSize:12, color:"#DC2626", flexShrink:0 }}>⚠️ {locError}</div>
        )}

        {/* Body */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", minHeight:0 }}>

          {/* Map */}
          <div style={{ flex:"0 0 auto", overflowY:"auto", padding:12, background:C.bg }}>
            <div style={{ position:"relative", display:"inline-block", width:"min(560px,57vw)" }}>

              {/* Official campus map image */}
              <img
                src="https://www.uniduna.hu/images/documentsfordownload/campus_terkep_ENG.png"
                alt="Dunaújváros Egyetem Campus Map"
                style={{ width:"100%", height:"auto", display:"block", borderRadius:14,
                  border:`1px solid ${C.border}`,
                  filter: C.bg==="0F172A" ? "brightness(0.85)" : "none" }}
              />

              {/* Clickable building overlays */}
              {BUILDINGS.map(b => {
                const isSel  = selected?.id === b.id;
                const isHov  = hovered    === b.id;
                const isDim  = search.trim() && !highlightIds.has(b.id);
                return (
                  <div key={b.id}
                    onClick={() => setSelected(isSel ? null : b)}
                    onMouseEnter={() => setHovered(b.id)}
                    onMouseLeave={() => setHovered(null)}
                    title={b.name}
                    style={{
                      position:"absolute",
                      left:`${b.x}%`, top:`${b.y}%`,
                      width:`${b.w}%`, height:`${b.h}%`,
                      background: isDim ? "transparent" : isSel ? `${b.color}50` : isHov ? `${b.color}30` : `${b.color}15`,
                      border: isDim ? "1px solid transparent"
                        : isSel ? `2.5px solid ${b.color}`
                        : isHov ? `1.5px solid ${b.color}88`
                        : `1px solid ${b.color}40`,
                      borderRadius:4, cursor:"pointer", transition:"all 0.15s",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      opacity: isDim ? 0.1 : 1,
                      boxShadow: isSel ? `0 0 0 3px ${b.color}33, 0 4px 14px ${b.color}40` : "none",
                    }}>
                    {(isHov || isSel) && (
                      <span style={{ background:b.color, color:"#fff",
                        fontSize:"clamp(6px,1.1vw,10px)", fontWeight:800,
                        padding:"1px 5px", borderRadius:4, pointerEvents:"none",
                        whiteSpace:"nowrap", boxShadow:"0 2px 6px rgba(0,0,0,0.4)",
                        maxWidth:"90%", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {b.label}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Live location dot — shown at approximate user position on map */}
              {userPos && (
                <div style={{ position:"absolute", left:"50%", top:"50%",
                  transform:"translate(-50%,-50%)", pointerEvents:"none" }}>
                  <div style={{ width:14, height:14, borderRadius:"50%", background:"#3B82F6",
                    border:"2.5px solid #fff",
                    boxShadow:"0 0 0 7px rgba(59,130,246,0.2), 0 2px 8px rgba(0,0,0,0.3)",
                    animation:"livepulse 2s infinite" }}/>
                </div>
              )}
            </div>

            {/* Legend */}
            <div style={{ marginTop:9, display:"flex", gap:8, flexWrap:"wrap", paddingLeft:2 }}>
              {[
                {color:"#3182CE", label:uiLang==="hu"?"Tanulmányi":"Academic"},
                {color:"#F687B3", label:uiLang==="hu"?"Kollégium":"Dorms"},
                {color:"#48BB78", label:uiLang==="hu"?"Sport":"Sports"},
                {color:"#F6AD55", label:uiLang==="hu"?"Étkezés":"Dining"},
                {color:"#FC8181", label:uiLang==="hu"?"Labor":"Labs"},
              ].map(l=>(
                <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:9, height:9, borderRadius:2, background:l.color }}/>
                  <span style={{ fontSize:10, color:C.muted }}>{l.label}</span>
                </div>
              ))}
              <span style={{ marginLeft:"auto", fontSize:10, color:C.muted }}>
                {uiLang==="hu" ? "Kattints egy épületre" : "Click a building"}
              </span>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ flex:1, display:"flex", flexDirection:"column",
            borderLeft:`1px solid ${C.border}`, minWidth:0, overflow:"hidden" }}>

            {selected ? (
              <div style={{ flex:1, overflowY:"auto", padding:18 }}>
                <button onClick={()=>setSelected(null)}
                  style={{ background:"transparent", border:`1px solid ${C.border}`,
                    borderRadius:8, padding:"4px 12px", color:C.muted,
                    fontSize:12, cursor:"pointer", fontFamily:"inherit", marginBottom:14 }}>
                  ← {uiLang==="hu" ? "Vissza" : "Back"}
                </button>

                <div style={{ background:`${selected.color}12`, border:`2px solid ${selected.color}44`,
                  borderRadius:16, padding:16, marginBottom:14 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{selected.icon}</div>
                  <div style={{ fontSize:11, fontWeight:800, color:selected.color,
                    textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:4 }}>
                    {uiLang==="hu" ? "Épület" : "Building"} {selected.label}
                  </div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text, lineHeight:1.3, marginBottom:4 }}>
                    {selected.dept}
                  </div>
                  <div style={{ fontSize:12, color:C.muted }}>
                    {uiLang==="hu" ? selected.hu : selected.name}
                  </div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                  {[
                    { icon:"📍", label: uiLang==="hu"?"Helyszín":"Location", val: selected.room },
                    { icon:"🕐", label: uiLang==="hu"?"Nyitvatartás":"Hours", val: selected.hours },
                  ].map(row => (
                    <div key={row.label} style={{ background:C.bg, borderRadius:10,
                      padding:"10px 14px", border:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>{row.icon} {row.label}</div>
                      <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{row.val}</div>
                    </div>
                  ))}
                </div>

                {/* Distance badge */}
                {userPos && distToCampus !== null && (
                  <div style={{ background:`${C.accent||"#0D9488"}10`,
                    border:`1px solid ${C.accent||"#0D9488"}30`,
                    borderRadius:10, padding:"10px 14px", marginBottom:14,
                    display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:"#3B82F6",
                      boxShadow:"0 0 0 4px rgba(59,130,246,0.25)", flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text }}>
                        {uiLang==="hu" ? "Kampusztól" : "From campus centre"}:
                        {" "}<span style={{ color:"#3B82F6" }}>{distToCampus}m</span>
                        {" "}·{" "}
                        <span style={{ color:C.muted, fontWeight:400, fontSize:12 }}>
                          ~{Math.max(1, Math.round(distToCampus/80))} {uiLang==="hu"?"perc gyalog":"min walk"}
                        </span>
                      </div>
                      <div style={{ fontSize:10, color:C.muted }}>±{userPos.accuracy}m accuracy</div>
                    </div>
                  </div>
                )}

                {/* Direction buttons */}
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <a href={directionsUrl(selected)} target="_blank" rel="noopener noreferrer"
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      padding:"12px 16px", borderRadius:12, background:"#4285F4",
                      color:"#fff", fontSize:13, fontWeight:700, textDecoration:"none",
                      boxShadow:"0 4px 12px rgba(66,133,244,0.35)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
                    </svg>
                    {userPos
                      ? (uiLang==="hu" ? "Útvonal (Google Maps)" : "Get Directions — Google Maps")
                      : (uiLang==="hu" ? "Megnyitás Google Maps-en" : "Open in Google Maps")}
                  </a>

                  <a href={appleMapsUrl(selected)} target="_blank" rel="noopener noreferrer"
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      padding:"12px 16px", borderRadius:12,
                      background:"transparent", border:`1px solid ${C.border}`,
                      color:C.text2, fontSize:13, fontWeight:600, textDecoration:"none" }}>
                    🍎 {uiLang==="hu" ? "Útvonal (Apple Maps)" : "Get Directions — Apple Maps"}
                  </a>

                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Dunaújvárosi Egyetem Táncsics Mihály u. 1/a Dunaújváros")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      padding:"12px 16px", borderRadius:12,
                      background:"transparent", border:`1px solid ${C.border}`,
                      color:C.text2, fontSize:13, fontWeight:600, textDecoration:"none" }}>
                    🏫 {uiLang==="hu" ? "Teljes kampusz térképen" : "View Full Campus on Maps"}
                  </a>
                </div>
              </div>

            ) : (
              <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
                  letterSpacing:"1px", marginBottom:8, paddingLeft:2 }}>
                  {uiLang==="hu" ? "Összes épület" : "All Buildings"} ({filtered.length})
                </div>
                {filtered.map(b => (
                  <div key={b.id} onClick={()=>setSelected(b)}
                    onMouseEnter={()=>setHovered(b.id)}
                    onMouseLeave={()=>setHovered(null)}
                    style={{ display:"flex", gap:10, padding:"9px 10px", borderRadius:10,
                      border:`1px solid ${hovered===b.id ? b.color+"77" : C.border}`,
                      background: hovered===b.id ? `${b.color}08` : C.bg,
                      marginBottom:5, cursor:"pointer", transition:"all 0.15s", alignItems:"center" }}>
                    <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
                      background:`${b.color}22`, border:`1.5px solid ${b.color}66`,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
                      {b.icon}
                    </div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.text,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        <span style={{ color:b.color, fontWeight:800 }}>{b.label}</span>
                        {" · "}{b.dept.split("·")[0].trim()}
                      </div>
                      <div style={{ fontSize:10, color:C.muted }}>{b.room}</div>
                    </div>
                    <div style={{ color:C.muted, fontSize:14, flexShrink:0 }}>›</div>
                  </div>
                ))}
              </div>
            )}

            {/* Status footer */}
            <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`,
              flexShrink:0, display:"flex", alignItems:"center", gap:8 }}>
              {userPos ? (
                <>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:"#38A169",
                    boxShadow:"0 0 0 3px rgba(56,161,105,0.25)", animation:"livepulse 2s infinite", flexShrink:0 }}/>
                  <span style={{ fontSize:11, color:"#38A169", fontWeight:600 }}>
                    {uiLang==="hu" ? "GPS aktív" : "GPS active"}
                  </span>
                  <span style={{ fontSize:10, color:C.muted }}>
                    · ±{userPos.accuracy}m · {distToCampus}m {uiLang==="hu" ? "a kampusztól" : "from campus"}
                  </span>
                </>
              ) : (
                <>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:C.border, flexShrink:0 }}/>
                  <span style={{ fontSize:11, color:C.muted }}>
                    {uiLang==="hu"
                      ? "Kapcsold be a helyzet meghatározást az útvonaltervezéshez"
                      : "Enable location for live turn-by-turn directions"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes livepulse { 0%,100%{opacity:1;box-shadow:0 0 0 7px rgba(59,130,246,0.2);} 50%{opacity:0.7;box-shadow:0 0 0 12px rgba(59,130,246,0.05);} }
      `}</style>
    </div>
  );
}