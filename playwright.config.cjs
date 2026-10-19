const {defineConfig} = require('@playwright/test');
const {browserEnvironment} = require('./scripts/browser-runtime.cjs');
module.exports = defineConfig({
  testDir:'tests/browser', workers:1, fullyParallel:false, retries:0,
  timeout:30000, reporter:[['list'],['html',{outputFolder:'.artifacts/browser-report',open:'never'}]],
  outputDir:'.artifacts/browser-results',
  use:{baseURL:'http://127.0.0.1:4179', browserName:'chromium', headless:true, launchOptions:{env:browserEnvironment()}, trace:'retain-on-failure', screenshot:'only-on-failure'},
  webServer:{command:'node scripts/request-preview.cjs', url:'http://127.0.0.1:4179', reuseExistingServer:false, env:{PORT:'4179',HOST:'127.0.0.1'}, timeout:15000},
});
