import ConfiguratorScene from '../engine/scene/ConfiguratorScene'
import ConfiguratorPanel from '../ui/ConfiguratorPanel'
import ModelMapper from '../admin/ModelMapper'

export default function App() {
  if (new URLSearchParams(window.location.search).get('admin') === 'model') {
    return <ModelMapper />
  }

  return (
    <main className="configurator">
      <section className="configurator__viewer" aria-label="Aperçu 3D">
        <ConfiguratorScene />
      </section>
      <ConfiguratorPanel />
    </main>
  )
}
