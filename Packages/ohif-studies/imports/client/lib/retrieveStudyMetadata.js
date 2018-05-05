import { Meteor } from 'meteor/meteor';
import { OHIF } from 'meteor/ohif:core';
import 'meteor/ohif:viewerbase';

// Define the StudyMetaDataPromises object. This is used as a cache to store study meta data
// promises and prevent unnecessary subsequent calls to the server
const StudyMetaDataPromises = new Map();

function toStudyMetadata(resultData, studyInstanceUid) {
    const seriesMap = {};
    const seriesList = [];

    resultData.forEach(function(study) {
        // Use seriesMap to cache series data
        // If the series instance UID has already been used to
        // process series data, continue using that series
        const seriesInstanceUid = study.seriesInstanceUid;
        let series = seriesMap[seriesInstanceUid];

        // If no series data exists in the seriesMap cache variable,
        // process any available series data
        if (!series) {
            series = {
                seriesInstanceUid: seriesInstanceUid,
                seriesNumber: study.seriesNumber,
                modality: study.modalities,
                instances: []
            };

            // Save this data in the seriesMap cache variable
            seriesMap[seriesInstanceUid] = series;
            seriesList.push(series);
        }

        const sopInstanceUid = study.sopInstanceUid;

        // Add this instance to the current series
        const { url } = cornerstoneWADOImageLoader.wadouri.parseImageId(study.imageId);
        series.instances.push({
            patientId: study.patientId,
            sopClassUid: study.sopClassUid,
            sopInstanceUid,
            uri: study.uri,
            url: study.imageId,
            instanceNumber: study.instanceNumber
        });
    });
    return seriesList;
}

/**
 * Retrieves study metadata using a server call
 *
 * @param {String} studyInstanceUid The UID of the Study to be retrieved
 * @returns {Promise} that will be resolved with the metadata or rejected with the error
 */
OHIF.studies.retrieveStudyMetadata = (studyInstanceUid, seriesInstanceUids) => {

    // @TODO: Whenever a study metadata request has failed, its related promise will be rejected once and for all
    // and further requests for that metadata will always fail. On failure, we probably need to remove the
    // corresponding promise from the "StudyMetaDataPromises" map...

    // If the StudyMetaDataPromises cache already has a pending or resolved promise related to the
    // given studyInstanceUid, then that promise is returned
    if (StudyMetaDataPromises.has(studyInstanceUid)) {
        return StudyMetaDataPromises.get(studyInstanceUid);
    }

    const seriesKeys = Array.isArray(seriesInstanceUids) ? '|' + seriesInstanceUids.join('|') : '';
    const timingKey = `retrieveStudyMetadata[${studyInstanceUid}${seriesKeys}]`;
    OHIF.log.time(timingKey);

    // Create a promise to handle the data retrieval
    const promise = new Promise((resolve, reject) => {
        // If no study metadata is in the cache variable, we need to retrieve it from
        // the server with a call.
        const callback = function(error, study) {
            OHIF.log.timeEnd(timingKey);

            if (error) {
                const errorType = error.error;
                let errorMessage = '';

                if (errorType === 'server-connection-error') {
                    errorMessage = 'There was an error connecting to the DICOM server, please verify if it is up and running.';
                } else if (errorType === 'server-internal-error') {
                    errorMessage = `There was an internal error with the DICOM server getting metadeta for ${studyInstanceUid}`;
                } else {
                    errorMessage = `For some reason we could not retrieve the study\'s metadata for ${studyInstanceUid}.`;
                }

                OHIF.log.error(errorMessage);
                OHIF.log.error(error.stack);
                reject(`GetStudyMetadata: ${errorMessage}`);
                return;
            }

            // Filter series if seriesInstanceUid exists
            if (seriesInstanceUids && seriesInstanceUids.length) {
                study.seriesList = study.seriesList.filter(series => seriesInstanceUids.indexOf(series.seriesInstanceUid) > -1);
            }

            if (!study) {
                const studies = OHIF.studylist.collections.LocalStudies.find({studyInstanceUid}).fetch();
                if (studies.length > 0) {
                  let study = studies[0];
                  study.seriesList = toStudyMetadata(studies);
                } else {
                  reject(`GetStudyMetadata: No study data found: ${studyInstanceUid}`);
                }
                return;
            }

            if (window.HipaaLogger && Meteor.user && Meteor.user()) {
                window.HipaaLogger.logEvent({
                    eventType: 'viewed',
                    userId: Meteor.userId(),
                    userName: Meteor.user().profile.fullName,
                    collectionName: 'Study',
                    recordId: studyInstanceUid,
                    patientId: study.patientId,
                    patientName: study.patientName
                });
            }

            // Once the data was retrieved, the series are sorted by series and instance number
            OHIF.viewerbase.sortStudy(study);

            // Updates WADO-RS metaDataManager
            OHIF.viewerbase.updateMetaDataManager(study);

            // Transform the study in a StudyMetadata object
            const studyMetadata = new OHIF.metadata.StudyMetadata(study);

            // Add the display sets to the study
            study.displaySets = OHIF.viewerbase.sortingManager.getDisplaySets(studyMetadata);
            study.displaySets.forEach(displaySet => {
                OHIF.viewerbase.stackManager.makeAndAddStack(study, displaySet);
                studyMetadata.addDisplaySet(displaySet);
            });

            // Resolve the promise with the final study metadata object
            resolve(study);
        };
        if (false) {
          const server = OHIF.servers.getCurrentServer();
          const studies = OHIF.studylist.collections.Studies.find({studyInstanceUid}).fetch();
          if (studies.length > 0) {
            let study = studies[0];
            study.seriesList = toStudyMetadata(studies);
            callback(undefined, study);
          } else {
            callback();
          }
        } else {
          Meteor.call('GetStudyMetadata', studyInstanceUid, callback);
        }
    });

    // Store the promise in cache
    StudyMetaDataPromises.set(studyInstanceUid, promise);

    return promise;
};
