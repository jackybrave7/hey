// web/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Error boundary — показывает ошибку прямо на странице, чтобы не гадать
class ErrorBoundary extends React.Component {
  state = { error: null, info: null };
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) {
    console.error('[HEY Error]', err, info);
    this.setState({ info });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight:'100vh', padding:'40px 20px',
          background:'var(--grad,#2a1058)', color:'white',
          fontFamily:'system-ui,sans-serif', boxSizing:'border-box',
          overflow:'auto',
        }}>
          <div style={{maxWidth:720,margin:'0 auto'}}>
            <h1 style={{fontSize:22,fontWeight:700,marginTop:0}}>⚠ Что-то сломалось</h1>
            <pre style={{
              background:'rgba(0,0,0,.4)',padding:16,borderRadius:12,
              whiteSpace:'pre-wrap',wordBreak:'break-word',fontSize:13,lineHeight:1.5,
              color:'#ff9090',
            }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            {this.state.error?.stack && (
              <details style={{marginTop:14}}>
                <summary style={{cursor:'pointer',color:'#d8c5f5'}}>Стек</summary>
                <pre style={{
                  background:'rgba(0,0,0,.4)',padding:12,borderRadius:10,
                  whiteSpace:'pre-wrap',wordBreak:'break-word',fontSize:11,
                  color:'rgba(255,255,255,.7)',marginTop:8,
                }}>{this.state.error.stack}</pre>
              </details>
            )}
            <button onClick={() => location.reload()}
              style={{
                marginTop:18,padding:'10px 24px',borderRadius:50,
                background:'rgba(120,90,200,.85)',border:'none',color:'white',
                fontSize:14,fontWeight:700,cursor:'pointer',
              }}>
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App/>
  </ErrorBoundary>
);
