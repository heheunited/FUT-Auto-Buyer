import {getBuyerSettings, getValue} from "../services/repository";
import {deleteRequestToBackend, getRequestToBackend, postRequestToBackend} from "./api/apiRequest";
import {startAutoBuyer} from "../handlers/autobuyerProcessor";
import {sendErrorNotificationToUser, sendUINotification} from "./notificationUtil";

const apiEndpoint = 'https://mysterious-savannah-72408.herokuapp.com/api';

const _createUnresolvedCaptchaEntity = async () => {
    const endpoint = apiEndpoint + '/webhook/captcha';

    await postRequestToBackend(endpoint).catch(sendUINotification);
}

const _deleteAllCaptchaEntities = async () => {
    const endpoint = apiEndpoint + '/webhook/captcha/all';

    await deleteRequestToBackend(endpoint).catch(sendUINotification);
}

const longPollingCaptchaResolve = async () => {
    const autobuyerSettings = getBuyerSettings();
    const isLongPollingCaptchaActive = autobuyerSettings['idAbLongPollingCaptchaResolve'];

    if (!isLongPollingCaptchaActive || getValue('autoBuyerActive') === true) {
        return false;
    }

    await _createUnresolvedCaptchaEntity();

    await _loop();
}

const _loop = async () => {
    let checkCaptchaStatusEndpoint = apiEndpoint + '/webhook/captcha/status';

    if (getValue('autoBuyerActive') === true) {
        await _deleteAllCaptchaEntities();
        return true;
    }

    await getRequestToBackend(checkCaptchaStatusEndpoint)
        .then(async (response) => {
            let responseData = response.data;

            if (responseData.is_resolved === false) {
                setTimeout(await _loop, 30000)
            } else {
                let message = 'Captcha success resolved by long polling. Start Autobuyer.'
                sendErrorNotificationToUser(message)
                sendUINotification(message)

                startAutoBuyer.call(getValue("AutoBuyerInstance"));

                await _deleteAllCaptchaEntities();

                return true;
            }
        });

}

export {longPollingCaptchaResolve, _deleteAllCaptchaEntities}