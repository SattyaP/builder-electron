const JavaScriptObfuscator = require("javascript-obfuscator")
const cliProgress = require("cli-progress")
const esbuild = require('esbuild')
const { join, extname, resolve, dirname, relative } = require("path")
const { readFile, readdir, writeFile, copyFile, stat, existsSync, readdirSync, lstatSync, rmdirSync, unlinkSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, statSync, access, rm, mkdir } = require("fs").promises
const { exec } = require('child_process')

/**
 * Compile JavaScript files with Google Closure Compiler and copy non-JS files.
 * @param {string} srcDir - Source directory containing files.
 * @param {string} distDir - Destination directory for compiled/copied files.
 */

/**
 * The configuration for the obfuscator.
 * Crucially, `stringArray` is set to false to prevent breaking string literals
 * like your Puppeteer selectors.
 */
const obfuscatorOptions = {
    compact: true,
    controlFlowFlattening: false, // Set to true for higher obfuscation, but can impact performance
    deadCodeInjection: false, // Set to true for higher obfuscation
    debugProtection: false,
    disableConsoleOutput: true,
    renameGlobals: false,
    selfDefending: true,
    stringArray: false, // Prevents strings from being moved into an array, preserving selectors
    unicodeEscapeSequence: false
}

const emptyDir = (dirPath) => {
    if (existsSync(dirPath)) {
        readdirSync(dirPath).forEach((file) => {
            const filePath = join(dirPath, file)
            if (lstatSync(filePath).isDirectory()) {
                emptyDir(filePath)
                rmdirSync(filePath)
            } else {
                unlinkSync(filePath)
            }
        })
    }
}

const getAllFiles = (dirPath, arrayOfFiles) => {
    const files = readdirSync(dirPath)
    arrayOfFiles = arrayOfFiles || []

    files.forEach((file) => {
        if (lstatSync(join(dirPath, file)).isDirectory()) {
            arrayOfFiles = getAllFiles(join(dirPath, file), arrayOfFiles)
        } else {
            arrayOfFiles.push(join(dirPath, file))
        }
    })

    return arrayOfFiles
}

const copyDirectory = (src, dest) => {
    if (!existsSync(dest)) {
        mkdirSync(dest, { recursive: true })
    }

    readdirSync(src).forEach((file) => {
        const srcFilePath = join(src, file)
        const destFilePath = join(dest, file)

        if (lstatSync(srcFilePath).isDirectory()) {
            copyDirectory(srcFilePath, destFilePath)
        } else {
            copyFileSync(srcFilePath, destFilePath)
        }
    })
}

const processFiles = (src, dest, progressBar, excludeObfuscation, excludeCopy) => {
    if (!existsSync(dest)) {
        mkdirSync(dest, {
            recursive: true,
        })
    }

    readdirSync(src).forEach((file) => {
        const srcFilePath = join(src, file)
        const destFilePath = join(dest, file)

        if (excludeCopy && excludeCopy.includes(file)) {
            return
        }

        if (lstatSync(srcFilePath).isDirectory()) {
            if (excludeObfuscation && excludeObfuscation.includes(file)) {
                copyDirectory(srcFilePath, destFilePath)
            } else {
                processFiles(srcFilePath, destFilePath, progressBar, excludeObfuscation, excludeCopy)
            }
        } else if (extname(file) === ".js") {
            const inputCode = readFileSync(srcFilePath, "utf8")

            if (excludeObfuscation && excludeObfuscation.includes(file)) {
                copyFileSync(srcFilePath, destFilePath)
            } else {
                const obfuscationResult = JavaScriptObfuscator.obfuscate(inputCode, {
                    "compact": true,
                    "controlFlowFlattening": true,
                    "controlFlowFlatteningThreshold": 0.8,
                    "numbersToExpressions": true,
                    "simplify": true,
                    "stringArray": true,
                    "stringArrayEncoding": ["base64"],
                    "stringArrayThreshold": 0.5,
                    "splitStrings": true,
                    "splitStringsChunkLength": 10,
                    "deadCodeInjection": true,
                    "deadCodeInjectionThreshold": 0.2,
                    "transformObjectKeys": true,
                    "renameGlobals": true,
                    "identifierNamesGenerator": "mangled",
                    "selfDefending": true
                })

                writeFileSync(destFilePath, obfuscationResult.getObfuscatedCode())
            }
        } else {
            copyFileSync(srcFilePath, destFilePath)
        }

        progressBar.increment()
    })
}

