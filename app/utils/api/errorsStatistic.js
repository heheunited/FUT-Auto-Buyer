import {postRequestToBackend} from "./apiRequest";
import {sendUINotification} from "../notificationUtil";

const apiEndpoint = 'https://mysterious-savannah-72408.herokuapp.com/api';
const errorsStatisticPath = '/autobuyer/statistic/errors';
const errorsEndpoint = apiEndpoint + errorsStatisticPath;

export const create = (data) => {
    const postData = {
        code: data.code
    }

    postRequestToBackend(errorsEndpoint, postData)
        .catch(errors => sendUINotification(errors, UINotificationType.NEGATIVE));
}