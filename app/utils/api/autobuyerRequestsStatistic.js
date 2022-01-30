import {postRequestToBackend} from "./apiRequest";
import {sendUINotification} from "../notificationUtil";

const apiEndpoint = 'https://mysterious-savannah-72408.herokuapp.com/api';
const requestsStatisticPath = '/autobuyer/statistic/requests';
const requestsStatisticPathEndpoint = apiEndpoint + requestsStatisticPath;

const recordRequestsStatistics = (data) => {
    postRequestToBackend(requestsStatisticPathEndpoint, data)
        .then(response => {
            const responseData = response.data;

            if (responseData.success === true) {
                sendUINotification(`Requests statistic recorded!`);
            }
        }).catch(console.log)
}

export {recordRequestsStatistics}