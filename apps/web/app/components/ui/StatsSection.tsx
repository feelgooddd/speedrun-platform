interface Stats {
  total_runs: number;
  total_pbs: number;
  runners: number;
  world_records: number;
}

export async function StatsSection({ statsPromise }: { statsPromise: Promise<Stats | null> }) {
  const stats = await statsPromise;

  const STATS = [
    { number: stats?.total_runs?.toLocaleString() ?? "—", label: "Total Runs" },
    { number: stats?.total_pbs?.toLocaleString() ?? "—", label: "Number of PB's" },
    { number: stats?.runners?.toLocaleString() ?? "—", label: "Runners" },
    { number: stats?.world_records?.toLocaleString() ?? "—", label: "World Records" },
  ];

  return (
    <section className="stats-section">
      <div className="stats-grid">
        {STATS.map((s) => (
          <div key={s.label}>
            <div className="stat-number">{s.number}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StatsSkeleton() {
  return (
    <section className="stats-section">
      <div className="stats-grid">
        {["Total Runs", "Number of PB's", "Runners", "World Records"].map((label) => (
          <div key={label}>
            <div className="stat-number" style={{ opacity: 0.3 }}>—</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}