import axios from "axios";
import {getBuyerSettings} from "../../services/repository";

const getRequestToBackend = (url) => {
    url = _appendApiKeyToUrl(url);

    return axios.get(url, {
        validateStatus: function (status) {
            return status < 500;
        }
    });
}

const postRequestToBackend = (url, data) => {
    url = _appendApiKeyToUrl(url);

    return axios.post(
        url, data, {
            validateStatus: function (status) {
                return status < 500;
            }
        });
}

const deleteRequestToBackend = (url) => {
    url = _appendApiKeyToUrl(url);

    return axios.delete(url, {
        validateStatus: function (status) {
            return status < 500;
        }
    });
}

const _appendApiKeyToUrl = (url) => {
    const apiKeySetting = getBuyerSettings()['idAbBackendApiKey'];

    let urlObj = new URL(url)

    urlObj.searchParams.set('apiKey', apiKeySetting);

    return urlObj.href;
};

export {getRequestToBackend, postRequestToBackend, deleteRequestToBackend}