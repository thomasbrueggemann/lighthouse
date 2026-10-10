import { JOBS } from './texgen.js';

// Web Worker: computes one procedural texture per message and hands the pixel buffers back without copying.
self.onmessage = (e) => {
  const { name } = e.data;
  const raw = JOBS[name]();
  const transfer = [raw.col?.buffer, raw.rgh?.buffer, raw.nrm?.buffer].filter(Boolean);
  self.postMessage({ name, raw }, transfer);
};
