import { Meteor } from 'meteor/meteor';
import { OHIF } from 'meteor/ohif:core';

Meteor.methods({
    /**
     * Use the specified filter to conduct a search from the DICOM server
     *
     * @param filter
     */
    StudyListSearch(filter) {
        // Get the server data. This is user-defined in the config.json files or through servers
        // configuration modal
        const server = OHIF.servers.getCurrentServer();
        // OHIF.log("Server" + server)

        if (!server) {
            throw new Meteor.Error('improper-server-config', 'No properly configured server was available over DICOMWeb or DIMSE.');
        }

        const cachedStudies = OHIF.studylist.collections.CachedStudies.find();
        if (cachedStudies.count() == 0 || JSON.stringify(filter) != "{}") {  // TODO: WTF
            try {
                if (server.type === 'dicomWeb') {
                    const studies = OHIF.studies.services.QIDO.Studies(server, filter);
                    if (filter === {}) {
                        studies.forEach(study => OHIF.studylist.collections.CachedStudies.insert(study));
                    }
                    return studies;
                } else if (server.type === 'dimse') {
                    OHIF.log.info(`STUDIES ${OHIF.studylist.collections.CachedStudies.find().count()}`);
                    const studies = OHIF.studies.services.DIMSE.Studies(filter);
                    if (filter === {}) {
                        studies.forEach(study => {
                            OHIF.log.info(`Inserting ${study} into ${OHIF.studylist.collections.CachedStudies}`);
                            OHIF.studylist.collections.CachedStudies.insert(study)
                        });
                    }
                    OHIF.log.info(`STUDIES ${OHIF.studylist.collections.CachedStudies.find().count()}`);
                    return studies;
                }
            } catch (error) {
                OHIF.log.trace();

                throw error;
            }
        } else {
            return cachedStudies.fetch();
        }
    }
});
