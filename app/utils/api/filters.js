import axios from "axios";
import {sendUINotification} from "../notificationUtil";
import {saveFilterInDB} from "../userExternalUtil";

const apiEndpoint = 'https://mysterious-savannah-72408.herokuapp.com/api';
const filtersPath = '/filters';
const filtersEndpoint = apiEndpoint + filtersPath;

const uploadFilter = (filterName, jsonSettings) => {
    const data = {
        'name': filterName,
        'settings': jsonSettings
    }

    axios.post(filtersEndpoint, data).then(response => {
        if (response.data.success === true) {
            sendUINotification(`Filter: ${filterName} success uploaded`);
        }
    }).catch(error => {
        sendUINotification(`Filter: ${filterName} upload failed`);
    })
}

const syncFilters = async () => {
    await axios.get(filtersEndpoint).then(response => {
        let responseData = response.data;
        if (responseData.success === true) {
            responseData.data.map(filter => {
                saveFilterInDB(filter.name, filter.settings)
                sendUINotification(`Filter: ${filter.name} success synced`);
            })
        }
    }).catch(error => {
        console.log(error)
    });
}

export {uploadFilter, syncFilters}