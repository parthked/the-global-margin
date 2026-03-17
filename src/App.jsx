import { useState, useEffect, useRef, useCallback } from "react";

const REGIONS = [
  { id: "all", label: "All Regions" }, { id: "europe", label: "Europe" },
  { id: "asia", label: "Asia-Pacific" }, { id: "americas", label: "Americas" },
  { id: "middleeast", label: "Middle East" }, { id: "africa", label: "Africa" },
];
const TOPICS = [
  { id: "all", label: "All" }, { id: "conflict", label: "Conflict & Security" },
  { id: "diplomacy", label: "Diplomacy" }, { id: "trade", label: "Trade & Sanctions" },
  { id: "elections", label: "Elections" }, { id: "climate", label: "Climate Policy" },
];

function useFonts() {
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return; loaded.current = true;
    const link = document.createElement("link"); link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,500;8..60,600&family=DM+Sans:wght@300;400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);
}

export default function App() {
  useFonts();
  const [articles, setArticles] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [region, setRegion] = useState("all");
  const [topic, setTopic] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [voiceGender, setVoiceGender] = useState("female");
  const [lastFetched, setLastFetched] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const didFetch = useRef(false);
  const speakingRef = useRef(null);
  useEffect(() => { speakingRef.current = speakingId; }, [speakingId]);

  const fetchNews = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true); else setPhase("loading");
    setErrorMsg("");
    try {
      const r = await fetch("/api/news", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!r.ok) { let m = "Error " + r.status; try { const e = await r.json(); if (e?.error) m = e.error; } catch (_) {} throw new Error(m); }
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      if (!data.articles?.length) throw new Error("No articles found.");
      setArticles(data.articles); setLastFetched(new Date()); setPhase("ready");
    } catch (err) {
      setErrorMsg(String(err.message || err));
      if (articles.length === 0) setPhase("error"); else setPhase("ready");
    } finally { setRefreshing(false); }
  }, [articles.length]);

  useEffect(() => { if (!didFetch.current) { didFetch.current = true; fetchNews(false); } }, [fetchNews]);

  const filtered = articles.filter(a => {
    if (region !== "all") { const rl = (REGIONS.find(r => r.id === region)?.label || "").toLowerCase().replace(/[\s-]/g, ""); const ar = (a.region || "").toLowerCase().replace(/[\s-]/g, ""); if (!ar.includes(rl) && !rl.includes(ar)) return false; }
    if (topic !== "all") { const tl = (TOPICS.find(t => t.id === topic)?.label || "").toLowerCase(); const at = (a.topic || "").toLowerCase(); if (!at.includes(tl) && !tl.includes(at)) return false; }
    return true;
  });

  const stopSpeaking = useCallback(() => { try { window.speechSynthesis?.cancel(); } catch (_) {} setSpeakingId(null); }, []);
  const speak = useCallback((article) => {
    const synth = window.speechSynthesis; if (!synth) return;
    if (speakingRef.current === article.id) { stopSpeaking(); return; }
    synth.cancel();
    const text = article.headline + ". " + (article.body || article.summary || "").replace(/\n+/g, ". ");
    const utter = new SpeechSynthesisUtterance(text); utter.rate = 0.92; utter.pitch = voiceGender === "female" ? 1.05 : 0.85;
    const voices = synth.getVoices(); const en = voices.filter(v => v.lang.startsWith("en"));
    let v; if (voiceGender === "female") v = en.find(x => /samantha|victoria|karen|fiona|tessa|zira|hazel/i.test(x.name)) || en[0];
    else v = en.find(x => /daniel|david|james|mark|alex|george|fred/i.test(x.name)) || en[1] || en[0];
    if (v) utter.voice = v;
    utter.onend = () => setSpeakingId(null); utter.onerror = () => setSpeakingId(null);
    setSpeakingId(article.id); synth.speak(utter);
  }, [voiceGender, stopSpeaking]);

  const voiceInit = useRef(false);
  useEffect(() => { if (!voiceInit.current) { voiceInit.current = true; return; } stopSpeaking(); }, [voiceGender, stopSpeaking]);
  useEffect(() => { const fn = () => window.speechSynthesis?.getVoices(); fn(); if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = fn; }, []);

  return (
    <div style={S.shell}><style>{CSS}</style>
      {refreshing && <div style={S.topBar} />}
      <header style={S.header}><div style={{...W}}>
        <div style={S.headerRow}><div>
          <h1 style={S.logo}>THE GLOBAL MARGIN</h1>
          <p style={S.tagline}>Geopolitical intelligence — unfiltered, ad-free, open.</p>
        </div><div style={S.headerRight}>
          {lastFetched && <span style={S.timeLabel}>Updated {lastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={() => fetchNews(true)} disabled={refreshing} style={S.refreshBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={refreshing ? { animation: "tgmSpin 0.7s linear infinite" } : undefined}>
              <path d="M21 2v6h-6M3 12a9 9 0 0115.3-6.4L21 8M3 22v-6h6M21 12a9 9 0 01-15.3 6.4L3 16" /></svg>
          </button></div></div>
        <div style={S.accentLine} />
      </div></header>

      <div style={{...W}}><div style={S.filterBar}>
        <FG label="Region">{REGIONS.map(r => <Pill key={r.id} on={region===r.id} click={()=>setRegion(r.id)}>{r.label}</Pill>)}</FG>
        <FG label="Topic">{TOPICS.map(t => <Pill key={t.id} on={topic===t.id} click={()=>setTopic(t.id)}>{t.label}</Pill>)}</FG>
        <div style={{display:"flex",flexDirection:"column",gap:5,marginLeft:"auto"}}>
          <span style={S.fLabel}>Audio Voice</span>
          <div style={{display:"flex"}}>{["female","male"].map((g,i) => (
            <button key={g} onClick={()=>setVoiceGender(g)} style={{fontSize:11,padding:"4px 11px",display:"flex",alignItems:"center",gap:4,background:voiceGender===g?"#2C3E50":"transparent",color:voiceGender===g?"#fff":"var(--fg3)",borderTop:`1px solid ${voiceGender===g?"#2C3E50":"var(--bd)"}`,borderBottom:`1px solid ${voiceGender===g?"#2C3E50":"var(--bd)"}`,borderRight:`1px solid ${voiceGender===g?"#2C3E50":"var(--bd)"}`,borderLeft:i===0?`1px solid ${voiceGender===g?"#2C3E50":"var(--bd)"}`:"none",borderRadius:i===0?"2px 0 0 2px":"0 2px 2px 0",cursor:"pointer",fontFamily:"var(--sn)",transition:"all 0.15s"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 00-16 0"/></svg>
              {g.charAt(0).toUpperCase()+g.slice(1)}</button>))}</div></div>
      </div></div>

      <main style={S.main}><div style={{...W}}>
        {phase==="loading" && <div style={S.loaderBox}><div style={S.spinner}/><p style={S.loaderText}>Fetching the latest from global wire services…</p></div>}
        {phase==="error" && <div style={S.errorBox}><p style={{marginBottom:14}}>{errorMsg}</p><button onClick={()=>fetchNews(false)} style={S.retryBtn}>Try Again</button></div>}
        {phase==="ready" && articles.length>0 && filtered.length===0 && <p style={S.emptyText}>No articles match your filters. Try broadening your selection.</p>}
        {phase==="ready" && filtered.map((a,i) => <Card key={a.id||i} a={a} idx={i} expanded={expandedId===a.id} speaking={speakingId===a.id} onToggle={()=>setExpandedId(p=>p===a.id?null:a.id)} onSpeak={()=>speak(a)}/>)}
        {phase==="ready" && errorMsg && <p style={{textAlign:"center",padding:"20px 0",color:"var(--ac)",fontSize:12}}>Refresh failed: {errorMsg}</p>}
      </div></main>

      <footer style={S.footer}><div style={{...W}}>
        <p style={S.fBrand}>THE GLOBAL MARGIN</p>
        <p style={S.fNote}>News sourced from Reuters, AP, BBC, and global wire services via GNews. No advertisements. No subscriptions. No tracking.</p>
        <p style={S.fDisc}>Articles are aggregated from credible sources. Always verify critical information from primary sources.</p>
      </div></footer>
    </div>
  );
}

function FG({label,children}){return <div style={{display:"flex",flexDirection:"column",gap:5}}><span style={S.fLabel}>{label}</span><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{children}</div></div>}
function Pill({on,click,children}){return <button onClick={click} style={{fontSize:11,padding:"4px 12px",border:`1px solid ${on?"var(--fg)":"var(--bd)"}`,borderRadius:1,background:on?"var(--fg)":"transparent",color:on?"var(--bg)":"var(--fg3)",whiteSpace:"nowrap",cursor:"pointer",fontFamily:"var(--sn)",transition:"all 0.15s"}}>{children}</button>}

function Card({a,expanded,speaking,onToggle,onSpeak,idx}){
  const [imgErr,setImgErr]=useState(false);
  return <article style={{padding:"26px 0",borderBottom:"1px solid var(--bd)",animation:"tgmFade 0.4s ease both",animationDelay:idx*0.05+"s"}}>
    <div style={{display:"flex",gap:20}}><div style={{flex:1}}>
      <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:7}}>
        <span style={{fontSize:9.5,fontWeight:600,textTransform:"uppercase",letterSpacing:1.2,color:"var(--ac)"}}>{a.region||"Global"}</span>
        <span style={{fontSize:9.5,textTransform:"uppercase",letterSpacing:0.8,color:"var(--fg3)"}}>{a.topic||"General"}</span>
        <span style={{color:"var(--fg3)",fontSize:8}}>·</span>
        <span style={{fontSize:9.5,color:"var(--fg3)"}}>{a.source||"Reuters"}</span>
        {a.timestamp&&<span style={{fontSize:9.5,color:"var(--fg3)",fontWeight:300}}>· {a.timestamp}</span>}
      </div>
      <h2 onClick={onToggle} style={S.headline}>{a.headline}</h2>
      <p style={S.summary}>{a.summary}</p>
    </div>
    {a.image&&!imgErr&&<div style={{flexShrink:0,width:140,height:95,borderRadius:3,overflow:"hidden",marginTop:20}}>
      <img src={a.image} alt="" onError={()=>setImgErr(true)} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/></div>}
    </div>
    {expanded&&a.body&&<div style={{maxWidth:660,padding:"16px 0 4px",animation:"tgmFade 0.3s ease both"}}>
      {a.body.split(/\n\n+/).filter(Boolean).map((p,i)=><p key={i} style={S.bodyPara}>{p}</p>)}
      {a.source_url&&<a href={a.source_url} target="_blank" rel="noopener noreferrer" style={S.srcLink}>Read full article at {a.source} →</a>}</div>}
    <div style={{display:"flex",alignItems:"center",gap:14,marginTop:11}}>
      <button onClick={onToggle} style={S.expandBtn}>{expanded?"Collapse":"Read more"}</button>
      <button onClick={onSpeak} style={{fontSize:11,background:"none",borderRadius:2,padding:"3px 10px",display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontFamily:"var(--sn)",color:speaking?"var(--ac)":"var(--fg3)",borderWidth:1,borderStyle:"solid",borderColor:speaking?"var(--ac)":"var(--bd)"}}>
        {speaking?<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        :<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>}
        {speaking?"Stop":"Listen"}</button>
      <div style={{display:"flex",alignItems:"center",gap:2,marginLeft:"auto"}}>
        {[1,2,3,4,5].map(n=><span key={n} style={{width:5,height:5,borderRadius:"50%",display:"inline-block",background:n<=(a.credibility_score||3)?"var(--ac)":"var(--bd)"}}/>)}
        <span style={{fontSize:9,color:"var(--fg3)",marginLeft:4,fontWeight:300}}>Credibility</span></div>
    </div></article>}

const CSS=`@keyframes tgmSpin{to{transform:rotate(360deg)}}@keyframes tgmSlide{0%{transform:translateX(-100%)}50%{transform:translateX(0)}100%{transform:translateX(100%)}}@keyframes tgmFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`;
const W={maxWidth:920,margin:"0 auto",padding:"0 28px",width:"100%"};
const S={shell:{fontFamily:"'DM Sans',-apple-system,sans-serif",minHeight:"100vh",display:"flex",flexDirection:"column",WebkitFontSmoothing:"antialiased","--bg":"#FAFAF8","--fg":"#1A1A18","--fg2":"#4A4A46","--fg3":"#8A8A84","--ac":"#B5312C","--bd":"#DCDCD6","--sf":"'Source Serif 4',Georgia,serif","--sn":"'DM Sans',-apple-system,sans-serif",background:"var(--bg)",color:"var(--fg)"},topBar:{position:"fixed",top:0,left:0,right:0,height:2,background:"var(--ac)",zIndex:999,animation:"tgmSlide 1.4s ease infinite"},header:{paddingTop:28,borderBottom:"1px solid var(--bd)"},headerRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10,paddingBottom:16},logo:{fontFamily:"var(--sf)",fontSize:25,fontWeight:600,letterSpacing:1.5,lineHeight:1,color:"var(--fg)",margin:0},tagline:{fontSize:11.5,fontWeight:300,color:"var(--fg3)",letterSpacing:0.4,marginTop:4},headerRight:{display:"flex",alignItems:"center",gap:12},timeLabel:{fontSize:11,color:"var(--fg3)",fontWeight:300},refreshBtn:{background:"none",border:"1px solid var(--bd)",borderRadius:2,padding:5,color:"var(--fg3)",display:"flex",alignItems:"center",cursor:"pointer"},accentLine:{height:2,width:55,background:"var(--ac)",marginBottom:-1},filterBar:{padding:"20px 0 16px",borderBottom:"1px solid var(--bd)",display:"flex",flexWrap:"wrap",gap:18,alignItems:"flex-end"},fLabel:{fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:1.8,color:"var(--fg3)"},main:{flex:1,paddingBottom:50},loaderBox:{display:"flex",flexDirection:"column",alignItems:"center",padding:"90px 20px",gap:14},spinner:{width:28,height:28,border:"2px solid var(--bd)",borderTopColor:"var(--ac)",borderRadius:"50%",animation:"tgmSpin 0.8s linear infinite"},loaderText:{fontSize:13,color:"var(--fg3)",fontWeight:300},errorBox:{textAlign:"center",padding:"70px 20px",color:"var(--ac)",fontSize:14},retryBtn:{padding:"7px 22px",border:"1px solid var(--ac)",background:"none",color:"var(--ac)",fontSize:12,borderRadius:2,cursor:"pointer",fontFamily:"var(--sn)"},emptyText:{textAlign:"center",padding:"70px 20px",color:"var(--fg3)",fontSize:13.5,fontWeight:300},headline:{fontFamily:"var(--sf)",fontSize:20,fontWeight:500,lineHeight:1.35,marginBottom:6,cursor:"pointer",color:"var(--fg)"},summary:{fontSize:13.5,lineHeight:1.65,color:"var(--fg2)",fontWeight:300,maxWidth:700},bodyPara:{fontFamily:"var(--sf)",fontSize:15,lineHeight:1.85,color:"var(--fg2)",marginBottom:13,fontWeight:300},srcLink:{fontSize:12,color:"var(--ac)",display:"inline-block",marginTop:2,textDecoration:"none"},expandBtn:{fontSize:11,fontWeight:500,color:"var(--fg3)",background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"var(--sn)"},footer:{borderTop:"1px solid var(--bd)",padding:"32px 0 28px",marginTop:"auto"},fBrand:{fontFamily:"var(--sf)",fontSize:13,fontWeight:500,letterSpacing:1,color:"var(--fg3)",marginBottom:6},fNote:{fontSize:11.5,color:"var(--fg3)",lineHeight:1.6,fontWeight:300,maxWidth:540,marginBottom:5},fDisc:{fontSize:10.5,color:"var(--fg3)",opacity:0.5,lineHeight:1.5,fontWeight:300,maxWidth:540,fontStyle:"italic"}};
