import React from 'react'

// One <style> block, mounted once by OnboardingLayout, holding every
// keyframe and interactive (:hover/:focus/:active) class the onboarding
// page uses. Inline style objects can't express pseudo-classes or
// @keyframes, so this is the one place real CSS is needed — everything
// else stays as plain style props per the project's convention.
export default function OnboardingStyles() {
  return (
    <style>{`
      @keyframes ls-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ls-glow-in { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      @keyframes ls-logo-launch {
        0% { opacity: 0; transform: translateY(-14px); }
        60% { opacity: 1; transform: translateY(2px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes ls-logo-icon-launch {
        0% { transform: translateY(-6px) rotate(0deg); }
        40% { transform: translateY(1px) rotate(3deg); }
        70% { transform: translateY(-1px) rotate(-1deg); }
        100% { transform: translateY(0) rotate(0deg); }
      }
      @keyframes ls-logo-pulse {
        0%, 100% { filter: drop-shadow(0 0 0px rgba(139,92,246,0)); }
        50% { filter: drop-shadow(0 0 10px rgba(139,92,246,0.55)); }
      }
      @keyframes ls-panel-enter {
        from { opacity: 0; transform: translateY(20px) scale(0.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes ls-stagger-up {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes ls-orbit-cw { from { transform: translateX(-50%) rotate(0deg); } to { transform: translateX(-50%) rotate(360deg); } }
      @keyframes ls-orbit-ccw { from { transform: translateX(-50%) rotate(0deg); } to { transform: translateX(-50%) rotate(-360deg); } }
      @keyframes ls-glow-drift {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.9; }
        50% { transform: translate(18px, -12px) scale(1.06); opacity: 1; }
      }
      @keyframes ls-star-twinkle {
        0%, 100% { opacity: 0.15; transform: translateY(0); }
        50% { opacity: 0.55; transform: translateY(-3px); }
      }
      @keyframes ls-step-in {
        from { opacity: 0; transform: translateX(14px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes ls-step-out {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(-10px); }
      }
      @keyframes ls-label-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes ls-check-in {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes ls-nudge {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-4px); }
        50% { transform: translateX(3px); }
        75% { transform: translateX(-2px); }
      }
      @keyframes ls-lock-pulse {
        0% { transform: scale(1); }
        30% { transform: scale(1.18); }
        100% { transform: scale(1); }
      }
      @keyframes ls-border-sweep {
        0% { background-position: -120% 0; }
        100% { background-position: 220% 0; }
      }
      @keyframes ls-btn-shimmer {
        0%, 88%, 100% { background-position: -140% 0; }
        94% { background-position: 220% 0; }
      }
      @keyframes ls-spin { to { transform: rotate(360deg); } }
      @keyframes ls-rocket-up {
        0% { opacity: 0; transform: translate(-50%, 0) scale(0.6); }
        20% { opacity: 1; }
        100% { opacity: 0; transform: translate(-50%, -160px) scale(1); }
      }

      .ls-orbit-ring-1 { animation: ls-orbit-cw 60s linear infinite; }
      .ls-orbit-ring-2 { animation: ls-orbit-ccw 46s linear infinite; }
      .ls-glow-drift { animation: ls-glow-drift 14s ease-in-out infinite; }
      .ls-star { animation: ls-star-twinkle 4.5s ease-in-out infinite; }
      .ls-logo-pulse { animation: ls-logo-pulse 5s ease-in-out infinite; }

      .ls-footlink { position: relative; transition: color 0.2s; }
      .ls-footlink::after {
        content: ''; position: absolute; left: 0; right: 100%; bottom: -3px; height: 1px;
        background: rgba(255,255,255,0.55); transition: right 0.25s ${'cubic-bezier(0.22,1,0.36,1)'};
      }
      .ls-footlink:hover { color: rgba(255,255,255,0.75) !important; }
      .ls-footlink:hover::after { right: 0; }

      .ls-primary-btn {
        position: relative; overflow: hidden;
        transition: transform 0.15s ${'cubic-bezier(0.22,1,0.36,1)'}, box-shadow 0.2s ease, filter 0.2s ease;
        background-image: linear-gradient(135deg, #3b82f6, #4f46e5), linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.22) 50%, transparent 60%);
        background-size: 100% 100%, 260% 100%;
        background-repeat: no-repeat;
        animation: ls-btn-shimmer 10s ease-in-out infinite;
      }
      .ls-primary-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 16px 40px rgba(59,130,246,0.45); }
      .ls-primary-btn:active:not(:disabled) { transform: scale(0.985); }
      .ls-primary-btn .ls-btn-arrow { display: inline-block; transition: transform 0.2s ${'cubic-bezier(0.22,1,0.36,1)'}; }
      .ls-primary-btn:hover:not(:disabled) .ls-btn-arrow { transform: translateX(3px); }

      .ls-input {
        transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.15s ease, background 0.25s ease;
      }
      .ls-input:focus {
        border-color: #8B5CF6 !important;
        box-shadow: 0 0 0 4px rgba(139,92,246,0.16), 0 0 20px rgba(59,130,246,0.15);
        transform: translateY(-1px);
        background: rgba(255,255,255,0.08) !important;
      }
      .ls-input-error { animation: ls-nudge 0.32s ease; }
      .ls-input-label { transition: color 0.2s ease; }

      .ls-feature-item { transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease; }
      .ls-feature-item:hover { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.14) !important; transform: translateY(-1px); }

      @media (prefers-reduced-motion: reduce) {
        .ls-orbit-ring-1, .ls-orbit-ring-2, .ls-glow-drift, .ls-star, .ls-logo-pulse, .ls-primary-btn { animation: none !important; }
        .ls-primary-btn:hover:not(:disabled) { transform: none; }
        * { transition-duration: 0.01ms !important; }
      }
    `}</style>
  )
}
