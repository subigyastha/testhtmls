// Mascot Animation Kit: draws one baked frame.
//
// Step 1 composites the art layers for the frame on a 2D canvas at master
// resolution (1205 x 1306): expression patches for the breathing set, a pose
// crossfade for the prep set. Step 2 warps that composite with the app's own
// mesh (rig/rig.mjs warp) in WebGL, or with the app's Canvas fallback.

import { warp, ART_SCALE, clamp } from "./rig/rig.mjs"
import { makeMesh, drawCanvasPose, prepareHighResolutionTextures } from "./rig/renderer.mjs"
import { BREATHING_TEXTURES, PREP_POSES, OFFSETS } from "./motion.mjs"

export const ART_W = 1205, ART_H = 1306

const makeCanvas = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h })
const load = src => new Promise((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(Error("Missing " + src)); image.src = src
})

const VERT = "attribute vec2 a_position;attribute vec2 a_uv;varying vec2 v_uv;void main(){gl_Position=vec4(a_position,0.,1.);v_uv=a_uv;}"
const FRAG = "precision mediump float;varying vec2 v_uv;uniform sampler2D u_art;void main(){gl_FragColor=texture2D(u_art,v_uv);}"

function webglWarp(canvas) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true })
  if (!gl) throw Error("WebGL unavailable")
  const compile = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); return s }
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(program); gl.useProgram(program)
  const mesh = makeMesh(), positions = new Float32Array(mesh.uv.length)
  const attribute = (data, usage, name) => {
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage)
    const at = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0)
    return b
  }
  const vertices = attribute(positions, gl.DYNAMIC_DRAW, "a_position")
  attribute(mesh.uv, gl.STATIC_DRAW, "a_uv")
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  return (art, p, w, h) => {
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    for (let i = 0; i < mesh.uv.length; i += 2) {
      const [x, y] = warp(mesh.uv[i], mesh.uv[i + 1], p)
      positions[i] = (x - 0.5) * 2 * ART_SCALE; positions[i + 1] = (0.5 - y) * 2 * ART_SCALE
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices); gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art)
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0)
  }
}

function canvasWarp(canvas) {
  const ctx = canvas.getContext("2d")
  return (art, p, w, h) => {
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"
    drawCanvasPose(ctx, art, p, w, h, { cols: 48, rows: 56 })
  }
}

export async function loadCharacter(set, root = ".") {
  const art = makeCanvas(ART_W, ART_H), actx = art.getContext("2d")
  actx.imageSmoothingEnabled = true; actx.imageSmoothingQuality = "high"
  let compose
  if (set === "prep") {
    const images = Object.fromEntries(await Promise.all(PREP_POSES.map(async n => [n, await load(`${root}/art/prep-poses/${n}.webp`)])))
    const put = (name, alpha) => {
      const [dx, dy] = OFFSETS[name] || [0, 0]
      actx.globalAlpha = alpha; actx.drawImage(images[name], dx, dy, ART_W, ART_H)
    }
    // "lighter" adds premultiplied pixels, so A(1-m) + B(m) is an exact crossfade.
    compose = ({ a, b, amount }) => {
      actx.clearRect(0, 0, ART_W, ART_H); actx.globalCompositeOperation = "source-over"
      put(a, b ? 1 - amount : 1)
      if (b && amount > 0) { actx.globalCompositeOperation = "lighter"; put(b, amount) }
      actx.globalCompositeOperation = "source-over"; actx.globalAlpha = 1
    }
  } else {
    const [laugh, calm, exhale, eyes] = await Promise.all(BREATHING_TEXTURES.map(n => load(`${root}/art/expressions/${n}.webp`)))
    // The app's own texture prep: one body, face patches from the expression art.
    const layers = prepareHighResolutionTextures(laugh, calm, makeCanvas, exhale, eyes)
    compose = ({ calm, exhale, look }) => {
      actx.clearRect(0, 0, ART_W, ART_H)
      for (const [i, alpha] of [1, calm, exhale, look].entries()) { actx.globalAlpha = clamp(alpha); actx.drawImage(layers[i], 0, 0, ART_W, ART_H) }
      actx.globalAlpha = 1
    }
  }
  const surface = makeCanvas(1, 1)
  let draw, backend
  try { draw = webglWarp(surface); backend = "WebGL" } catch { draw = canvasWarp(surface); backend = "Canvas" }
  return {
    set, backend,
    // Draws the warped character into rect {x, y, w, h} of ctx (output pixels).
    render(ctx, frame, rect) {
      compose(frame.layers)
      const w = Math.max(1, Math.round(rect.w)), h = Math.max(1, Math.round(rect.h))
      draw(art, frame.p, w, h)
      ctx.drawImage(surface, rect.x, rect.y, rect.w, rect.h)
    }
  }
}

// An approximation of the routine page scene (tracker_ui.css .visit-routine__scene):
// a faint halo that swells with the breath and a soft ground shadow. halo: false = shadow only.
export function drawScene(ctx, rect, breath, ink = "#1c1c1c", { halo = true } = {}) {
  const cx = rect.x + rect.w / 2
  ctx.save()
  const r = rect.w * 0.36 * (0.96 + 0.04 * breath)
  ctx.globalAlpha = halo ? 0.035 : 0; ctx.strokeStyle = ink; ctx.lineWidth = rect.w * 0.03
  ctx.beginPath(); ctx.arc(cx, rect.y + rect.h * 0.08 + rect.w * 0.36, r, 0, Math.PI * 2); ctx.stroke()
  const gy = rect.y + rect.h * 0.92, gw = rect.w * 0.48 * (1 + 0.03 * breath) / 2, gh = rect.h * 0.03
  ctx.globalAlpha = 1; ctx.translate(cx, gy); ctx.scale(1, gh / gw)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, gw)
  g.addColorStop(0, "rgba(28,28,28,.16)"); g.addColorStop(0.55, "rgba(28,28,28,.05)"); g.addColorStop(0.72, "rgba(28,28,28,0)")
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, gw, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}
