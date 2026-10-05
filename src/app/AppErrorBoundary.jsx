import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Configurator runtime error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-error">
          <div className="app-error__card">
            <div className="admin__eyebrow">Configurateur 3D</div>
            <h1>Une erreur est survenue</h1>
            <p>L’interface n’a pas pu se charger correctement.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Réessayer
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
