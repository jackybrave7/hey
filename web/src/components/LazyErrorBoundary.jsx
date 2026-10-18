import React from 'react';
import ChunkLoadError from './ChunkLoadError';

export default class LazyErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[HEY lazy chunk]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <ChunkLoadError
          error={this.state.error}
          onRetry={() => {
            this.setState({ error: null });
            window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}
