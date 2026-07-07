import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/design-system/components';

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SiteScop render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-danger/30 bg-surface p-8">
          <h2 className="text-lg font-bold text-danger">
            {this.props.title ?? 'Something went wrong'}
          </h2>
          <p className="mt-3 text-sm text-text">{this.state.error.message}</p>
          <Button
            className="mt-6"
            variant="secondary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
