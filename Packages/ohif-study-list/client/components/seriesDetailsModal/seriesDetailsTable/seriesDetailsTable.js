import { Template } from 'meteor/templating';
import { ReactiveDict } from 'meteor/reactive-dict';
import { _ } from 'meteor/underscore';
import { OHIF } from 'meteor/ohif:core';

Template.seriesDetailsTable.onCreated(() => {
    const instance = Template.instance();

    let studies = instance.data.selectedStudies;

    if (!studies) {
        return;
    }

    // Display loading text while getting series
    studies.forEach(study => {
        study.displaySeriesLoadingText = true;
    });

    instance.selectedStudies = new ReactiveDict();
    instance.selectedStudies.set('studies', studies);
});

Template.seriesDetailsTable.onRendered(() => {
    const instance = Template.instance();
    const studies = instance.data.selectedStudies;  //instance.selectedStudies.get('studies');

    if (!studies) {
        return;
    }

    new Promise((resolve, reject) => {
        studies.forEach(study => {
            const report = OHIF.studylist.reports[study.accessionNumber];
            if (report && report.text) {
                study.report = report.text.join('\n');
            }
            instance.selectedStudies.set('studies', studies);
            resolve();
        });
    });

    // Get series list for the study
    studies.forEach(study => {
        OHIF.studies.retrieveStudyMetadata(study.studyInstanceUid).then(studyMetadata => {
            study.seriesList = studyMetadata.seriesList;
            study.displaySeriesLoadingText = false;
            instance.selectedStudies.set('studies', studies);
        });
    });
});

Template.seriesDetailsTable.helpers({
    selectedStudies() {
        return Template.instance().selectedStudies.get('studies');
    }
});
