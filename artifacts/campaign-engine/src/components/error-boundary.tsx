import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
          <div className="max-w-lg space-y-4">
            <h1 className="text-3xl font-serif text-primary">魔法出了點問題...</h1>
            <p className="text-muted-foreground font-mono text-sm bg-card border border-border rounded p-4 text-left whitespace-pre-wrap">
              {this.state.error.message}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="px-6 py-2 bg-primary text-primary-foreground rounded font-serif hover:opacity-90 transition-opacity"
            >
              重新載入
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
