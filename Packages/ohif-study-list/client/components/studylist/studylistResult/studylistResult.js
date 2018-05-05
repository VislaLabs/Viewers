import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { ReactiveVar } from 'meteor/reactive-var';
import { ReactiveDict } from 'meteor/reactive-dict';
import { moment } from 'meteor/momentjs:moment';
import { OHIF } from 'meteor/ohif:core';
import * as localforage_ from 'localforage';

const localforage = localforage_.default;

Session.setDefault('showVisla', false);
Session.setDefault('showLoadingText', true);
Session.setDefault('serverError', false);

OHIF.studylist.sortedStudies = [];
OHIF.studylist.diagnostis = {};
OHIF.studylist.reports = {};
OHIF.studylist.studyCount = 0;
OHIF.studylist._dep = new Deps.Dependency;
OHIF.studylist._dep2 = new Deps.Dependency;

// const fs = Npm.require('fs');
let cachedStudies = null;

OHIF.studylist.filterHeatmapsFromDiagnostics = diagnostics => {
    return diagnostics.map(diag => {
        const filteredDiag = {};
        filteredDiag.accessionNumber = diag.accessionNumber;
        filteredDiag.diagnostic = {};
        for (key in diag.diagnostic) {
            filteredDiag.diagnostic[key] = diag.diagnostic[key].probability;
        }
        return filteredDiag;
    });
}

