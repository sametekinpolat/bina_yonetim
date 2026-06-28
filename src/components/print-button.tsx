"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: "8px 20px", background: "#4f46e5", color: "white",
        border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px",
      }}
    >
      Yazdır / PDF Kaydet
    </button>
  );
}
