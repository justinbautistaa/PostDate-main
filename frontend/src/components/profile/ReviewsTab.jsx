/**
 * ReviewsTab — the "Your reviews" panel: one row per review, each with the
 * reviewer's avatar, name, score and comment, separated by white hairlines.
 *
 * Usage:
 *   <ReviewsTab reviews={profile.reviews} />
 *
 * `reviews` is [{ id, author, avatarUrl, rating, body }, ...]
 */
export default function ReviewsTab({ reviews = [] }) {
  if (reviews.length === 0) {
    /* Empty states should tell the user what to do next, not just say "none". */
    return (
      <p className="reviews-empty">
        <style>{`
          .reviews-empty {
            margin: 0;
            font-family: var(--pd-mono);
            font-size: clamp(11px, 1vw, 17px);
            color: var(--pd-cream);
          }
        `}</style>
        No reviews yet. They show up here after your first date.
      </p>
    );
  }

  return (
    <ul className="reviews">
      <style>{`
        .reviews {
          margin: 0;
          padding: 0;
          list-style: none;
          height: 100%;
          overflow-y: auto;
        }

        .reviews-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: clamp(10px, 1.6vw, 26px);

          padding: clamp(10px, 1.5vw, 22px) 0;   /* 🎛️ row height */
          border-bottom: 1px solid var(--pd-white);
        }
        .reviews-row:last-child { border-bottom: none; }

        .reviews-avatar {
          width: clamp(44px, 5vw, 92px);         /* 🎛️ reviewer avatar size */
          height: clamp(44px, 5vw, 92px);
          border-radius: 50%;
          background: var(--pd-salmon);
          object-fit: cover;
        }

        .reviews-head {
          display: flex;
          align-items: baseline;
          gap: clamp(8px, 1.2vw, 20px);
          flex-wrap: wrap;
          margin-bottom: 0.3em;
        }
        .reviews-name {
          font-family: var(--pd-display);
          font-size: clamp(14px, 1.5vw, 26px);   /* 🎛️ reviewer name size */
          color: var(--pd-white);
        }
        .reviews-rating {
          font-family: var(--pd-mono);
          font-size: clamp(10px, 0.95vw, 16px);
          color: var(--pd-white);
          opacity: 0.85;
        }
        .reviews-body {
          margin: 0;
          font-family: var(--pd-mono);
          font-size: clamp(10px, 1vw, 17px);     /* 🎛️ review text size */
          line-height: 1.5;
          color: var(--pd-white);
        }
      `}</style>

      {reviews.map(({ id, author, avatarUrl, rating, body }) => (
        <li className="reviews-row" key={id}>
          {avatarUrl ? (
            <img className="reviews-avatar" src={avatarUrl} alt="" />
          ) : (
            <span className="reviews-avatar" aria-hidden="true" />
          )}

          <div>
            <div className="reviews-head">
              <span className="reviews-name">{author}</span>
              <span className="reviews-rating">{rating}</span>
            </div>
            <p className="reviews-body">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
