// Frontend dashboard for health-live project.
// This page renders a simple health dashboard similar to Athlytic and
// automatically fetches data from the `/api/timeseries` endpoint. It
// computes basic recovery, exertion and sleep metrics from the raw
// Health Auto Export metrics stored in Supabase and presents them in a
// clean, responsive layout. This dashboard is intentionally minimal
// (no external UI frameworks) to ensure it works out of the box on
// Vercel without additional dependencies.

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
} from 'chart.js';

// Register Chart.js components to enable line charts. Without registering these
// components the charts will not render in Chart.js v4+. This setup is
// deliberately minimal and does not specify colours, allowing Chart.js to
// select sensible defaults.
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip
);

// Helper to pick the first available value from a list of potential keys
function getMetric(obj = {}, keys) {
  for (const key of keys) {
    if (obj[key] != null && obj[key] !== undefined) {
      return obj[key];
    }
  }
  return null;
}

export default function Home() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch time series data from API on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/timeseries?range=60d');
        const json = await res.json();
        setEntries(json.data || []);
      } catch (err) {
        console.error('Failed to fetch timeseries', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Transform raw entries into a friendlier format
  const processed = entries.map((entry) => {
    const metrics = entry.metrics || {};
    const workouts = entry.workouts || {};
    const date = entry.ingest_date ? entry.ingest_date.slice(0, 10) : '';
    // Extract common metrics; fall back gracefully if fields are missing
    const hrv = getMetric(metrics, [
      'hrv',
      'hrvAverage',
      'hrv_average',
      'averageHrv',
      'HRV',
      'hrvAvg'
    ]);
    const rhr = getMetric(metrics, [
      'restingHeartRate',
      'rhr',
      'resting_heart_rate',
      'restingHeartRateAvg',
      'RHR'
    ]);
    const steps = getMetric(metrics, [
      'steps',
      'stepCount',
      'step_count',
      'dailyStepCount'
    ]);
    // Sleep duration may be in hours, seconds or milliseconds
    const sleepRaw = getMetric(metrics, [
      'sleepHours',
      'sleepDuration',
      'totalSleepTime',
      'sleepDurationHours'
    ]);
    let sleepHours = null;
    if (sleepRaw != null) {
      if (typeof sleepRaw === 'number') {
        // If it's large assume milliseconds
        if (sleepRaw > 50) {
          sleepHours = sleepRaw / 3600;
        } else {
          sleepHours = sleepRaw;
        }
      } else if (!isNaN(parseFloat(sleepRaw))) {
        sleepHours = parseFloat(sleepRaw);
      }
    }
    const trainingLoad = getMetric(metrics, [
      'trainingLoad',
      'trimp',
      'TRIMP',
      'training_load'
    ]);
    const spo2 = getMetric(metrics, [
      'oxygenSaturation',
      'spo2',
      'SpO2',
      'blood_oxygen_percentage'
    ]);
    const respiratoryRate = getMetric(metrics, [
      'respiratoryRate',
      'respirationRate',
      'respiratory_rate'
    ]);
    const temperature = getMetric(metrics, [
      'temperature',
      'wristTemperature',
      'wristTemp',
      'bodyTemperature'
    ]);
    return {
      date,
      hrv: hrv != null ? Number(hrv) : null,
      rhr: rhr != null ? Number(rhr) : null,
      steps: steps != null ? Number(steps) : null,
      sleepHours,
      trainingLoad: trainingLoad != null ? Number(trainingLoad) : null,
      spo2: spo2 != null ? Number(spo2) : null,
      respiratoryRate: respiratoryRate != null ? Number(respiratoryRate) : null,
      temperature: temperature != null ? Number(temperature) : null
    };
  });

  // Compute baselines and latest metrics
  const hrvValues = processed
    .map((p) => p.hrv)
    .filter((v) => v != null && !isNaN(v));
  const rhrValues = processed
    .map((p) => p.rhr)
    .filter((v) => v != null && !isNaN(v));
  const loadValues = processed
    .map((p) => p.trainingLoad)
    .filter((v) => v != null && !isNaN(v));
  const latest = processed[processed.length - 1] || {};
  const baselineHRV = hrvValues.length
    ? hrvValues.reduce((sum, v) => sum + v, 0) / hrvValues.length
    : null;
  const baselineRHR = rhrValues.length
    ? rhrValues.reduce((sum, v) => sum + v, 0) / rhrValues.length
    : null;
  const baselineLoad = loadValues.length
    ? loadValues.reduce((sum, v) => sum + v, 0) / loadValues.length
    : null;
  const recoveryScore =
    baselineHRV && latest.hrv && baselineRHR && latest.rhr
      ? Math.round(
          ((latest.hrv / baselineHRV) * 0.7 + (baselineRHR / latest.rhr) * 0.3) *
            100
        )
      : null;
  const exertionScore =
    baselineLoad && latest.trainingLoad
      ? Math.round((latest.trainingLoad / baselineLoad) * 100)
      : null;
  // Determine target exertion zone based on recovery
  let targetZone = null;
  if (recoveryScore != null) {
    if (recoveryScore >= 90) targetZone = 'High';
    else if (recoveryScore >= 70) targetZone = 'Moderate';
    else targetZone = 'Low';
  }
  // Determine sleep quality text
  let sleepQuality = null;
  if (latest.sleepHours != null) {
    if (latest.sleepHours >= 7.5) sleepQuality = 'Excellent';
    else if (latest.sleepHours >= 6) sleepQuality = 'Average';
    else sleepQuality = 'Poor';
  }
  // Determine health monitoring alerts (simple thresholds)
  const alerts = [];
  if (latest.spo2 != null && latest.spo2 < 95) {
    alerts.push('Low SpO₂');
  }
  if (latest.respiratoryRate != null && latest.respiratoryRate > 20) {
    alerts.push('High Respiratory Rate');
  }
  if (latest.temperature != null && latest.temperature > 38) {
    alerts.push('Elevated Temperature');
  }

  // Calculate sleep debt over the last 7 days. We assume an optimal nightly sleep
  // duration of 7.5 hours (52.5 total hours per week). If the sum of the last 7
  // recorded sleep hours falls short, the difference is treated as "sleep debt".
  let sleepDebtHours = null;
  if (processed.length >= 7) {
    const last7 = processed.slice(-7);
    const totalSleep = last7.reduce(
      (sum, p) => sum + (p.sleepHours != null ? p.sleepHours : 0),
      0
    );
    const optimal = 7 * 7.5;
    const debt = optimal - totalSleep;
    sleepDebtHours = debt > 0 ? debt : 0;
  }

  // Estimate a target sleep recommendation for tonight based on recovery,
  // exertion and accumulated sleep debt. This simple heuristic starts with
  // eight hours and adds half-hour increments if recovery is low, exertion
  // unusually high or sleep debt is significant. If no recovery score is
  // available (e.g. no data yet) we leave this as null.
  let targetSleep = null;
  if (recoveryScore != null) {
    targetSleep = 8;
    if (recoveryScore < 80) targetSleep += 0.5;
    if (exertionScore != null && exertionScore > 120) targetSleep += 0.5;
    if (sleepDebtHours != null && sleepDebtHours > 3) targetSleep += 0.5;
  }

  // Build trend data for recovery and exertion across all processed entries. For
  // each day we derive a relative recovery (0–100) from that day's HRV and
  // RHR versus baseline, and an exertion ratio (exertionScore-like) from
  // training load versus baseline. Missing values are represented as null so
  // charts can leave gaps gracefully.
  const labels = processed.map((p) => p.date);
  const recoveryTrend = processed.map((p) => {
    if (baselineHRV && p.hrv && baselineRHR && p.rhr) {
      return (
        ((p.hrv / baselineHRV) * 0.7 + (baselineRHR / p.rhr) * 0.3) * 100
      );
    }
    return null;
  });
  const exertionTrend = processed.map((p) => {
    if (baselineLoad && p.trainingLoad) {
      return (p.trainingLoad / baselineLoad) * 100;
    }
    return null;
  });
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Recovery (%)',
        data: recoveryTrend,
        yAxisID: 'y',
      },
      {
        label: 'Exertion',
        data: exertionTrend,
        yAxisID: 'y1',
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Recovery (%)',
        },
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Exertion',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <div className="container">
      <Head>
        <title>Health Dashboard</title>
        <meta
          name="description"
          content="Personal health dashboard with Athlytic-inspired insights and automatic syncing via Health Auto Export."
        />
      </Head>
      <h1>Health Dashboard</h1>
      <p>
        Your data is automatically synced via Health Auto Export. View recovery,
        exertion, sleep and health metrics below.
      </p>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="cards">
            <div className="card">
              <h2>Recovery</h2>
              {recoveryScore != null ? <p>{recoveryScore}%</p> : <p>N/A</p>}
            </div>
            <div className="card">
              <h2>Exertion</h2>
              {exertionScore != null ? <p>{exertionScore}</p> : <p>N/A</p>}
            </div>
            <div className="card">
              <h2>Target Zone</h2>
              {targetZone ? <p>{targetZone}</p> : <p>N/A</p>}
            </div>
            <div className="card">
              <h2>Sleep Quality</h2>
              {sleepQuality ? <p>{sleepQuality}</p> : <p>N/A</p>}
            </div>
            <div className="card">
              <h2>Sleep Debt</h2>
              {sleepDebtHours != null ? (
                <p>{sleepDebtHours.toFixed(2)}h</p>
              ) : (
                <p>N/A</p>
              )}
            </div>
            <div className="card">
              <h2>Target Sleep</h2>
              {targetSleep != null ? (
                <p>{targetSleep.toFixed(2)}h</p>
              ) : (
                <p>N/A</p>
              )}
            </div>
            <div className="card">
              <h2>Alerts</h2>
              {alerts.length ? (
                <ul>
                  {alerts.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p>None</p>
              )}
            </div>
          </div>
          <div className="table-container">
            <h2>Recent Metrics (Last 60 Days)</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>HRV</th>
                  <th>RHR</th>
                  <th>Sleep (h)</th>
                  <th>Steps</th>
                  <th>Load</th>
                  <th>SpO₂</th>
                  <th>Resp.</th>
                  <th>Temp</th>
                </tr>
              </thead>
              <tbody>
                {processed.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.hrv != null ? row.hrv.toFixed(2) : '—'}</td>
                    <td>{row.rhr != null ? row.rhr.toFixed(2) : '—'}</td>
                    <td>{
                      row.sleepHours != null ? row.sleepHours.toFixed(2) : '—'
                    }</td>
                    <td>{row.steps != null ? row.steps : '—'}</td>
                    <td>
                      {row.trainingLoad != null
                        ? row.trainingLoad.toFixed(2)
                        : '—'}
                    </td>
                    <td>{row.spo2 != null ? row.spo2.toFixed(2) : '—'}</td>
                    <td>
                      {row.respiratoryRate != null
                        ? row.respiratoryRate.toFixed(2)
                        : '—'}
                    </td>
                    <td>
                      {row.temperature != null
                        ? row.temperature.toFixed(2)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        <div className="chart-container">
          <h2>Recovery vs Exertion Trend</h2>
          {/* Chart only renders when there is data; Chart.js gracefully handles null values */}
          <Line data={chartData} options={chartOptions} />
        </div>
        </>
      )}
      <style jsx>{`
        .container {
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            Helvetica, Arial, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
        }
        h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        p {
          margin-bottom: 1rem;
        }
        .cards {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .card {
          flex: 1 1 160px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1rem;
          background: #fafafa;
          text-align: center;
        }
        .card h2 {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .card p {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 0;
        }
        .table-container {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          border: 1px solid #e0e0e0;
          padding: 0.5rem;
          text-align: center;
        }
        th {
          background: #f5f5f5;
        }
        .chart-container {
          margin-top: 2rem;
        }
      `}</style>
    </div>
  );
}
