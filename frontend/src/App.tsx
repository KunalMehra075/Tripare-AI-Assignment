import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HotelSearchForm } from './components/HotelSearchForm';
import { ComparisonResult } from './components/ComparisonResult';
import { Alert, AlertTitle, AlertDescription } from './components/ui/alert';
import { SearchFormData, SearchWorkflowResult } from './types';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './components/ui/button';

export const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [result, setResult] = useState<SearchWorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);

  // Check health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setBackendOnline(data.status === 'ok');
      })
      .catch(() => {
        setBackendOnline(false);
      });
  }, []);

  const handleSearch = async (formData: SearchFormData) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    // Generate a client tracking id for cancellation if needed
    const clientRequestId = `client-req-${Date.now()}`;
    setCurrentWorkflowId(clientRequestId);

    try {
      const response = await fetch('/api/search-hotels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Backend returned failure (e.g. 500 or 502)
        const errorMsg =
          data.message ||
          data.error ||
          (data.details && data.details.join(', ')) ||
          'Failed to retrieve hotel rates from suppliers.';
        setError(errorMsg);
        if (data.workflowId) {
          setCurrentWorkflowId(data.workflowId);
        }
      } else {
        setResult(data as SearchWorkflowResult);
        if (data.workflowId) {
          setCurrentWorkflowId(data.workflowId);
        }
      }
    } catch (err: any) {
      setError(
        err.message ||
          'Unable to reach backend server. Please verify backend is running.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!currentWorkflowId) return;

    try {
      await fetch(`/api/search-hotels/${currentWorkflowId}/cancel`, {
        method: 'POST',
      });
    } catch (err) {
      console.warn('Cancellation request sent:', err);
    } finally {
      setIsLoading(false);
      setResult({
        workflowId: currentWorkflowId,
        status: 'CANCELLED',
        comparison: {},
        message: 'Search request cancelled by user mid-way.',
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Header backendOnline={backendOnline} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Intro */}
        <div className="mb-6 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Compare Hotel Rates
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time rate orchestration and best-rate selection powered by Temporal workflows.
          </p>
        </div>

        {/* Search Form */}
        <HotelSearchForm
          onSearch={handleSearch}
          onCancel={handleCancel}
          isLoading={isLoading}
        />

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mt-6 shadow-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Search Failed</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit text-xs bg-white text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => setError(null)}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {result && <ComparisonResult result={result} />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        <p>Built with Node.js, TypeScript, Temporal SDK, React, & shadcn/ui</p>
      </footer>
    </div>
  );
};

export default App;

