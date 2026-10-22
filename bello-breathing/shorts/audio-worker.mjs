// Builds the sound stems off the main thread for the portal.
import { buildStems } from "./audio-core.mjs"
import { EXERCISES } from "../animation-kit/motion.mjs"

self.onmessage = ({ data: spec }) => {
  const { SR, N, duration, stems } = buildStems(spec, EXERCISES)
  const buffers = []
  for (const s of Object.values(stems)) buffers.push(s[0].buffer, s[1].buffer)
  self.postMessage({ SR, N, duration, stems }, buffers)
}
