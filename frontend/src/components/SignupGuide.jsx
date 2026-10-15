const HELP = {
  1: { title: "A little introduction goes a long way.", body: "Share the basics so people can get to know you. A few honest words are a lovely place to start.", tip: "Your birthdate helps us keep PostDate for adults 18 and over. Your email stays off your public profile." },
  2: { title: "Let them see the real you.", body: "Choose a clear, recent photo where your face is easy to recognize. Add more to show a little of your everyday life.", tip: "Use photos you feel comfortable sharing. You can update your profile photos later." },
  3: { title: "Find a little common ground.", body: "Pick the traits that feel most like you. They help others start a conversation and get a sense of your personality.", tip: "There is no perfect combination. Be yourself—you can change your picks on your profile." },
};
export default function SignupGuide({ step = 1, profile = {} }) {
  const help = HELP[step] || HELP[1];
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  return <aside className="signup-aside">
    <p className="public-eyebrow">GOOD CONNECTIONS START WITH YOU</p>
    <h2>{help.title}</h2><p className="signup-aside-copy">{help.body}</p>
    <div className="signup-profile-preview">
      <span className="signup-preview-label">YOUR PROFILE, TAKING SHAPE</span>
      <div className="signup-preview-avatar" aria-hidden="true">{profile.firstName?.[0] || "♡"}</div>
      <h3>{name || "A new face. A new possibility."}</h3>
      <p>{profile.bio || "Your story belongs here. A favourite hobby, a small joy, or what makes you smile."}</p>
      <span className="signup-preview-note">{name ? "Your introduction is saved for the next step." : "A little preview of what’s to come"}</span>
    </div>
    <div className="signup-privacy"><span aria-hidden="true">◇</span><p>{help.tip}</p></div>
  </aside>;
}
