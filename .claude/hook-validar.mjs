#!/usr/bin/env node
// Se dispara despues de cada Edit/Write. Valida SOLO el archivo tocado.
// Si la sintaxis quedo rota, sale con codigo 2 y Claude lo ve y lo corrige.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
let bruto = '';
try { bruto = await new Promise(r => { let s=''; process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => s += d); process.stdin.on('end', () => r(s)); }); } catch {}

let ruta = '';
try {
  const j = JSON.parse(bruto || '{}');
  const t = j.tool_input || j.toolInput || {};
  ruta = t.file_path || t.filePath || t.path || (Array.isArray(t.edits) && t.edits[0]?.file_path) || '';
} catch {}

if (!ruta) process.exit(0);
if (!['.html', '.js', '.mjs'].includes(extname(ruta).toLowerCase())) process.exit(0);

const r = spawnSync(process.execPath, [join(aqui, 'validar.mjs'), ruta], { encoding: 'utf8' });
if (r.status === 0) process.exit(0);
console.error('La validacion de sintaxis FALLO despues de editar ' + ruta + '. Corregilo antes de seguir:\n' + (r.stdout || '') + (r.stderr || ''));
process.exit(2);
