import { cornerstone } from 'meteor/ohif:cornerstone';
import { getElementIfNotEmpty } from './getElementIfNotEmpty';
// Visla Modules
import { vislaTools } from 'meteor/visla:cornerstone.js';

const getPatient = function(property) {
    if (!this.imageId) {
        return false;
    }

    const patient = cornerstone.metaData.get('patient', this.imageId);
    if (!patient) {
        return '';
    }

    return patient[property];
};

const getDiagnostic = function(property) {
    if (!this.imageId) {
        return false;
    }

    const instance = cornerstone.metaData.get('instance', this.imageId);
    if (!instance) {
        return false;
    }

    const modality = instance['modality'];
    if (!modality || modality != 'CR') {
        return false;
    }

    const diagnostic = vislaTools.getDiagnostic();
    const length = Object.keys(diagnostic).length;
    if (length == 0) {
        return '';
    }

    var result = "";
    var impression = false;
    var transition = false;
    var found = 0;
    for (const [key, value] of Object.entries(diagnostic)) {
        if (value > 50.0) {
            if (impression == false) {
                result += "IMPRESSION: "
                impression = true;
            } else {
                result += ", ";
            }
            result += key;
        } else {
            if (!transition) {
              if (found > 0) {
                  result += "\n"
                  result += "Also suspicion of ";
              } else {
                var adjective = "";
                if (value < 20.0) {
                  adjective = "small ";
                }
                result += `\nIt saw a ${adjective}risk of `;
              }
            } else {
              result += ", ";
            }
            transition = true;
            result += key;
        }
    }
    return result;
};

const getStudy = function(property) {
    if (!this.imageId) {
        return false;
    }

    const study = cornerstone.metaData.get('study', this.imageId);
    if (!study) {
        return '';
    }

    return study[property];
};

const getSeries = function(property) {
    if (!this.imageId) {
        return false;
    }

    const series = cornerstone.metaData.get('series', this.imageId);
    if (!series) {
        return '';
    }

    return series[property];
};

const getInstance = function(property) {
    if (!this.imageId) {
        return false;
    }

    const instance = cornerstone.metaData.get('instance', this.imageId);
    if (!instance) {
        return '';
    }

    return instance[property];
};

const getTagDisplay = function(property) {
    if (!this.imageId) {
        return false;
    }

    const instance = cornerstone.metaData.get('tagDisplay', this.imageId);
    if (!instance) {
        return '';
    }

    return instance[property];
};

const getImage = function(viewportIndex) {
    const element = getElementIfNotEmpty(viewportIndex);
    if (!element) {
        return false;
    }

    let enabledElement;
    try {
        enabledElement = cornerstone.getEnabledElement(element);
    } catch(error) {
        return false;
    }

    if (!enabledElement || !enabledElement.image) {
        return false;
    }

    return enabledElement.image;
};

const formatDateTime = (date, time) => `${date} ${time}`;

const viewportOverlayUtils = {
    getPatient,
    getDiagnostic,
    getStudy,
    getSeries,
    getInstance,
    getTagDisplay,
    getImage,
    formatDateTime
};

export { viewportOverlayUtils };
