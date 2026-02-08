"use client";

export function BackgroundEffects() {
  return (
    <div
      className="sticky top-0 left-0 w-full h-0 pointer-events-none overflow-visible"
      style={{ zIndex: 0 }}
    >
      {/* Gradient orbs */}
      <div
        className="absolute top-0 left-0 w-full h-screen"
        style={{
          background: [
            "radial-gradient(ellipse 800px 600px at 75% 10%, var(--gradient-orb-1) 0%, transparent 70%)",
            "radial-gradient(ellipse 900px 700px at 15% 80%, var(--gradient-orb-2) 0%, transparent 70%)",
            "radial-gradient(ellipse 500px 500px at 50% 50%, var(--gradient-orb-3) 0%, transparent 70%)",
          ].join(", "),
        }}
      />
      {/* Mugshot watermark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/epstein-mugshot.jpg"
        alt=""
        className="absolute bottom-0 right-0 w-[480px] grayscale select-none"
        style={{
          opacity: 0.07,
          top: "calc(100vh - 480px * 1.24)",
          right: 0,
        }}
      />
      {/* Noise grain */}
      <div
        className="absolute top-0 left-0 w-full h-screen"
        style={{
          opacity: 0.035,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
    </div>
  );
}
