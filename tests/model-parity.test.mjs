import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {inferModel}=require('../dist/inference.js');
test('deployed random-forest inference matches every saved Python reference prediction',()=>{
 const model=JSON.parse(fs.readFileSync(new URL('../dist/model.json',import.meta.url)));
 const fixture=JSON.parse(fs.readFileSync(new URL('../model/prediction-parity.json',import.meta.url)));
 assert.equal(fixture.inputs.length,452);assert.equal(fixture.expected.length,452);
 assert.equal(model.version,'uci-comparison-2');assert.equal(model.type,'Random forest');
 fixture.inputs.forEach((input,i)=>assert.equal(inferModel(model,input),fixture.expected[i],`reference row ${i}`));
});
