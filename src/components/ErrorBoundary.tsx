import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred. Please try refreshing the page.";
      let potentialCause = "This could be due to a temporary network issue or a configuration error.";
      let operationContext = "";
      
      try {
        if (this.state.error?.message) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.operationType) {
            operationContext = ` during ${parsedError.operationType}`;
            const rawError = parsedError.error.toLowerCase();
            
            if (rawError.includes('permission') || rawError.includes('insufficient')) {
              errorMessage = `Access Denied: You don't have permission to perform this action.`;
              potentialCause = "This usually happens if your user session has expired or if the security rules are restricting this specific operation. Try signing out and back in.";
            } else if (rawError.includes('quota') || rawError.includes('limit')) {
              errorMessage = `Quota Exceeded: The database has reached its free tier limit.`;
              potentialCause = "The daily usage limit for the database has been reached. Quotas typically reset every 24 hours.";
            } else if (rawError.includes('offline') || rawError.includes('network')) {
              errorMessage = `Connection Error: The database is unreachable.`;
              potentialCause = "You might be offline or behind a restrictive firewall. Please check your internet connection.";
            } else if (rawError.includes('not found')) {
              errorMessage = `Resource Not Found: The requested data does not exist.`;
              potentialCause = "The document or collection you are trying to access might have been deleted or moved.";
            } else {
              errorMessage = `Database Error: ${parsedError.error}`;
              potentialCause = "An unexpected database error occurred. If this persists, please contact support.";
            }
          }
        }
      } catch (e) {
        // Not a JSON error, use default or check raw message
        if (this.state.error?.message.includes('quota')) {
          errorMessage = "Quota Exceeded";
          potentialCause = "The database has reached its usage limit for today.";
        }
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Something went wrong{operationContext}</h2>
                <p className="text-red-400 text-sm font-medium">
                  {errorMessage}
                </p>
              </div>
              <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                <p className="text-zinc-400 text-xs leading-relaxed text-left">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider block mb-1">Potential Cause:</span>
                  {potentialCause}
                </p>
              </div>
            </div>
            <Button 
              onClick={this.handleReset}
              className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold py-6 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
