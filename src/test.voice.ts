// Entry point of the voice specs (npm run test:voice). The specs themselves are picked by
// tsconfig.voice-spec.json and the --include option, not by a require.context here.

import 'zone.js/testing'; // zone.js itself comes from src/polyfills.ts
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
