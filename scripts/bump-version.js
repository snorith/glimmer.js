#!/usr/bin/env node

/**
 * Bumps the version of all packages in the monorepo in lockstep.
 *
 * Usage: node scripts/bump-version.js [major|minor|patch]
 *
 * - Updates version in root package.json and all workspace packages
 * - Does NOT commit or tag (the CI workflow handles that)
 */

const fs = require('fs');
const path = require('path');

const RELEASE_TYPE = process.argv[2];
if (!['major', 'minor', 'patch'].includes(RELEASE_TYPE)) {
  console.error('Usage: node scripts/bump-version.js [major|minor|patch]');
  process.exit(1);
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

// Read root package.json to get current version
const rootPkgPath = path.join(__dirname, '..', 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const currentVersion = rootPkg.version;
const newVersion = bumpVersion(currentVersion, RELEASE_TYPE);

console.log(`Bumping version: ${currentVersion} -> ${newVersion} (${RELEASE_TYPE})`);

// Update root package.json
rootPkg.version = newVersion;
fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');
console.log(`  Updated: package.json`);

// Find all workspace packages
const packagesDir = path.join(__dirname, '..', 'packages', '@glimmer');
const packages = fs.readdirSync(packagesDir).filter((name) => {
  const pkgJsonPath = path.join(packagesDir, name, 'package.json');
  return fs.existsSync(pkgJsonPath);
});

// Update each package
packages.forEach((name) => {
  const pkgJsonPath = path.join(packagesDir, name, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  pkg.version = newVersion;

  // Update internal cross-references to use the new version
  ['dependencies', 'devDependencies', 'peerDependencies'].forEach((depType) => {
    if (!pkg[depType]) return;
    Object.keys(pkg[depType]).forEach((dep) => {
      if (dep.startsWith('@norith/glimmer-')) {
        pkg[depType][dep] = newVersion;
      }
    });
  });

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  Updated: packages/@glimmer/${name}/package.json`);
});

console.log(`\nVersion bumped to ${newVersion}`);
