import { OHIF } from 'meteor/ohif:core';
import { Router } from 'meteor/iron:router';

/**
 * Loads multiple unassociated studies in the Viewer
 */
OHIF.studylist.viewStudies = (newTab = false) => {
    OHIF.log.info('viewStudies');
    const selectedStudies = OHIF.studylist.getSelectedStudies();

    if (!selectedStudies || !selectedStudies.length) {
        return;
    }

    const studyInstanceUids = selectedStudies.map(study => study.studyInstanceUid).join(';');

    if (newTab) {
        window.open(Router.url('viewerStudies', { studyInstanceUids }));
    } else {
        Router.go('viewerStudies', { studyInstanceUids });
    }
};
