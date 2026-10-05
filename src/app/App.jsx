import ConfiguratorScene from '../engine/scene/ConfiguratorScene'
import ConfiguratorPanel from '../ui/ConfiguratorPanel'

export default function App() {
  return (
    <main className="configurator">
      <section className="configurator__viewer" aria-label="Aperçu 3D">
        <ConfiguratorScene />
      </section>
      <ConfiguratorPanel />
    </main>
  )
}
