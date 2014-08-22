var async = require('async');
var request = require('request');
var fs = require('fs');
var spawn = require('child_process').spawn;
var uuid = require('node-uuid');

var nconf = require('nconf');


module.exports.generateZipFromUrls = function (data, concurrency, next) {
  var downloads = [];

  var q = async.queue(function (item, callback) {
    var filename = nconf.get('reportDownloadDirectory') + (item.filename || (uuid.v4() + '.xlsx'));

    downloads.push(filename);

    request(item.url).pipe(fs.createWriteStream(filename)).on('close', callback);
  }, concurrency);


  q.drain = function () {
    var zipFilename = uuid.v4() + '.zip';

    var filesList = downloads.slice(0);

    // put the zip file at the front of the array
    // since the zip command requires the dest zip
    // to be the first parameter
    filesList.unshift(nconf.get('reportDownloadDirectory') + zipFilename);

    //We now create a child process to zip the files.
    var zip = spawn('zip', filesList);

    zip.on('error', function (err) {
      return next(err);
    });

    //on its completion, output the url for the file to
    //the browser and delete the temporary files.
    zip.on('close', function (code) {
      if (code !== 0) {
        return next(new Error('Zip process failed, exit code: ' + code));
      }

      // delete our the downloaded excel files
      for (var i = 0; i < downloads.length; i++) {
        fs.unlink(downloads[i], function (err) {
          if (err) {
            console.log('Error deleting file: ' + err.code);
          }
        });
      }

      return next(null, zipFilename);
    });
  };

  q.push(data);
};