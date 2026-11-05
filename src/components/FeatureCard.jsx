import React from 'react';
import Icon from './Icons';

/**
 * Reusable feature card for highlighting platform capabilities with vector icons.
 */
export default function FeatureCard({ title, description, icon, badge }) {
  const renderIcon = () => {
    if (typeof icon === 'string') {
      const iconMap = {
        '</>': 'code',
        'code': 'code',
        '📚': 'book-open',
        'learn': 'book-open',
        'book-open': 'book-open',
        '📈': 'chart',
        'chart': 'chart',
        'track': 'chart',
        'trending-up': 'chart'
      };
      const iconKey = iconMap[icon] || 'code';
      return <Icon name={iconKey} size={26} color="currentColor" />;
    }
    return icon;
  };

  return (
    <div className="card h-100 border shadow-sm feature-card transition-all p-2">
      <div className="card-body p-4 d-flex flex-column">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="feature-icon-wrapper rounded-3 bg-primary-subtle text-primary d-flex align-items-center justify-content-center p-3">
            {renderIcon()}
          </div>
          {badge && (
            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle small px-2 py-1">
              {badge}
            </span>
          )}
        </div>
        <h3 className="h5 fw-bold text-dark mb-2">{title}</h3>
        <p className="card-text text-secondary small mb-0 lh-base">
          {description}
        </p>
      </div>
    </div>
  );
}
