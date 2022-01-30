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

const totalBuyPlayerRequestsCountKey = 'totalBuyPlayerRequestsCountKey';
const bidPlayerRequestsCountKey = 'bidPlayerRequestsCountKey';
const buyPlayerRequestsCountKey = 'buyPlayerRequestsCountKey';
const outbidPlayerRequestsCountKey = 'outbidPlayerRequestsCountKey';
const searchRequestsCountKey = 'searchRequestsCountKey';
const listPlayerRequestsCountKey = 'listPlayerRequestsCountKey';
const reListPlayerRequestsCountKey = 'reListPlayerRequestsCountKey';
const removePlayerRequestsCountKey = 'removePlayerRequestsCountKey';

const getSentToTransferListStatsPerSession = (isNeedReset = false) => {
    let message = ` Sent to transfer list items, count: ${_getStatsValue(sendToTransferListPerSessionKey)} :::`;

    if (isNeedReset) {
        _resetStatsValue(sendToTransferListPerSessionKey);
    }

    return message;
}

const getTotalLosedTransferListStatsPerSession = (isNeedReset = false) => {
    const buyerSetting = getBuyerSettings();
    let idAbMaxBid = buyerSetting['idAbMaxBid'];

    let lessThanMaxBidMsg = ` Losed items with current bid < ${idAbMaxBid}, count: ${_getStatsValue(lessThanMaxBidLosedTransferListCountKey)} :::`;
    let higherThanMaxBidMsg = ` Losed items with current bid > ${idAbMaxBid}, count: ${_getStatsValue(greaterThanMaxBidLosedTransferListCountKey)} :::`;

    if (isNeedReset) {
        _resetStatsValue(lessThanMaxBidLosedTransferListCountKey);
        _resetStatsValue(greaterThanMaxBidLosedTransferListCountKey);
    }

    return lessThanMaxBidMsg + higherThanMaxBidMsg;
}

const getEstimatedProfitStatsPerSession = (isNeedReset = false) => {
    let estimatedProfitMsg = ` Estimated Profit: ${_getStatsValue(estimatedProfitKey)} `

    if (isNeedReset) {
        _resetStatsValue(estimatedProfitKey);
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
    const sttlCount = _getStatsValue(sendToTransferListPerSessionKey);
    const llmbCount = _getStatsValue(lessThanMaxBidLosedTransferListCountKey);
    const ltmbCount = _getStatsValue(greaterThanMaxBidLosedTransferListCountKey);
    const estimatedProfit = _getStatsValue(estimatedProfitKey);

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

const getRequestsStatisticForBackend = (isNeedReset) => {

    const totalBuyPlayerRequestsCount = _getStatsValue(totalBuyPlayerRequestsCountKey);
    const bidPlayerRequestsCount = _getStatsValue(bidPlayerRequestsCountKey);
    const buyPlayerRequestsCount = _getStatsValue(buyPlayerRequestsCountKey);
    const outbidPlayerRequestsCount = _getStatsValue(outbidPlayerRequestsCountKey);
    const searchRequestCount = _getStatsValue(searchRequestsCountKey);
    const listPlayerRequestsCount = _getStatsValue(listPlayerRequestsCountKey);
    const reListPlayerRequestsCount = _getStatsValue(reListPlayerRequestsCountKey);
    const removePlayerRequestsCount = _getStatsValue(removePlayerRequestsCountKey);

    if (
        !totalBuyPlayerRequestsCount &&
        !bidPlayerRequestsCount &&
        !outbidPlayerRequestsCount &&
        !searchRequestCount &&
        !buyPlayerRequestsCount &&
        !listPlayerRequestsCount &&
        !reListPlayerRequestsCount &&
        !removePlayerRequestsCount
    ) {
        return false;
    }

    if (isNeedReset) {
        _resetStatsValue(buyPlayerRequestsCountKey);
        _resetStatsValue(bidPlayerRequestsCountKey);
        _resetStatsValue(outbidPlayerRequestsCountKey);
        _resetStatsValue(searchRequestsCountKey);
        _resetStatsValue(totalBuyPlayerRequestsCountKey);
        _resetStatsValue(listPlayerRequestsCountKey);
        _resetStatsValue(reListPlayerRequestsCountKey);
        _resetStatsValue(removePlayerRequestsCountKey);
    }

    return {
        total_buyplayer_count: totalBuyPlayerRequestsCount,
        bid_count: bidPlayerRequestsCount,
        buy_count: buyPlayerRequestsCount,
        outbid_count: outbidPlayerRequestsCount,
        search_count: searchRequestCount,
        list_player_count: listPlayerRequestsCount,
        relist_player_count: reListPlayerRequestsCount,
        remove_player_count: removePlayerRequestsCount
    }
}

const _getStatsValue = (key, defaultValue = 0) => {
    return (getValue(key) || defaultValue);
}

const _resetStatsValue = (key, newValue = 0) => {
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

const increaseTotalBuyPlayerRequestsCount = () => {
    increAndGetStoreValue(totalBuyPlayerRequestsCountKey)
}

const increaseBidPlayerRequestsCount = () => {
    increAndGetStoreValue(bidPlayerRequestsCountKey)
}
const increaseBuyPlayerRequestsCount = () => {
    increAndGetStoreValue(buyPlayerRequestsCountKey)
}

const increaseOutbidPlayerRequestsCount = () => {
    increAndGetStoreValue(outbidPlayerRequestsCountKey)
}

const increaseSearchRequestCount = () => {
    increAndGetStoreValue(searchRequestsCountKey)
}

const increaseListPlayerRequestCount = () => {
    increAndGetStoreValue(listPlayerRequestsCountKey)
}

const increaseReListPlayerRequestCount = () => {
    increAndGetStoreValue(reListPlayerRequestsCountKey)
}

const increaseRemovePlayerRequestCount = () => {
    increAndGetStoreValue(removePlayerRequestsCountKey)
}

export {
    getSentToTransferListStatsPerSession,
    increaseSentToTransferListCount,
    getTotalLosedTransferListStatsPerSession,
    increaseTotalLosedTransferListCount,
    getSummaryTransferListStats,
    getTradeItemsStatisticForBackend,
    increaseEstimatedProfit,
    increaseTotalBuyPlayerRequestsCount,
    increaseBidPlayerRequestsCount,
    increaseOutbidPlayerRequestsCount,
    increaseSearchRequestCount,
    getRequestsStatisticForBackend,
    increaseBuyPlayerRequestsCount,
    increaseListPlayerRequestCount,
    increaseReListPlayerRequestCount,
    increaseRemovePlayerRequestCount
}