const sections = ['Façade', 'Caisson', 'Intérieur']

export default function ConfiguratorPanel() {
  return (
    <aside className="panel">
      <div className="panel__eyebrow">Configurateur 3D</div>
      <h1>Votre meuble</h1>
      <p className="panel__intro">
        Le moteur est prêt à recevoir le modèle et sa bibliothèque de matériaux.
      </p>

      <div className="panel__sections">
        {sections.map((section) => (
          <button className="panel__section" type="button" key={section}>
            <span>{section}</span>
            <span aria-hidden="true">+</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
