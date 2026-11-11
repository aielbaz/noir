// When the remote was last used. Things that repaint a full-screen image (a banner slide changing)
// wait until the remote has been quiet for a moment, because the repaint would stall the next key press.
// One listener for the whole app; it is added when this file is first imported, so no press is missed.
let lastKeyAt = 0

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { lastKeyAt = Date.now() }, true)
}

export const msSinceKeyPress = () => Date.now() - lastKeyAt
