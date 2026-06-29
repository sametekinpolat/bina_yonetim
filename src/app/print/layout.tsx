export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
      {children}
    </>
  );
}