function rebuildCate(srcDir, distDir, excludeObfuscation = [], excludeCopy = []) {
    emptyDir(distDir)

    const allFiles = getAllFiles(srcDir)
    const totalFiles = allFiles.length

    const progressBar = new cliProgress.SingleBar({},
        cliProgress.Presets.shades_classic
    )

    console.log("[INFO] Building files...")
    progressBar.start(totalFiles, 0)

    processFiles(srcDir, distDir, progressBar, excludeObfuscation, excludeCopy)

    progressBar.stop()

    console.log("[INFO] Build complete.\n")
    console.log("[INFO] Start Packaging...")
}

function buildProject(srcDir, distDir) {
    srcDir = resolve(srcDir)
    distDir = resolve(distDir)

    rmSync(distDir, { recursive: true, force: true })
    mkdirSync(distDir, { recursive: true })

    console.log('🚀 Starting build...\n')

    const copyFile = (src, dest) => {
        mkdirSync(dirname(dest), { recursive: true })
        copyFileSync(src, dest)
    }

    const compileJsFile = (src, dest) => {
        mkdirSync(dirname(dest), { recursive: true })

        exec(`google-closure-compiler --js "${src}" --js_output_file "${dest}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error compiling ${src}`)
            } else if (stderr) {
                console.warn(`⚠️ Warning: ${stderr}`)
            } else {
                console.log(`✅ Compiled: ${src} -> ${dest}`)
            }
        })
    }

    const processFiles = (dir) => {
        readdirSync(dir).forEach((file) => {
            const filePath = join(dir, file)
            const relPath = relative(srcDir, filePath)
            const outPath = join(distDir, relPath)

            if (statSync(filePath).isDirectory()) {
                processFiles(filePath)
            } else if (file.endsWith('.js')) {
                compileJsFile(filePath, outPath)
            } else {
                copyFile(filePath, outPath)
                console.log(`📂 Copied: ${filePath} -> ${outPath}`)
            }
        })
    }

    processFiles(srcDir)
    console.log("\n🎉 Build completed!")
}

function esBuildProject(srcDir, outDir) {
    function clearDist() {
        if (existsSync(outDir)) {
            rmSync(outDir, { recursive: true, force: true })
        }
        mkdirSync(outDir, { recursive: true })
    }

    function copyFiles(src, dest) {
        readdirSync(src).forEach(file => {
            const srcPath = join(src, file)
            const destPath = join(dest, file)

            if (statSync(srcPath).isDirectory()) {
                mkdirSync(destPath, { recursive: true })
                copyFiles(srcPath, destPath)
            } else if (!file.endsWith('.js')) {
                copyFileSync(srcPath, destPath)
            }
        })
    }

    function getJsFiles(dir) {
        let files = []
        readdirSync(dir).forEach(file => {
            const filePath = join(dir, file)
            if (statSync(filePath).isDirectory()) {
                files = files.concat(getJsFiles(filePath))
            } else if (file.endsWith('.js')) {
                files.push(filePath)
            }
        })
        return files
    }

    clearDist()
    copyFiles(srcDir, outDir)

    const entryPoints = getJsFiles(srcDir)

    return esbuild.build({
        entryPoints,
        bundle: true,
        minify: true,
        platform: 'node',
        external: ['electron'],
        format: 'esm',
        metafile: true,
        outdir: outDir,
    })
}

async function buildAndObfuscate(srcDir, destDir) {
    try {
        await access(srcDir);

        console.log(`🧹 Cleaning destination directory: ${destDir}`);
        await rm(destDir, { recursive: true, force: true });
        await mkdir(destDir, { recursive: true });

        console.log(`🚀 Starting build from '${srcDir}' to '${destDir}'...`);

        const items = await readdir(srcDir);

        for (const item of items) {
            const srcPath = join(srcDir, item);
            const destPath = join(destDir, item);
            const stats = await stat(srcPath);

            if (stats.isDirectory()) {
                await buildAndObfuscate(srcPath, destPath);
            } else if (extname(srcPath) === '.js') {
                console.log(`🔒 Obfuscating: ${srcPath}`);
                const code = await readFile(srcPath, 'utf8');
                const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions).getObfuscatedCode();
                await writeFile(destPath, obfuscatedCode, 'utf8');
            } else {
                console.log(`📄 Copying: ${srcPath}`);
                await copyFile(srcPath, destPath);
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Source directory not found: ${srcDir}`);
        }
        throw error;
    }
}

module.exports = { rebuildCate, buildProject, esBuildProject, buildAndObfuscate }
