import {getValue, increAndGetStoreValue, increaseForCountAndGetStoreValue, setValue} from "../services/repository";

const sendToTransferListPerSessionKey = 'sendToTransferListPerSession';
const losedTransferListCountKey = 'losedTransferListCountPerSession';

const getSentToTransferListStatsPerSession = (isNeedReset = false) => {
    let message = `\n Count sent to transfer list players per this sessions: ${_getSentToTransferListStats()}.`

    if (isNeedReset) {
        _resetSentToTransferListStats();
    }

    return message;
}

const getLosedTransferListStatsPerSession = (isNeedReset = false) => {
    let message = `\n Count losed transfer list players per this sessions: ${_getLosedTransferListStats()}. \n`

    if (isNeedReset) {
        _resetLosedTransferListStats();
    }

    return message;
}

const getSummaryTransferListStats = (isNeedReset = false) => {
    let sentMessage = getSentToTransferListStatsPerSession(isNeedReset);
    let losedMessage = getLosedTransferListStatsPerSession(isNeedReset);

    return sentMessage + losedMessage;
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
    setValue(losedTransferListCountKey, 0)
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
    increaseLosedTransferListCount,
    getSummaryTransferListStats
}