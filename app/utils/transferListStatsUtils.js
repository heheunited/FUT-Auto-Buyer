import {getValue, increAndGetStoreValue, setValue} from "../services/repository";
const sendToTransferListPerSessionKey = 'sendToTransferListPerSession';

const getSentToTransferListStatsPerSession = (isNeedReset = false) => {
    let message = `Count sent to transfer list players per this sessions: ${_getSentToTransferListStats()}`

    if (isNeedReset) {
        _resetSentToTransferListStats();
    }

    return message;
}


const _getSentToTransferListStats = () => {
    return (getValue(sendToTransferListPerSessionKey) || 0);
}

const _resetSentToTransferListStats = () => {
    setValue(sendToTransferListPerSessionKey, 0)
}

const increaseSentToTransferListCount = () => {
    increAndGetStoreValue(sendToTransferListPerSessionKey);
}


export {getSentToTransferListStatsPerSession, increaseSentToTransferListCount}