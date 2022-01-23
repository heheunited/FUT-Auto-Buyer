import {getValue, increAndGetStoreValue, increaseForCountAndGetStoreValue, setValue} from "../services/repository";

const sendToTransferListPerSessionKey = 'sendToTransferListPerSession';
const losedTransferListCountKey = 'losedTransferListCount';

const getSentToTransferListStatsPerSession = (isNeedReset = false) => {
    let message = `Count sent to transfer list players per this sessions: ${_getSentToTransferListStats()}.`

    if (isNeedReset) {
        _resetSentToTransferListStats();
    }

    return message;
}

const getLosedTransferListStatsPerSession = (isNeedReset = false) => {
    let message = `Count losed transfer list players per this sessions: ${_getLosedTransferListStats()}.`

    if (isNeedReset) {
        _resetLosedTransferListStats();
    }

    return message;
}


const _getSentToTransferListStats = () => {
    return (getValue(sendToTransferListPerSessionKey) || 0);
}

const _getLosedTransferListStats = () => {
    return (getValue(losedTransferListCountKey) || 0);
}

const _resetSentToTransferListStats = () => {
    setValue(sendToTransferListPerSessionKey, 0)
}

const _resetLosedTransferListStats = () => {
    setValue(sendToTransferListPerSessionKey, 0)
}

const increaseSentToTransferListCount = () => {
    increAndGetStoreValue(sendToTransferListPerSessionKey);
}

const increaseLosedTransferListCount = (count) => {
    increaseForCountAndGetStoreValue(losedTransferListCountKey, count);
}

export {
    getSentToTransferListStatsPerSession,
    increaseSentToTransferListCount,
    getLosedTransferListStatsPerSession,
    increaseLosedTransferListCount
}