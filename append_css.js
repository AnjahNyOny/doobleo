const fs = require('fs')
let content = fs.readFileSync('app/pages/room/[code]/index.vue', 'utf8')

const css = `
.scenes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.scene-card {
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
}

.scene-card:hover {
  background: #1a1a1a;
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.scene-card-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.scene-card-desc {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.waiting-scene {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}
.waiting-scene h2 {
  color: white;
  margin-bottom: 1rem;
}
</style>
`

content = content.replace('</style>', css)
fs.writeFileSync('app/pages/room/[code]/index.vue', content)
