#!/usr/bin/env node
// Valida la sintaxis del JavaScript de este proyecto.
//   node .claude/validar.mjs                  -> valida todos los .html y .js
//   node .claude/validar.mjs OFICINAS_PTOVISION.html
// En los .html revisa cada bloque <script> propio (los que tienen src= se saltan)
// y traduce el numero de linea del error a la linea REAL del archivo.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';

const RAIZ = process.cwd();
const tmp = mkdtempSync(join(tmpdir(), 'pv-val-'));
let fallos = 0, revisados = 0;

function chequear(codigo, etiqueta, offset) {
  const esModulo = /^\s*(import|export)\s/m.test(codigo);
  const f = join(tmp, 'x' + (esModulo ? '.mjs' : '.cjs'));
  writeFileSync(f, codigo);
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  revisados++;
  if (r.status === 0) return true;
  fallos++;
  const err = (r.stderr || '').split('\n').slice(0, 8)
    .map(l => l.replace(f, etiqueta).replace(/:(\d+)/, (_, n) => ':' + (Number(n) + offset)))
    .join('\n');
  console.error(`\n  ✗ ${etiqueta}\n${err}`);
  return false;
}

function validarHTML(ruta) {
  const txt = readFileSync(ruta, 'utf8');
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(txt)) !== null) {
    if (/\bsrc\s*=/i.test(m[1])) continue;          // lo carga de afuera, no es nuestro
    if (/type\s*=\s*["']?(application\/json|text\/template)/i.test(m[1])) continue;
    n++;
    const antes = txt.slice(0, m.index + m[0].indexOf('>') + 1);
    const linea = antes.split('\n').length;
    chequear(m[2], `${basename(ruta)} · bloque ${n} (empieza en la linea ${linea})`, linea - 1);
  }
  if (n === 0) console.log(`  · ${basename(ruta)}: sin script propio`);
}

const args = process.argv.slice(2);
const archivos = args.length ? args
  : readdirSync(RAIZ).filter(f => ['.html', '.js', '.mjs'].includes(extname(f).toLowerCase()));

console.log(`Validando ${archivos.length} archivo(s)...`);
for (const a of archivos) {
  const ext = extname(a).toLowerCase();
  try {
    if (ext === '.html') validarHTML(a);
    else if (ext === '.js' || ext === '.mjs') chequear(readFileSync(a, 'utf8'), basename(a), 0);
  } catch (e) { console.error(`  ✗ ${a}: no se pudo leer (${e.message})`); fallos++; }
}
rmSync(tmp, { recursive: true, force: true });
if (fallos) { console.error(`\nSINTAXIS CON ERRORES: ${fallos} de ${revisados} bloques.`); process.exit(1); }
console.log(`\nSintaxis correcta: ${revisados} bloque(s) revisado(s).`);
