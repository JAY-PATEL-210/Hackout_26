import React, { useState, useRef, useEffect } from 'react'

const PRESET_QUERIES = [
  {
    id: 'diagnose-wtg04',
    icon: '🚨',
    label: 'Diagnose WTG-04 Bearing Spike',
    query: 'Provide deep diagnostic root-cause analysis for Turbine WTG-04 critical alert.',
  },
  {
    id: 'financial-risk',
    icon: '💰',
    label: 'Calculate Financial Exposure',
    query: 'What is the current revenue at risk and estimated cost of unaddressed downtime across the fleet?',
  },
  {
    id: 'dispatch-checklist',
    icon: '📋',
    label: 'Generate Field Work Order Checklist',
    query: 'Generate a step-by-step field technician work order and safety checklist for WTG-04 gearbox intervention.',
  },
  {
    id: 'solar-mppt',
    icon: '☀️',
    label: 'Analyze PV-02 Solar Inverter Mismatch',
    query: 'Explain the anomaly in Solar Inverter PV-02 and recommend maintenance steps.',
  },
]

export default function AiCopilotModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am your **WindGuard SCADA Diagnostic Copilot**, connected to live renewable fleet telemetry. 

Currently tracking **8 hybrid assets** (5 Wind Turbines, 3 Solar Inverters). 
- **1 Critical Alert**: Turbine WTG-04 (Bearing vibration: 2.18g, Gearbox: 78.4°C)
- **1 Warning Alert**: Turbine WTG-02 (Hydraulic pitch valve drift)
- **1 Watch Alert**: Solar Inverter PV-02 (MPPT String 4 imbalance)

