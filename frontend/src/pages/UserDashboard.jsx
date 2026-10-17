import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppNav from "../components/AppNav";
import ProfilePhoto from "../components/ProfilePhoto";
import WorkspaceFeatures from "../components/WorkspaceFeatures";
import { getProfile, toPhotoUrl } from "../services/postdateApi";
import { getRole } from "../auth";
import "./Workspace.css";
import "./Dashboard.css";
import "./RoleDesigns.css";

export default function UserDashboard() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setError(false);
    getProfile().then(p => { if (active) setProfile(p); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retry]);
  const tasks = [{ label: "Add a profile photo", done: !!profile?.photoPaths?.length }, { label: "Tell your story", done: !!profile?.bio?.trim() }, { label: "Share your interests", done: !!profile?.tags?.length }, { label: "Say what you’re looking for", done: !!profile?.lookingFor?.length }];
  const progress = tasks.filter(t => t.done).length;
  const complete = progress === tasks.length;
  const name = profile?.displayName || profile?.name || "You";
  const role = getRole();
  return <div className="member-home"><AppNav /><main className="member-main">
    <div className="workspace-title"><div><p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h1>{profile ? "Hello, " + name.split(" ")[0] + "." : "Welcome to PostDate."}</h1><p className="muted">A little curiosity. A real connection. Something worth showing up for.</p></div>{role === "admin" || role === "moderator" ? <Link className="outline-button" to={role === "admin" ? "/admin" : "/staff"}>Open {role === "admin" ? "admin" : "staff"} workspace ↗</Link> : <span className="role-pill">Your personal space</span>}</div>
    <section className="workspace-banner member-banner"><div><span className="eyebrow">LESS SCROLLING. MORE SPARK.</span><h2>Good things start<br />with a hello.</h2><p>Find someone who shares your interests, your energy, or your love of a very good coffee.</p><Link className="cream-button" to="/discover">Meet the community ↗</Link></div><div className="postage-art" aria-hidden="true"><span>A NOTE FOR YOU</span><strong>♡</strong><small>OPEN TO POSSIBILITIES</small></div></section>
    <nav className="member-quicklinks" aria-label="Your space shortcuts">{[{ to: "/discover", icon: "✦", title: "Find dates", sub: "Meet someone who feels right" }, { to: "/messages", icon: "♡", title: "Your chats", sub: "Say hello to your matches" }, { to: "/profile", icon: "▧", title: "Your profile", sub: "Tell your story" }].map(link => <Link key={link.title} to={link.to} className="member-quicklink"><span aria-hidden="true">{link.icon}</span><span><b>{link.title}</b><small>{link.sub}</small></span><span aria-hidden="true">↗</span></Link>)}</nav>
    <nav className="feature-jumps" aria-label="Planning and updates"><a href="#date-planner">Your date planner ↓</a><a href="#community-notices">Community notices ↓</a></nav>
    {error ? <section className="workspace-panel workspace-empty" role="alert"><h2>Your profile couldn’t load.</h2><p>Please try again to see your personal overview.</p><button className="outline-button" onClick={() => setRetry(v => v + 1)}>Try again</button></section> : !profile ? <p role="status">Getting your space ready…</p> : <div className="member-columns">
      <section className="workspace-panel member-profile"><span className="eyebrow">THE PERSON BEHIND THE PROFILE</span><div className="member-avatar"><ProfilePhoto src={toPhotoUrl(profile.avatarPath)} name={name} alt={name} /></div><h2>{name}</h2><p className="muted">{[profile.age, profile.gender].filter(Boolean).join(" · ")}</p><p>{profile.bio || "Your story belongs here. Tell people a little about you."}</p><div className="member-tags">{(profile.tags ?? []).slice(0, 5).map(tag => <span key={tag}>{tag}</span>)}</div><Link className="outline-button" to="/profile">View & edit profile ↗</Link></section>
      {complete ? <section className="workspace-panel member-ready"><span className="member-ready-badge">✓ Profile essentials complete</span><p className="eyebrow">YOUR NEXT CHAPTER</p><h2>You’re ready to connect.</h2><p className="muted">Your story is set. Now make room for a good conversation, a shared interest, or something unexpected.</p><div className="member-ready-links"><Link to="/discover"><span aria-hidden="true">✦</span><span><b>Find your kind of person</b><small>Explore profiles and see who catches your eye.</small></span><span aria-hidden="true">↗</span></Link><Link to="/messages"><span aria-hidden="true">♡</span><span><b>Start a conversation</b><small>Pick up where you left off with your matches.</small></span><span aria-hidden="true">↗</span></Link><a href="#date-planner"><span aria-hidden="true">☷</span><span><b>Make a little plan</b><small>Keep an idea for your next date in one place.</small></span><span aria-hidden="true">↓</span></a></div><p className="member-ready-tip">A thoughtful first message goes a long way. Ask about something they love.</p></section> : <section className="workspace-panel"><p className="eyebrow">A LITTLE MORE YOU</p><h2>Make a first impression.</h2><p className="muted">Give someone a reason to say hello.</p><div className="progress-label"><span>Profile essentials</span><b>{progress} of 4</b></div><progress value={progress} max="4" aria-label="Profile essentials completed" />{tasks.map(task => <Link className="profile-task" key={task.label} to="/profile"><span className={task.done ? "task-check done" : "task-check"}>{task.done ? "✓" : "+"}</span><span>{task.label}<small>{task.done ? "Looking good" : "Add your personal touch"}</small></span><span aria-hidden="true">↗</span></Link>)}</section>}
    </div>}
    <aside className="member-note"><span aria-hidden="true">✦</span><div><h3>Your pace. Your boundaries.</h3><p>Share what feels comfortable, take your time, and choose connections that feel right for you.</p></div><Link to="/discover">Explore profiles →</Link></aside>
    <WorkspaceFeatures kind="plans" />
    <WorkspaceFeatures kind="announcements" />
    <footer className="workspace-footer"><span>POSTDATE! · Real people. Real possibilities.</span><Link to="/profile">Your profile ↗</Link></footer>
  </main></div>;
}
