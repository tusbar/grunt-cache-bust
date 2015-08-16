'use strict';

var url = require('url');
var path = require('path');
var grunt = require('grunt');
var crypto = require('crypto');

var _ = grunt.util._;

var DEFAULT_OPTIONS = {
    algorithm: 'md5',
    baseDir: './',
    deleteOriginals: false,
    encoding: 'utf8',
    jsonOutput: false,
    jsonOutputFilename: 'grunt-cache-bust.json',
    length: 16,
    separator: '.'
};

module.exports = function() {
    grunt.registerMultiTask('cacheBust', 'Bust static assets from the cache using content hashing', function() {
        var opts = this.options(DEFAULT_OPTIONS);

        var discoveryOpts = {
            cwd: path.resolve(opts.baseDir),
            filter: 'isFile'
        };

        // Generate an asset map
        var assetMap = grunt.file
            .expand(discoveryOpts, opts.assets)
            .sort()
            .reverse()
            .reduce(hashFilename, {});

        // Create an array of the assets that were found in files
        var foundAssets = [];

        this.files.forEach(function (file) {
            file.src.forEach(function (path) {
                var markup = grunt.file.read(path);

                _.each(assetMap, function (hashed, original) {
                    var fragments = markup.split(original);
                    if (fragments.length > 1) {
                        // The asset was found, let’s save it.
                        foundAssets.push(original);

                        markup = fragments.join(hashed);
                        grunt.file.write(path, markup);
                    }
                });
            });
        });

        // Remove the assets that were not found from the map
        assetMap = _.pick(assetMap, foundAssets);

        console.log(assetMap);

        // Write out assetMap
        if(opts.jsonOutput !== false) {
            var filename = typeof opts.jsonOutput === 'string' ? opts.jsonOutput : opts.jsonOutputFilename;
            grunt.file.write(path.resolve(opts.baseDir, filename), JSON.stringify(assetMap));
        }

        // Write the busted assets to disk
        _.each(assetMap, function (hashed, original) {
            var oldPath = path.resolve(opts.baseDir, original);
            var newPath = path.resolve(opts.baseDir, hashed);

            grunt.file.copy(oldPath, newPath);

            // Remove the original assets
            if(opts.deleteOriginals) {
                grunt.file.delete(oldPath);
            }
        });

        function hashFilename(obj, file) {
            var absPath = path.resolve(opts.baseDir, file);
            var hash = generateFileHash(grunt.file.read(absPath, {
                encoding: null
            }));
            var newFilename = addFileHash(file, hash, opts.separator);

            obj[file] = newFilename;

            return obj;
        }

        function generateFileHash(data) {
            return opts.hash || crypto.createHash(opts.algorithm).update(data, opts.encoding).digest('hex').substring(0, opts.length);
        }

        function addFileHash(str, hash, separator) {
            var parsed = url.parse(str);
            var ext = path.extname(parsed.pathname);

            return (parsed.hostname ? parsed.protocol + parsed.hostname : '') + parsed.pathname.replace(ext, '') + separator + hash + ext;
        }

    });

};
