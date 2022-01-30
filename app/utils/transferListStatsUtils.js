import {
    getBuyerSettings,
    getValue,
    increAndGetStoreValue,
    increaseForCountAndGetStoreValue,
    setValue
} from "../services/repository";

const sendToTransferListPerSessionKey = 'sendToTransferListPerSession';
const lessThanMaxBidLosedTransferListCountKey = 'lessThanMaxBidLosedTransferListCountKey';
const greaterThanMaxBidLosedTransferListCountKey = 'greaterThanMaxBidLosedTransferListCountKey';

const getSentToTransferListStatsPerSession = (isNeedReset = false) => {
    let message = ` Sent to transfer list items, count: ${_getTransferListStats(sendToTransferListPerSessionKey)} :::`;

    if (isNeedReset) {
        _resetTransferListStats(sendToTransferListPerSessionKey);
    }

    return message;
}

const getTotalLosedTransferListStatsPerSession = (isNeedReset = false) => {
    const buyerSetting = getBuyerSettings();
    let idAbMaxBid = buyerSetting['idAbMaxBid'];

    let lessThanMaxBidMsg = ` Losed items with current bid < ${idAbMaxBid}, count: ${_getTransferListStats(lessThanMaxBidLosedTransferListCountKey)} :::`;
    let higherThanMaxBidMsg = ` Losed items with current bid > ${idAbMaxBid}, count: ${_getTransferListStats(greaterThanMaxBidLosedTransferListCountKey)}`;

    if (isNeedReset) {
        _resetTransferListStats(lessThanMaxBidLosedTransferListCountKey);
        _resetTransferListStats(greaterThanMaxBidLosedTransferListCountKey);
    }

    return lessThanMaxBidMsg + higherThanMaxBidMsg;
}

const getSummaryTransferListStats = (isNeedReset = false) => {
    let sentMessage = getSentToTransferListStatsPerSession(isNeedReset);
    let losedMessage = getTotalLosedTransferListStatsPerSession(isNeedReset);

    return sentMessage + losedMessage;
}

const getTradeItemsStatisticForBackend = () => {
    const sttlCount = _getTransferListStats(sendToTransferListPerSessionKey);
    const llmbCount = _getTransferListStats(lessThanMaxBidLosedTransferListCountKey);
    const ltmbCount = _getTransferListStats(greaterThanMaxBidLosedTransferListCountKey);

    if (sttlCount === 0 && llmbCount === 0 && ltmbCount === 0) {
        return false;
    }

    return {
        sttl_count: sttlCount,
        llmb_count: llmbCount,
        ltmb_count: ltmbCount
    }
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
    increaseForCountAndGetStoreValue(greaterThanMaxBidLosedTransferListCountKey, greaterThanMaxBid);
}

export {
    getSentToTransferListStatsPerSession,
    increaseSentToTransferListCount,
    getTotalLosedTransferListStatsPerSession,
    increaseTotalLosedTransferListCount,
    getSummaryTransferListStats,
    getTradeItemsStatisticForBackend
}