import React from 'react';
import Alert from './Alert';
import Button from './Button';
import { RefreshCw } from 'lucide-react';

export const LiveDataNotice = ({
  isMockMode = true,
  isLoading = false,
  apiError = null,
  onRetry = null,
  resourceLabel = 'civic data'
}) => {
  if (isMockMode) return null;

  if (apiError) {
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <Alert type="danger" title="Backend Connection Error">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <span>{apiError}</span>
            {onRetry && (
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                disabled={isLoading}
                onClick={() => onRetry()}
              >
                {isLoading ? 'Retrying...' : 'Retry Connection'}
              </Button>
            )}
          </div>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <Alert type="info" title="Loading Live Data" icon={RefreshCw}>
          Fetching {resourceLabel} from the CivicReflex backend server...
        </Alert>
      </div>
    );
  }

  return null;
};

export default LiveDataNotice;
