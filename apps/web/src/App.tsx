function App() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-50">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-10 shadow-2xl shadow-slate-950/40">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">LeadPilot AI</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Outbound sales-agent operations</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
          The dashboard foundation is running. Live lead, call, callback, and WhatsApp data will appear here once the API integrations are configured.
        </p>
        <div className="mt-8 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-5 text-sm text-cyan-100">
          API health endpoint: <code className="font-semibold">GET /api/health</code>
        </div>
      </section>
    </main>
  );
}

export default App;
