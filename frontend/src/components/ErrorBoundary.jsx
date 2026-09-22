import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("RAMS frontend error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-error-screen" role="alert">
        <div className="app-error-card">
          <div className="app-error-icon" aria-hidden="true">!</div>
          <p className="eyebrow">RAMS application error</p>
          <h1>Something went wrong</h1>
          <p>
            The interface could not render this screen. Reload the application and try again.
          </p>
          <button type="button" className="primary" onClick={this.handleReload}>
            Reload application
          </button>
          {import.meta.env.DEV && this.state.error?.message ? (
            <details className="app-error-details">
              <summary>Technical details</summary>
              <pre>{this.state.error.message}</pre>
            </details>
          ) : null}
        </div>
      </main>
    );
  }
}
