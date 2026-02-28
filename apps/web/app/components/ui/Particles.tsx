"use client";

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left:     `${(i * 37 + 11) % 100}%`,
  top:      `${(i * 53 + 7)  % 100}%`,
  delay:    `${(i * 0.4)     % 6}s`,
  duration: `${4 + (i % 4)}s`,
}));

export default function Particles() {
  return (
    <div className="particles">
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            top: p.top,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}