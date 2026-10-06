import ConfiguratorScene from '../engine/scene/ConfiguratorScene'
import ConfiguratorPanel from '../ui/ConfiguratorPanel'
import ModelMapper from '../admin/ModelMapper'
import AdminGate from '../admin/AdminGate'
import { useConfiguratorStore } from '../configurator/state/configuratorStore'

export default function App() {
  const animationProgress = useConfiguratorStore((state) => state.animationProgress)
  const setAnimationProgress = useConfiguratorStore((state) => state.setAnimationProgress)
  const isOpen = animationProgress >= 0.5

  if (new URLSearchParams(window.location.search).get('admin') === 'model') {
    return <AdminGate>{({ signOut }) => <ModelMapper onSignOut={signOut} />}</AdminGate>
  }

  return (
    <main className="configurator">
      <section className="configurator__viewer" aria-label="Aperçu 3D">
        <ConfiguratorScene />
        <div className="configurator__animation-control">
          <button
            type="button"
            className="configurator__animation-button"
            onClick={() => setAnimationProgress(isOpen ? 0 : 1)}
            aria-label={isOpen ? 'Fermer le lit' : 'Ouvrir le lit'}
          >
            {isOpen ? 'Fermer le lit' : 'Ouvrir le lit'}
          </button>
        </div>
      </section>
      <ConfiguratorPanel />
    </main>
  )
}
