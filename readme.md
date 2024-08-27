# Builder Electron

This package is a powerful builder for Electron applications, combined with obfuscation. It provides a function called `rebuildCate` that takes two parameters: `srcDir` (the source directory to build) and `distSrc` (the destination output of the build).

## Installation

To install this package, run the following command:

```bash
npm install @sattyap/builder-electron
```

## Important 

U need to have access to use this package call the dev first !

## Usage

To use the `rebuildCate` function, import it into your code and call it with the appropriate parameters:

```javascript
const { rebuildCate } = require("builder-electron");

rebuildCate(srcDir, distSrc);
```

Make sure to replace `srcDir` with the path to your source directory and `distSrc` with the desired destination output directory.

## Example

Here's an example of how you can use this package in your Electron application:

```javascript
const { app } = require("electron");
const { rebuildCate } = require("builder-electron");

// Build the app using the `rebuildCate` function
rebuildCate("src", "dist");
```

## Params function

You can exclude some files or you can still build but without obsfucate that files
```javascript
// Note : Use [] if that ignored files, or exlude obsfucate on files more than 1

rebuildCate("src", "dist", ["Name of files ignored"], ["Name files wont obsfucate"]);
```
