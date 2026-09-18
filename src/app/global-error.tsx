"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#050505", color: "#f4f4f2", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 480, padding: 24, border: "1px solid #0B4F7A", borderRadius: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", color: "#7d8085" }}>VOLT</div>
          <h1 style={{ fontSize: 20, margin: "12px 0" }}>SOMETHING TRIPPED</h1>
          <p style={{ color: "#b8bcc2", fontSize: 14, lineHeight: 1.5 }}>{error.message || "An unexpected error interrupted the application."}</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, background: "#0d0d0e", color: "#f4f4f2", border: "1px solid #35d8ff", padding: "10px 18px", borderRadius: 6, cursor: "pointer", letterSpacing: "0.14em", fontSize: 12 }}>
            RETRY
          </button>
        </div>
      </body>
    </html>
  );
}
