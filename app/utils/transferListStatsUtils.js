import {
    getBuyerSettings,
    getValue,
    increAndGetStoreValue,
    increaseForCountAndGetStoreValue,
    setValue
} from "../services/repository";

const buyerSetting = getBuyerSettings();
const sendToTransferListPerSessionKey = 'sendToTransferListPerSession';
const lessThanMaxBidLosedTransferListCountKey = 'lessThanMaxBidLosedTransferListCountKey';
const higherThanMaxBidLosedTransferListCountKey = 'higherThanMaxBidLosedTransferListCountKey';

const getSentToTransferListStatsPerSession = (isNeedReset = false) => {
    let message = `\nSent to transfer list items. Count: ${_getTransferListStats(sendToTransferListPerSessionKey)}.`

    if (isNeedReset) {
        _resetTransferListStats(sendToTransferListPerSessionKey);
    }

    return message;
}

const getTotalLosedTransferListStatsPerSession = (isNeedReset = false) => {
    let lessThanMaxBidMsg = `\nLosed items with current bid < ${buyerSetting['ibMaxBid']}. Count: ${_getTransferListStats(lessThanMaxBidLosedTransferListCountKey)}. \n`
    let higherThanMaxBidMsg = `\nLosed items with current bid > ${buyerSetting['ibMaxBid']}. Count: ${_getTransferListStats(higherThanMaxBidLosedTransferListCountKey)}. \n`

    if (isNeedReset) {
        _resetTransferListStats(lessThanMaxBidLosedTransferListCountKey);
        _resetTransferListStats(higherThanMaxBidLosedTransferListCountKey);
    }

    return lessThanMaxBidMsg + higherThanMaxBidMsg;
}

const getSummaryTransferListStats = (isNeedReset = false) => {
    let sentMessage = getSentToTransferListStatsPerSession(isNeedReset);
    let losedMessage = getTotalLosedTransferListStatsPerSession(isNeedReset);

    return sentMessage + losedMessage;
}

const _getTransferListStats = (key, defaultValue = 0) => {
    return (getValue(key) || defaultValue);
}

const _resetTransferListStats = (key, newValue = 0) => {
    setValue(key, newValue)
}

const increaseSentToTransferListCount = () => {
    increAndGetStoreValue(sendToTransferListPerSessionKey);
}

const increaseTotalLosedTransferListCount = (lessThanMaxBid = 0, greaterThanMaxBid = 0) => {
    increaseForCountAndGetStoreValue(lessThanMaxBidLosedTransferListCountKey, lessThanMaxBid);
    increaseForCountAndGetStoreValue(higherThanMaxBidLosedTransferListCountKey, greaterThanMaxBid);
}

export {
    getSentToTransferListStatsPerSession,
    increaseSentToTransferListCount,
    getTotalLosedTransferListStatsPerSession,
    increaseTotalLosedTransferListCount,
    getSummaryTransferListStats
}