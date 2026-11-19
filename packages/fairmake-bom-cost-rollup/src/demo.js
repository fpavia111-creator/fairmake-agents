import { fairmakeDemo } from 'fairmake-core';
import { manifest, DEMO } from './manifest.js';

export const demo = fairmakeDemo(manifest, new URL('../fixtures/', import.meta.url), DEMO);
