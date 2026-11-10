'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseCsv, parsePrice, applyChanges} = require('../scripts/importCatalog');

test('Acepta precios con puntos, signo de pesos y espacios', () => {
  assert.equal(parsePrice('130000', 'p1'), 130000);
  assert.equal(parsePrice('$ 130.000', 'p1'), 130000);
  assert.equal(parsePrice('', 'p1'), undefined);
  assert.throws(() => parsePrice('130,50', 'p1'));
  assert.throws(() => parsePrice('0', 'p1'));
});

test('Las celdas vacías no cambian el producto', () => {
  const csv = '﻿id;categoria;nombre;precio;tallas;foto\r\np001;Gorras;A;45.000;;/img/p001.jpg\r\np002;Gorras;B;;Talla única;/img/p002.jpg\r\np003;Gorras;C;;;x\r\n';
  assert.deepEqual(parseCsv(csv), [
    {id: 'p001', precio: 45000},
    {id: 'p002', tallas: ['Talla única']}
  ]);
});

test('Solo informa los productos que realmente cambian y rechaza referencias inexistentes', () => {
  const products = [
    {id: 'p001', nombre: 'A', precio: null, tallas: []},
    {id: 'p002', nombre: 'B', precio: 70000, tallas: ['M']}
  ];
  const applied = applyChanges(products, [{id: 'p001', precio: 45000, tallas: ['7', '7 1/8']}, {id: 'p002', precio: 70000}]);
  assert.equal(applied.length, 1);
  assert.deepEqual(products[0], {id: 'p001', nombre: 'A', precio: 45000, tallas: ['7', '7 1/8']});
  assert.throws(() => applyChanges(products, [{id: 'p999', precio: 1}]));
});

test('La plantilla incluida se puede leer sin errores', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const file = path.join(__dirname, '..', 'data', 'completar-catalogo.csv');
  if (fs.existsSync(file)) assert.doesNotThrow(() => parseCsv(fs.readFileSync(file, 'utf8')));
});
