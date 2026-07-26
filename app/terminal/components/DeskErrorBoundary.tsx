"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  failed: boolean;
};

/**
 * Keeps MemberShell chrome visible if Trading Desk client render crashes.
 * Avoids a blank white viewport when a child throws during hydration/render.
 */
export class DeskErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[TradingDeskOS]", error.message, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <section
          className="deskWidget deskUnavailable"
          role="alert"
          style={{
            margin: "24px 0",
            padding: "28px 24px",
            border: "1px solid #3a554c",
            borderRadius: 14,
            background: "#0d1411",
            color: "#e8f2ec",
          }}
        >
          <strong style={{ display: "block", marginBottom: 8, fontSize: 18 }}>Trading Desk could not finish rendering</strong>
          <p style={{ margin: 0, color: "#9aa7a0", lineHeight: 1.55 }}>
            The member shell is still available. Refresh the page to retry. No market figures were invented while the desk recovered.
          </p>
          <button
            type="button"
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "10px 16px",
              border: "1px solid #2f4038",
              borderRadius: 10,
              background: "#0c1411",
              color: "#dce6e1",
              cursor: "pointer",
            }}
            onClick={() => this.setState({ failed: false })}
          >
            Retry desk
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
