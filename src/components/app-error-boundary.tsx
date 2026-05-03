import { Component, type ComponentChildren } from 'preact'

interface AppErrorBoundaryProps {
  children: ComponentChildren
}

interface AppErrorBoundaryState {
  hasError: boolean
  message: string
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  override componentDidCatch(error: Error): void {
    this.setState({ hasError: true, message: error.message || 'Unexpected application error' })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div class="error-banner error-banner--crash" role="alert">
          <span class="error-banner__icon" aria-hidden="true">⚠</span>
          <div class="error-banner__body">
            <p>Something went wrong while rendering the app.</p>
            <p class="error-banner__detail">{this.state.message}</p>
            <button class="btn btn-secondary" onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
