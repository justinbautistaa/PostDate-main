import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import { getLandingStats } from "../services/postdateApi";
import "./PublicPages.css";

export default function Home() {
  const [stats, setStats] = useState([]);
  useEffect(() => {
    let active = true;
    getLandingStats().then(data => { if (active && Array.isArray(data)) setStats(data); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <div className="home public-page">
    <SiteNav />
    <main className="landing-main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-intro"><p className="public-eyebrow">A LITTLE CURIOSITY. A REAL CONNECTION.</p><h1 id="landing-title">Your next chapter<br />starts with <em>hello.</em></h1><p className="landing-description">Someone who gets your humor. Shares your little joys. Makes an ordinary day feel different. Start getting to know them here.</p><div className="public-actions"><Link className="public-primary" to="/signup">Create your profile <span aria-hidden="true">↗</span></Link><Link className="public-textlink" to="/login">Already a member? Log in →</Link></div><p className="landing-caption">Your pace. Your story. Your kind of connection.</p></div>
        <div className="connection-art" aria-label="Illustrated postcards celebrating a new connection" role="img"><span className="art-orbit"/><div className="hello-card hello-card-back"><span>TO SOMEONE NEW</span><strong>Nice to<br />meet you.</strong><i aria-hidden="true">✦</i><small>A LITTLE SPARK GOES A LONG WAY</small></div><div className="hello-card hello-card-front"><span>FROM THE HEART</span><strong>Let’s see<br />where this goes.</strong><div className="art-heart" aria-hidden="true">♡</div><small>POSTDATE! / OPEN TO POSSIBILITIES</small></div><span className="art-seal" aria-hidden="true">REAL<br />CONNECTIONS<br />✳</span></div>
      </section>
      <section className="landing-steps" aria-labelledby="steps-title"><div className="steps-heading"><p className="public-eyebrow">GOOD THINGS START SMALL</p><h2 id="steps-title">A little more you.<br />A little closer to someone.</h2></div><ol>{[{ title: "Tell your story", body: "Build a profile with the interests, moments, and little things that make you, you." }, { title: "Find your kind of person", body: "Explore profiles and show interest. When the feeling is mutual, it’s a match." }, { title: "Make the first hello", body: "Start a conversation with your match and see what you have in common." }].map((step, index) => <li key={step.title}><span className="step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol></section>
      {!!stats.length && <section className="landing-numbers" aria-label="Community at a glance">{stats.map(stat => <div key={stat.label}><strong>{stat.display}</strong><span>{stat.label}</span></div>)}</section>}
      <section className="landing-invite"><span aria-hidden="true">✳</span><div><p className="public-eyebrow">MAKE ROOM FOR SOMETHING GOOD</p><h2>There’s a story waiting to start.</h2></div><Link className="public-primary" to="/signup">Start yours ↗</Link></section>
    </main><SiteFooter />
  </div>;
}
