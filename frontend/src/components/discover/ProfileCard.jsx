/**
 * ProfileCard
 * One tile in the discover grid: photo fills the square, a white hairline
 * separates it from a short meta strip (name + age / distance / gender).
 *
 * 🔍 CONFIDENCE NOTE: the Figma export has 18 of these, but roughly a third
 * were missing the distance/gender text and the border wandered between 1px
 * and 3px — almost certainly lost when the designer duplicated the layer
 * rather than an intentional variant. This component renders all three
 * fields every time so the grid reads consistently; delete a field here if
 * your Figma actually meant some cards to show less.
 *
 * Usage:
 *   <ProfileCard profile={p} onOpen={() => setSelected(p)} />
 */
export default function ProfileCard({ profile, onOpen }) {
  const { name, age, distanceMi, gender, photoUrl } = profile;

  return (
    <button type="button" className="pcard" onClick={onOpen}>
      <style>{`
        .pcard {
          all: unset;
          box-sizing: border-box;
          cursor: pointer;

          position: relative;
          aspect-ratio: 1 / 1;
          width: 100%;

          background: var(--pd-salmon);
          border: 3px solid var(--pd-maroon);  /* 🎛️ card border weight */
          border-radius: 5px;
          overflow: hidden;

          display: flex;
          flex-direction: column;
          justify-content: flex-end;

          transition: transform 0.15s ease;
        }
        .pcard:hover,
        .pcard:focus-visible { transform: translateY(-3px); }

        .pcard img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pcard-meta {
          position: relative;
          padding: clamp(8px, 1vw, 14px) clamp(10px, 1.1vw, 16px);
          border-top: 1px solid var(--pd-white);
          background: rgba(43, 35, 32, 0.16);  /* faint scrim so text reads on any photo */

          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: left;
          font-family: var(--pd-mono);
          color: var(--pd-white);
        }

        .pcard-name {
          font-weight: 700;
          font-size: clamp(11px, 1.15vw, 20px);  /* 🎛️ name/age size */
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pcard-sub {
          display: flex;
          gap: 8px;
          font-size: clamp(9px, 0.85vw, 13px);   /* 🎛️ distance/gender size */
          opacity: 0.9;
        }
      `}</style>

      {photoUrl && <img src={photoUrl} alt="" />}

      <span className="pcard-meta">
        <span className="pcard-name">
          {name}, {age}
        </span>
        <span className="pcard-sub">
          <span>{Number.isFinite(distanceMi) ? `${distanceMi} mi` : "Distance not shared"}</span>
          <span aria-hidden="true">·</span>
          <span>{gender}</span>
        </span>
      </span>
    </button>
  );
}
