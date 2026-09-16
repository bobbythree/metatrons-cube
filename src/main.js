import './style.css'

const canvas = document.querySelector('#canvas')
const ctx = canvas.getContext('2d')
const solidButtons = [...document.querySelectorAll('.solid-button')]
const scopeInputs = [...document.querySelectorAll('.scope-input')]

const BASE_COLOR = '#4682b4'
const HIGHLIGHT_COLOR = '#add8e6'
const PHI = (1 + Math.sqrt(5)) / 2

const signed = (values) => {
  const result = []
  const combinations = 2 ** values.length
  for (let mask = 0; mask < combinations; mask += 1) {
    result.push(values.map((value, index) => (mask & (1 << index) ? value : -value)))
  }
  return result
}

const uniqueVertices = (vertices) => {
  const seen = new Set()
  return vertices.filter((vertex) => {
    const key = vertex.join(',')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const solids = {
  tetrahedron: { vertices: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]] },
  cube: { vertices: signed([1, 1, 1]) },
  octahedron: { vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] },
  icosahedron: {
    vertices: uniqueVertices([
      ...signed([0, 1, PHI]),
      ...signed([1, PHI, 0]),
      ...signed([PHI, 0, 1]),
    ]),
  },
}

const distance3d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

Object.values(solids).forEach((solid) => {
  let edgeLength = Infinity
  for (let i = 0; i < solid.vertices.length; i += 1) {
    for (let j = i + 1; j < solid.vertices.length; j += 1) {
      const distance = distance3d(solid.vertices[i], solid.vertices[j])
      if (distance > 0.001 && distance < edgeLength) edgeLength = distance
    }
  }

  solid.edges = []
  for (let i = 0; i < solid.vertices.length; i += 1) {
    for (let j = i + 1; j < solid.vertices.length; j += 1) {
      if (Math.abs(distance3d(solid.vertices[i], solid.vertices[j]) - edgeLength) < 0.001) {
        solid.edges.push([i, j])
      }
    }
  }
})

// The standard golden-ratio coordinates are rotated in their projection plane.
// This correction places the six outer icosahedron vertices exactly on the
// vertical Metatron lattice.
const GOLDEN_SOLID_ROTATION = -22.23875609296496 * (Math.PI / 180)
solids.icosahedron.rotation = GOLDEN_SOLID_ROTATION

// Look down the [1, 1, 1] axis. This is the corner-on projection that
// produces Metatron's sixfold lattice: a cube's six visible vertices land
// directly on the six circle centres and its near/far vertices overlap in the
// middle. Using this same basis for every solid keeps their shared orientation.
const projectToMetatron = ([x, y, z]) => {
  const screenX = (x - y) / Math.sqrt(2)
  const screenY = (x + y - 2 * z) / Math.sqrt(6)
  const depth = (x + y + z) / Math.sqrt(3)
  return [screenX, screenY, depth]
}

const rotateProjection = ([x, y, z], angle = 0) => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
  z,
]

function drawBase(centerX, centerY, unit) {
  const circleRadius = unit / 2
  const points = [[centerX, centerY]]
  for (let ring = 1; ring <= 2; ring += 1) {
    for (let i = 0; i < 6; i += 1) {
      const angle = i * (Math.PI / 3) - Math.PI / 2
      points.push([centerX + Math.cos(angle) * unit * ring, centerY + Math.sin(angle) * unit * ring])
    }
  }

  ctx.save()
  ctx.strokeStyle = BASE_COLOR
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.58
  ctx.lineWidth = Math.max(0.8, unit * 0.009)
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      ctx.beginPath()
      ctx.moveTo(...points[i])
      ctx.lineTo(...points[j])
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 0.92
  ctx.lineWidth = Math.max(1.2, unit * 0.015)
  points.forEach(([x, y]) => {
    ctx.beginPath()
    ctx.arc(x, y, circleRadius, 0, Math.PI * 2)
    ctx.stroke()
  })
  ctx.restore()
}

