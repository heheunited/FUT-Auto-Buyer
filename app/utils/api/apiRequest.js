import axios from "axios";
import {getBuyerSettings} from "../../services/repository";

const getRequestToBackend = (url) => {
    url += _getApiKey();

    return axios.get(url, {
        validateStatus: function (status) {
            return status < 500;
        }
    });
}

const postRequestToBackend = (url, data) => {
    url += _getApiKey();

    return axios.post(
        url, data, {
            validateStatus: function (status) {
                return status < 500;
            }
        });
}

const _getApiKey = () => {
    const apiKeySetting = getBuyerSettings()['idAbBackendApiKey'];

    return `?apiKey=${apiKeySetting}`
};

export {getRequestToBackend, postRequestToBackend}