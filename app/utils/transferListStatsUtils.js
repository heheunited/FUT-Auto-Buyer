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
const estimatedProfitKey = 'estimatedProfitKey';

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
    let higherThanMaxBidMsg = ` Losed items with current bid > ${idAbMaxBid}, count: ${_getTransferListStats(greaterThanMaxBidLosedTransferListCountKey)} :::`;

    if (isNeedReset) {
        _resetTransferListStats(lessThanMaxBidLosedTransferListCountKey);
        _resetTransferListStats(greaterThanMaxBidLosedTransferListCountKey);
    }

    return lessThanMaxBidMsg + higherThanMaxBidMsg;
}

const getEstimatedProfitStatsPerSession = (isNeedReset = false) => {
    let estimatedProfitMsg = ` Estimated Profit: ${_getTransferListStats(estimatedProfitKey)} `

    if (isNeedReset) {
        _resetTransferListStats(estimatedProfitKey);
    }

    return estimatedProfitMsg;
}

const getSummaryTransferListStats = (isNeedReset = false) => {
    let sentMessage = getSentToTransferListStatsPerSession(isNeedReset);
    let losedMessage = getTotalLosedTransferListStatsPerSession(isNeedReset);
    let estimatedProfitMessage = getEstimatedProfitStatsPerSession(isNeedReset);

    return sentMessage + losedMessage + estimatedProfitMessage;
}

const getTradeItemsStatisticForBackend = () => {
    const sttlCount = _getTransferListStats(sendToTransferListPerSessionKey);
    const llmbCount = _getTransferListStats(lessThanMaxBidLosedTransferListCountKey);
    const ltmbCount = _getTransferListStats(greaterThanMaxBidLosedTransferListCountKey);
    const estimatedProfit = _getTransferListStats(estimatedProfitKey);

    if (sttlCount === 0 && llmbCount === 0 && ltmbCount === 0 && estimatedProfit === 0) {
        return false;
    }

    return {
        sttl_count: sttlCount,
        llmb_count: llmbCount,
        ltmb_count: ltmbCount,
        estimated_profit: estimatedProfit
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

const increaseEstimatedProfit = (profit) => {
    increaseForCountAndGetStoreValue(estimatedProfitKey, profit)
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
    getTradeItemsStatisticForBackend,
    increaseEstimatedProfit
}