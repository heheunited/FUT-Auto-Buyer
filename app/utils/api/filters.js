import {sendUINotification} from "../notificationUtil";
import {saveFilterInDB} from "../userExternalUtil";
import {deleteRequestToBackend, getRequestToBackend, postRequestToBackend} from "./apiRequest";

const apiEndpoint = 'https://mysterious-savannah-72408.herokuapp.com/api';
const filtersPath = '/filters';
const filtersEndpoint = apiEndpoint + filtersPath;

const uploadFilter = (filterName, jsonSettings) => {
    const data = {
        'name': filterName,
        'settings': jsonSettings
    }

    postRequestToBackend(filtersEndpoint, data).then(response => {
        let responseData = response.data;

        if (responseData.success === true) {
            sendUINotification(`Filter: ${filterName} success uploaded`);
        } else {
            sendUINotification(`Something went wrong! Message: ${responseData.message}`, UINotificationType.NEGATIVE);
        }
    }).catch(error => {
        sendUINotification(`Filter: ${error} upload failed`, UINotificationType.NEGATIVE);
    })
}

const syncFilters = async () => {
    await getRequestToBackend(filtersEndpoint).then(response => {
        let responseData = response.data;
        if (responseData.success === true) {
            responseData.data.map(filter => {
                saveFilterInDB(filter.name, filter.settings)
                sendUINotification(`Filter: ${filter.name} success synced`);
            })
        } else {
            sendUINotification(`Something went wrong! Message: ${responseData.message}`);
        }
    }).catch(error => {
        sendUINotification(`Sync error: ${error}`, UINotificationType.NEGATIVE);
    });
}

const deleteFilterFromCloud = async (filterName) => {
    let newFiltersEndpoint = filtersEndpoint + `?filterName=${filterName}`;

    await deleteRequestToBackend(newFiltersEndpoint).then(response => {
        let responseData = response.data;

        if (responseData.success === true) {
            sendUINotification(`Filter: ${filterName} success deleted`);
        }
    }).catch(error => {
        sendUINotification(`Delete error: ${error}`, UINotificationType.NEGATIVE);
    })
}

export {uploadFilter, syncFilters, deleteFilterFromCloud}