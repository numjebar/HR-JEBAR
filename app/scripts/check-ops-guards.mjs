import { spawnSync } from 'node:child_process';

const checks = [
  ['Bangkok time helper', 'node', ['scripts/check-bangkok-time.mjs']],
  ['OPS inbox helper', 'node', ['scripts/check-ops-inbox-helpers.mjs']],
  ['Employee OPS production fields', 'node', ['scripts/check-emp-ops-production-fields.mjs']],
];

for (const [label, command, args] of checks) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nAll OPS guard checks passed');
