const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");
const cliProgress = require("cli-progress");

const emptyDir = (dirPath) => {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const filePath = path.join(dirPath, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                emptyDir(filePath);
                fs.rmdirSync(filePath);
            } else {
                fs.unlinkSync(filePath);
            }
        });
    }
};

const getAllFiles = (dirPath, arrayOfFiles) => {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach((file) => {
        if (fs.lstatSync(path.join(dirPath, file)).isDirectory()) {
            arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, file));
        }
    });

    return arrayOfFiles;
};

const processFiles = (src, dest, progressBar) => {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, {
            recursive: true,
        });
    }

    fs.readdirSync(src).forEach((file) => {
        const srcFilePath = path.join(src, file);
        const destFilePath = path.join(dest, file);

        if (fs.lstatSync(srcFilePath).isDirectory()) {
            processFiles(srcFilePath, destFilePath, progressBar);
        } else if (path.extname(file) === ".js") {
            const inputCode = fs.readFileSync(srcFilePath, "utf8");

            if (path.basename(srcFilePath) === "main.js") {
                fs.copyFileSync(srcFilePath, destFilePath);
            } else {
                const obfuscationResult = JavaScriptObfuscator.obfuscate(inputCode, {
                    compact: true,
                    controlFlowFlattening: true,
                    controlFlowFlatteningThreshold: 1,
                    numbersToExpressions: true,
                    simplify: true,
                    stringArray: true,
                    stringArrayEncoding: ["base64"],
                    stringArrayThreshold: 1,
                    splitStrings: true,
                    splitStringsChunkLength: 5,
                    deadCodeInjection: true,
                    deadCodeInjectionThreshold: 0.4,
                    transformObjectKeys: true,
                });

                fs.writeFileSync(destFilePath, obfuscationResult.getObfuscatedCode());
            }
        } else {
            fs.copyFileSync(srcFilePath, destFilePath);
        }

        progressBar.increment();
    });
};

function rebuildCate(srcDir, distDir) {
    emptyDir(distDir);

    const allFiles = getAllFiles(srcDir);
    const totalFiles = allFiles.length;

    const progressBar = new cliProgress.SingleBar({},
        cliProgress.Presets.shades_classic
    );

    console.log("[INFO] Building files...");
    progressBar.start(totalFiles, 0);

    processFiles(srcDir, distDir, progressBar);

    progressBar.stop();

    console.log("[INFO] Build complete.\n");
    console.log("[INFO] Start Packaging...");
}

module.exports = rebuildCate;