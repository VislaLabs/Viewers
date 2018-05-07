import { Meteor } from 'meteor/meteor';
import { OHIF } from 'meteor/ohif:core';
import * as localforage_ from "./localforage.nopromises.min";
// Visla Modules
import { vislaTools } from 'meteor/visla:cornerstone.js';

const localforage = localforage_.default;


Meteor.startup(() => {
    const Diagnostics = new Meteor.Collection(null);
    Diagnostics._debugName = 'Diagnostics';

    OHIF.studylist.collections.Diagnostics = Diagnostics;
});

/**
 * Imports selected studies from local into studylist
 * @param analyzeStudies Files located in the client machine to import
 */
const analyzeStudies = (studiesToAnalyze, batch) => {
    let numberOfStudies = studiesToAnalyze && studiesToAnalyze.length;
    if (!numberOfStudies) {
        return;
    }
    const maxNumberOfStudies = 1000;
    let remainingStudies = studiesToAnalyze.slice(maxNumberOfStudies);  // Do max 1000 at a time.
    studiesToAnalyze = studiesToAnalyze.slice(0, maxNumberOfStudies);
    numberOfStudies = studiesToAnalyze.length;

    const title = `Applying Visla AI...${remainingStudies.length ? " (" + (remainingStudies.length / maxNumberOfStudies) + " batches remaining...)" : ""}`;

    const message = function(e) {
      if (e) {
          return `Processed studies: ${e.processed} / ${e.total}`;
      } else {
          return `Running 121 layer-deep neural network using ${vislaTools.getBackend()} in your browser.\nNo data is leaving your device...`;
      }
    };

    const taskRunHandler = dialog => {
        const errorHandler = error => {
            dialog.setMessage(`Error: ${error.exception}`);
        };

        const successHandler = diagnostics => {
            dialog.done();
            new Promise((resolve, reject) => {
                let filteredDiagnostics = diagnostics.filter(diagnostic => diagnostic != undefined);
                filteredDiagnostics = OHIF.studylist.filterHeatmapsFromDiagnostics(filteredDiagnostics);
                // filteredDiagnostics.forEach(diagnostic => {
                //     const localReports = OHIF.studylist.collections.LocalReports;
                //     const modified = localReports.update({ accessionNumber: diagnostic.accessionNumber }, {
                //         $set: { diagnostic: diagnostic.diagnostic }
                //     });
                //     if (modified == 0) {
                //         localReports.insert(diagnostic);
                //     }
                // });
                resolve(filteredDiagnostics);
            }).then(diagnostics => {
                diagnostics.forEach(diagnostic => OHIF.studylist.diagnostics[diagnostic.accessionNumber] = diagnostic.diagnostic);
                localforage.getItem('diagnosticsNoHeatmaps').then(savedDiagnostics => {
                    let allDiagnostics = diagnostics;
                    if (savedDiagnostics) {
                        allDiagnostics = savedDiagnostics.concat(diagnostics);
                    }
                    localforage.setItem('diagnosticsNoHeatmaps', allDiagnostics).then(() => {
                        OHIF.studylist.update();
                        if (remainingStudies.length) {
                            analyzeStudies(remainingStudies, batch + 1);
                        }
                     });
                });
                Meteor.call('storeDiagnostics', diagnostics, (error, response) => {
                    if (error) {
                        OHIF.log.error(error);
                    }
                });
            });
        };

        applyAIModel(studiesToAnalyze, dialog).then(successHandler).catch(errorHandler);
    };

    return OHIF.ui.showDialog('dialogProgress', {
        title,
        message: message,
        total: numberOfStudies,
        task: { run: taskRunHandler }
    });
};

OHIF.studylist.analyzeStudies = () => {
    analyzeStudies(OHIF.studylist.getSelectedStudies(), 0);
}

OHIF.studylist.analyzeAllStudies = () => {
    analyzeStudies(OHIF.studylist.collections.Studies.find({ diseaseRisk: undefined }).fetch(), 0);
}

const applyAIModel = (studies, dialog) => {
    let processed = 0;

    const promise = new Promise((resolve, reject) => {
        const promises = [];

        studies.forEach(study => {
            let error = false;
            const loaderPromise = OHIF.studies.retrieveStudyMetadata(study.studyInstanceUid).then(studyMetadata => {
                const displaySetUid = studyMetadata.displaySets[0].displaySetInstanceUid;
                const imageIds = OHIF.viewerbase.stackManager.findStack(displaySetUid).imageIds;
                const imageId = imageIds[0];
                return cornerstoneWADOImageLoader.wadouri.loadImage(imageId);
            });
            const vislaPromise = loaderPromise.then(imagePromise => {
                return imagePromise.promise.then(image => vislaTools.computeDiagnostic(image));
            });
            const finishPromise = vislaPromise.then(diagnostic => {
                dialog.update(++processed);
                return { accessionNumber: study.accessionNumber, diagnostic};
            });
            promises.push(finishPromise.catch(errorMessage => {
                dialog.setMessage(`${errorMessage}, continuing...`);
            }));
        });

        Promise.all(promises).then(resolve).catch(reject);
    });

    return promise;
};
