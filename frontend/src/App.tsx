import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Home,
  Inbox,
  LineChart,
  Search,
  Send,
  Upload,
  Users,
  XCircle,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CrowdCanvas } from './CrowdCanvas'
import './App.css'

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

type Summary = {
  customers_analyzed: number
  revenue_at_risk: number
  critical_customers: number
  immediate_actions: number
  approval_required: number
  feedback_records: number
  model: { name: string; accuracy: string; source: string }
}

type Customer = {
  customer_id: number
  churn_probability: number
  monthly_value: number
  revenue_at_risk: number
  risk_band: string
  urgency: string
  reason: string
}

type Detail = Customer & {
  recommendation: {
    reason: string
    action: string
    channel: string
    offer: string
    requires_approval: boolean
  }
  behaviour: { metric: string; previous: number; current: number }[]
  explanations: { feature: string; signal: number; impact: string }[]
  decision: { status: string; note: string; offer?: string }
}

type Analytics = {
  risk_distribution: { band: string; count: number }[]
  top_k: { label: string; customers: number; revenue_at_risk: number; avg_risk: number }[]
  action_distribution: { status: string; count: number }[]
}

type ModelIntel = {
  model_file: string
  pipeline_type: string
  estimator: string
  hidden_layers: number[]
  expected_columns: string[]
  transformed_feature_count: number
  sample_transformed_features: string[]
  note: string
}

