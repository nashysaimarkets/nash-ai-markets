"use client";

import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Log prefix, e.g. "brief" or "dashboard". */
  route: string;
  title: string;
  description: string;
  correlationId?: string | null;
};

type State = { failed: boolean };

/**
 * Member routes assemble their data inside a try/catch, but React invokes the
 * presentation components *after* the page function returns, so a render-phase
 * throw escapes that catch and blanks the whole route. This boundary keeps a
 * presentation failure contained and reported.
 */
export class RouteRenderBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[${this.props.route}:render] ${JSON.stringify({
        correlationId: this.props.correlationId ?? null,
        error: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      })}`,
    );
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section className="dashPartialBanner is-critical" role="alert">
        <strong>{this.props.title}</strong>
        <span>
          {this.props.description}
          {this.props.correlationId ? ` Ref ${this.props.correlationId}.` : ""}
        </span>
        <div>
          <Link href="/dashboard">Open Dashboard</Link>
          <Link href="/terminal">Open Trading Desk</Link>
          <Link href="/brief">Open Morning Brief</Link>
        </div>
      </section>
    );
  }
}
