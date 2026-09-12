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

const INITIAL_TURBINES = [
  {
    turbine_id: 1,
    name: 'Turbine 1',
    type: 'wind',
    location: 'Sector Alpha - Ridge North',
    installed_date: Timestamp.fromDate(new Date('2023-04-15T00:00:00Z')),
    current_risk_level: 'Low',
    current_anomaly_score: 0.375,
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
    turbine_id: 2,
    name: 'Turbine 2',
    type: 'wind',
    location: 'Sector Alpha - Ridge Center',
    installed_date: Timestamp.fromDate(new Date('2023-04-20T00:00:00Z')),
    current_risk_level: 'Low',
    current_anomaly_score: 0.395,
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
    turbine_id: 3,
    name: 'Turbine 3',
    type: 'wind',
    location: 'Sector Beta - Valley Inflow',
    installed_date: Timestamp.fromDate(new Date('2023-05-02T00:00:00Z')),
    current_risk_level: 'Low',
    current_anomaly_score: 0.405,
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
    turbine_id: 4,
    name: 'Turbine 4',
    type: 'wind',
    location: 'Sector Beta - Valley Outflow',
    installed_date: Timestamp.fromDate(new Date('2023-05-10T00:00:00Z')),
    current_risk_level: 'Low',
    current_anomaly_score: 0.412,
    last_updated: Timestamp.now(),
    latest_reading: {
      wind_speed: 9.45,
      rpm: 13.2,
      gearbox_temp: 53.4,
      bearing_vibration: 1.228,
      power_output: 680.9,
      ambient_temp: 17.1,
    },
  },
  {
    turbine_id: 5,
    name: 'Turbine 5',
    type: 'wind',
    location: 'Sector Gamma - High Peak',
    installed_date: Timestamp.fromDate(new Date('2023-06-01T00:00:00Z')),
    current_risk_level: 'Low',
    current_anomaly_score: 0.392,
    last_updated: Timestamp.now(),
    latest_reading: {
      wind_speed: 8.95,
      rpm: 12.75,
      gearbox_temp: 51.8,
      bearing_vibration: 1.198,
      power_output: 585.2,
      ambient_temp: 16.4,
    },
  },
]

async function seed() {
  console.log('[*] Starting Firestore seeding via Firebase Web Client SDK...')

  // 1. Turbines collection + subcollections
  for (const t of INITIAL_TURBINES) {
    const tid = String(t.turbine_id)
    const turbineRef = doc(db, 'turbines', tid)
    await setDoc(turbineRef, t)
    console.log(`  [✓] Seeded turbines/${tid}`)

    // Subcollection: readings
    const readingRef = doc(db, 'turbines', tid, 'readings', 'init_001')
    await setDoc(readingRef, {
      timestamp: t.last_updated,
      ...t.latest_reading,
      anomaly_score: t.current_anomaly_score,
      risk_level: t.current_risk_level,
      is_fault: 0,
      why_flagged: [],
    })
    console.log(`  [✓] Seeded turbines/${tid}/readings/init_001`)

    // Subcollection: maintenance_log
    const logRef = doc(db, 'turbines', tid, 'maintenance_log', 'init_log')
    await setDoc(logRef, {
      timestamp: t.installed_date,
      technician_name: 'Commissioning Engineer',
      action: 'inspected',
      notes: 'Initial commissioning inspection completed. Sensor baselines verified.',
    })
    console.log(`  [✓] Seeded turbines/${tid}/maintenance_log/init_log`)
  }

  // 2. simulation_state/current
  const simRef = doc(db, 'simulation_state', 'current')
  await setDoc(simRef, {
    status: 'stopped',
    speed: '10x',
    current_row_index: 0,
    current_simulated_timestamp: Timestamp.fromDate(new Date('2026-02-01T00:00:00Z')),
    dataset_source: 'live_input_dataset.csv',
  })
  console.log('  [✓] Seeded simulation_state/current')

  // 3. model_metrics/latest
  const metricsRef = doc(db, 'model_metrics', 'latest')
  await setDoc(metricsRef, {
    precision: 0.2473,
    recall: 0.5046,
    detection_lead_time_days: 23.5,
    false_positive_rate: 0.0669,
    evaluated_at: Timestamp.now(),
  })
  console.log('  [✓] Seeded model_metrics/latest')

  // 4. fleet_summary/current
  const fleetRef = doc(db, 'fleet_summary', 'current')
  await setDoc(fleetRef, {
    count_low: 5,
    count_medium: 0,
    count_high: 0,
    count_critical: 0,
    total_estimated_revenue_at_risk: 0.0,
    last_computed: Timestamp.now(),
  })
  console.log('  [✓] Seeded fleet_summary/current')

  console.log('[SUCCESS] All Firestore collections and documents have been created successfully!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('[ERROR] Seeding failed:', err)
  process.exit(1)
})
