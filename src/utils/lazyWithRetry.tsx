import { ComponentType, lazy, Suspense, Component } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

class ErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error in lazy loaded component:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.error('Lazy loading failed:', error);
      return { 
        default: (() => <div>Failed to load component. Please try again.</div>) as unknown as T 
      };
    }
  });

  return (props: any) => (
    <ErrorBoundary 
      fallback={
        <div className="p-4 text-red-600">
          An error occurred while loading this component.
          <button 
            onClick={() => window.location.reload()} 
            className="ml-2 px-3 py-1 bg-red-100 rounded hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      }
    >
      <Suspense fallback={fallback || <LoadingSpinner size="md" />}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
