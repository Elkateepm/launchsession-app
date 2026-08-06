// Shared timing/easing so every animated piece on the onboarding page moves
// to the same rhythm instead of each component inventing its own numbers.
export const EASE = {
  standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
}

export const DURATION = {
  fast: 180,      // outgoing step content
  base: 320,      // incoming step content, panel micro-interactions
  panel: 550,     // panel/logo entrance
  progress: 500,  // progress bar segment fill
  slow: 900,      // completion transition ceiling
}

export const STAGGER = {
  glow: 0,
  logo: 80,
  panel: 160,
  header: 340,
  content: 420,
  button: 480,
  footer: 560,
}
