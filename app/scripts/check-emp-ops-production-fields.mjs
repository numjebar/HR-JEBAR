import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/employee/EmpOps.jsx', import.meta.url), 'utf8');

assert.match(source, /production:\s*\{[^}]*dispatches:\s*\[\][^}]*wasteQty:\s*''/s, 'production default draft must keep dispatches and wasteQty');
assert.match(source, /case 'production':[\s\S]*s\.wasteQty[\s\S]*s\.dispatches[\s\S]*\.length > 0/, 'hasDraftData must consider wasteQty and dispatches');
assert.match(source, /if \(taskKey === 'production'\)[\s\S]*draft\.wasteQty[\s\S]*draft\.dispatches[\s\S]*\.length > 0/, 'hasAnyInput must consider wasteQty and dispatches');
assert.match(source, /<Field label="ส่งไปสาขา \(ถ้ามี\)">/, 'production form must render dispatch field');
assert.match(source, /<Field label="ของเสีย \(ชิ้น\)">/, 'production form must render waste field');
assert.match(source, /<Field label="อัตราของเสีย">/, 'production form must render waste-rate summary');

console.log('Employee OPS production field checks passed');
