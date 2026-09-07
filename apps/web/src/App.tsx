import { useState, useEffect } from 'react';

interface Lead {
  id: string;
  name: string;
  phone: string;
  qualification?: string;
  qualificationScore?: number;
}

function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form states
  const [newLead, setNewLead] = useState({ name: '', phone: '' });

  const API_URL = 'http://localhost:4000/api';

  // Fetch leads
  const fetchLeads = async () => {
    try {
      const response = await fetch(`${API_URL}/leads`);
      if (response.ok) {
        const json = await response.json();
        // API returns { data: [...] }, we need the data array
        const data = json.data || json;
        setLeads(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch leads:', response.status);
        setLeads([]);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
      setLeads([]);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Create lead
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      });

      if (response.ok) {
        setSuccess(`Lead created: ${newLead.name}`);
        setNewLead({ name: '', phone: '' });
        fetchLeads();
      } else {
        setError('Failed to create lead');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Trigger outbound call
  const handleOutboundCall = async (leadId: string, leadName: string, leadPhone: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/calls/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: leadPhone,
          assistantId: '161ed4f6-1521-421c-b197-0a67a6890ca5', // Your Vapi assistant ID
          metadata: { leadId, leadName }
        }),
      });

      if (response.ok) {
        setSuccess(`✅ Outbound call initiated for ${leadName}!`);
        fetchLeads();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(`Failed to initiate call: ${errorData.error?.message || errorData.message || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Send WhatsApp
  const handleSendWhatsApp = async (leadId: string, leadName: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/leads/${leadId}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Hello ${leadName}, this is a test message from LeadPilot AI!`,
          type: 'MANUAL'
        }),
      });

      if (response.ok) {
        setSuccess(`✅ WhatsApp sent to ${leadName}!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(`Failed to send WhatsApp: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">LeadPilot AI</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Outbound Sales Agent Operations</h1>
          <p className="mt-2 text-slate-400">
            Manage leads, trigger voice calls, and send WhatsApp messages
          </p>
        </section>

        {/* Status Messages */}
        {success && (
          <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-green-400">
            {success}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Create Lead Form */}
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold text-cyan-400">Create New Lead</h2>
          <form onSubmit={handleCreateLead} className="mt-4 flex gap-4">
            <input
              type="text"
              placeholder="Lead Name"
              value={newLead.name}
              onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              required
            />
            <input
              type="tel"
              placeholder="Phone (E.164: +91...)"
              value={newLead.phone}
              onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-cyan-500 px-6 py-2 font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
          </form>
        </section>

        {/* Leads List */}
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold text-cyan-400">Active Leads</h2>
          
          {leads.length === 0 ? (
            <p className="mt-4 text-slate-400">No leads yet. Create one above to get started!</p>
          ) : (
            <div className="mt-4 space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-4"
                >
                  <div>
                    <h3 className="font-semibold text-slate-100">{lead.name}</h3>
                    <p className="text-sm text-slate-400">{lead.phone}</p>
                    {lead.qualification && (
                      <span className={`mt-1 inline-block rounded px-2 py-1 text-xs font-semibold ${
                        lead.qualification === 'HOT' ? 'bg-red-500/20 text-red-400' :
                        lead.qualification === 'WARM' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {lead.qualification} {lead.qualificationScore && `(${lead.qualificationScore})`}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOutboundCall(lead.id, lead.name || 'Unknown', lead.phone)}
                      disabled={loading}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      📞 Call
                    </button>
                    <button
                      onClick={() => handleSendWhatsApp(lead.id, lead.name || 'Unknown')}
                      disabled={loading}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      💬 WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* API Info */}
        <section className="mt-6 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-cyan-100">
          <strong>API Status:</strong> Connected to <code className="font-semibold">http://localhost:4000</code>
        </section>
      </div>
    </main>
  );
}

export default App;
