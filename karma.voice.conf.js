// Karma configuration for the voice specs (npm run test:voice): headless Chrome, one run.
// karma.conf.js needs karma-coverage-istanbul-reporter, which is not installed, so it cannot be reused.

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      clearContext: false,
      jasmine: { random: false }
    },
    reporters: ['progress'],
    port: 9877,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ['ChromeHeadlessVoice'],
    customLaunchers: {
      ChromeHeadlessVoice: {
        base: 'ChromeHeadless',
        // No real microphone is opened: the specs stub getUserMedia.
        flags: ['--no-sandbox', '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
      }
    },
    singleRun: true,
    restartOnFileChange: false
  });
};
