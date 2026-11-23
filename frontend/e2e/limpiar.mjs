import { rmSync } from 'node:fs';

export default function limpiar(config) {
  if (typeof config.metadata.data === 'string') rmSync(config.metadata.data, {force: true, recursive: true});
}
