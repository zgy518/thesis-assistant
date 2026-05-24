import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h1 className="mb-2 text-xl font-bold text-foreground">出错了</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              {this.state.error?.message || "应用发生了意外错误"}
            </p>
            <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/"; }}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              返回首页
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