function downloadObjectAsJson(exportObj, exportName){
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

Meteor.defer(() => {
    if (navigator.storage) {
        navigator.storage.estimate().then(
          info => console.log(
            `using ${info.usage} out of ${info.quota}, or ${info.usage/info.quota*100}%`
          )
        );
    }

    OHIF.log.info('Loading local files');

    Session.set('showLoadingVisla', true);

    const studiesPromise = localforage.getItem('localStudies').then(studies => {
        if (studies) {
            studies.forEach(study => {
                cornerstoneWADOImageLoader.wadouri.fileManager.add(study.file)
                OHIF.studylist.collections.LocalStudies.insert(study);
            });
            OHIF.log.info(`Loaded ${studies.length} studies`);
        }
    });

    const diagnosticsPromise = localforage.getItem('diagnosticsNoHeatmaps').then(diagnostics => {
        if (diagnostics) {
//             diagnostics.forEach(diagnostic => {
//                 OHIF.studylist.collections.Diagnostics.insert(diagnostic);
//             });
            //downloadObjectAsJson(diagnostics);
            OHIF.studylist.diagnostics = diagnostics.reduce(function(map, obj) {
                if (obj.diagnostic) {
                    map[obj.accessionNumber] = obj.diagnostic;
                }
                return map;
            }, {});
            OHIF.log.info(`Loaded ${diagnostics.length} diagnostics`);
        }
    });

    const reportsPromise = localforage.getItem('localReports').then(reports => {
        if (reports) {
            // reports.forEach(report => {
            //     OHIF.studylist.collections.LocalReports.insert(report);
            // });
            OHIF.studylist.reports = reports.reduce(function(map, obj) {
                if (obj.text) {
                    const reportAnomaly = OHIF.studylist.isReportNormal(obj.text);
                    const report = {
                        text: obj.text,
                        isReportNormal: !reportAnomaly.found,
                    };
                    if (reportAnomaly.found) {
                        report.anomalies = reportAnomaly.anomalies;
                    }
                    map[obj.accessionNumber] = report;
                }
                return map;
            }, {});
            OHIF.log.info(`Loaded ${reports.length} reports`);
        };
    });

    Promise.all([studiesPromise, diagnosticsPromise, reportsPromise]).then(() => {
        Session.set('showLoadingVisla', false);
        search();
    });
})



Template.studylistResult.helpers({
    /**
     * Returns a ascending sorted instance of the Studies Collection by Patient name and Study Date
     */
    studies() {
        OHIF.studylist._dep.depend();
        const instance = Template.instance();

        let studies = OHIF.studylist.sortedStudies;

        const rowsPerPage = instance.paginationData.rowsPerPage.get();
        const currentPage = instance.paginationData.currentPage.get();
        const offset = rowsPerPage * currentPage;
        const limit = offset + rowsPerPage;

        instance.numberOfStudies.set(studies.length);
        OHIF.studylist.studyCount = studies.length;
        OHIF.studylist._dep2.changed();

        if (!studies) {
            return;
        }

        // Update record count
        instance.paginationData.recordCount.set(studies.length);

        // Limit studies
        return studies.slice(offset, limit);
    },

    numberOfStudies() {
        const instance = Template.instance();
        return instance.numberOfStudies.get();
    },

    sortingColumnsIcons() {
        const instance = Template.instance();

        let sortingColumnsIcons = {};
        Object.keys(instance.sortingColumns.keys).forEach(key => {
            const value = instance.sortingColumns.get(key);

            if (value === 1) {
                sortingColumnsIcons[key] = 'fa fa-fw fa-sort-up';
            } else if (value === -1) {
                sortingColumnsIcons[key] = 'fa fa-fw fa-sort-down';
            } else {
                // fa-fw is blank
                sortingColumnsIcons[key] = 'fa fa-fw';
            }
        });
        return sortingColumnsIcons;
    }
});

let studyDateFrom;
let studyDateTo;
let filter;

/**
 * Transforms an input string into a search filter for
 * the StudyList Search call
 *
 * @param filter The input string to be searched for
 * @returns {*}
 */
function getFilter(filter) {
    if (filter && filter.length && filter.substr(filter.length - 1) !== '*') {
        filter += '*';
    }

    return filter;
}

function getPredicate(filter) {
    const getOperator = op => {
        if (filter.includes(op)) {
            const splitString = filter.split(op);
            let value;
            if (splitString && splitString.length) {
                value = parseFloat(splitString[splitString.length - 1]);
            }
            return value;
        }
        return null;
    };
    const getWordFilter = () => {
        const words = filter.match(/((\*|[A-Z]|[a-z])+)/g);
        if (words && words.length) {
            return words[0];
        }
        return null;
    }
    if (filter && filter.length) {
        const lt = getOperator('<') || getOperator('<=');
        const gt = getOperator('>') || getOperator('>=');
        const riskFilter = {};
        if (lt) {
            riskFilter['$lt'] = lt
        }
        if (gt) {
            riskFilter['$gt'] = gt
        }
        filters = {};
        if (lt || gt) {
            filters['maxRisk'] = riskFilter;
        }
        const wordFilter = getWordFilter(filter);
        if (wordFilter) {
            filters['diseaseRisk'] = { "$regex": wordFilter };
        }
        return filters;
    }
}

/**
 * Search for a value in a string
 */
function isIndexOf(mainVal, searchVal) {
    if (mainVal === undefined || mainVal === '' || mainVal.indexOf(searchVal) > -1){
        return true;
    }

    return false;
}

/**
 * Replace object if undefined
 */
function replaceUndefinedColumnValue(text) {
    if (text === undefined || text === 'undefined') {
        return '';
    } else {
        return text.toUpperCase();
    }
}

/**
 * Convert string to study date
 */
function convertStringToStudyDate(dateStr) {
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    const newDateStr = m + '/' + d + '/' + y;
    return new Date(newDateStr);
}

function fetchAllFromRemote(callback) {
    // Hiding error message
    Session.set('serverError', false);

    Meteor.call('StudyListSearch', {}, (error, studies) => {
        OHIF.log.info('StudyListSearch');
        // Hide loading text

        if (error) {
            Session.set('serverError', true);

            const errorType = error.error;

            if (errorType === 'server-connection-error') {
                OHIF.log.error('There was an error connecting to the DICOM server, please verify if it is up and running.');
            } else if (errorType === 'server-internal-error') {
                OHIF.log.error('There was an internal error with the DICOM server');
            } else {
                OHIF.log.error('For some reason we could not list the studies.')
            }

            OHIF.log.error(error.stack);
            return;
        }

        if (!studies || studies.length == 0) {
            OHIF.log.warn('No studies found');
            return;
        }

        callback(studies);
    });
}

function finishFilteringStudiesIntoCollection(studies, modality, collection) {
    // Loop through all identified studies
    studies.forEach(study => {
      // Search the rest of the parameters that aren't done via the server call
      if (isIndexOf(study.modalities, modality) &&
          (new Date(studyDateFrom).setHours(0, 0, 0, 0) <= convertStringToStudyDate(study.studyDate) || !studyDateFrom || studyDateFrom === '') &&
          (convertStringToStudyDate(study.studyDate) <= new Date(studyDateTo).setHours(0, 0, 0, 0) || !studyDateTo || studyDateTo === '')) {

          // Convert numberOfStudyRelatedInstance string into integer
          study.numberOfStudyRelatedInstances = !isNaN(study.numberOfStudyRelatedInstances) ? parseInt(study.numberOfStudyRelatedInstances) : undefined;

          const diagnostic = OHIF.studylist.diagnostics[study.accessionNumber];
          if (study.accessionNumber == "SCA01212190") {
              console.log(JSON.stringify(diagnostic));
          }
          let maxRisk = 0.0;
          if (diagnostic) {
              const diseasesByRisk = [];
              let diseaseRisk = "2% or less";
              for (var disease in diagnostic) {
                let probability = parseFloat(diagnostic[disease]);
                if (disease == "Infiltration") {
                    probability /= 2.0;
                }
                if (probability > 2.0) {
                    diseasesByRisk.push([disease, probability]);
                }
                if (probability > 2.0 && probability > maxRisk) {
                    maxRisk = probability;
                    diseaseRisk = `${maxRisk}%`
                }
              }
              study.diseases = diseasesByRisk.sort((a, b) => b[1] - a[1]).slice(0, 3).map(a => a[0]).join(', ');
              study.diseaseRisk = diseaseRisk;
              study.maxRisk = maxRisk;
          }

          const report = OHIF.studylist.reports[study.accessionNumber];
          if (report) {
              // if (study.accessionNumber == "CHE00157345" || maxRisk < 10.0) {
              //     OHIF.studylist.isReportNormal(report.text, true);
              // }
              study.reportText = report.text;
              study.isReportNormal = report.isReportNormal;
              if (report.isReportNormal) {
                  study.reportAnomalies = "Normal";
              } else {
                  if (Object.keys(report.anomalies).length) {
                      study.reportAnomalies = Object.keys(report.anomalies).join(", ");
                  } else {
                      study.reportAnomalies = "Abnormal";
                  }
              }
          }

          // Insert any matching studies into the Studies Collection
          if (report) {
              collection.insert(study);
          }
      }
  });
}

/**
 * Runs a search for studies matching the studylist query parameters
 * Inserts the identified studies into the Studies Collection
 */
function search() {
    OHIF.log.info('search()');

    // Create the filters to be used for the StudyList Search
    filter = {
        patientName: getFilter($('input#patientName').val()),
        //patientId: getFilter($('input#patientId').val()),
        accessionNumber: getFilter($('input#accessionNumber').val()),
        studyDescription: getFilter($('input#studyDescription').val()),
        studyDateFrom,
        studyDateTo,
        modalitiesInStudy: $('input#modality').val() ? $('input#modality').val() : ''
    };
    let collectionFilter = {};
    for (key in filter) {
        if (filter[key] && key != "studyDateFrom" && key != "studyDateTo") {
            collectionFilter[key] = { "$regex": filter[key] };
        }
    }

    const finish = () => {
        // Make sure that modality has a reasonable value, since it is occasionally
        // returned as 'undefined'
        const modality = replaceUndefinedColumnValue($('input#modality').val());
        const Studies = new Meteor.Collection(null);
        finishFilteringStudiesIntoCollection(OHIF.studylist.collections.LocalStudies.find(collectionFilter).fetch(), modality,
                                             Studies);
        finishFilteringStudiesIntoCollection(cachedStudies.find(collectionFilter).fetch(), modality,
                                             Studies);
        OHIF.studylist.collections.Studies = Studies;
        sortStudies();
        Studies._debugName = "Studies";
        OHIF.studylist._dep.changed();
        Session.set('showLoadingText', false);
    }

    Session.set('showLoadingText', true);

    if (cachedStudies == null) {
        localforage.getItem('cachedStudies').then(studies => {
            cachedStudies = new Meteor.Collection(null);
            if (studies) {
                OHIF.log.info(`Loaded ${studies.length} cached studies`);
                studies.forEach(study => cachedStudies.insert(study));
                finish();
            } else {
                OHIF.log.warn(`Loaded 0 cached studies`);
            }
        });

        fetchAllFromRemote(studies => {
            cachedStudies = new Meteor.Collection(null);
            studies.forEach(study => cachedStudies.insert(study));
            finish();
        });
    } else {
        new Promise((resolve, reject) => {
            finish();
            resolve();
        });
    }
}

OHIF.studylist.update = function() {
    search();
}

const saveCachedStudies = function() {
    localforage.setItem('cachedStudies', cachedStudies.find().fetch());
}

const getCurrentPage = () => {
    const currentPage = sessionStorage.getItem('currentPage');
    return currentPage ? currentPage : 0;
}

const setCurrentPage = (oldValue, newValue) => {
    sessionStorage.setItem('currentPage', newValue);
    return typeof ReactiveVar._isEqual === 'function' ? ReactiveVar._isEqual(oldValue, newValue) : oldValue === newValue;
};

const getRowsPerPage = () => {
    const rowsPerPage = sessionStorage.getItem('rowsPerPage');
    return rowsPerPage ? rowsPerPage : 25;
}

// Wraps ReactiveVar equalsFunc function. Whenever ReactiveVar is
// set to a new value, it will save it in the Session Storage.
// The return is the default ReactiveVar equalsFunc if available
// or values are === comCurrentPagepared
const setRowsPerPage = (oldValue, newValue) => {
    sessionStorage.setItem('rowsPerPage', newValue);
    return typeof ReactiveVar._isEqual === 'function' ? ReactiveVar._isEqual(oldValue, newValue) : oldValue === newValue;
};

Template.studylistResult.onCreated(() => {
    const instance = Template.instance();
    instance.sortOption = new ReactiveVar();
    instance.sortingColumns = new ReactiveDict();
    instance.numberOfStudies = new ReactiveVar(0);

    // Pagination parameters
    const rowsPerPage = getRowsPerPage();
    const currentPage = getCurrentPage();
    instance.paginationData = {
        class: 'studylist-pagination',
        currentPage: new ReactiveVar(parseInt(currentPage, 10), setCurrentPage),
        rowsPerPage: new ReactiveVar(parseInt(rowsPerPage, 10), setRowsPerPage),
        recordCount: new ReactiveVar(0)
    };

    // Set sortOption
    const sortOptionSession = Session.get('sortOption');
    if (sortOptionSession) {
        instance.sortingColumns.set(sortOptionSession);
    } else {
        instance.sortingColumns.set({
            patientName: 0,
            studyDate: 0,
            patientId: 0,
            accessionNumber: 0,
            diseaseRisk: -1,
            studyDescription: 0,
            modality: 0
        });
    }
});

Template.studylistResult.onRendered(() => {
    const instance = Template.instance();

    // Initialize daterangepicker
    const today = moment();
    const lastWeek = moment().subtract(6, 'days');
    const lastMonth = moment().subtract(29, 'days');
    const $studyDate = instance.$('#studyDate');
    const dateFilterNumDays = OHIF.uiSettings.studyListDateFilterNumDays;
    let startDate, endDate;

    if (dateFilterNumDays) {
        startDate = moment().subtract(dateFilterNumDays - 1, 'days');
        endDate = today;
    }

    instance.datePicker = $studyDate.daterangepicker({
        maxDate: today,
        autoUpdateInput: true,
        startDate: startDate,
        endDate: endDate,
        ranges: {
            Today: [today, today],
            'Last 7 Days': [lastWeek, today],
            'Last 30 Days': [lastMonth, today]
        }
    }).data('daterangepicker');

    if (startDate && endDate) {
//         instance.datePicker.updateInputText();
    } else {
        // Retrieve all studies
        search();
    }
});

Template.studylistResult.onDestroyed(() => {
    const instance = Template.instance();

    // Destroy the daterangepicker to prevent residual elements on DOM
    instance.datePicker.remove();
});

function resetSortingColumns(instance, sortingColumn) {
    Object.keys(instance.sortingColumns.keys).forEach(key => {
        if (key !== sortingColumn) {
            instance.sortingColumns.set(key, null);
        }
    });
}

function sortStudies(instance) {
    let sortOption = {
        // patientName: 1,
        // studyDate: 1,
        diseaseRisk: -1,
    };

    // Update sort option if session is defined
    if (Session.get('sortOption')) {
        sortOption = Session.get('sortOption');
    }

    let sortFunction;
    if (sortOption['diseaseRisk'] == 1) {
        sortOption['diseaseRisk'] = (a, b) => {
            return (a.diseaseRisk ? parseFloat(a.diseaseRisk) : 0.0) - (b.diseaseRisk ? parseFloat(b.diseaseRisk) : 0.0);
        }
    } else if (sortOption['diseaseRisk'] == -1) {
        sortOption['diseaseRisk'] = (a, b) => {
            return (b.diseaseRisk ? parseFloat(b.diseaseRisk) : 0.0) - (a.diseaseRisk ? parseFloat(a.diseaseRisk) : 0.0);
        }
    }

    // Pagination parameters
    const diseasesFilter = $('input#diseases').val();
    const reportFilter = $('input#report').val();
    const diseaseRiskFilter = getPredicate($('input#diseaseRisk').val());
    const filter = diseaseRiskFilter ? diseaseRiskFilter : {};
    if (diseasesFilter) {
        filter.diseases = { "$regex": diseasesFilter };
    }
    if (reportFilter) {
        filter.reportAnomalies = { "$regex": reportFilter };
    }

    OHIF.studylist.sortedStudies = OHIF.studylist.collections.Studies.find(filter, {
        sort: sortOption
    }).fetch();
    // if (sortFunction) {
    //     OHIF.studylist.sortedStudies.sort(sortFunction);
    // }
}

Template.studylistResult.events({
    'keydown input'(event) {
        if (event.which === 13) { //  Enter
            search();
        }
    },

    'onsearch input'() {
        search();
    },

    'change #studyDate'(event) {
        let dateRange = $(event.currentTarget).val();

        // Remove all space chars
        dateRange = dateRange.replace(/ /g, '');

        // Split dateRange into subdates
        const dates = dateRange.split('-');
        studyDateFrom = dates[0];
        studyDateTo = dates[1];

        if (dateRange !== '') {
            search();
        }
    },

    'click div.sortingCell'(event, instance) {
        const elementId = event.currentTarget.id;

        // Remove _ from id
        const columnName = elementId.replace('_', '');

        let sortOption = {};
        resetSortingColumns(instance, columnName);

        const columnObject = instance.sortingColumns.get(columnName);
        if (columnObject) {
            instance.sortingColumns.set(columnName, columnObject * -1);
            sortOption[columnName] = columnObject * -1;
        } else {
            instance.sortingColumns.set(columnName, 1);
            sortOption[columnName] = 1;
        }

        instance.sortOption.set(sortOption);
        Session.set('sortOption', sortOption);
        sessionStorage.setItem('sortOption', sortOption);
        sortStudies();
    }
});
