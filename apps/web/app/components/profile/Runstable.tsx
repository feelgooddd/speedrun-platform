"use client";
import { useState } from "react";

interface Run {
  id: string;
  game: string;
  category: string;
  platform: string;
  timing_method: string;
  realtime_ms: number | null;
  realtime_display: string | null;
  gametime_ms: number | null;
  gametime_display: string | null;
  verified: boolean;
  video_url: string | null;
  submitted_at: string;
}

interface PersonalBest {
  category_name: string;
  platform: string;
  realtime_ms: number | null;
  gametime_ms: number | null;
  timing_method: string;
}

interface RunsTableProps {
  runs: Run[];
  personalBests: PersonalBest[];
}

function groupByGame(runs: Run[]) {
  const map = new Map<string, Run[]>();
  for (const run of runs) {
    if (!map.has(run.game)) map.set(run.game, []);
    map.get(run.game)!.push(run);
  }
  return Array.from(map.entries()).map(([game, runs]) => ({ game, runs }));
}

export default function RunsTable({ runs, personalBests }: RunsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const colCount = 4;

  // Filter to only verified non-PB runs
  const orphanedRuns = runs.filter((run) => {
    const pb = personalBests.find(
      (pb) => pb.category_name === run.category && pb.platform === run.platform
    );
    if (!pb) return false; // no PB in this category means this IS the PB, skip

    const pbTime =
      pb.timing_method === "gametime" ? pb.gametime_ms : pb.realtime_ms;
    const runTime =
      run.timing_method === "gametime" ? run.gametime_ms : run.realtime_ms;

    // It's orphaned if it's slower than the PB
    return runTime !== null && pbTime !== null && runTime > pbTime;
  });

  if (orphanedRuns.length === 0) return null;

  const gameGroups = groupByGame(orphanedRuns);

  return (
    <div className="profile-section">
      <h2 className="profile-section-title">Other Runs</h2>

      <div className="profile-pb-games">
        {gameGroups.map((group) => (
          <div key={group.game} className="profile-pb-game">
            <span className="profile-pb-game-title" style={{ cursor: "default" }}>
              {group.game}
            </span>

            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Platform</th>
                    <th>Time</th>
                    <th>Video</th>
                  </tr>
                </thead>
                <tbody>
                  {group.runs.map((run) => {
                    const isExpanded = expandedId === run.id;
                    const primaryTime =
                      run.timing_method === "gametime"
                        ? run.gametime_display
                        : run.realtime_display;
                    const secondaryTime =
                      run.timing_method === "gametime"
                        ? run.realtime_display
                        : run.gametime_display;
                    const secondaryLabel =
                      run.timing_method === "gametime" ? "RTA" : "IGT";

                    return (
                      <>
                        <tr
                          key={run.id}
                          onClick={() =>
                            setExpandedId((prev) =>
                              prev === run.id ? null : run.id
                            )
                          }
                          style={{ cursor: "pointer" }}
                        >
                          <td>{run.category}</td>
                          <td className="date-cell">{run.platform}</td>
                          <td className="time-cell">
                            {primaryTime || "—"}
                            {secondaryTime &&
                              run.realtime_ms !== run.gametime_ms && (
                                <span className="time-secondary">
                                  {" "}({secondaryTime} {secondaryLabel})
                                </span>
                              )}
                          </td>
                          <td className="video-cell">
                            {run.video_url ? (
                              <a
                                href={run.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="video-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                ▶ Watch
                              </a>
                            ) : (
                              <span className="no-video">—</span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr
                            key={`${run.id}-comment`}
                            className="run-accordion-row"
                          >
                            <td colSpan={colCount} className="run-accordion-cell">
                              <div className="run-accordion-content">
                                <span className="run-accordion-label">
                                  Date:
                                </span>{" "}
                                {new Date(run.submitted_at).toLocaleDateString()}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}