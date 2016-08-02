/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var isProd = false;
var gulp = require('gulp'),
    fs = require('fs'),
    del = require('del'),
    watch = require('gulp-watch'),
    watchify = require('watchify'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    gutil = require('gulp-util'),
    babelify = require('babelify'),
    minifycss = require('gulp-minify-css'),
    uglify = require('gulp-uglify'),
    sass = require('gulp-sass'),
    streamify = require('gulp-streamify'),
    runSequence = require('run-sequence'),
    license = require('gulp-license'),
    replace = require('gulp-replace'),
    bump = require('gulp-bump'),
    vulcanize = require('gulp-vulcanize'),
    base64 = require('gulp-base64'),
    minifyInline = require('gulp-minify-inline'),
    path = require('path');

var version = null;

function createBundle(url) {
  return browserify({
    entries: [url],
    debug: !isProd
  }).transform(babelify);
}

function watchBundles() {
  var bundleKeys = Object.keys(bundles);
  var watch = null;
  var key = null;
  for (var b = 0; b < bundleKeys.length; b++) {
    key = bundleKeys[b];
    buildBundle(key);
    watch = watchify(bundles[key].bundle);
    watch.on('update', buildBundle.bind(this, key));
  }
}

function buildBundle(bundleName) {

  var job = bundles[bundleName];
  var bundle = job.bundle;
  var name = job.name;
  var dest = job.dest || './dist/scripts';

  var b = bundle.bundle()
      .on('log', gutil.log.bind(gutil, 'Browserify Log'))
      .on('error', gutil.log.bind(gutil, 'Browserify Error'))
      .pipe(source(name));

  if (isProd) {
    b = b.pipe(streamify(uglify()));
  }

  return b.pipe(license('Apache', {
      organization: 'Google Inc. All rights reserved.'
    }))
    .pipe(gulp.dest(dest));
}

var bundles = {
  'core': {
    url: './src/scripts/guitartuner-core.js',
    name: 'guitartuner-core.js',
    bundle: null
  },

  'audio-processor': {
    url: './src/elements/audio-processor/audio-processor.js',
    name: 'audio-processor.js',
    dest: './dist/elements/audio-processor',
    bundle: null
  },

  'audio-visualizer': {
    url: './src/elements/audio-visualizer/audio-visualizer.js',
    name: 'audio-visualizer.js',
    dest: './dist/elements/audio-visualizer',
    bundle: null
  },

  'tuning-instructions': {
    url: './src/elements/tuning-instructions/tuning-instructions.js',
    name: 'tuning-instructions.js',
    dest: './dist/elements/tuning-instructions',
    bundle: null
  }
};

/** Clean */
gulp.task('clean', function(done) {
  del(['dist'], done);
});

/** Styles */
gulp.task('styles', function() {
  return gulp.src('./src/styles/*.scss')
      .pipe(sass())
      .pipe(minifycss())
      .pipe(license('Apache', {
        organization: 'Google Inc. All rights reserved.'
      }))
      .pipe(gulp.dest('./dist/styles'));
});

/** Scripts */
gulp.task('scripts', function() {
  var bundleKeys = Object.keys(bundles);
  for (var b = 0; b < bundleKeys.length; b++) {
    buildBundle(bundleKeys[b]);
  }
});

/** Root */
gulp.task('root', function() {
  gulp.src('./src/*.*')
    .pipe(replace(/@VERSION@/g, version))
    .pipe(gulp.dest('./dist/'));

  return gulp.src('./src/favicon.ico')
    .pipe(gulp.dest('./dist/'));
});

/** HTML */
gulp.task('html', function() {

  return gulp.src('./src/**/*.html')
    .pipe(replace(/@VERSION@/g, version))
    .pipe(gulp.dest('./dist/'));
});

/** Images */
gulp.task('images', function() {
  return gulp.src([
      './src/**/*.svg',
      './src/**/*.png',
      './src/**/*.jpg'])
    .pipe(gulp.dest('./dist'));
});

/** Third Party */
gulp.task('third_party', function() {
  return gulp.src('./src/third_party/**/*.*')
    .pipe(gulp.dest('./dist/third_party'));
});

/** Service Worker */
gulp.task('serviceworker', function() {
  return gulp.src('./src/scripts/sw.js')
    .pipe(replace(/@VERSION@/g, version))
    .pipe(gulp.dest('./dist/scripts'));
});

/** Vulcanize */
gulp.task('vulcanize-and-minify', function() {

  return gulp.src('./dist/elements/**/*.html')
    .pipe(vulcanize({
      inlineScripts: true,
      inlineCss: true,
      stripExcludes: false,
      excludes: [path.resolve('./dist/third_party/polymer.html')]
    }))
    .pipe(base64())
    .pipe(minifyInline())
    .pipe(gulp.dest('./dist/elements'));

});

gulp.task('clean-elements-folder', function(done) {
  del(['dist/elements/**/*.*',
      '!dist/elements/**/*.svg',
      '!dist/elements/**/*.html'], done);
});

/** Watches */
gulp.task('watch', function() {
  gulp.watch('./src/**/*.scss', ['styles']);
  gulp.watch('./src/*.*', ['root']);
  gulp.watch('./src/**/*.html', ['html']);
  gulp.watch('./src/images/**/*.*', ['images']);
  gulp.watch('./src/third_party/**/*.*', ['third_party']);
  gulp.watch('./src/scripts/sw.js', ['serviceworker']);

  watchBundles();
});

gulp.task('getversion', function() {
  version = JSON.parse(fs.readFileSync('./package.json', 'utf8')).version;
});

/** Main tasks */

(function () {
  var bundleKeys = Object.keys(bundles);
  var key = null;
  for (var b = 0; b < bundleKeys.length; b++) {
    key = bundleKeys[b];
    bundles[key].bundle = createBundle(bundles[key].url);
  }
})();

var allTasks = ['styles', 'scripts', 'root', 'html', 'images',
    'third_party', 'serviceworker'];

gulp.task('bump', function() {
  return gulp.src('./package.json')
    .pipe(bump({type:'patch'}))
    .pipe(gulp.dest('./'));
});

gulp.task('default', function() {
  isProd = true;
  return runSequence('clean', 'bump', 'getversion', allTasks,
        'vulcanize-and-minify', 'clean-elements-folder');
});

gulp.task('dev', function() {
  return runSequence('clean', 'getversion', allTasks, 'watch');
});
