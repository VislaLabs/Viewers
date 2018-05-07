import { Template } from 'meteor/templating';
import { FS } from 'meteor/cfs:base-package';

Template.serverInformationFilesystem.onRendered(() => {
    const instance = Template.instance();
    instance.autorun(function() {
        const mode = instance.data.mode.get();
        if (mode === 'edit') {
            const data = instance.data.currentItem.get();
            instance.data.form.value(data);
        }
    });
});

FS.debug = true;

var eventPhotosStore = new FS.Store.FileSystem('eventPhotos', {
  path: '~/Downloads'
});

eventPhotos = new FS.Collection('eventPhotos', {
  stores: [eventPhotosStore]
});
eventPhotos.allow({
  insert: function (userId, doc) {
      return true;
  },
  update: function (userId, doc) {
      return true;
  },
  remove: function (userId, doc) {
      return true;
  },
  download: function (userId, doc) {
      return true;
  }
});

events = new Meteor.Collection('events');

Template.serverInformationFilesystem.events({
  'click input[type="submit"]': function () {
    var files = $('#file').get(0).files;
    for (var i = 0, f; f = files[i]; i++) {

        // Only process image files.
        if (!f.type.match('application/dicom')) {
          continue;
        }

        var reader = new FileReader();

        // Closure to capture the file information.
        reader.onload = (function(theFile) {
          return function(e) {
            console.log("Read file " + theFile)
          };
        })(f);

        // Read in the image file as a data URL.
        reader.readAsDataURL(f);

        // eventPhotos.insert(f, function (err, fileObj) {
        //    console.log("callback for the insert, err: ", err);
        //    if (!err) {
        //      console.log("inserted without error");
        //    }
        //    else {
        //      console.log("there was an error", err);
        //    }
        //  });
      }
    // var fileObj = eventPhotos.insert(file);
    // console.log('Upload result: ', fileObj);
    // events.insert({
    //   name: 'event',
    //   file: fileObj
    // });
  }
});
