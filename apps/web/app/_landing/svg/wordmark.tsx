const WORDS = ['OPEN', 'BOOX'];

// Split-flap wordmark ([SM §5.1]): each letter is a clipped cell holding an outline layer above a filled layer.
// The hero intro rolls each stack from empty, past the outline, to the filled letter. Decorative; the h1 carries
// the name.
export function Wordmark() {
  return (
    <div className="obx-wordmark" aria-hidden="true">
      {WORDS.map((word) => (
        <span key={word} className="obx-wordmark__word">
          {[...word].map((letter, i) => (
            <span key={i} className="obx-flap">
              <span className="obx-flap__stack">
                <span className="obx-flap__cell obx-flap__cell--outline">{letter}</span>
                <span className="obx-flap__cell">{letter}</span>
              </span>
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}