function drawSolid(solid, centerX, centerY, radius) {
  const projected = solid.vertices.map((vertex) => rotateProjection(
    projectToMetatron(vertex),
    solid.rotation,
  ))
  const maxExtent = Math.max(...projected.map(([x, y]) => Math.hypot(x, y)))
  const points = projected.map(([x, y, z]) => ({
    x: centerX + (x / maxExtent) * radius,
    y: centerY + (y / maxExtent) * radius,
    z,
  }))
  const edges = [...solid.edges].sort((a, b) => {
    const depthA = (points[a[0]].z + points[a[1]].z) / 2
    const depthB = (points[b[0]].z + points[b[1]].z) / 2
    return depthA - depthB
  })

  ctx.save()
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.fillStyle = HIGHLIGHT_COLOR
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = HIGHLIGHT_COLOR
  ctx.shadowBlur = Math.max(5, radius * 0.055)
  ctx.lineWidth = Math.max(2.2, radius * 0.018)
  edges.forEach(([start, end]) => {
    const averageDepth = (points[start].z + points[end].z) / 2
    ctx.globalAlpha = averageDepth < 0 ? 0.5 : 0.98
    ctx.beginPath()
    ctx.moveTo(points[start].x, points[start].y)
    ctx.lineTo(points[end].x, points[end].y)
    ctx.stroke()
  })

  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  points.forEach(({ x, y }) => {
    ctx.beginPath()
    ctx.arc(x, y, Math.max(2, radius * 0.018), 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
}

// A lattice-aligned 2D dodecahedron look-alike, as in the reference image.
// It is intentionally not a perspective projection of a regular dodecahedron:
// that would preserve phi, but its vertices would not meet this lattice.
function drawDodecahedron(centerX, centerY, unit) {
  // These twelve outline corners are intersections of the base's straight lines.
  const step = Math.sqrt(3) / 5
  const outline = [
    [-step, -1], [step, -1], [2 * step, -0.8], [3 * step, -0.2],
    [3 * step, 0.2], [2 * step, 0.8], [step, 1], [-step, 1],
    [-2 * step, 0.8], [-3 * step, 0.2], [-3 * step, -0.2], [-2 * step, -0.8],
  ]
  const point = ([x, y]) => [centerX + x * unit, centerY + y * unit]
  const line = (start, end) => {
    ctx.beginPath()
    ctx.moveTo(...point(start))
    ctx.lineTo(...point(end))
    ctx.stroke()
  }

  ctx.save()
  ctx.strokeStyle = HIGHLIGHT_COLOR
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = HIGHLIGHT_COLOR
  ctx.shadowBlur = Math.max(5, unit * 0.055)
  ctx.lineWidth = Math.max(1.5, unit * 0.012)
  ctx.globalAlpha = 0.9

  // Trace only the strong internal edges in the reference, not the faint
  // Metatron construction lines visible through its blue fill.
  const upperLeft = [-0.45, -0.76]
  const upperMiddle = [0, -0.67]
  const upperRight = [0.45, -0.76]
  const lowerLeft = [-0.59, 0.33]
  const lowerRight = [0.59, 0.33]
  line(outline[11], upperLeft)
  line(upperLeft, upperMiddle)
  line(upperMiddle, upperRight)
  line(upperRight, outline[2])
  line([0, -1], [0, 1])
  line(outline[10], lowerLeft)
  line(lowerLeft, outline[7])
  line(outline[3], lowerRight)
  line(lowerRight, outline[6])
  line([0, 0], lowerLeft)
  line([0, 0], lowerRight)

  ctx.globalAlpha = 1
  ctx.lineWidth = Math.max(2.2, unit * 0.018)
  outline.forEach((vertex, index) => line(vertex, outline[(index + 1) % outline.length]))
  ctx.restore()
}

function render() {
  const bounds = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(bounds.width * dpr)
  canvas.height = Math.round(bounds.height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, bounds.width, bounds.height)

  const size = Math.min(bounds.width, bounds.height)
  const centerX = bounds.width / 2
  const centerY = bounds.height / 2
  drawBase(centerX, centerY, size * 0.165)

  solidButtons.forEach((button) => {
    if (button.getAttribute('aria-pressed') !== 'true') return
    const name = button.dataset.solid
    const scope = document.querySelector(`input[name="${name}-scope"]:checked`).value
    const draw = name === 'dodecahedron'
      ? (radius) => drawDodecahedron(centerX, centerY, radius)
      : (radius) => drawSolid(solids[name], centerX, centerY, radius)
    if (scope === 'inner' || scope === 'both') draw(size * 0.165)
    if (scope === 'outer' || scope === 'both') draw(size * 0.33)
  })
}

solidButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const isActive = button.getAttribute('aria-pressed') === 'true'
    button.setAttribute('aria-pressed', String(!isActive))
    render()
  })
})
scopeInputs.forEach((input) => input.addEventListener('change', render))

new ResizeObserver(render).observe(canvas)
render()
