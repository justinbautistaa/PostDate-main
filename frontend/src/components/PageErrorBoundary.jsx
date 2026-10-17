import { Component } from "react";

export default class PageErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main role="alert" style={{ maxWidth: 560, margin: "64px auto", padding: 24, textAlign: "center" }}>
      <h1>This page could not load.</h1>
      <p>Check your connection, then reload to get the latest version of PostDate.</p>
      <button type="button" onClick={() => window.location.reload()}>Reload page</button>
    </main>;
  }
}
