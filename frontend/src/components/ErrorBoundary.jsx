import React from 'react'

/**
 * Global Error Boundary component for catching JavaScript errors anywhere
 * in its child component tree, logging them, and rendering a graceful
 * inline fallback UI instead of crashing the entire page.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }

  render() {
    if (this.state.hasError) {
      const { title = 'View Temporarily Unavailable', fallbackMessage } = this.props

      return (
        <div className="my-4 p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-rose-500/30 shadow-xl shadow-rose-950/20 backdrop-blur-md transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 text-lg shrink-0 shadow-inner">
                ⚠️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {title}
                  </h3>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Inline Recovered
                  </span>
                </div>
                <p className="text-xs text-rose-300/80 mt-1 font-mono break-all line-clamp-2">
                  {fallbackMessage || this.state.error?.message || 'An unexpected rendering error occurred.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>↺</span>
                <span>Retry View</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
