const gulp = require('gulp')
const ts = require('gulp-typescript')
const del = require('del')
const concat = require('gulp-concat')
const sourcemaps = require('gulp-sourcemaps')
const merge = require('merge-stream')
const through = require('through2')

function fixDts(opts) {
	return through.obj(function (file, encoding, callback) {
		if (file.isBuffer()) {
			const contents = file.contents.toString()
			const lines = contents.split(/\r\n|\r|\n/g)
			const importLines = []
			const otherLines = []
			const newImportLines = []
			const resolvedImports = []
			for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
				if (lines[lineIndex].startsWith('import')) {
					importLines.push(lines[lineIndex])
				} else {
					otherLines.push(lines[lineIndex])
				}
			}

			for (var importLineIndex = 0; importLineIndex < importLines.length; importLineIndex++) {
				var current = importLines[importLineIndex].replace('import {', '').replace(';', '').replace('./model/', './').split('} from')
				var currentPackage = {
					package: current[1].trim(),
					imports: current[0].split(',').map(c => c.trim()),
				}
				var foundPackage = resolvedImports.find(r => r.package == currentPackage.package)
				if (!foundPackage) {
					resolvedImports.push(currentPackage)
					foundPackage = currentPackage
				} else {
					for (var importIndex = 0; importIndex < currentPackage.imports.length; importIndex++) {
						var foundImport = foundPackage.imports.find(im => im === currentPackage.imports[importIndex])
						if (!foundImport) {
							foundPackage.imports.push(currentPackage.imports[importIndex])
						}
					}
				}
			}
			for (resolvedImportIndex = 0; resolvedImportIndex < resolvedImports.length; resolvedImportIndex++) {
				newImportLines.push(`import {${resolvedImports[resolvedImportIndex].imports.join(', ')}} from ${resolvedImports[resolvedImportIndex].package}`)
			}
			file.contents = Buffer.from(newImportLines.join('\n') + '\n\n' + otherLines.join('\n'), 'utf8')
		}
		callback(null, file)
	})
}

function getBuildTask(srcPath = "src", destPath = "dist") {
	var tsProject = ts.createProject("tsconfig.json");
	gulp.task("clean", async () => {
		del(`./${destPath}/*`);
	});

	gulp.task("build", async () => {
		const tsResult =
			tsProject.src()
			.pipe(sourcemaps.init())
			.pipe(tsProject())

		return merge([
			tsResult.dts
			.pipe(concat('index.d.ts'))
			.pipe(fixDts())
			.pipe(gulp.dest(destPath)),
			tsResult.js
			.pipe(concat('index.js'))
			.pipe(sourcemaps.write('.'))
			.pipe(gulp.dest(destPath)),
			gulp.src(`${srcPath}/**/*.json`)
			.pipe(gulp.dest(destPath))
		]);
	});

	return gulp.series("clean", "build")
}

exports.fixDts = fixDts
exports.getBuildTask = getBuildTask