Select an action below or enter a custom telemetry inquiry:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const chatEndRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const generateAnswer = (userPrompt) => {
    const p = userPrompt.toLowerCase()

    if (p.includes('wtg-04') || p.includes('wtg04') || p.includes('bearing') || p.includes('gearbox')) {
      return `### 🚨 Deep Diagnostic Report: Turbine WTG-04 (Sector Beta)
**Asset Spec:** Siemens Gamesa SG 3.4-132 (3.4 MW)
**Current Anomaly Score:** 0.812 *(Threshold: 0.500)* | **Health Score:** 61.2%

#### 1. Sensor Telemetry Findings:
- **Bearing Vibration:** \`2.18 g\` *(ISO 10816-3 Class IV limit is 1.80 g - Exceeded by +21%)*
- **Gearbox Temperature:** \`78.4 °C\` *(Nominal envelope: 48–62 °C - Elevated by +16.4 °C)*
- **Active Power:** \`680.9 kW\` (operating at reduced output to prevent thermal runaway)

#### 2. Root Cause Attribution (Ensemble Isolation Forest):
High-frequency spectral vibration analysis indicates **micro-pitting on the high-speed shaft intermediate stage bearing raceway**. The accompanying temperature rise confirms friction escalation from metal-on-metal degradation.

#### 3. Recommended Field Actions:
1. **Immediate Derating:** Reduce yaw angle and cap maximum RPM to 10.5 until inspection crew arrives.
2. **Work Order Dispatched:** WO-1041 has been created with Critical priority.
3. **Avoided Failure Cost:** Early intervention saves an estimated **$185,000** in catastrophic nacelle/gearbox replacement costs.`
    }

    if (p.includes('financial') || p.includes('revenue') || p.includes('cost') || p.includes('money')) {
      return `### 💰 Fleet Financial Exposure & OPEX Analysis
**Evaluation Timestamp:** ${new Date().toLocaleDateString()}

- **Current Live Revenue at Risk:** \`$4,972.50 / day\`
- **Avoided Catastrophic Outage Costs (YTD):** \`$248,500.00\`
- **Preventive Maintenance ROI:** \`5.2× return on inspection OPEX\`

#### Breakdown by Asset:
| Asset Code | Severity | Daily Lost Generation | Estimated Repair Cost | Risk Status |
| :--- | :--- | :--- | :--- | :--- |
| **WTG-04** | Critical | $2,840.00 | $14,200 | Severe Gearbox Wear |
| **WTG-02** | Warning | $860.00 | $3,400 | Pitch Valve Drift |
| **PV-02** | Watch | $310.00 | $950 | MPPT Inbalance |
| **Others (5)**| Healthy | $962.50 (Total) | Baseline | Nominal Operations |

**Financial Advisory:** Executing Work Order WO-1041 within the next 48 hours avoids an unplanned outage penalty of $38,000 under the Power Purchase Agreement (PPA).`
    }

    if (p.includes('checklist') || p.includes('work order') || p.includes('technician') || p.includes('safety')) {
      return `### 📋 Field Technician Dispatch Checklist: WTG-04
**Work Order:** \`WO-1041\` | **Assigned To:** Lead Mechanical Tech | **Estimated Time:** 6.0 Hours

#### Phase 1: Lockout / Tagout (LOTO) & Safety
- [ ] Engage mechanical rotor lock and verify zero hydraulic pressure in brake caliper.
- [ ] Isolate 34.5 kV pad-mounted transformer feed and tag pad-lock lockbox.
- [ ] Inspect nacelle climb harness and hoist system before ascension.

#### Phase 2: Diagnostic Inspection
- [ ] Perform borescope/endoscopic visual inspection of high-speed intermediate pinion teeth.
- [ ] Draw 200ml lube oil sample from filter outlet for spectrographic ICP metals analysis (inspect for Fe & Cu ppm).
- [ ] Measure radial clearance of spherical roller bearing with feeler gauge.

#### Phase 3: Replacement & Verification
- [ ] Flush secondary inline 10-micron oil filter cartridge.
- [ ] Retorque high-speed shaft bearing housing bolts to 420 N·m.
- [ ] Conduct 30-minute low-speed spin test while monitoring vibration sensor #BRG-04B.`
    }

    if (p.includes('solar') || p.includes('pv') || p.includes('mppt') || p.includes('inverter')) {
      return `### ☀️ Solar Inverter Array PV-02 Analysis (Sector Delta)
**Asset Spec:** Huawei SUN2000-185KTL-H1 (2.0 MW)
**Current Anomaly Score:** 0.365 | **Health Score:** 89.2%

#### Diagnostic Telemetry:
- **Solar Irradiance:** \`835 W/m²\` *(Clear Sky Peak)*
- **DC Operating Voltage:** \`1,120 V\`
- **DC Current:** \`1,720 A\` *(Nominal expectation: 1,940 A - 11.3% deficit)*
- **Inverter Temperature:** \`58.6 °C\`

#### Root Cause:
MPPT Tracker #4 is exhibiting voltage clamping under thermal stress, pointing to **dust accumulation on string #4 connector blocks** and slight thermal derating.

#### Recommended Action:
- Dispatched Work Order \`WO-1043\` (Scheduled).
- Clean DC connectors and thermal heatsink fins during scheduled low-sun maintenance window at 18:00.`
    }

    // Default intelligent response
    return `### ⚡ Fleet Telemetry Operational Advisory
**Fleet Status:** 8 Assets Online | **Fleet Health Score:** 94.2% | **Active Generation:** 14.85 MW

- **Priority Focus:** Turbine **WTG-04** requires priority field attendance (bearing vibration 2.18g).
- **Secondary Focus:** Turbine **WTG-02** pitch calibration scheduled for Feb 25.
- **Solar Field:** Performing at 96.8% of modeled irradiance curve.

*Tip: You can ask specific questions such as "Diagnose WTG-04", "Calculate Financial Impact", or "Generate Work Order Checklist".*`
  }

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!query.trim() || isGenerating) return

    const userText = query.trim()
    setQuery('')
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])

    setIsGenerating(true)

    // Simulate fast intelligent inference response
    setTimeout(() => {
      const response = generateAnswer(userText)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setIsGenerating(false)
    }, 600)
  }

  const handleCopyReport = (content) => {
    navigator.clipboard?.writeText(content)
    alert('Diagnostic report copied to clipboard!')
  }

  return (
    <>
      {/* Floating Trigger Button (Bottom Right) */}
      <button
        id="btn-ai-copilot-trigger"
        onClick={() => setIsOpen(true)}
        className="fixed z-40 bottom-6 right-6 group flex items-center gap-3 px-5 py-3.5 rounded-full bg-white/90 hover:bg-white text-slate-900 border border-white/95 shadow-[0_12px_36px_rgba(14,165,233,0.25)] hover:shadow-[0_16px_48px_rgba(14,165,233,0.35)] hover:scale-105 transition-all duration-300 cursor-pointer font-manrope"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
        </span>
        <span className="text-lg">🧠</span>
        <span className="font-bold text-sm font-space tracking-tight">
          AI SCADA Copilot
        </span>
        <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold font-mono">
          ISO-10816 AI
        </span>
      </button>

      {/* Slide-in Drawer / Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-fadeIn"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Container */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white/95 backdrop-blur-2xl border-l border-white shadow-2xl flex flex-col font-manrope">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50/60 to-emerald-50/40">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xl shadow-md shadow-sky-500/20">
                    🧠
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg font-space text-slate-900">
                        AI SCADA Copilot
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Telemetry Stream
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Real-time anomaly diagnostics, failure prediction & technician guidance
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-sm text-slate-600 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Quick Prompt Chips */}
              <div className="p-4 bg-slate-50/70 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 font-space">
                  Suggested Diagnostic Inquiries:
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_QUERIES.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setQuery(item.query)
                        setTimeout(() => {
                          const inputEl = document.getElementById('copilot-query-input')
                          inputEl?.focus()
                        }, 50)
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-900 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Conversation Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
                      <span className="font-bold font-space">
                        {msg.role === 'user' ? 'Operator' : 'SCADA Copilot'}
                      </span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`p-4 sm:p-5 rounded-2xl max-w-[92%] sm:max-w-[85%] text-xs leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-sky-600 text-white font-medium rounded-tr-none'
                          : 'bg-slate-50/90 text-slate-800 border border-slate-200/80 rounded-tl-none prose prose-xs'
                      }`}
                    >
                      <div className="whitespace-pre-line">{msg.content}</div>

                      {msg.role === 'assistant' && i > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Model: IsolationForest-Ensemble-v4
                          </span>
                          <button
                            onClick={() => handleCopyReport(msg.content)}
                            className="text-[10px] font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 transition cursor-pointer"
                          >
                            <span>📋 Copy Diagnostic Report</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isGenerating && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 w-fit">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                    <span>Analyzing sensor harmonics & financial models...</span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Drawer Footer / Input Bar */}
              <form
                onSubmit={handleSubmit}
                className="p-4 border-t border-slate-100 bg-white flex items-center gap-2"
              >
                <input
                  id="copilot-query-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about turbine vibration, financial risk, or dispatch checklist…"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition shadow-inner font-manrope"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || isGenerating}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs font-space transition shadow-xs disabled:opacity-40 cursor-pointer"
                >
                  Analyze →
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
