// scripts/build-exe.js
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'print-server', 'dist');
const OUTPUT_EXE = path.join(ROOT_DIR, 'quickprint.exe');
const SEA_CONFIG = path.join(ROOT_DIR, 'sea-config.json');
const BLOB_FILE = path.join(DIST_DIR, 'sea-prep.blob');
const CJS_FILE = path.join(DIST_DIR, 'server.cjs');

console.log('Building standalone QuickPrint Daemon (.exe)...');

// 1. Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// 2. Bundle into single CJS file
console.log('1/4 Bundling zero-dependency server code...');
execSync(
  `npx -y esbuild print-server/src/index.js --bundle --platform=node --format=cjs --outfile="${CJS_FILE}"`,
  { stdio: 'inherit' }
);

// 3. Ensure sea-config.json exists
fs.writeFileSync(
  SEA_CONFIG,
  JSON.stringify(
    {
      main: 'print-server/dist/server.cjs',
      output: 'print-server/dist/sea-prep.blob',
      disableExperimentalSEAWarning: true,
    },
    null,
    2
  )
);

// 4. Generate SEA prep blob
console.log('2/4 Generating Single Executable preparation blob...');
execSync(`node --experimental-sea-config "${SEA_CONFIG}"`, { stdio: 'inherit' });

// 5. Copy node binary
console.log('3/4 Copying base Windows executable...');
fs.copyFileSync(process.execPath, OUTPUT_EXE);

// Ensure SumatraPDF.exe is present next to quickprint.exe for silent printing
const sumatraSrc = path.join(ROOT_DIR, 'print-server', 'bin', 'SumatraPDF.exe');
const sumatraDest = path.join(ROOT_DIR, 'SumatraPDF.exe');
if (fs.existsSync(sumatraSrc)) {
  fs.copyFileSync(sumatraSrc, sumatraDest);
}

// 6. Inject blob using postject
console.log('4/4 Injecting payload into quickprint.exe...');
execSync(
  `npx -y postject "${OUTPUT_EXE}" NODE_SEA_BLOB "${BLOB_FILE}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
  { stdio: 'inherit' }
);

const stats = fs.statSync(OUTPUT_EXE);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(1);

console.log(`\nSuccessfully generated standalone executable!`);
console.log(`   File: ${OUTPUT_EXE}`);
console.log(`   Size: ${sizeMb} MB`);
console.log(`   Instructions: Hand this .exe file to the merchant. They simply double-click it to run!\n`);
