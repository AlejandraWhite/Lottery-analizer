// components/ErrorBoundary.jsx
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Crash capturado:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: "monospace", color: "#b91c1c" }}>
          <h2>Ocurrió un error</h2>
          <p>{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}