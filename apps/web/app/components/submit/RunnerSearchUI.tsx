// @/app/components/submit/RunnerSearchUI.tsx
import { Runner } from "@/app/lib/types/submission";

interface RunnerSearchUIProps {
  runners: Runner[];
  results: Runner[];
  onAdd: (runner: Runner) => void;
  onRemove: (id: string) => void;
  search: string;
  setSearch: (val: string) => void;
  searching: boolean;
  required: number | null;
  currentUser: any;
}

export default function RunnerSearchUI({
  runners,
  results,
  onAdd,
  onRemove,
  search,
  setSearch,
  searching,
  required,
  currentUser,
}: RunnerSearchUIProps) {
  return (
    <div className="form-group">
      <label className="form-label">
        Runners * {required && `(${runners.length}/${required})`}
      </label>
      
      {/* 1. Restored the "Box around each name" (Badges) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {runners.map((r) => (
          <div 
            key={r.id} 
            className="runner-badge" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '4px 10px',
              border: '1px solid rgba(255, 255, 255, 0.2)', // The "box"
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              fontSize: '0.9rem'
            }}
          >
            <span>
              {r.display_name || r.username} 
              {r.id === currentUser?.id && <small style={{ opacity: 0.6, marginLeft: '4px' }}>(you)</small>}
            </span>
            {r.id !== currentUser?.id && (
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 0, fontSize: '1.1rem', lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 2. The Search Input & Dropdown */}
      {(!required || runners.length < required) && (
        <div className="runner-search-container" style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search for a runner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="auth-input"
          />
          
          {(results.length > 0 || searching) && (
            <div 
              className="search-results-dropdown" 
              style={{ 
                marginTop: '4px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                background: '#0a0a0a', // Matches your dark theme
                overflow: 'hidden'
              }}
            >
              {searching ? (
                <div style={{ padding: "12px", opacity: 0.5 }}>Searching...</div>
              ) : (
                results.map((res) => (
                  <div 
                    key={res.id} 
                    onClick={() => onAdd(res)} 
                    className="search-result-item"
                    style={{ 
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                      transition: "background 0.2s"
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{res.display_name || res.username}</span>
                    <span style={{ marginLeft: '8px', opacity: 0.4, fontSize: '0.85rem' }}>
                      @{res.username}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}