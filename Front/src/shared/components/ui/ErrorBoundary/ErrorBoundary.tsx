import React from 'react';

type State = {
  hasError: boolean;
  error?: Error | null;
  errorInfo?: React.ErrorInfo | null;
};

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error } as State;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console and preserve stack for debugging
    // (server-side logging can be added here)
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, background: '#fff0f0', color: '#800', fontFamily: 'system-ui, sans-serif' }}>
          <h2>Se ha producido un error en la interfaz</h2>
          <p>Puedes recargar la página o copiar el error para investigar.</p>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ marginRight: 8 }}>
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}
