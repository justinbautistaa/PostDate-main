import { Link } from "react-router-dom";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import "./PublicPages.css";
import "./About.css";

export default function About() {
  return <div className="public-page about-page"><SiteNav /><main className="about-main">
    <section className="about-hero" aria-labelledby="about-title"><p className="public-eyebrow">THE STORY BEHIND POSTDATE</p><h1 id="about-title">A little hello.<br />A meaningful connection.</h1><p>PostDate brings people together through shared interests, mutual matches, and conversations that have room to grow.</p><span className="about-heart" aria-hidden="true">♡</span></section>
    <section className="about-purpose" aria-labelledby="purpose-title"><div><p className="public-eyebrow">WHY WE BUILT IT</p><h2 id="purpose-title">Getting to know someone should feel personal.</h2></div><div><p>We built PostDate to give people a place to express who they are, discover others with similar interests, and explore the possibility of friendship or a relationship at their own pace.</p><p>From creating a profile to chatting after a mutual match, our purpose is to make meeting someone feel approachable. Reviews help members share their experiences, while reporting and appeals give the community a way to raise concerns and ask for a fair review.</p></div></section>
    <section aria-labelledby="values-title"><p className="public-eyebrow">WHAT MATTERS HERE</p><h2 id="values-title">Built around people.</h2><div className="about-values">{[
      ["01", "Be yourself", "Share your interests, photos, and story so others can get to know the person behind the profile."],
      ["02", "Choose each other", "Conversations begin with a mutual match, giving both people a say in the connection."],
      ["03", "Keep it respectful", "Community reports, member feedback, and a moderation team support a more considerate space."],
    ].map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="about-team" aria-labelledby="team-title"><div><p className="public-eyebrow">THE PEOPLE BEHIND THE PROJECT</p><h2 id="team-title">Meet the development team.</h2><p className="about-school">PHINMA–University of Pangasinan</p><p>PostDate is our team’s collaborative project, bringing together design, development, data management, testing, and documentation to help people build meaningful connections.</p></div><div className="about-developers">{[
      ["PL", "Peter Jericho P. Landingin", "Frontend Developer"],
      ["JB", "Justin V. Bautista", "Backend Developer"],
      ["RR", "Regie M. Rea", "Database Administrator"],
      ["AB", "Angelica C. Blanco", "Project Manager"],
      ["BB", "Blesilda B. Barbiran", "Quality Assurance"],
      ["FR", "Francine D. Roca", "Documentation"],
    ].map(([initials, name, role]) => <article className="about-developer" key={name}><span className="about-developer-initials" aria-hidden="true">{initials}</span><div><h3>{name}</h3><p>{role}</p></div></article>)}</div></section>
    <section className="about-invite"><h2>Your next chapter starts with a hello.</h2><Link className="public-primary" to="/signup">Join PostDate ↗</Link></section>
  </main><SiteFooter /></div>;
}
