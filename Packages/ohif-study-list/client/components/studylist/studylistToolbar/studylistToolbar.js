import { OHIF } from 'meteor/ohif:core';
import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { $ } from 'meteor/jquery';

Template.studylistToolbar.onCreated(() => {
    Meteor.call('importSupported', (error, result) => {
        if (error || !result) {
            Session.set('importSupported', false);
        } else {
            Session.set('importSupported', true);
        }
    });
});

Template.studylistToolbar.events({
    'change .js-import-files'(event) {
        //  Get selected files located in the client machine
        const selectedFiles = $.map(event.currentTarget.files, value => value);

        var dcmFiles = [];
        selectedFiles.forEach(file => {
          const fileNameParts = file.name.split(".");
          if (fileNameParts.length > 0 && fileNameParts[fileNameParts.length - 1].toLowerCase() == "dcm") {
            dcmFiles.push(file);
          }
        });

        OHIF.studylist.addLocalFiles(dcmFiles);
    },

    'click .js-import-files'(event) {
        // Reset file input
        $(event.currentTarget).val('');
    }
});

Template.studylistToolbar.helpers({
    numberOfStudies() {
        OHIF.studylist._dep2.depend();
        const count = OHIF.studylist.studyCount;
        if (count == 0) {
          return "Add local DICOM files"
        } else if (count == 1) {
          return count + " study";
        } else {
          return count + " studies";
        }
    },

    importSupported() {
        const importSupported = Session.get('importSupported');
        return (importSupported && OHIF.uiSettings.studyListFunctionsEnabled);
    }
});
