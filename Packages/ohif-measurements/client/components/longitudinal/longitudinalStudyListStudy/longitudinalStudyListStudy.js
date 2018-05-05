import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { OHIF } from 'meteor/ohif:core';

// Use Aldeed's meteor-template-extension package to replace the
// default StudyListStudy template.
// See https://github.com/aldeed/meteor-template-extension
const defaultTemplate = 'studylistStudy';

if (OHIF.studylist) {
    Template.longitudinalStudyListStudy.replaces(defaultTemplate);

    // Add the TimepointName helper to the default template. The
    // HTML of this template is replaced with that of longitudinalStudyListStudy
    Template[defaultTemplate].helpers({
        timepointName() {
            const instance = Template.instance();
            const timepointApi = OHIF.studylist.timepointApi;
            if (!timepointApi) {
                return;
            }

            const timepoint = timepointApi.study(instance.data.studyInstanceUid)[0];
            if (!timepoint) {
                return;
            }

            return timepointApi.name(timepoint);
        },

        reviewerTip() {
            const instance = Template.instance();
            const timepointApi = OHIF.studylist.timepointApi;
            if (!timepointApi || !window.Reviewers) {
                return;
            }

            const timepoint = timepointApi.study(instance.data.studyInstanceUid);
            if (!timepoint) {
                return;
            }

            const timepointReviewers = window.Reviewers.findOne({ timepointId: timepoint.timepointId });
            if (!timepointReviewers) {
                return;
            }

            return getReviewerTipText(timepointReviewers.reviewers);
        },

        reportText() {
            OHIF.studylist._dep.depend();
            const instance = Template.instance();
            return instance.data.reportText.join('\n');
        },

        reportAnomalies() {
            OHIF.studylist._dep.depend();
            const instance = Template.instance();
            return instance.data.reportAnomalies;
        },

        reportStyle() {
            OHIF.studylist._dep.depend();
            const instance = Template.instance();
            if (instance.data.isReportNormal) {
                return "";
            } else {
                const anomalies = instance.data.reportAnomalies;
                if (anomalies.includes("Urgent")) {
                    return "urgentReport";
                }
                if (anomalies.includes("Atelectasis") || anomalies.includes("Nodule") || anomalies.includes("Cardiomegaly")) {
                    return "abnormalReport";
                }
                if (anomalies.includes("Scoliosis") || anomalies.includes("Minimal")) {
                    return "yellowReport";
                }
                if (anomalies.includes("Scar") || anomalies.includes("Minimal")) {
                    return "scarReport";
                }
                // if (anomalies.includes("Mild")) {
                //     return "orangeReport";
                // }
                if (anomalies.includes("Sternotomy")) {
                    return "greyReport";
                }
                if (anomalies.includes("Old") || anomalies.includes("Healed")) {
                    return "greyReport";
                } else if (anomalies.includes("Fracture")) {
                    return "blueReport";
                }
                return "abnormalReport";
            }
        }
    });

    function getReviewerTipText(reviewers) {
        if (!reviewers || !reviewers.length) {
            return;
        }

        const newReviewers = reviewers.filter(function(reviewer) {
            return reviewer.userId !== Meteor.userId();
        });

        if (!newReviewers.length) {
            return;
        }

        let tipText = 'The study is being reviewed by ';
        newReviewers.forEach(function(reviewer, index) {
            if (reviewer.userId === Meteor.userId()) {
                return;
            }

            if (index > 0) {
                tipText += ',';
            }

            tipText += reviewer.userName;
        });

        return tipText;
    }
}
