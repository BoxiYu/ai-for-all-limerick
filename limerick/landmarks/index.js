// Landmark registry. All landmarks build before the city fill, so each reserves its own ground.
// Order matters only for the deterministic city layout.
import castle from './castle.js';
import church from './church.js';
import bridges from './bridges.js';
import stone from './treaty-stone.js';
import library from './library.js';
import customHouse from './custom-house.js';
import curragower from './curragower.js';
import granary from './granary.js';
import terrace from './terrace.js';
import datacentres from './datacentres.js';
import windows from './windows.js';

export default [castle, church, bridges, stone, library, customHouse, curragower, granary, terrace, datacentres, windows];
