import { Meteor } from 'meteor/meteor';
import { OHIF } from 'meteor/ohif:core';
import * as localforage_ from "./localforage.nopromises.min";
// Visla Modules
import { vislaTools } from 'meteor/visla:cornerstone.js';

const localforage = localforage_.default;

// Define the Studies Collection. This is a client-side only Collection which stores the list of
// studies in the StudyList
Meteor.startup(() => {
    const LocalStudies = new Meteor.Collection(null);
    LocalStudies._debugName = 'LocalStudies';

    OHIF.studylist.collections.LocalStudies = LocalStudies;
});

function dataSetToStudy(dataSet, imageId) {
    return {
        imageId: imageId,
        uri: imageId,
        studyInstanceUid: dataSet.string('x0020000d'),
        seriesInstanceUid: dataSet.string('x0020000e'),
        seriesNumber: dataSet.uint16('x00200011'),
        studyDate: dataSet.string('x00080020'),
        studyTime: dataSet.string('x00080030'),
        accessionNumber: dataSet.string('x00080050'),
        referringPhysicianName: dataSet.string('x00080090'),
        patientName: dataSet.string('x00100010'),
        patientId: dataSet.string('x00100020'),
        patientBirthdate: dataSet.string('x00100030'),
        patientSex: dataSet.string('x00100040'),
        imageCount: dataSet.uint16('x00201208'),
        studyId: dataSet.string('x00200010'),
        studyDescription: dataSet.string('x00081030'),
        modalities: dataSet.string('x00080060'),
        sopInstanceUid: dataSet.string('x00080018'),
        sopClassUid: dataSet.string('x00080016'),
        instanceNumber: dataSet.uint16('x00200013')
    };
}

/**
 * Imports selected studies from local into studylist
 * @param filesToImport Files located in the client machine to import
 */
OHIF.studylist.importStudies = filesToImport => {
    const numberOfFiles = filesToImport && filesToImport.length;
    if (!numberOfFiles) {
        return new Promise((resolve, reject) => reject('No files to upload'));
    }

    const uploadMessage = ({ processed, total }) => `Uploaded files: ${processed} / ${total}`;

    const taskRunHandler = dialog => {
        const uploadErrorHandler = error => {
            if (error instanceof Array) {
                const names = error.join('; ');
                dialog.setMessage(`Failed to upload files: ${names}`);
            } else {
                dialog.setMessage(`Error: ${error.exception}`);
            }
        };

        const uploadSuccessHandler = studiesToImport => {
            importStudiesInternal(studiesToImport, dialog).then(() => {
                dialog.done();
            }).catch(errorMessage => {
                dialog.setMessage(errorMessage);
            });
        };

        uploadFiles(filesToImport, dialog).then(uploadSuccessHandler).catch(uploadErrorHandler);
    };

    return OHIF.ui.showDialog('dialogProgress', {
        title: 'Importing Studies...',
        message: uploadMessage,
        total: numberOfFiles,
        task: { run: taskRunHandler }
    });
};

OHIF.studylist.addLocalFiles = filesToImport => {
    const numberOfFiles = filesToImport && filesToImport.length;
    if (!numberOfFiles) {
        return new Promise((resolve, reject) => reject('No files to add'));
    }

    OHIF.studylist.collections.LocalStudies.remove({});
    cornerstoneWADOImageLoader.wadouri.fileManager.purge({});

    const uploadMessage = function(e) {
      if (e) {
          return `Processed files: ${e.processed} / ${e.total}`;
      } else {
          return `Parsing DICOM files...`;
      }
    };

    const taskRunHandler = dialog => {
        const uploadErrorHandler = error => {
            if (error instanceof Array) {
                const names = error.join('; ');
                dialog.setMessage(`Failed to upload files: ${names}`);
            } else {
                dialog.setMessage(`Error: ${error.exception}`);
            }
        };

        const uploadSuccessHandler = studiesToImport => {
            importFilesInternal(studiesToImport, dialog).then(diagnostics => {
                dialog.done();
                studiesToImport.forEach(study => OHIF.studylist.collections.LocalStudies.insert(study));
                localforage.setItem('localStudies', studiesToImport).then(OHIF.studylist.update());
            }).catch(errorMessage => {
                dialog.setMessage(errorMessage);
            });
        };

        addFiles(filesToImport, dialog).then(uploadSuccessHandler).catch(uploadErrorHandler);
    };

    return OHIF.ui.showDialog('dialogProgress', {
        title: 'Importing Studies...',
        message: uploadMessage,
        total: numberOfFiles,
        task: { run: taskRunHandler }
    });
};

