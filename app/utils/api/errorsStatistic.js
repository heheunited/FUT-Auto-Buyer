import {getRequestToBackend, postRequestToBackend} from "./apiRequest";
import {sendUINotification} from "../notificationUtil";
import {updateStats} from "../../handlers/statsProcessor";

const apiEndpoint = 'https://mysterious-savannah-72408.herokuapp.com/api';
const errorsStatisticPath = '/autobuyer/statistic/errors';
const errorsEndpoint = apiEndpoint + errorsStatisticPath;

export const create = (data) => {
    const postData = {
        code: data.code
    }

    postRequestToBackend(errorsEndpoint, postData).catch(errors => sendUINotification(errors, UINotificationType.NEGATIVE));
}

export const createCaptcha = () => {
    let newUrl = errorsEndpoint + '/captcha'
    
    postRequestToBackend(newUrl, {}).catch(errors => sendUINotification(errors, UINotificationType.NEGATIVE));
}

export const getErrorsCountInterval = () => {
    const errorsCountPath = '/autobuyer/statistic/errors-count';
    const url = apiEndpoint + errorsCountPath;

    setInterval(() => {
        getRequestToBackend(url).then(response => {
            const responseData = response.data;

            if (responseData.success === true) {
                updateStats('tl24hErrors', responseData.count);
            }
        }).catch(error => sendUINotification(error, UINotificationType.NEGATIVE))
    }, 120000)
}

export const getCaptchaCountInterval = () => {
    const errorsCountPath = '/autobuyer/statistic/captcha-count';
    const url = apiEndpoint + errorsCountPath;

    setInterval(() => {
        getRequestToBackend(url).then(response => {
            const responseData = response.data;

            if (responseData.success === true) {
                updateStats('tl24hCaptcha', responseData.count);
            }
        }).catch(error => sendUINotification(error, UINotificationType.NEGATIVE))
    }, 120000)
}