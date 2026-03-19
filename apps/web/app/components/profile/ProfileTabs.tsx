"use client";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import PBTable from "./Pbtable";
import RunsTable from "./Runstable";
import RejectedRuns from "./RejectedRuns";

interface ProfileTabsProps {
  fullGameGroups: any[];
  ilGroups: any[];
  otherRuns: any[];
  profileUser: {
    username: string;
    display_name: string | null;
    country: string | null;
  };
}

export default function ProfileTabs({
  fullGameGroups,
  ilGroups,
  otherRuns,
  profileUser,
}: ProfileTabsProps) {
  const { user } = useAuth();
  const isOwnProfile = user?.username === profileUser.username;
  const [activeTab, setActiveTab] = useState<"runs" | "rejected">("runs");

  return (
    <>
      <div className="leaderboard-tabs" style={{ marginBottom: "1.5rem" }}>
        <button
          className={`leaderboard-tab ${activeTab === "runs" ? "active" : ""}`}
          onClick={() => setActiveTab("runs")}
        >
          Runs
        </button>
        {isOwnProfile && (
          <button
            className={`leaderboard-tab ${activeTab === "rejected" ? "active" : ""}`}
            onClick={() => setActiveTab("rejected")}
          >
            Rejected
          </button>
        )}
      </div>

      {activeTab === "runs" && (
        <>
          <div className="profile-section">
            <h2 className="profile-section-title">Personal Bests</h2>
            <PBTable
              fullGameGroups={fullGameGroups}
              ilGroups={ilGroups}
              profileUser={profileUser}
            />
          </div>
          <RunsTable variant="runs" runs={otherRuns} />
        </>
      )}

      {activeTab === "rejected" && isOwnProfile && (
        <RejectedRuns username={profileUser.username} />
      )}
    </>
  );
}