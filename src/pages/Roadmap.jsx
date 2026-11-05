import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getRoadmap,
  recalculateRoadmap,
  completeRoadmapRecommendation,
  getLatestComparison
} from '../utils/api';
import RevisionRoadmap from '../components/RevisionRoadmap';
import EvidenceComparison from '../components/EvidenceComparison';
import ActivityHistory from '../components/ActivityHistory';
import Icon from '../components/Icons';

/**
 * Roadmap Page (Milestones 15C & 15D)
 * Comprehensive view for the learner's evidence-based revision roadmap,
 * diagnostic reassessment comparisons, and verified learning activity history.
 */
export default function Roadmap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'roadmap';

  const [roadmap, setRoadmap] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(true);
  const [isLoadingComparison, setIsLoadingComparison] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadRoadmap = async () => {
    setErrorMessage('');
    try {
      const res = await getRoadmap();
      if (res.ok && res.data?.data) {
        setRoadmap(res.data.data);
      } else {
        setErrorMessage(res.data?.message || 'Failed to load revision roadmap.');
      }
    } catch {
      setErrorMessage('Network error while retrieving roadmap.');
    } finally {
      setIsLoadingRoadmap(false);
    }
  };

  const loadComparison = async () => {
    try {
      const res = await getLatestComparison();
      if (res.ok && res.data?.data) {
        setComparison(res.data.data);
      }
    } catch {
      // Comparison is optional
    } finally {
      setIsLoadingComparison(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getRoadmap(),
      getLatestComparison()
    ])
      .then(([roadmapRes, comparisonRes]) => {
        if (!isMounted) return;
        if (roadmapRes.ok && roadmapRes.data?.data) {
          setRoadmap(roadmapRes.data.data);
        } else {
          setErrorMessage(roadmapRes.data?.message || 'Failed to load revision roadmap.');
        }

        if (comparisonRes.ok && comparisonRes.data?.data) {
          setComparison(comparisonRes.data.data);
        }
      })
      .catch(() => {
        if (isMounted) setErrorMessage('Network error while retrieving roadmap data.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRoadmap(false);
          setIsLoadingComparison(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await recalculateRoadmap();
      if (res.ok && res.data?.data) {
        setRoadmap(res.data.data);
        // Refresh comparison too in case it was updated
        loadComparison();
      } else {
        setErrorMessage(res.data?.message || 'Failed to recalculate roadmap.');
      }
    } catch {
      setErrorMessage('Network error during roadmap recalculation.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleToggleComplete = async (recId, isCompleted) => {
    try {
      const res = await completeRoadmapRecommendation(recId, isCompleted);
      if (res.ok && res.data?.data) {
        setRoadmap(res.data.data);
      }
    } catch {
      loadRoadmap();
    }
  };

  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 pb-3 border-bottom gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span className="badge bg-primary px-2 py-1">Personalized Learning Plan</span>
            <span className="small text-secondary fw-semibold">Review &amp; Reassessment</span>
          </div>
          <h1 className="display-6 fw-bold text-dark mb-1">
            Revision <span className="text-primary">Roadmap & Progress</span>
          </h1>
          <p className="lead text-secondary mb-0 fs-6">
            Prioritized learning actions, longitudinal reassessment comparisons, and verified activity history.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/onboarding?edit=true" className="btn btn-outline-secondary fw-semibold d-inline-flex align-items-center gap-1.5">
            <Icon name="gear" size={14} />
            <span>Preferences</span>
          </Link>
          <Link to="/diagnostic" className="btn btn-outline-primary fw-semibold d-inline-flex align-items-center gap-1.5">
            <Icon name="brain" size={14} />
            <span>Diagnostic</span>
          </Link>
          <Link to="/dashboard" className="btn btn-primary fw-semibold d-inline-flex align-items-center gap-1.5">
            <Icon name="chart" size={14} />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" role="alert">
          <Icon name="alert-triangle" size={16} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <ul className="nav nav-pills mb-4 gap-2 border-bottom pb-3" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link fw-semibold d-inline-flex align-items-center gap-1.5 ${activeTab === 'roadmap' ? 'active' : ''}`}
            onClick={() => handleTabChange('roadmap')}
            role="tab"
            aria-selected={activeTab === 'roadmap'}
          >
            <Icon name="map" size={16} />
            <span>Revision Roadmap</span>
            {roadmap?.stats?.pendingCount !== undefined && (
              <span className={`badge ms-1.5 ${activeTab === 'roadmap' ? 'bg-white text-primary' : 'bg-secondary'}`}>
                {roadmap.stats.pendingCount}
              </span>
            )}
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link fw-semibold d-inline-flex align-items-center gap-1.5 ${activeTab === 'comparison' ? 'active' : ''}`}
            onClick={() => handleTabChange('comparison')}
            role="tab"
            aria-selected={activeTab === 'comparison'}
          >
            <Icon name="refresh" size={16} />
            <span>Reassessment Comparison</span>
            {comparison?.hasComparison && (
              <span className={`badge ms-1.5 ${
                comparison.overallDeltaPercentage > 0
                  ? 'bg-success text-white'
                  : comparison.overallDeltaPercentage < 0
                  ? 'bg-danger text-white'
                  : 'bg-info text-dark'
              }`}>
                {comparison.overallDeltaPercentage > 0 ? `+${comparison.overallDeltaPercentage}` : comparison.overallDeltaPercentage}%
              </span>
            )}
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link fw-semibold d-inline-flex align-items-center gap-1.5 ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
            role="tab"
            aria-selected={activeTab === 'history'}
          >
            <Icon name="clipboard" size={16} />
            <span>Verified Activity History</span>
          </button>
        </li>
      </ul>

      {/* Tab Content */}
      {activeTab === 'roadmap' && (
        isLoadingRoadmap ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading revision roadmap...</span>
            </div>
            <p className="text-secondary mt-3">Evaluating learning preferences and diagnostic evidence...</p>
          </div>
        ) : (
          <RevisionRoadmap
            roadmap={roadmap}
            onRecalculate={handleRecalculate}
            onToggleComplete={handleToggleComplete}
            isRecalculating={isRecalculating}
          />
        )
      )}

      {activeTab === 'comparison' && (
        <EvidenceComparison
          comparison={comparison}
          isLoading={isLoadingComparison}
          onRefresh={loadComparison}
        />
      )}

      {activeTab === 'history' && (
        <ActivityHistory />
      )}
    </div>
  );
}
