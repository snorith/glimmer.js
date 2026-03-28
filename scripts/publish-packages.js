#!/usr/bin/env node

/**
 * Publishes all non-private packages in the monorepo to npm.
 *
 * Usage: node scripts/publish-packages.js [--provenance] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const provenance = args.includes('--provenance');

const packagesDir = path.join(__dirname, '..', 'packages', '@glimmer');
const packages = fs.readdirSync(packagesDir).filter((name) => {
  const pkgJsonPath = path.join(packagesDir, name, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  return !pkg.private && pkg.publishConfig;
});

console.log(`Publishing ${packages.length} packages${dryRun ? ' (dry run)' : ''}:\n`);

let failed = [];

packages.forEach((name) => {
  const pkgDir = path.join(packagesDir, name);
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

  const flags = ['--access', 'public'];
  if (provenance) flags.push('--provenance');
  if (dryRun) flags.push('--dry-run');

  const cmd = `npm publish ${flags.join(' ')}`;
  console.log(`  ${pkg.name}@${pkg.version}: ${cmd}`);

  try {
    execSync(cmd, { cwd: pkgDir, stdio: 'inherit' });
  } catch (err) {
    console.error(`  FAILED: ${pkg.name}`);
    failed.push(pkg.name);
  }
});

console.log(`\nPublished ${packages.length - failed.length}/${packages.length} packages`);
if (failed.length > 0) {
  console.error(`\nFailed packages:\n${failed.map((n) => `  - ${n}`).join('\n')}`);
  process.exit(1);
}
