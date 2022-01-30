import axios from "axios";
import {sendUINotification} from "../notificationUtil";

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

const syncFilters = () => {
    axios.get(filtersEndpoint).then(response => {
        console.log(response)
    }).catch(error => {
        console.log(error)
    });
}

export {uploadFilter, syncFilters}