import { Mongo } from 'meteor/mongo';
import { OHIF } from 'meteor/ohif:core';

const StudyImportStatus = new Mongo.Collection('studyImportStatus');
StudyImportStatus._debugName = 'StudyImportStatus';
OHIF.studylist.collections.StudyImportStatus = StudyImportStatus;

const CachedStudies = new Mongo.Collection('cachedStudies');
CachedStudies._debugName = 'CachedStudies';
OHIF.studylist.collections.CachedStudies = CachedStudies;

export { StudyImportStatus, CachedStudies };
