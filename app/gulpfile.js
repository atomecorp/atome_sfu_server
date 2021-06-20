const gulp = require('gulp');
const gutil = require('gulp-util');
const plumber = require('gulp-plumber');
const rename = require('gulp-rename');
const browserify = require('browserify');
const envify = require('envify/custom');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const del = require('del');
const browserSync = require('browser-sync');
const path = require('path');

const PKG = require('./package.json');
const OUTPUT_DIR = '../server/public';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

function logError(error)
{
    gutil.log(gutil.colors.red(error.stack));
}

function bundle() {
    let bundler = browserify(
        {
            entries: PKG.main,
            extensions: ['.js', '.jsx'],
            debug: true,
            cache: {},
            packageCache: {},
            fullPaths: false
        })
        .transform('babelify')
        .transform(envify(
            {
                NODE_ENV: process.env.NODE_ENV,
                _: 'purge'
            }));

    return bundler.bundle()
        .on('error', logError)
        .pipe(plumber())
        .pipe(source(`${PKG.name}.js`))
        .pipe(buffer())
        .pipe(rename(`${PKG.name}.js`))
        .pipe(gulp.dest(OUTPUT_DIR));
}

gulp.task('clean', () => del(OUTPUT_DIR, {force: true}));

gulp.task('bundle', () => {
    return bundle();
});

gulp.task('html', () => {
    return gulp.src('index.html')
        .pipe(gulp.dest(OUTPUT_DIR));
});

gulp.task('default', gulp.series(
    'clean',
    'bundle',
    'html',
    (done) =>
    {
        const config = require('../server/config');

        browserSync(
            {
                host      : config.domain,
                server    :
                    {
                        baseDir : OUTPUT_DIR
                    },
                https     : config.https.tls,
                ghostMode : false,
                files     : path.join(OUTPUT_DIR, '**', '*')
            });

        done();
    }
));