const addFiles = (files, dialog) => {
    let processed = 0;

    const promise = new Promise((resolve, reject) => {
      const promises = [];

      files.forEach(file => {
        const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
        const { scheme, url } = cornerstoneWADOImageLoader.wadouri.parseImageId(imageId);
        const loader = cornerstoneWADOImageLoader.wadouri.getLoaderForScheme(scheme);
        const filePromise = cornerstoneWADOImageLoader.wadouri.dataSetCacheManager.load(url, loader, imageId).then(dataSet => {
            dialog.update(++processed);
            const study = dataSetToStudy(dataSet, imageId);
            study.file = file;
            return study;
        });
        promises.push(filePromise);
      });

      Promise.all(promises).then(resolve).catch(reject);
    });

    return promise;
};

const uploadFiles = (files, dialog) => {
    let processed = 0;

    const promise = new Promise((resolve, reject) => {
        const promises = [];

        //  Upload files to the server
        files.forEach(file => {
            const filePromise = uploadFile(file, dialog);
            filePromise.then(() => dialog.update(++processed));
            promises.push(filePromise);
        });

        Promise.all(promises).then(resolve).catch(reject);
    });

    return promise;
};

const uploadFile = file => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/uploadFilesToImport', true);
        xhr.setRequestHeader('filename', file.name);

        xhr.onload = () => {
            if (xhr.readyState === 4 && xhr.status !== 200) {
                // Failed to upload the file
                reject(file.name);
            } else {
                // Success uploading the file
                resolve(xhr.responseText);
            }
        };

        // Failed to upload the file
        xhr.onerror = () => {
          console.log("Reject");
          reject(file.name);
        }

        xhr.send(file);
    });
};

const importFilesInternal = (studiesToImport, dialog) => {
    const numberOfStudies = studiesToImport && studiesToImport.length;
    if (!numberOfStudies) {
        return new Promise((resolve, reject) => reject('No studies to import'));
    }

    let processed = 0;
    dialog.update(processed);
    dialog.setTotal(numberOfStudies);
    dialog.setMessage(({ processed, total }) => `Applying AI model: ${processed} / ${total}`);

    return new Promise((resolve, reject) => {
        const promises = [];

        studiesToImport.forEach(study => {
          const imagePromise = cornerstoneWADOImageLoader.wadouri.loadImage(study.imageId);
          const vislaPromise = imagePromise.promise.then(image => {
              return vislaTools.computeDiagnostic(image).then((diagnostic) => {
                dialog.update(++processed);
                study.diagnostic = diagnostic;
                return study;
              });
          });
          promises.push(vislaPromise);
        });

        Promise.all(promises).then(resolve).catch(reject);
    });
};

const importStudiesInternal = (studiesToImport, dialog) => {
    const numberOfStudies = studiesToImport && studiesToImport.length;
    if (!numberOfStudies) {
        return new Promise((resolve, reject) => reject('No studies to import'));
    }

    let processed = 0;
    dialog.update(processed);
    dialog.setTotal(numberOfStudies);
    dialog.setMessage(({ processed, total }) => `Imported: ${processed} / ${total}`);

    return new Promise((resolve, reject) => {
        //  Create/Insert a new study import status item
        Meteor.call('createStudyImportStatus', (error, studyImportStatusId) => {
            if (error) {
                return reject(error.message);
            }

            //  Handle when StudyImportStatus collection is updated
            OHIF.studylist.collections.StudyImportStatus.find(studyImportStatusId).observe({
                changed(studyImportStatus) {
                    const { numberOfStudiesImported, numberOfStudiesFailed } = studyImportStatus;
                    dialog.update(numberOfStudiesImported);

                    if (numberOfStudiesImported === numberOfStudies) {
                        //  The entire import operation is completed, so remove the study import status item
                        Meteor.call('removeStudyImportStatus', studyImportStatus._id);

                        // Show number of failed files if there is at least one failed file
                        if (studyImportStatus.numberOfStudiesFailed > 0) {
                            const failed = numberOfStudiesFailed;
                            reject(`Failed to import ${failed} of ${numberOfStudies} studies`);
                        } else {
                            resolve();
                        }
                    }
                }
            });

            //  Import studies with study import status id to get callbacks
            Meteor.call('importStudies', studiesToImport, studyImportStatusId);
        });
    });
};