function LandingPage() {
  const navigate = useNavigate()
  const [lead, setLead] = useState({ name: '', email: '', company: '', use_case: '' })
  const [leadStatus, setLeadStatus] = useState('')

  async function submitLead(event: React.FormEvent) {
    event.preventDefault()
    setLeadStatus('Sending...')
    try {
      await api('/leads', { method: 'POST', body: JSON.stringify(lead) })
      setLeadStatus('Thanks. Your demo request has been captured.')
      setLead({ name: '', email: '', company: '', use_case: '' })
    } catch {
      setLeadStatus('Please enter a valid email and try again.')
    }
  }

  return (
    <main className="landing">
      <nav className="landing-nav">
        <div className="landing-brand"><span><Gauge size={20} /></span><b>CustomerPulse</b></div>
        <div>
          <button onClick={() => navigate('/app')}>Launch app</button>
        </div>
      </nav>

      <section className="crowd-landing-hero">
        <div className="crowd-copy">
          <p className="kicker">Customer retention intelligence</p>
          <h1>CustomerPulse</h1>
          <p>
            Capture churn signals, calculate real risk, and move retention teams from customer data
            to approved action without losing the human decision layer.
          </p>
          <form className="hero-lead-form" onSubmit={submitLead}>
            <input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Name" required />
            <input value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="Work email" required />
            <input value={lead.company} onChange={(e) => setLead({ ...lead, company: e.target.value })} placeholder="Company" />
            <button type="submit">Request demo <ArrowRight size={16} /></button>
          </form>
          <div className="pulse-actions">
            <button className="text-link-button" onClick={() => navigate('/app')}>Enter product <ArrowRight size={16} /></button>
          </div>
          {leadStatus && <p className="success">{leadStatus}</p>}
        </div>
        <div className="crowd-stage">
          <CrowdCanvas />
        </div>
      </section>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app/*" element={<ProductApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function ProductApp() {
  return (
    <div className="product">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/model" element={<ModelPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
        </Routes>
      </main>
    </div>
  )
}

function Sidebar() {
  const links = [
    ['/app', 'Overview', Home],
    ['/app/customers', 'Customers', Users],
    ['/app/actions', 'Actions', ClipboardList],
    ['/app/analytics', 'Analytics', BarChart3],
    ['/app/model', 'Model', Brain],
    ['/app/upload', 'Upload', Upload],
    ['/app/feedback', 'Feedback', Inbox],
  ] as const
  return (
    <aside className="sidebar">
      <div className="brand">
        <span><Gauge size={22} /></span>
        <div><strong>CustomerPulse</strong><small>Retention operating system</small></div>
      </div>
      <nav>
        {links.map(([to, label, Icon]) => (
          <NavLink to={to} key={to} end={to === '/app'}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function Overview() {
  const { data: summary, reload } = useApi<Summary>('/summary')
  const { data: customers } = useApi<Customer[]>('/customers?limit=6')
  const navigate = useNavigate()

  return (
    <Page title="Retention command center" kicker="Behaviour to action" action={<button onClick={() => navigate('/app/customers')}>Open queue <ArrowRight size={16} /></button>}>
      <section className="hero-panel">
        <div>
          <p className="kicker">Live workspace</p>
          <h2>Manage the retention queue after the landing page converts interest into action.</h2>
          <p>Use this workspace to inspect customers, upload new cohorts, approve recommendations, and record outcomes.</p>
        </div>
        <button onClick={reload}><LineChart size={18} /> Refresh live metrics</button>
      </section>
      <div className="metric-grid">
        <Metric icon={<Users />} label="Customers analyzed" value={fmt(summary?.customers_analyzed)} />
        <Metric icon={<AlertTriangle />} label="Revenue at risk" value={money(summary?.revenue_at_risk)} />
        <Metric icon={<Gauge />} label="Critical customers" value={fmt(summary?.critical_customers)} />
        <Metric icon={<ClipboardList />} label="Approvals required" value={fmt(summary?.approval_required)} />
      </div>

      <section className="split">
        <Panel title="Top business priorities" icon={<Users />}>
          <div className="queue">
            {(customers ?? []).map((customer) => <CustomerRow key={customer.customer_id} customer={customer} />)}
          </div>
        </Panel>
        <Panel title="Demo flow" icon={<CheckCircle2 />}>
          <div className="steps">
            {['Identify risky customers', 'Review behaviour and explanation', 'Approve or modify action', 'Record retained/churned outcome'].map((step, index) => (
              <div key={step}><b>{index + 1}</b><span>{step}</span></div>
            ))}
          </div>
        </Panel>
      </section>
    </Page>
  )
}

function Customers() {
  const [risk, setRisk] = useState('All')
  const [query, setQuery] = useState('')
  const { data } = useApi<Customer[]>(`/customers?limit=80&risk=${risk}&q=${query}`)
  return (
    <Page title="Customer intelligence" kicker="Business priority queue">
      <div className="toolbar">
        <label><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer ID" /></label>
        <select value={risk} onChange={(e) => setRisk(e.target.value)}>
          {['All', 'Critical', 'High', 'Medium', 'Low'].map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="customer-grid">
        {(data ?? []).map((customer) => <CustomerRow key={customer.customer_id} customer={customer} />)}
      </div>
    </Page>
  )
}

function CustomerDetail() {
  const { id } = useParams()
  const { data, reload } = useApi<Detail>(`/customers/${id}`)
  const [note, setNote] = useState('')
  if (!data) return <Page title="Loading customer" kicker="Customer intelligence"><Skeleton /></Page>

  async function decide(status: 'approved' | 'modified' | 'rejected') {
    await api(`/customers/${id}/decision`, { method: 'POST', body: JSON.stringify({ status, note, offer: data?.recommendation.offer }) })
    reload()
  }

  async function feedback(outcome: 'retained' | 'churned' | 'monitoring') {
    await api(`/customers/${id}/feedback`, { method: 'POST', body: JSON.stringify({ outcome, note }) })
    reload()
  }

  return (
    <Page title={`Customer ${data.customer_id}`} kicker={`${data.risk_band} risk | ${data.urgency}`}>
      <div className="metric-grid">
        <Metric icon={<Gauge />} label="Churn risk" value={`${data.churn_probability}%`} />
        <Metric icon={<BarChart3 />} label="Monthly value" value={money(data.monthly_value)} />
        <Metric icon={<AlertTriangle />} label="Revenue at risk" value={money(data.revenue_at_risk)} />
        <Metric icon={<CheckCircle2 />} label="Decision" value={data.decision.status} />
      </div>
      <section className="split">
        <Panel title="Observed behaviour" icon={<LineChart />}>
          <ResponsiveContainer width="100%" height={260}>
            <ReLineChart data={data.behaviour}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="metric" />
              <YAxis />
              <Tooltip />
              <Line dataKey="previous" stroke="#3178c6" strokeWidth={3} />
              <Line dataKey="current" stroke="#d9480f" strokeWidth={3} />
            </ReLineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Recommendation" icon={<Send />}>
          <div className="recommendation">
            <p><b>Reason</b><span>{data.recommendation.reason}</span></p>
            <p><b>Action</b><span>{data.recommendation.action}</span></p>
            <p><b>Channel</b><span>{data.recommendation.channel}</span></p>
            <p><b>Offer</b><span>{data.recommendation.offer}</span></p>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add decision note" />
          <div className="button-row">
            <button onClick={() => decide('approved')}><CheckCircle2 size={16} /> Approve</button>
            <button onClick={() => decide('modified')}><ClipboardList size={16} /> Modify</button>
            <button className="danger" onClick={() => decide('rejected')}><XCircle size={16} /> Reject</button>
          </div>
          <div className="button-row muted">
            <button onClick={() => feedback('retained')}>Retained</button>
            <button onClick={() => feedback('churned')}>Churned</button>
            <button onClick={() => feedback('monitoring')}>Monitoring</button>
          </div>
        </Panel>
      </section>
      <Panel title="Model explanation signals" icon={<Brain />}>
        <div className="explain-grid">
          {data.explanations.map((item) => <div key={item.feature}><b>{item.feature}</b><span>{item.signal}</span><small>{item.impact}</small></div>)}
        </div>
      </Panel>
    </Page>
  )
}

function Actions() {
  const { data } = useApi<Customer[]>('/customers?limit=30&risk=Critical')
  return (
    <Page title="Action center" kicker="Human-in-the-loop workflow">
      <div className="kanban">
        {['Immediate', 'Within 24h', 'Monitor'].map((urgency) => (
          <Panel title={urgency} icon={<ClipboardList />} key={urgency}>
            <div className="queue">
              {(data ?? []).filter((customer) => customer.urgency === urgency).slice(0, 8).map((customer) => <CustomerRow key={customer.customer_id} customer={customer} />)}
            </div>
          </Panel>
        ))}
      </div>
    </Page>
  )
}

function AnalyticsPage() {
  const { data } = useApi<Analytics>('/analytics')
  return (
    <Page title="Business analytics" kicker="Risk, lift, and money at risk">
      <section className="split">
        <Panel title="Risk distribution" icon={<BarChart3 />}>
          <div className="chart-panel">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.risk_distribution ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="band" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count">{(data?.risk_distribution ?? []).map((_, i) => <Cell key={i} fill={['#d9480f', '#f08c00', '#2f9e44', '#1971c2'][i]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
          <div className="button-row muted">
            {(data?.risk_distribution ?? []).map((item) => <button key={item.band}>{item.band}: {fmt(item.count)}</button>)}
          </div>
        </Panel>
        <Panel title="Revenue priority bands" icon={<LineChart />}>
          <div className="chart-panel">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.top_k ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue_at_risk" fill="#176347" />
            </BarChart>
          </ResponsiveContainer>
          </div>
          <div className="button-row muted">
            {(data?.top_k ?? []).map((item) => <button key={item.label}>{item.label}: {money(item.revenue_at_risk)}</button>)}
          </div>
        </Panel>
      </section>
    </Page>
  )
}

function ModelPage() {
  const { data } = useApi<ModelIntel>('/model-intelligence')
  return (
    <Page title="Model intelligence" kicker="Real backend evidence">
      <Panel title="Loaded production artifact" icon={<Brain />}>
        <div className="evidence-grid">
          <div><small>Model file</small><b>{data?.model_file}</b></div>
          <div><small>Pipeline type</small><b>{data?.pipeline_type}</b></div>
          <div><small>Estimator</small><b>{data?.estimator}</b></div>
          <div><small>Hidden layers</small><b>{data?.hidden_layers?.join(' -> ')}</b></div>
          <div><small>Raw input columns</small><b>{data?.expected_columns?.length}</b></div>
          <div><small>Transformed features</small><b>{data?.transformed_feature_count}</b></div>
        </div>
        <p className="system-note">{data?.note}</p>
      </Panel>
      <Panel title="Accepted upload schema" icon={<BarChart3 />}>
        <div className="schema-grid">
          {(data?.expected_columns ?? []).map((column) => <span key={column}>{column}</span>)}
        </div>
      </Panel>
    </Page>
  )
}

function UploadPage() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [createdIds, setCreatedIds] = useState<number[]>([])
  const navigate = useNavigate()
  async function submit(file?: File) {
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    setError('')
    const response = await fetch(`${API}/predict-upload`, { method: 'POST', body })
    const result = await response.json()
    if (!response.ok) {
      const detail = result.detail
      setMessage('')
      setCreatedIds([])
      setPreview([])
      setError(typeof detail === 'string' ? detail : `${detail?.message ?? 'Upload failed'}${detail?.missing_columns?.length ? ` Missing: ${detail.missing_columns.join(', ')}` : ''}`)
      return
    }
    setMessage(`Created and calculated ${result.rows} CustomerPulse ${result.rows === 1 ? 'entry' : 'entries'}`)
    setCreatedIds(result.created_customer_ids ?? [])
    setPreview(result.preview ?? [])
  }
  return (
    <Page title="Upload company data" kicker="Controlled onboarding flow">
      <Panel title="Predict a compatible CSV or Excel file" icon={<Upload />}>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => submit(event.target.files?.[0])} />
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        {createdIds.length > 0 && (
          <div className="button-row muted">
            <button onClick={() => navigate(`/app/customers/${createdIds[0]}`)}>Open new entry #{createdIds[0]}</button>
            <button onClick={() => navigate('/app/customers')}>View in customer queue</button>
          </div>
        )}
      </Panel>
      {preview.length > 0 && <DataPreview rows={preview} />}
    </Page>
  )
}

function FeedbackPage() {
  const { data } = useApi<Summary>('/summary')
  return (
    <Page title="Feedback loop" kicker="Outcome memory for retraining">
      <section className="hero-panel">
        <div><h2>{fmt(data?.feedback_records)} outcomes stored</h2><p>Every decision can be connected to a real result: retained, churned, or still monitoring.</p></div>
      </section>
    </Page>
  )
}

function Page({ title, kicker, children, action }: { title: string; kicker: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <><header className="page-head"><div><p className="kicker">{kicker}</p><h1>{title}</h1></div>{action}</header>{children}</>
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-title"><h2>{title}</h2>{icon}</div>{children}</section>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="metric"><span>{icon}</span><small>{label}</small><b>{value}</b></div>
}

function CustomerRow({ customer }: { customer: Customer }) {
  return (
    <NavLink className="customer-row" to={`/app/customers/${customer.customer_id}`}>
      <span><b>#{customer.customer_id}</b><small>{customer.reason}</small></span>
      <span><strong>{customer.churn_probability}%</strong><small>{money(customer.revenue_at_risk)} risk</small></span>
    </NavLink>
  )
}

function DataPreview({ rows }: { rows: Record<string, unknown>[] }) {
  const keys = Object.keys(rows[0] ?? {}).slice(0, 8)
  return <Panel title="Prediction preview" icon={<BarChart3 />}><div className="data-table"><div>{keys.map((key) => <b key={key}>{key}</b>)}</div>{rows.slice(0, 10).map((row, i) => <div key={i}>{keys.map((key) => <span key={key}>{String(row[key])}</span>)}</div>)}</div></Panel>
}

function Skeleton() {
  return <div className="skeleton" />
}

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    api(path).then((result) => alive && setData(result)).catch(() => alive && setData(null))
    return () => { alive = false }
  }, [path, tick])
  return { data, reload: () => setTick((value) => value + 1) }
}

async function api(path: string, init?: RequestInit) {
  const headers = init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' }
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

function fmt(value?: number) {
  return value == null ? '-' : value.toLocaleString('en-IN')
}

function money(value?: number) {
  if (value == null) return '-'
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`
  return `₹${value.toLocaleString('en-IN')}`
}

export default App
