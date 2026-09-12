import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyALhDfQh3ekvWgnTmfPIZMb9zrj1Ytur28',
  authDomain: 'hackout-26.firebaseapp.com',
  projectId: 'hackout-26',
  storageBucket: 'hackout-26.firebasestorage.app',
  messagingSenderId: '70364416083',
  appId: '1:70364416083:web:4037c680d5ef97f3639ea6',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function setDocWithRetry(ref, data, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      await setDoc(ref, data)
      return
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

/* ── 1. Enterprise Renewable Assets (Wind & Solar) ─────────────────────────── */
const ASSETS = [
  {
    asset_id: 'WTG-01',
    legacy_id: 1,
    name: 'Wind Turbine Alpha 01',
    short_tag: 'WTG-01',
    category: 'Wind Turbine',
    model_spec: 'Vestas V112-3.0 MW Industrial',
    manufacturer: 'Vestas Wind Systems',
    farm_sector: 'Sector Alpha - Ridge North',
    rated_capacity_mw: 3.0,
    commissioned_date: Timestamp.fromDate(new Date('2023-04-15T00:00:00Z')),
    operational_status: 'Online (Nominal)',
    health_score: 96.4,
    current_risk_level: 'Healthy',
    current_anomaly_score: 0.112,
    failure_probability_pct: 2.1,
    revenue_at_risk_usd: 145.50,
    active_fault: 'Nominal baseline',
    last_inspection_date: '2026-02-10',
    next_scheduled_service: '2026-05-15',
    last_updated: Timestamp.now(),
    latest_reading: {
      wind_speed: 8.79,
      rpm: 12.54,
      gearbox_temp: 50.28,
      bearing_vibration: 1.222,
      power_output: 536.94,
      ambient_temp: 16.5,
    },
  },
  {
    asset_id: 'WTG-02',
    legacy_id: 2,
    name: 'Wind Turbine Alpha 02',
    short_tag: 'WTG-02',
    category: 'Wind Turbine',
    model_spec: 'Vestas V112-3.0 MW Industrial',
    manufacturer: 'Vestas Wind Systems',
    farm_sector: 'Sector Alpha - Ridge Center',
    rated_capacity_mw: 3.0,
    commissioned_date: Timestamp.fromDate(new Date('2023-04-20T00:00:00Z')),
    operational_status: 'Warning (Pitch Drift)',
    health_score: 82.1,
    current_risk_level: 'Warning',
    current_anomaly_score: 0.495,
    failure_probability_pct: 18.5,
    revenue_at_risk_usd: 860.00,
    active_fault: 'Pitch Valve Drift',
    last_inspection_date: '2026-01-28',
    next_scheduled_service: '2026-03-01',
    last_updated: Timestamp.now(),
    latest_reading: {
      wind_speed: 9.12,
      rpm: 12.91,
      gearbox_temp: 52.14,
      bearing_vibration: 1.205,
      power_output: 612.45,
      ambient_temp: 16.8,
    },
  },
  {
    asset_id: 'WTG-03',
    legacy_id: 3,
    name: 'Wind Turbine Beta 01',
    short_tag: 'WTG-03',
    category: 'Wind Turbine',
    model_spec: 'GE 2.8-127 High Efficiency',
    manufacturer: 'GE Renewable Energy',
    farm_sector: 'Sector Beta - Valley Inflow',
    rated_capacity_mw: 2.8,
    commissioned_date: Timestamp.fromDate(new Date('2023-05-02T00:00:00Z')),
    operational_status: 'Online (Nominal)',
    health_score: 93.8,
    current_risk_level: 'Healthy',
    current_anomaly_score: 0.145,
    failure_probability_pct: 3.4,
    revenue_at_risk_usd: 220.00,
    active_fault: 'Nominal baseline',
    last_inspection_date: '2026-02-04',
    next_scheduled_service: '2026-05-20',
    last_updated: Timestamp.now(),
    latest_reading: {
      wind_speed: 8.65,
      rpm: 12.4,
      gearbox_temp: 51.05,
      bearing_vibration: 1.215,
      power_output: 542.1,
      ambient_temp: 16.2,
    },
  },
  {
    asset_id: 'WTG-04',
    legacy_id: 4,
    name: 'Wind Turbine Beta 02',
    short_tag: 'WTG-04',
    category: 'Wind Turbine',
    model_spec: 'Siemens Gamesa SG 3.4-132',
    manufacturer: 'Siemens Gamesa',
    farm_sector: 'Sector Beta - Valley Outflow',
    rated_capacity_mw: 3.4,
    commissioned_date: Timestamp.fromDate(new Date('2023-05-10T00:00:00Z')),
    operational_status: 'Critical (Gearbox Vibration)',
    health_score: 61.2,
    current_risk_level: 'Critical',
    current_anomaly_score: 0.812,
    failure_probability_pct: 42.8,
    revenue_at_risk_usd: 2840.00,
    active_fault: 'Bearing Vibration Spike & Micro-pitting',
    last_inspection_date: '2026-01-15',
    next_scheduled_service: '2026-02-20',
    last_updated: Timestamp.now(),
    latest_reading: {
      wind_speed: 9.45,
      rpm: 13.2,
      gearbox_temp: 78.4,
      bearing_vibration: 2.18,
      power_output: 680.9,
      ambient_temp: 17.1,
    },
  },
  {
    asset_id: 'WTG-05',
    legacy_id: 5,
    name: 'Wind Turbine Gamma 01',
    short_tag: 'WTG-05',
    category: 'Wind Turbine',
    model_spec: 'Nordex N131/3300 High Wind',
    manufacturer: 'Nordex Group',
    farm_sector: 'Sector Gamma - High Peak',
    rated_capacity_mw: 3.3,
    commissioned_date: Timestamp.fromDate(new Date('2023-06-01T00:00:00Z')),
    operational_status: 'Watch (Elevated Temp)',
    health_score: 87.5,
    current_risk_level: 'Medium',
    current_anomaly_score: 0.392,
    failure_probability_pct: 9.6,
    revenue_at_risk_usd: 510.00,
    active_fault: 'Elevated High-Speed Shaft Temp',
    last_inspection_date: '2026-02-08',
    next_scheduled_service: '2026-04-10',
    last_updated: Timestamp.now(),
    latest_reading: {
      wind_speed: 8.95,
      rpm: 12.75,
      gearbox_temp: 68.8,
      bearing_vibration: 1.48,
      power_output: 585.2,
      ambient_temp: 16.4,
    },
  },
  {
    asset_id: 'PV-01',
    legacy_id: 6,
    name: 'Solar Inverter Array 01',
    short_tag: 'PV-01',
    category: 'Solar Array',
    model_spec: 'SMA Sunny Central 2500-EV',
    manufacturer: 'SMA Solar Technology',
    farm_sector: 'Sector Delta - South Plain',
    rated_capacity_mw: 2.5,
    commissioned_date: Timestamp.fromDate(new Date('2023-07-12T00:00:00Z')),
    operational_status: 'Online (Nominal)',
    health_score: 97.8,
    current_risk_level: 'Healthy',
    current_anomaly_score: 0.088,
    failure_probability_pct: 1.4,
    revenue_at_risk_usd: 85.00,
    active_fault: 'Nominal baseline',
    last_inspection_date: '2026-02-14',
    next_scheduled_service: '2026-06-01',
    last_updated: Timestamp.now(),
    latest_reading: {
      solar_irradiance: 842.0,
      dc_voltage: 1180.5,
      dc_current: 2150.0,
      inverter_temp: 46.2,
      power_output: 2480.0,
      ambient_temp: 21.4,
    },
  },
  {
    asset_id: 'PV-02',
    legacy_id: 7,
    name: 'Solar Inverter Array 02',
    short_tag: 'PV-02',
    category: 'Solar Array',
    model_spec: 'Huawei SUN2000-185KTL-H1',
    manufacturer: 'Huawei Enterprise Solar',
    farm_sector: 'Sector Delta - South Plain',
    rated_capacity_mw: 2.0,
    commissioned_date: Timestamp.fromDate(new Date('2023-07-15T00:00:00Z')),
    operational_status: 'Watch (MPPT Mismatch)',
    health_score: 89.2,
    current_risk_level: 'Medium',
    current_anomaly_score: 0.365,
    failure_probability_pct: 8.2,
    revenue_at_risk_usd: 310.00,
    active_fault: 'MPPT String 4 Phase Inbalance',
    last_inspection_date: '2026-02-01',
    next_scheduled_service: '2026-04-15',
    last_updated: Timestamp.now(),
    latest_reading: {
      solar_irradiance: 835.0,
      dc_voltage: 1120.0,
      dc_current: 1720.0,
      inverter_temp: 58.6,
      power_output: 1890.0,
      ambient_temp: 22.1,
    },
  },
  {
    asset_id: 'PV-03',
    legacy_id: 8,
    name: 'Solar Inverter Array 03',
    short_tag: 'PV-03',
    category: 'Solar Array',
    model_spec: 'Sungrow SG3125HV-30 Central',
    manufacturer: 'Sungrow Power Supply',
    farm_sector: 'Sector Epsilon - West Plateau',
    rated_capacity_mw: 3.1,
    commissioned_date: Timestamp.fromDate(new Date('2023-08-01T00:00:00Z')),
    operational_status: 'Online (Nominal)',
    health_score: 98.1,
    current_risk_level: 'Healthy',
    current_anomaly_score: 0.075,
    failure_probability_pct: 1.1,
    revenue_at_risk_usd: 72.00,
    active_fault: 'Nominal baseline',
    last_inspection_date: '2026-02-12',
    next_scheduled_service: '2026-06-15',
    last_updated: Timestamp.now(),
    latest_reading: {
      solar_irradiance: 855.0,
      dc_voltage: 1210.0,
      dc_current: 2540.0,
      inverter_temp: 48.0,
      power_output: 3080.0,
      ambient_temp: 21.8,
    },
  },
]

/* ── 2. Top-Level Work Orders Collection ──────────────────────────────────── */
const WORK_ORDERS = [
  {
    order_id: 'WO-1041',
    asset_id: 'WTG-04',
    asset_name: 'Wind Turbine Beta 02',
    priority: 'Critical',
    category: 'High-Speed Gearbox & Bearing Replacement',
    issue_description: 'Bearing vibration spike (2.18g) with micro-pitting telemetry signature. Urgent field intervention required before mechanical seize.',
    technician_assigned: 'Lead Mechanical Tech',
    target_date: '2026-02-20',
    estimated_duration: '6 hours',
    status: 'Dispatched',
    created_at: Timestamp.now(),
  },
  {
    order_id: 'WO-1042',
    asset_id: 'WTG-02',
    asset_name: 'Wind Turbine Alpha 02',
    priority: 'Warning',
    category: 'Hydraulic Pitch Actuator Recalibration',
    issue_description: 'Pitch drift detected on blade #2 during wind shear event. Recalibrate proportional valve and verify servo pressure.',
    technician_assigned: 'Field Systems Specialist',
    target_date: '2026-02-25',
    estimated_duration: '3 hours',
    status: 'In Progress',
    created_at: Timestamp.now(),
  },
  {
    order_id: 'WO-1043',
    asset_id: 'PV-02',
    asset_name: 'Solar Inverter Array 02',
    priority: 'Watch',
    category: 'Inverter MPPT String Re-balancing',
    issue_description: 'String 4 current drop detected during peak noon irradiance. Inspect combiner box diode array and clean DC connectors.',
    technician_assigned: 'Solar Electrical Tech',
    target_date: '2026-03-02',
    estimated_duration: '2 hours',
    status: 'Scheduled',
    created_at: Timestamp.now(),
  },
  {
    order_id: 'WO-1044',
    asset_id: 'WTG-01',
    asset_name: 'Wind Turbine Alpha 01',
    priority: 'Healthy',
    category: 'Routine 10,000-Hour Fluid Analysis',
    issue_description: 'Semi-annual lube oil spectrographic sampling and generator bearing grease purge. All sensor baselines nominal.',
    technician_assigned: 'Preventive Care Team',
    target_date: '2026-02-10',
    estimated_duration: '4 hours',
    status: 'Completed',
    created_at: Timestamp.fromDate(new Date('2026-02-10T09:00:00Z')),
  },
]

async function seedEnterpriseDatabase() {
  console.log('[*] Commencing Enterprise Firestore Database Population...')

  // 1. Seed renewable_assets collection
  console.log('\n[1/5] Writing renewable_assets collection...')
  for (const asset of ASSETS) {
    const assetRef = doc(db, 'renewable_assets', asset.asset_id)
    await setDocWithRetry(assetRef, asset)
    console.log(`  [✓] renewable_assets/${asset.asset_id} (${asset.name})`)

    // Subcollection: telemetry_history
    const teleRef = doc(db, 'renewable_assets', asset.asset_id, 'telemetry_history', 'LOG-2026-02-01-001')
    await setDocWithRetry(teleRef, {
      recorded_at: asset.last_updated,
      ...asset.latest_reading,
      anomaly_score: asset.current_anomaly_score,
      risk_level: asset.current_risk_level,
      is_fault: asset.current_risk_level === 'Critical' ? 1 : 0,
      diagnostic_flags: asset.active_fault !== 'Nominal baseline' ? [asset.active_fault] : [],
    })

    // Subcollection: maintenance_records
    const maintRef = doc(db, 'renewable_assets', asset.asset_id, 'maintenance_records', 'REC-2026-001')
    await setDocWithRetry(maintRef, {
      inspection_date: asset.last_inspection_date,
      technician: 'Lead Diagnostics Engineer',
      action_performed: 'Comprehensive SCADA Baseline Validation',
      findings: `Asset operating at ${asset.health_score}% health index. Current risk evaluated as ${asset.current_risk_level}.`,
      status: 'Approved',
    })
  }

  // 2. Sync turbines collection (both WTG-01..05 and 1..5 for 100% backward compatibility)
  console.log('\n[2/5] Updating turbines collection with enterprise metadata...')
  for (const asset of ASSETS.filter(a => a.category === 'Wind Turbine')) {
    // Write WTG-0X
    const wtgRef = doc(db, 'turbines', asset.asset_id)
    await setDocWithRetry(wtgRef, { ...asset, turbine_id: asset.legacy_id })
    console.log(`  [✓] turbines/${asset.asset_id}`)

    // Write numerical ID 1..5
    const numRef = doc(db, 'turbines', String(asset.legacy_id))
    await setDocWithRetry(numRef, {
      turbine_id: asset.legacy_id,
      name: asset.name,
      asset_code: asset.asset_id,
      type: 'wind',
      model_spec: asset.model_spec,
      location: asset.farm_sector,
      installed_date: asset.commissioned_date,
      current_risk_level: asset.current_risk_level,
      current_anomaly_score: asset.current_anomaly_score,
      last_updated: asset.last_updated,
      latest_reading: asset.latest_reading,
      health_score: asset.health_score,
      active_fault: asset.active_fault,
      revenue_at_risk: asset.revenue_at_risk_usd,
      failure_probability: `${asset.failure_probability_pct}%`,
    })
    console.log(`  [✓] turbines/${asset.legacy_id} (enriched metadata)`)

    // Ensure subcollections readings and maintenance_log exist with clean logs
    const readingRef = doc(db, 'turbines', String(asset.legacy_id), 'readings', 'step_00001')
    await setDocWithRetry(readingRef, {
      timestamp: asset.last_updated,
      ...asset.latest_reading,
      anomaly_score: asset.current_anomaly_score,
      risk_level: asset.current_risk_level,
      is_fault: asset.current_risk_level === 'Critical' ? 1 : 0,
      why_flagged: asset.active_fault !== 'Nominal baseline' ? [asset.active_fault] : [],
    })

    const logRef = doc(db, 'turbines', String(asset.legacy_id), 'maintenance_log', 'log_001')
    await setDocWithRetry(logRef, {
      timestamp: asset.last_updated,
      technician_name: 'Lead Diagnostics Engineer',
      action: 'Inspection',
      notes: `Health index ${asset.health_score}%. ${asset.active_fault}`,
    })
  }

  // 3. Top-Level work_orders Collection
  console.log('\n[3/5] Seeding work_orders collection...')
  for (const wo of WORK_ORDERS) {
    const woRef = doc(db, 'work_orders', wo.order_id)
    await setDocWithRetry(woRef, wo)
    console.log(`  [✓] work_orders/${wo.order_id} (${wo.priority}: ${wo.asset_name})`)
  }

  // 4. fleet_summary & fleet_analytics Collection
  console.log('\n[4/5] Updating fleet_summary & fleet_analytics...')
  const fleetData = {
    portfolio_name: 'WindGuard Renewable Portfolio Alpha',
    total_assets: 8,
    total_turbines: 5,
    total_solar_arrays: 3,
    overall_health_index: 94.2,
    total_revenue_at_risk: 4972.50,
    avoided_catastrophic_losses_usd: 248500.00,
    active_generation_mw: 14.85,
    risk_distribution: {
      Critical: 1,
      High: 1,
      Medium: 2,
      Low: 4,
    },
    simulated_timestamp: '2026-02-01 00:00:00',
    simulation_progress_pct: 100,
    last_updated: Timestamp.now(),
  }
  await setDocWithRetry(doc(db, 'fleet_summary', 'current'), fleetData)
  await setDocWithRetry(doc(db, 'fleet_summary', 'portfolio_metrics'), fleetData)
  await setDocWithRetry(doc(db, 'fleet_analytics', 'live_overview'), fleetData)
  console.log('  [✓] fleet_summary/current & portfolio_metrics')
  console.log('  [✓] fleet_analytics/live_overview')

  // 5. model_metrics & ai_model_metrics Collection
  console.log('\n[5/5] Updating model_metrics & ai_model_metrics...')
  const modelData = {
    model_id: 'ISO-FOREST-V4',
    model_name: 'Ensemble Isolation Forest + Safety Backstop',
    pipeline_stage: 'Phase 4 Validated',
    precision: 0.2473,
    recall: 0.5046,
    f1_score: 0.332,
    detection_lead_time_days: 23.5,
    detection_lead_time_hours: 564.0,
    false_positive_rate_healthy_turbines: 0.0669,
    flag_attribution: {
      total_high_critical_flags: 42,
      ml_model_involved_pct: 71.4,
      ml_score_alone_pct: 52.4,
      ml_score_alone_count: 22,
      safety_backstop_alone_pct: 28.6,
      safety_backstop_alone_count: 12,
      both_ml_and_backstop_pct: 19.0,
      both_ml_and_backstop_count: 8,
    },
    evaluation_dataset: 'live_input_dataset.csv (4,320 timesteps x 5 turbines)',
    last_evaluation: Timestamp.now(),
  }
  await setDocWithRetry(doc(db, 'model_metrics', 'latest'), modelData)
  await setDocWithRetry(doc(db, 'ai_model_metrics', 'production_benchmark'), modelData)
  console.log('  [✓] model_metrics/latest')
  console.log('  [✓] ai_model_metrics/production_benchmark')

  // 6. simulation_state Collection
  await setDocWithRetry(doc(db, 'simulation_state', 'current'), {
    status: 'ready',
    speed: '10x',
    current_row_index: 0,
    current_simulated_timestamp: Timestamp.fromDate(new Date('2026-02-01T00:00:00Z')),
    dataset_source: 'live_input_dataset.csv',
    active_stream_name: 'SCADA-Telemetry-Stream-Alpha',
    total_timesteps: 4320,
    total_assets: 5,
    last_ping: Timestamp.now(),
  })
  console.log('  [✓] simulation_state/current')

  console.log('\n[SUCCESS] Enterprise Firestore database schema populated perfectly!')
}

seedEnterpriseDatabase().catch((err) => {
  console.error('[ERROR] Enterprise seeding failed:', err)
  process.exit(1)
})
