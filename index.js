const JavaScriptObfuscator = require("javascript-obfuscator");
const cliProgress = require("cli-progress");
const { join, extname, resolve, dirname, relative } = require("path");
const { existsSync, readdirSync, lstatSync, rmdirSync, unlinkSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, statSync } = require("fs");
const { exec } = require('child_process');

/**
 * Compile JavaScript files with Google Closure Compiler and copy non-JS files.
 * @param {string} srcDir - Source directory containing files.
 * @param {string} distDir - Destination directory for compiled/copied files.
 */

const emptyDir = (dirPath) => {
    if (existsSync(dirPath)) {
        readdirSync(dirPath).forEach((file) => {
            const filePath = join(dirPath, file);
            if (lstatSync(filePath).isDirectory()) {
                emptyDir(filePath);
                rmdirSync(filePath);
            } else {
                unlinkSync(filePath);
            }
        });
    }
};

const getAllFiles = (dirPath, arrayOfFiles) => {
    const files = readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach((file) => {
        if (lstatSync(join(dirPath, file)).isDirectory()) {
            arrayOfFiles = getAllFiles(join(dirPath, file), arrayOfFiles);
        } else {
            arrayOfFiles.push(join(dirPath, file));
        }
    });

    return arrayOfFiles;
};

const copyDirectory = (src, dest) => {
    if (!existsSync(dest)) {
        mkdirSync(dest, { recursive: true });
    }

    readdirSync(src).forEach((file) => {
        const srcFilePath = join(src, file);
        const destFilePath = join(dest, file);

        if (lstatSync(srcFilePath).isDirectory()) {
            copyDirectory(srcFilePath, destFilePath);
        } else {
            copyFileSync(srcFilePath, destFilePath);
        }
    });
};

const processFiles = (src, dest, progressBar, excludeObfuscation, excludeCopy) => {
    if (!existsSync(dest)) {
        mkdirSync(dest, {
            recursive: true,
        });
    }

    readdirSync(src).forEach((file) => {
        const srcFilePath = join(src, file);
        const destFilePath = join(dest, file);

        if (excludeCopy && excludeCopy.includes(file)) {
            return;
        }

        if (lstatSync(srcFilePath).isDirectory()) {
            if (excludeObfuscation && excludeObfuscation.includes(file)) {
                copyDirectory(srcFilePath, destFilePath);
            } else {
                processFiles(srcFilePath, destFilePath, progressBar, excludeObfuscation, excludeCopy);
            }
        } else if (extname(file) === ".js") {
            const inputCode = readFileSync(srcFilePath, "utf8");

            if (excludeObfuscation && excludeObfuscation.includes(file)) {
                copyFileSync(srcFilePath, destFilePath);
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
                });

                writeFileSync(destFilePath, obfuscationResult.getObfuscatedCode());
            }
        } else {
            copyFileSync(srcFilePath, destFilePath);
        }

        progressBar.increment();
    });
};

function rebuildCate(srcDir, distDir, excludeObfuscation = [], excludeCopy = []) {
    emptyDir(distDir);

    const allFiles = getAllFiles(srcDir);
    const totalFiles = allFiles.length;

    const progressBar = new cliProgress.SingleBar({},
        cliProgress.Presets.shades_classic
    );

    console.log("[INFO] Building files...");
    progressBar.start(totalFiles, 0);

    processFiles(srcDir, distDir, progressBar, excludeObfuscation, excludeCopy);

    progressBar.stop();

    console.log("[INFO] Build complete.\n");
    console.log("[INFO] Start Packaging...");
}

function buildProject(srcDir, distDir) {
    srcDir = resolve(srcDir);
    distDir = resolve(distDir);

    rmSync(distDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });

    console.log('🚀 Starting build...\n');

    const copyFile = (src, dest) => {
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, dest);
    };

    const compileJsFile = (src, dest) => {
        mkdirSync(dirname(dest), { recursive: true });

        exec(`google-closure-compiler --js "${src}" --js_output_file "${dest}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error compiling ${src}`);
            } else if (stderr) {
                console.warn(`⚠️ Warning: ${stderr}`);
            } else {
                console.log(`✅ Compiled: ${src} -> ${dest}`);
            }
        });
    };

    const processFiles = (dir) => {
        readdirSync(dir).forEach((file) => {
            const filePath = join(dir, file);
            const relPath = relative(srcDir, filePath);
            const outPath = join(distDir, relPath);

            if (statSync(filePath).isDirectory()) {
                processFiles(filePath);
            } else if (file.endsWith('.js')) {
                compileJsFile(filePath, outPath);
            } else {
                copyFile(filePath, outPath);
                console.log(`📂 Copied: ${filePath} -> ${outPath}`);
            }
        });
    };

    processFiles(srcDir);
    console.log("\n🎉 Build completed!");
}

module.exports = { rebuildCate, buildProject };
